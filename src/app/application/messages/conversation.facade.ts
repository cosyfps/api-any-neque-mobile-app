import { Injectable, Signal, inject, signal } from '@angular/core';

import { Message } from '@app/domain/messages/model/message.model';
import { MESSAGES_PORT } from '@app/domain/messages/port/messages.port';
import { DomainError, toDomainError } from '@app/domain/shared/model/app-error';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/**
 * Conversacion de un alumno con su entrenador (A-4). La usan las dos
 * pantallas de mensajes: la del alumno y la que abre el entrenador desde la
 * ficha. El alumno de la conversacion se fija en `load`.
 */
@Injectable()
export class ConversationFacade {
  private readonly port = inject(MESSAGES_PORT);

  private readonly _studentId = signal<string | null>(null);
  private readonly _sending = signal(false);
  private readonly _sendError = signal<DomainError | null>(null);

  // Una conversacion vacia es un estado valido: se muestra la invitacion a escribir.
  readonly messages: AsyncState<Message[]> = asyncState<Message[]>({ isEmpty: () => false });

  readonly viewState: Signal<ViewState> = this.messages.viewState;
  readonly sending: Signal<boolean> = this._sending.asReadonly();
  readonly sendError: Signal<DomainError | null> = this._sendError.asReadonly();

  load(studentId: string): void {
    this._studentId.set(studentId);
    this.messages.load(() => this.port.list(studentId));
  }

  reload(): void {
    this.messages.reload();
  }

  /**
   * Trae mensajes nuevos sin pasar por "cargando": la pantalla la llama cada
   * tanto mientras esta abierta. Un fallo aqui no tapa lo que ya se ve.
   */
  refresh(): void {
    const studentId = this._studentId();
    if (studentId === null || this._sending()) {
      return;
    }
    this.port.list(studentId).subscribe({
      next: lista => this.messages.set(lista),
      error: () => undefined,
    });
  }

  /** Envia el texto; lo agrega al final sin releer la conversacion. */
  send(body: string): Promise<boolean> {
    const studentId = this._studentId();
    if (studentId === null || this._sending()) {
      return Promise.resolve(false);
    }
    this._sending.set(true);
    this._sendError.set(null);

    return new Promise(resolve => {
      this.port.send(studentId, body).subscribe({
        next: mensaje => {
          this.messages.set([...(this.messages.data() ?? []), mensaje]);
          this._sending.set(false);
          resolve(true);
        },
        error: (cause: unknown) => {
          this._sendError.set(toDomainError(cause));
          this._sending.set(false);
          resolve(false);
        },
      });
    });
  }
}
