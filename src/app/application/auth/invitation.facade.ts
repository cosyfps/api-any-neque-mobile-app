import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { INVITATION_PORT, InvitationDetails } from '@app/domain/auth/port/invitation.port';
import { toDomainError } from '@app/domain/shared/model/app-error';

import { AsyncState, asyncState } from '../shared/async-state';

import { SessionFacade } from './session.facade';

/** Flujo de `/invite/:token`: resolver la invitacion y fijar la contrasena. */
@Injectable()
export class InvitationFacade {
  private readonly port = inject(INVITATION_PORT);
  private readonly session = inject(SessionFacade);

  private readonly _submitting = signal(false);
  private readonly _submitError = signal<string | null>(null);

  readonly invitation: AsyncState<InvitationDetails> = asyncState<InvitationDetails>();
  readonly submitting: Signal<boolean> = this._submitting.asReadonly();
  readonly submitError: Signal<string | null> = this._submitError.asReadonly();

  readonly viewState = this.invitation.viewState;
  readonly studentName: Signal<string> = computed(() => this.invitation.data()?.studentName ?? '');
  readonly trainerName: Signal<string> = computed(() => this.invitation.data()?.trainerName ?? '');
  readonly errorMessage: Signal<string | null> = computed(
    () => this.invitation.error()?.message ?? null,
  );

  /**
   * True si el backend rechazo el enlace (vencido, usado o inexistente).
   * Un fallo de red o del servicio no dice nada del enlace: se puede
   * reintentar.
   */
  readonly linkRejected: Signal<boolean> = computed(() => {
    const code = this.invitation.error()?.code;
    return code === 'invalid_invitation' || code === 'not_found' || code === 'validation';
  });

  private token = '';

  /** Carga la invitacion del token de la URL. */
  load(token: string): void {
    this.token = token;
    this.invitation.load(() => this.port.resolve(token));
  }

  /** Reintenta la lectura. Es lo que la pagina pasa a `[retry]`. */
  reload(): void {
    this.invitation.reload();
  }

  /**
   * Fija la contrasena, adopta la sesion resultante y devuelve la ruta
   * del home del alumno. Devuelve null si la operacion fallo.
   */
  accept(password: string): Promise<string | null> {
    if (this._submitting()) {
      return Promise.resolve(null);
    }

    this._submitting.set(true);
    this._submitError.set(null);

    return new Promise(resolve => {
      this.port.accept(this.token, password).subscribe({
        next: session => {
          this._submitting.set(false);
          resolve(this.session.adopt(session));
        },
        error: (cause: unknown) => {
          this._submitting.set(false);
          this._submitError.set(toDomainError(cause).message);
          resolve(null);
        },
      });
    });
  }

  /** Descarta el error de envio, por ejemplo al editar el formulario. */
  clearSubmitError(): void {
    this._submitError.set(null);
  }
}
