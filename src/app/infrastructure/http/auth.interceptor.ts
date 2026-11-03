import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

import { AuthSession } from '@app/domain/auth/model/auth-user.model';
import {
  SESSION_STORAGE_PORT,
  SessionStoragePort,
} from '@app/domain/auth/port/session-storage.port';

import { API_BASE_URL } from './api-client';

/** La sesion que entrega el BFF trae ademas el refresh token. */
export type StoredSession = AuthSession & { readonly refreshToken?: string };

/** Rutas que no llevan token ni disparan refresh: son las que lo obtienen. */
const PUBLIC_PATHS = ['/auth/login', '/auth/refresh', '/auth/password-reset', '/invitations/'];

let refreshing: Observable<StoredSession> | null = null;

/** Recarga la app en el inicio: el guard ve que no hay sesion y muestra el login. */
export let onSessionExpired = (): void => {
  window.location.assign('/');
};

/** Solo para tests. */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

function withToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Agrega el access token y, si vencio, lo renueva una sola vez aunque haya
 * varias peticiones en vuelo. Si el refresh tambien falla, la sesion se
 * cierra.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  const storage = inject(SESSION_STORAGE_PORT);

  if (!req.url.startsWith(base)) {
    return next(req);
  }
  const path = req.url.slice(base.length);
  if (PUBLIC_PATHS.some(prefix => path.startsWith(prefix)) && !path.endsWith('/revoke')) {
    return next(req);
  }

  const session = storage.read() as StoredSession | null;
  const send = session === null ? req : withToken(req, session.token);

  return next(send).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || session === null) {
        return throwError(() => error);
      }
      return refreshAndRetry(req, next, storage, base, session);
    }),
  );
};

function refreshAndRetry(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  storage: SessionStoragePort,
  base: string,
  session: StoredSession,
) {
  if (session.refreshToken === undefined) {
    return expire(storage, req);
  }
  if (refreshing === null) {
    refreshing = next(
      new HttpRequest<{ refreshToken: string }>('POST', `${base}/auth/refresh`, {
        refreshToken: session.refreshToken,
      }),
    ).pipe(
      // `next` emite eventos; solo interesa la respuesta final.
      switchMap(event =>
        'body' in event && event.body !== null ? [event.body as StoredSession] : [],
      ),
      shareReplay(1),
      finalize(() => (refreshing = null)),
    );
  }
  return refreshing.pipe(
    switchMap(renewed => {
      storage.write(renewed);
      return next(withToken(req, renewed.token));
    }),
    catchError(() => expire(storage, req)),
  );
}

function expire(storage: SessionStoragePort, req: HttpRequest<unknown>) {
  storage.clear();
  onSessionExpired();
  return throwError(
    () =>
      new HttpErrorResponse({
        status: 401,
        url: req.url,
        error: { error: { code: 'unauthorized' } },
      }),
  );
}
