import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, Provider, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, catchError, throwError, timeout } from 'rxjs';

import { DomainError, DomainErrorCode, domainError } from '@app/domain/shared/model/app-error';

/** Base de la API: `/api/v1` en web (mismo origen), absoluta en nativo. */
export const API_BASE_URL = new InjectionToken<string>('ApiBaseUrl');

/**
 * En la app nativa el origen es `capacitor://localhost`, que no tiene API:
 * ahi se usa la direccion publica. En web, la ruta relativa sirve igual en
 * local (proxy de `ng serve`), en Preview y en produccion.
 */
export function resolveApiBaseUrl(publicAppUrl: string, isNative: boolean): string {
  return isNative ? `${publicAppUrl.replace(/\/+$/, '')}/api/v1` : '/api/v1';
}

export function provideApiBaseUrl(publicAppUrl: string): Provider {
  return {
    provide: API_BASE_URL,
    useFactory: () => resolveApiBaseUrl(publicAppUrl, Capacitor.isNativePlatform()),
  };
}

const REQUEST_TIMEOUT_MS = 15_000;

const CODES: readonly DomainErrorCode[] = [
  'not_found',
  'unauthorized',
  'forbidden',
  'invalid_credentials',
  'too_many_attempts',
  'invalid_invitation',
  'conflict',
  'validation',
  'network',
  'unknown',
];

interface ErrorBody {
  readonly error?: { readonly code?: string; readonly message?: string };
}

/** Traduce cualquier fallo HTTP al error de dominio que ya entienden las facades. */
export function toDomainError(cause: unknown): DomainError {
  if (cause instanceof DomainError) {
    return cause;
  }
  if (cause instanceof HttpErrorResponse) {
    if (cause.status === 0) {
      return domainError('network');
    }
    const body = cause.error as ErrorBody | null;
    const code = CODES.find(item => item === body?.error?.code);
    return domainError(
      code ?? (cause.status === 401 ? 'unauthorized' : 'unknown'),
      body?.error?.message,
    );
  }
  if (cause instanceof Error && cause.name === 'TimeoutError') {
    return domainError('network');
  }
  return domainError('unknown');
}

/**
 * Cliente del BFF. Todos los adapters HTTP pasan por aqui para que el
 * timeout y la traduccion de errores sean una sola regla.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    return this.wrap(
      this.http.get<T>(this.url(path), {
        params: params === undefined ? undefined : new HttpParams({ fromObject: params }),
      }),
    );
  }

  post<T>(path: string, body: unknown = {}): Observable<T> {
    return this.wrap(this.http.post<T>(this.url(path), body));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.wrap(this.http.put<T>(this.url(path), body));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.wrap(this.http.patch<T>(this.url(path), body));
  }

  delete<T>(path: string): Observable<T> {
    return this.wrap(this.http.delete<T>(this.url(path)));
  }

  private url(path: string): string {
    return `${this.base}${path}`;
  }

  private wrap<T>(request: Observable<T>): Observable<T> {
    return request.pipe(
      timeout(REQUEST_TIMEOUT_MS),
      catchError((cause: unknown) => throwError(() => toDomainError(cause))),
    );
  }
}
