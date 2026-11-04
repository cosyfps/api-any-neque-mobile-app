import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Id } from '@app/domain/shared/model/ids';

import { Message } from '../model/message.model';

/**
 * Conversacion de un alumno con su entrenador. La ve el propio alumno y su
 * entrenador; el BFF decide quien escribe a partir del token.
 */
export interface MessagesPort {
  /** Ultimos mensajes, del mas antiguo al mas nuevo. Marca como leidos los de la otra parte. */
  list(studentId: Id): Observable<Message[]>;
  send(studentId: Id, body: string): Observable<Message>;
}

export const MESSAGES_PORT = new InjectionToken<MessagesPort>('MessagesPort');
