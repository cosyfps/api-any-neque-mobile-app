import { Id, IsoDateString } from '@app/domain/shared/model/ids';

/** Los dos roles que la app reconoce. Ñeque es invitation-only: no hay registro abierto. */
export type UserRole = 'trainer' | 'student';

/**
 * Identidad del usuario autenticado.
 *
 * `profileId` apunta al Trainer o al Student segun el rol. Viaja en la sesion
 * a proposito: evita que cada feature necesite un `getByUserId` propio.
 */
export interface AuthUser {
  readonly id: Id;
  readonly email: string;
  readonly role: UserRole;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly profileId: Id;
}

/** Sesion activa: identidad mas el token que la respalda. */
export interface AuthSession {
  readonly user: AuthUser;
  readonly token: string;
  readonly expiresAt: IsoDateString;
}

/**
 * Comprobante de que el codigo de un solo uso ya fue verificado.
 *
 * Existe para que el OTP NO equivalga a la contrasena: verificarlo solo
 * habilita a establecer una nueva, no abre sesion. El token es de un solo uso
 * y lo invalida el backend al consumirlo.
 */
export interface PasswordResetTicket {
  readonly email: string;
  readonly token: string;
}

/** Credenciales de ingreso. */
export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** Ruta inicial de cada rol tras autenticarse. */
export function homeRouteForRole(role: UserRole): string {
  return role === 'trainer' ? '/trainer/home' : '/student/home';
}

/** Por que se cerro la sesion sin que el usuario la cerrara. */
export type SessionEndReason = 'session_replaced';

/**
 * Clave de `sessionStorage` con el motivo del ultimo cierre forzado. La
 * escribe el interceptor HTTP antes de recargar y la lee (y borra) el login.
 */
export const SESSION_END_KEY = 'neque.session-end';
