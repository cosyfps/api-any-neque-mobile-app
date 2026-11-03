import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { AuthSession, Credentials, PasswordResetTicket } from '../model/auth-user.model';

/**
 * Operaciones de autenticacion.
 *
 * Todo devuelve Observable para que el adapter HTTP del BFF encaje sin
 * cambiar ninguna firma.
 */
export interface AuthPort {
  login(credentials: Credentials): Observable<AuthSession>;
  signOut(): Observable<void>;
  requestPasswordReset(email: string): Observable<void>;
  /** Verificar el codigo NO abre sesion: entrega el permiso para cambiarla. */
  verifyOtp(email: string, code: string): Observable<PasswordResetTicket>;
  resetPassword(ticket: PasswordResetTicket, newPassword: string): Observable<AuthSession>;
  /**
   * Cambia la contrasena desde el perfil, con la sesion abierta. Pide la
   * actual: un telefono desbloqueado en manos ajenas no basta para cambiarla.
   * Falla con `invalid_credentials` si la actual no coincide.
   */
  changePassword(email: string, currentPassword: string, newPassword: string): Observable<void>;
}

export const AUTH_PORT = new InjectionToken<AuthPort>('AuthPort');
