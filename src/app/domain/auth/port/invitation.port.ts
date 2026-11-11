import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Id, IsoDateString } from '@app/domain/shared/model/ids';

import { AuthSession } from '../model/auth-user.model';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/**
 * Vigencia de una invitacion, en horas.
 *
 * Vive en dominio y no en el adapter para que el contador que ve el
 * entrenador y el vencimiento que aplica el backend salgan del mismo numero.
 */
export const INVITATION_TTL_HOURS = 48;

/**
 * Invitacion emitida por un entrenador para que un alumno cree su acceso.
 *
 * El entrenador nunca conoce ni define la contrasena: solo comparte el enlace.
 */
export interface InvitationDetails {
  readonly token: string;
  readonly studentId: Id;
  readonly studentName: string;
  readonly email: string;
  readonly trainerName: string;
  readonly expiresAt: IsoDateString;
  readonly status: InvitationStatus;
  /**
   * Solo al emitirla: si el correo con el enlace salio. Ausente cuando el
   * envio no esta configurado o la invitacion solo se consulta.
   */
  readonly emailSent?: boolean;
}

export interface InvitationPort {
  /** Resuelve los datos de la invitacion. Falla si el token no sirve. */
  resolve(token: string): Observable<InvitationDetails>;
  /** Fija la contrasena del alumno y devuelve su sesion ya iniciada. */
  accept(token: string, password: string): Observable<AuthSession>;

  /** Invitacion vigente del alumno, si la tiene. */
  getForStudent(studentId: Id): Observable<InvitationDetails | null>;
  /** Emite una invitacion nueva e invalida la anterior del mismo alumno. */
  create(studentId: Id): Observable<InvitationDetails>;
  /** Deja al alumno sin invitacion activa, sin emitir otra. */
  revoke(token: string): Observable<void>;
}

export const INVITATION_PORT = new InjectionToken<InvitationPort>('InvitationPort');
