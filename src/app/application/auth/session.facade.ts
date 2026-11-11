import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import {
  AuthSession,
  AuthUser,
  Credentials,
  UserRole,
  homeRouteForRole,
} from '@app/domain/auth/model/auth-user.model';
import { AUTH_PORT } from '@app/domain/auth/port/auth.port';
import { SESSION_STORAGE_PORT } from '@app/domain/auth/port/session-storage.port';
import { DomainError, toDomainError } from '@app/domain/shared/model/app-error';
import { parseIsoDate } from '@app/domain/shared/model/date';

/** Estado del formulario de ingreso. */
export type LoginStatus = 'idle' | 'submitting' | 'error';

/**
 * Sesion del usuario autenticado.
 *
 * Es la unica facade que otras facades pueden inyectar: les entrega el
 * `profileId` sin que cada feature necesite resolverlo por su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class SessionFacade {
  private readonly auth = inject(AUTH_PORT);
  private readonly storage = inject(SESSION_STORAGE_PORT);

  private readonly _session = signal<AuthSession | null>(null);
  private readonly _status = signal<LoginStatus>('idle');
  private readonly _error = signal<DomainError | null>(null);

  readonly session: Signal<AuthSession | null> = this._session.asReadonly();
  readonly status: Signal<LoginStatus> = this._status.asReadonly();
  readonly loginError: Signal<DomainError | null> = this._error.asReadonly();

  readonly user: Signal<AuthUser | null> = computed(() => this._session()?.user ?? null);
  readonly role: Signal<UserRole | null> = computed(() => this.user()?.role ?? null);
  readonly profileId: Signal<string | null> = computed(() => this.user()?.profileId ?? null);
  readonly displayName: Signal<string> = computed(() => this.user()?.displayName ?? '');
  readonly isAuthenticated: Signal<boolean> = computed(() => this._session() !== null);
  readonly isSubmitting: Signal<boolean> = computed(() => this._status() === 'submitting');

  /**
   * Rehidrata la sesion persistida. La llama el guard antes de resolver
   * cualquier ruta protegida, por eso es sincrona.
   *
   * Un access token vencido NO cierra la sesion: el refresh token sigue
   * valido y el interceptor lo renueva en el primer 401. Antes se borraba
   * todo al reabrir la app pasada la hora de vida del token.
   */
  restore(): void {
    if (this._session() !== null) {
      return;
    }
    const stored = this.storage.read();
    if (stored === null) {
      return;
    }
    if (parseIsoDate(stored.expiresAt) === null) {
      this.storage.clear();
      return;
    }
    this._session.set(stored);
  }

  /** Autentica y persiste. Resuelve con la ruta inicial del rol, o null si fallo. */
  login(credentials: Credentials): Promise<string | null> {
    this._status.set('submitting');
    this._error.set(null);

    return new Promise(resolve => {
      this.auth.login(credentials).subscribe({
        next: session => {
          this._session.set(session);
          this.storage.write(session);
          this._status.set('idle');
          resolve(homeRouteForRole(session.user.role));
        },
        error: (cause: unknown) => {
          this._error.set(toDomainError(cause));
          this._status.set('error');
          resolve(null);
        },
      });
    });
  }

  /** Publica una sesion ya obtenida por otro flujo, como la invitacion o el OTP. */
  adopt(session: AuthSession): string {
    this._session.set(session);
    this.storage.write(session);
    this._status.set('idle');
    this._error.set(null);
    return homeRouteForRole(session.user.role);
  }

  /** Cierra sesion. Limpia el estado local aunque el backend falle. */
  signOut(): Promise<void> {
    return new Promise(resolve => {
      this.auth.signOut().subscribe({
        next: () => {
          this.clearLocal();
          resolve();
        },
        error: () => {
          this.clearLocal();
          resolve();
        },
      });
    });
  }

  /** Descarta el error de ingreso, por ejemplo al editar el formulario. */
  clearError(): void {
    this._error.set(null);
    if (this._status() === 'error') {
      this._status.set('idle');
    }
  }

  private clearLocal(): void {
    this._session.set(null);
    this._error.set(null);
    this._status.set('idle');
    this.storage.clear();
  }
}
