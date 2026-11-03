import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  AuthSession,
  Credentials,
  PasswordResetTicket,
} from '@app/domain/auth/model/auth-user.model';
import { AuthPort } from '@app/domain/auth/port/auth.port';
import { InvitationDetails, InvitationPort } from '@app/domain/auth/port/invitation.port';
import { Id } from '@app/domain/shared/model/ids';

import { ApiClient } from '../http/api-client';

const toVoid = map((): void => undefined);

/**
 * Autenticacion contra el BFF. La sesion que vuelve trae ademas el refresh
 * token; se persiste con ella y la usa solo el interceptor.
 */
@Injectable()
export class AuthHttpAdapter implements AuthPort {
  private readonly api = inject(ApiClient);

  login(credentials: Credentials): Observable<AuthSession> {
    return this.api.post<AuthSession>('/auth/login', credentials);
  }

  signOut(): Observable<void> {
    return this.api.post<null>('/auth/logout').pipe(toVoid);
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.api.post<null>('/auth/password-reset', { email }).pipe(toVoid);
  }

  verifyOtp(email: string, code: string): Observable<PasswordResetTicket> {
    return this.api.post<PasswordResetTicket>('/auth/password-reset/verify', { email, code });
  }

  resetPassword(ticket: PasswordResetTicket, newPassword: string): Observable<AuthSession> {
    return this.api.post<AuthSession>('/auth/password-reset/complete', { ticket, newPassword });
  }

  /** El correo lo toma el BFF del token: no se envia. */
  changePassword(_email: string, currentPassword: string, newPassword: string): Observable<void> {
    return this.api
      .post<null>('/auth/password/change', { currentPassword, newPassword })
      .pipe(toVoid);
  }
}

@Injectable()
export class InvitationHttpAdapter implements InvitationPort {
  private readonly api = inject(ApiClient);

  resolve(token: string): Observable<InvitationDetails> {
    return this.api.get<InvitationDetails>(`/invitations/${encodeURIComponent(token)}`);
  }

  accept(token: string, password: string): Observable<AuthSession> {
    return this.api.post<AuthSession>(`/invitations/${encodeURIComponent(token)}/accept`, {
      password,
    });
  }

  getForStudent(studentId: Id): Observable<InvitationDetails | null> {
    return this.api.get<InvitationDetails | null>(`/students/${studentId}/invitation`);
  }

  create(studentId: Id): Observable<InvitationDetails> {
    return this.api.post<InvitationDetails>(`/students/${studentId}/invitation`);
  }

  revoke(token: string): Observable<void> {
    return this.api.post<null>(`/invitations/${encodeURIComponent(token)}/revoke`).pipe(toVoid);
  }
}
