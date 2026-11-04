import { Message } from '@app/domain/messages/model/message.model';

import { fail } from '../domain/api-error';
import { Actor } from '../http/context';
import { MessageRow, toMessage } from '../infrastructure/mappers';
import { adminClient, maybe, must } from '../infrastructure/supabase';

import { assertCanSeeStudent } from './access';
import { notify } from './notifications';

const db = () => adminClient();

/** Cuantos mensajes trae la conversacion: los ultimos. */
const LIMITE = 200;

/**
 * Conversacion de un alumno con su entrenador (A-4). Al leerla se marcan como
 * leidos los mensajes de la otra parte.
 */
export async function listMessages(actor: Actor, studentId: string): Promise<Message[]> {
  await assertCanSeeStudent(actor, studentId);
  const filas = await must<MessageRow[]>(
    db()
      .from('messages')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(LIMITE),
  );
  const otra = actor.role === 'student' ? 'trainer' : 'student';
  const sinLeer = filas.filter(fila => fila.sender_role === otra && fila.read_at === null);
  if (sinLeer.length > 0) {
    await maybe(
      db()
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in(
          'id',
          sinLeer.map(fila => fila.id),
        ),
    );
  }
  return filas.reverse().map(toMessage);
}

/** Envia un mensaje y avisa a la otra parte. */
export async function sendMessage(actor: Actor, studentId: string, body: string): Promise<Message> {
  await assertCanSeeStudent(actor, studentId);
  if (actor.role !== 'student' && actor.role !== 'trainer') {
    return fail('forbidden');
  }
  const alumno = await must<{ trainer_id: string; user_id: string }>(
    db().from('students').select('trainer_id, user_id').eq('id', studentId).single(),
  );
  const fila = await must<MessageRow>(
    db()
      .from('messages')
      .insert({
        student_id: studentId,
        trainer_id: alumno.trainer_id,
        sender_role: actor.role,
        body: body.trim(),
      })
      .select('*')
      .single(),
  );

  const destino =
    actor.role === 'student'
      ? (
          await must<{ user_id: string }>(
            db().from('trainers').select('user_id').eq('id', alumno.trainer_id).single(),
          )
        ).user_id
      : alumno.user_id;
  const vista = body.trim();
  await notify(destino, {
    kind: 'message',
    title: `Mensaje de ${actor.displayName}`,
    body: vista.length > 80 ? `${vista.slice(0, 77)}...` : vista,
    targetType: 'message',
    targetId: studentId,
  });
  return toMessage(fila);
}
