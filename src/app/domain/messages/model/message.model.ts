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

/** Mensajes seguidos de la misma persona dentro de este lapso forman un grupo. */
export const MESSAGE_GROUP_MS = 30 * 60_000;

/**
 * True si el mensaje cierra su grupo y por lo tanto lleva la hora debajo.
 * Un grupo son mensajes seguidos de la misma persona, el mismo dia, con menos
 * de 30 minutos entre uno y el siguiente. Asi una rafaga de mensajes muestra
 * una sola hora, y un mensaje aislado (o separado por mas de 30 min) la suya.
 */
export function endsGroup(messages: readonly Message[], index: number): boolean {
  const actual = messages[index];
  const siguiente = messages[index + 1];
  if (actual === undefined) {
    return false;
  }
  if (siguiente === undefined || siguiente.senderRole !== actual.senderRole) {
    return true;
  }
  const a = new Date(actual.createdAt);
  const b = new Date(siguiente.createdAt);
  return a.toDateString() !== b.toDateString() || b.getTime() - a.getTime() > MESSAGE_GROUP_MS;
}
