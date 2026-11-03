import { fail } from '../domain/api-error';
import { Actor } from '../http/context';
import { adminClient, maybe } from '../infrastructure/supabase';

/*
 * Reglas de propiedad. El BFF usa la clave secreta, asi que esta es la
 * barrera real entre entrenadores: un recurso ajeno responde 404, igual que
 * uno inexistente, para no revelar que existe.
 */

/** El alumno pertenece a la cartera del entrenador autenticado. */
export async function assertTrainerOf(actor: Actor, studentId: string): Promise<void> {
  if (actor.role !== 'trainer') {
    fail('not_found');
  }
  const row = await maybe<{ id: string }>(
    adminClient()
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('trainer_id', actor.profileId)
      .maybeSingle(),
  );
  if (row === null) {
    fail('not_found');
  }
}

/** El propio alumno, o su entrenador. */
export async function assertCanSeeStudent(actor: Actor, studentId: string): Promise<void> {
  if (actor.role === 'student') {
    if (actor.profileId !== studentId) {
      fail('not_found');
    }
    return;
  }
  await assertTrainerOf(actor, studentId);
}

/** Solo el propio alumno. */
export function assertIsStudent(actor: Actor, studentId: string): void {
  if (actor.role !== 'student' || actor.profileId !== studentId) {
    fail('not_found');
  }
}

/** Solo el propio entrenador. */
export function assertIsTrainer(actor: Actor, trainerId: string): void {
  if (actor.role !== 'trainer' || actor.profileId !== trainerId) {
    fail('not_found');
  }
}
