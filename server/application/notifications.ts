import {
  AppNotification,
  NotificationKind,
  NotificationTarget,
} from '@app/domain/notifications/model/notification.model';
import { addDays, startOfDay } from '@app/domain/shared/model/date';
import { riskLabel, studentRisk } from '@app/domain/workouts/model/risk';

import { fail } from '../domain/api-error';
import { Actor } from '../http/context';
import {
  NotificationRow,
  WORKOUT_SELECT,
  WorkoutSessionRow,
  toNotification,
  toWorkoutSession,
} from '../infrastructure/mappers';
import { adminClient, maybe, must } from '../infrastructure/supabase';

interface NewNotification {
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  readonly targetType: NotificationTarget | null;
  readonly targetId: string | null;
  /** Si se repite la clave, la notificacion no se duplica. */
  readonly dedupeKey?: string;
}

const db = () => adminClient();

/** Registra una notificacion. Nunca hace fallar la operacion que la origina. */
export async function notify(userId: string, item: NewNotification): Promise<void> {
  await notifyMany([{ userId, ...item }]);
}

async function notifyMany(items: readonly (NewNotification & { userId: string })[]): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const { error } = await db()
    .from('notifications')
    .upsert(
      items.map(item => ({
        user_id: item.userId,
        kind: item.kind,
        title: item.title,
        body: item.body,
        target_type: item.targetType,
        target_id: item.targetId,
        dedupe_key: item.dedupeKey ?? null,
      })),
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );
  if (error !== null) {
    console.error(JSON.stringify({ level: 'error', notify: error.code, message: error.message }));
  }
}

const DIAS = 14;

/**
 * Alertas del entrenador que salen de lo que hacen sus alumnos: sesion
 * completada, ejercicio saltado por dolor y alumno en riesgo. Se generan al
 * leer la bandeja, con una clave estable para no repetirlas.
 */
async function syncTrainerAlerts(actor: Actor): Promise<void> {
  const students = await must<{ id: string; first_name: string }[]>(
    db()
      .from('students')
      .select('id, first_name')
      .eq('trainer_id', actor.profileId)
      .eq('status', 'active'),
  );
  if (students.length === 0) {
    return;
  }
  const ahora = new Date();
  const desde = addDays(startOfDay(ahora), -DIAS).toISOString();
  const rows = await must<WorkoutSessionRow[]>(
    db()
      .from('workout_sessions')
      .select(WORKOUT_SELECT)
      .in(
        'student_id',
        students.map(item => item.id),
      )
      .gte('scheduled_for', addDays(ahora, -60).toISOString()),
  );

  const eventos: (NewNotification & { userId: string })[] = [];
  for (const student of students) {
    const sesiones = rows.filter(row => row.student_id === student.id).map(toWorkoutSession);
    const destino = { targetType: 'student' as const, targetId: student.id, userId: actor.userId };
    for (const sesion of sesiones) {
      const cuando = sesion.completedAt ?? sesion.scheduledFor;
      if (cuando < desde) {
        continue;
      }
      if (sesion.status === 'completed') {
        eventos.push({
          ...destino,
          kind: 'session',
          title: `${student.first_name} completó su sesión`,
          body: `${sesion.title} · ${sesion.durationMinutes ?? sesion.estimatedMinutes} min`,
          dedupeKey: `done:${sesion.id}`,
        });
      }
      for (const ejercicio of sesion.exercises) {
        if (ejercicio.skipped === true && ejercicio.skipReason === 'pain') {
          eventos.push({
            ...destino,
            kind: 'alert',
            title: `${student.first_name} saltó un ejercicio`,
            body: `${ejercicio.name} · Molestia o dolor`,
            dedupeKey: `pain:${sesion.id}:${ejercicio.routineExerciseId}`,
          });
        }
      }
    }
    const riesgo = studentRisk(sesiones, ahora);
    if (riesgo !== null) {
      eventos.push({
        ...destino,
        kind: 'alert',
        title: `${student.first_name} está en riesgo`,
        body: riskLabel(riesgo),
        // Una por dia: si sigue en riesgo manana, es un aviso nuevo.
        dedupeKey: `risk:${student.id}:${ahora.toISOString().slice(0, 10)}`,
      });
    }
  }
  await notifyMany(eventos);
}

export async function listNotifications(actor: Actor): Promise<AppNotification[]> {
  if (actor.role === 'trainer') {
    await syncTrainerAlerts(actor);
  }
  const rows = await must<NotificationRow[]>(
    db()
      .from('notifications')
      .select('*')
      .eq('user_id', actor.userId)
      .order('created_at', { ascending: false })
      .limit(100),
  );
  return rows.map(toNotification);
}

export async function markRead(actor: Actor, notificationId: string): Promise<AppNotification> {
  const actual = await maybe<NotificationRow>(
    db()
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('user_id', actor.userId)
      .maybeSingle(),
  );
  if (actual === null) {
    return fail('not_found');
  }
  if (actual.read_at !== null) {
    return toNotification(actual);
  }
  const row = await must<NotificationRow>(
    db()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select('*')
      .single(),
  );
  return toNotification(row);
}

export async function markAllRead(actor: Actor): Promise<void> {
  await maybe(
    db()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', actor.userId)
      .is('read_at', null),
  );
}
