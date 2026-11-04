import { Id, IsoDateString } from '@app/domain/shared/model/ids';

/** Quien escribio el mensaje. */
export type MessageSender = 'trainer' | 'student';

/** Un mensaje de la conversacion entre un alumno y su entrenador. */
export interface Message {
  readonly id: Id;
  readonly studentId: Id;
  readonly senderRole: MessageSender;
  readonly body: string;
  readonly createdAt: IsoDateString;
  /** Cuando lo leyo la otra parte; null si todavia no. */
  readonly readAt: IsoDateString | null;
}

/** Largo maximo de un mensaje (limite de la base y del BFF). */
export const MESSAGE_MAX_LENGTH = 1000;

/** Mensaje para el usuario si el texto no se puede enviar, o null. */
export function messageError(body: string): string | null {
  const texto = body.trim();
  if (texto === '') {
    return 'Escribe un mensaje.';
  }
  return texto.length > MESSAGE_MAX_LENGTH
    ? `El mensaje puede tener hasta ${MESSAGE_MAX_LENGTH} caracteres.`
    : null;
}

/** Mensajes de la otra parte que todavia no se leen. */
export function unreadFrom(messages: readonly Message[], me: MessageSender): number {
  return messages.filter(message => message.senderRole !== me && message.readAt === null).length;
}
