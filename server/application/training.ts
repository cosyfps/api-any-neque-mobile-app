import { Exercise, ExerciseInput } from '@app/domain/routines/model/exercise.model';
import { Routine, RoutineAssignment, RoutineInput } from '@app/domain/routines/model/routine.model';
import { DateRange } from '@app/domain/shared/model/date-range';
import { rescheduleError } from '@app/domain/workouts/model/reschedule-rules';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';

import { fail } from '../domain/api-error';
import { DateWindow, staleSessionWindow } from '../domain/assignment-rules';
import { sessionInstant, zonedParts } from '../domain/zoned-time';
import { Actor } from '../http/context';
import {
  ExerciseRow,
  ROUTINE_SELECT,
  RoutineDayRow,
  RoutineRow,
  WORKOUT_SELECT,
  WorkoutSessionRow,
  dateIn,
  toExercise,
  toRoutine,
  toWorkoutSession,
} from '../infrastructure/mappers';
import { adminClient, maybe, must } from '../infrastructure/supabase';

import { assertCanSeeStudent, assertIsTrainer } from './access';
import { notify } from './notifications';
import { userIdOfStudent } from './people';

const db = () => adminClient();

// ── Catalogo de ejercicios ─────────────────────────────────────────────────
export async function listPublicExercises(): Promise<Exercise[]> {
  const rows = await must<ExerciseRow[]>(
    db()
      .from('exercises')
      .select('*')
      .is('owner_trainer_id', null)
      .is('deleted_at', null)
      .order('name'),
  );
  return rows.map(toExercise);
}

/** Catalogo publico mas los propios. Nunca los de otro entrenador. */
export async function listExercisesForTrainer(
  actor: Actor,
  trainerId: string,
): Promise<Exercise[]> {
  assertIsTrainer(actor, trainerId);
  const rows = await must<ExerciseRow[]>(
    db()
      .from('exercises')
      .select('*')
      .or(`owner_trainer_id.is.null,owner_trainer_id.eq.${trainerId}`)
      .is('deleted_at', null)
      .order('name'),
  );
  return rows.map(toExercise);
}

export async function getExercise(actor: Actor, exerciseId: string): Promise<Exercise> {
  const row = await must<ExerciseRow>(
    db().from('exercises').select('*').eq('id', exerciseId).maybeSingle(),
  );
  // Uno privado lo ve su dueno; el alumno lo ve porque llega por su rutina.
  if (
    row.owner_trainer_id !== null &&
    actor.role === 'trainer' &&
    row.owner_trainer_id !== actor.profileId
  ) {
    return fail('not_found');
  }
  return toExercise(row);
}

export async function createExercise(actor: Actor, input: ExerciseInput): Promise<Exercise> {
  if (actor.role !== 'trainer') {
    return fail('forbidden');
  }
  const row = await must<ExerciseRow>(
    db()
      .from('exercises')
      .insert({
        name: input.name,
        muscle_group: input.muscleGroup,
        equipment: input.equipment,
        thumbnail_url: input.thumbnailUrl,
        instructions: input.instructions,
        // El dueno es quien lo crea, diga lo que diga el cuerpo.
        owner_trainer_id: actor.profileId,
        default_load: input.defaultLoad ?? null,
        default_measure: input.defaultMeasure ?? null,
      })
      .select('*')
      .single(),
  );
  return toExercise(row);
}

/** Solo el dueno toca un ejercicio propio; los del catalogo publico no se editan. */
async function ownedExercise(actor: Actor, exerciseId: string): Promise<ExerciseRow> {
  const row = await maybe<ExerciseRow>(
    db().from('exercises').select('*').eq('id', exerciseId).is('deleted_at', null).maybeSingle(),
  );
  if (row === null || actor.role !== 'trainer' || row.owner_trainer_id !== actor.profileId) {
    return fail('not_found');
  }
  return row;
}

export async function updateExercise(
  actor: Actor,
  exerciseId: string,
  input: ExerciseInput,
): Promise<Exercise> {
  await ownedExercise(actor, exerciseId);
  const row = await must<ExerciseRow>(
    db()
      .from('exercises')
      .update({
        name: input.name,
        muscle_group: input.muscleGroup,
        equipment: input.equipment,
        thumbnail_url: input.thumbnailUrl,
        instructions: input.instructions,
        // El formulario no los envia: si faltan, se conservan los actuales.
        ...(input.defaultLoad === undefined ? {} : { default_load: input.defaultLoad }),
        ...(input.defaultMeasure === undefined ? {} : { default_measure: input.defaultMeasure }),
      })
      .eq('id', exerciseId)
      .select('*')
      .single(),
  );
  // Las rutinas guardan el nombre copiado: se renombra donde sigue en uso.
  // Las sesiones ya entrenadas conservan el nombre con que se hicieron.
  await maybe(
    db()
      .from('routine_exercises')
      .update({ name: input.name })
      .eq('exercise_id', exerciseId)
      .is('deleted_at', null),
  );
  return toExercise(row);
}

/**
 * Baja logica de un ejercicio propio. Si alguna rutina vigente lo usa, se
 * rechaza nombrandola: borrarlo dejaria esa rutina con un ejercicio fantasma.
 */
export async function removeExercise(actor: Actor, exerciseId: string): Promise<void> {
  await ownedExercise(actor, exerciseId);
  const usos = await must<{ routine_day_id: string }[]>(
    db()
      .from('routine_exercises')
      .select('routine_day_id')
      .eq('exercise_id', exerciseId)
      .is('deleted_at', null),
  );
  const dias =
    usos.length === 0
      ? []
      : await must<{ routine_id: string }[]>(
          db()
            .from('routine_days')
            .select('routine_id')
            .in('id', [...new Set(usos.map(uso => uso.routine_day_id))]),
        );
  const vigentes =
    dias.length === 0
      ? []
      : await must<{ name: string }[]>(
          db()
            .from('routines')
            .select('name')
            .in('id', [...new Set(dias.map(dia => dia.routine_id))])
            .is('deleted_at', null),
        );
  const rutinas = [...new Set(vigentes.map(rutina => rutina.name))];
  if (rutinas.length > 0) {
    const lista = rutinas.map(nombre => `«${nombre}»`).join(', ');
    return fail(
      'conflict',
      rutinas.length === 1
        ? `Este ejercicio está en la rutina ${lista}. Quítalo de ella antes de eliminarlo.`
        : `Este ejercicio está en las rutinas ${lista}. Quítalo de ellas antes de eliminarlo.`,
    );
  }
  await maybe(
    db().from('exercises').update({ deleted_at: new Date().toISOString() }).eq('id', exerciseId),
  );
}

// ── Rutinas ────────────────────────────────────────────────────────────────
async function loadRoutine(routineId: string): Promise<Routine> {
  const row = await must<RoutineRow>(
    db()
      .from('routines')
      .select(ROUTINE_SELECT)
      .eq('id', routineId)
      .is('deleted_at', null)
      .maybeSingle(),
  );
  return toRoutine(row);
}

async function ownedRoutine(actor: Actor, routineId: string): Promise<Routine> {
  const routine = await loadRoutine(routineId);
  if (actor.role !== 'trainer' || routine.trainerId !== actor.profileId) {
    return fail('not_found');
  }
  return routine;
}

export async function listRoutines(actor: Actor, trainerId: string): Promise<Routine[]> {
  assertIsTrainer(actor, trainerId);
  const rows = await must<RoutineRow[]>(
    db()
      .from('routines')
      .select(ROUTINE_SELECT)
      .eq('trainer_id', trainerId)
      .is('deleted_at', null)
      .order('created_at'),
  );
  return rows.map(toRoutine);
}

export async function getRoutine(actor: Actor, routineId: string): Promise<Routine> {
  const routine = await loadRoutine(routineId);
  const visible =
    actor.role === 'trainer'
      ? routine.trainerId === actor.profileId
      : routine.assignments.some(item => item.studentId === actor.profileId);
  return visible ? routine : fail('not_found');
}

async function activeAssignment(
  studentId: string,
): Promise<{ routine_id: string; start_date: string; end_date: string | null } | null> {
  return maybe(
    db()
      .from('routine_assignments')
      .select('routine_id, start_date, end_date')
      .eq('student_id', studentId)
      .is('ended_at', null)
      .maybeSingle(),
  );
}

export async function activeRoutineForStudent(
  actor: Actor,
  studentId: string,
): Promise<Routine | null> {
  await assertCanSeeStudent(actor, studentId);
  const assignment = await activeAssignment(studentId);
  if (assignment === null) {
    return null;
  }
  const row = await maybe<RoutineRow>(
    db()
      .from('routines')
      .select(ROUTINE_SELECT)
      .eq('id', assignment.routine_id)
      .is('deleted_at', null)
      .maybeSingle(),
  );
  return row === null ? null : toRoutine(row);
}

export async function saveRoutine(
  actor: Actor,
  routineId: string | null,
  input: Omit<RoutineInput, 'trainerId'>,
): Promise<Routine> {
  if (actor.role !== 'trainer') {
    return fail('forbidden');
  }
  const id = await must<string>(
    db().rpc('save_routine', {
      p_trainer_id: actor.profileId,
      p_routine_id: routineId,
      p_payload: input,
    }),
  );
  if (routineId !== null) {
    await removeOrphanSessions(id);
  }
  return loadRoutine(id);
}

/**
 * Al guardar, la funcion SQL recrea los dias de la rutina y solo borra lo
 * pendiente desde hoy. Las sesiones sin empezar de dias ya reemplazados (por
 * ejemplo, el lunes de la semana en curso) quedaban junto a las que se
 * regeneran para los dias nuevos: el alumno veia el mismo dia dos veces y el
 * progreso semanal contaba de mas. Las completadas o empezadas no se tocan.
 */
async function removeOrphanSessions(routineId: string): Promise<void> {
  const viejos =
    (await maybe<{ id: string }[]>(
      db()
        .from('routine_days')
        .select('id')
        .eq('routine_id', routineId)
        .not('deleted_at', 'is', null),
    )) ?? [];
  if (viejos.length === 0) {
    return;
  }
  const candidatas =
    (await maybe<{ id: string }[]>(
      db()
        .from('workout_sessions')
        .select('id')
        .eq('routine_id', routineId)
        .eq('status', 'scheduled')
        .is('started_at', null)
        .in(
          'routine_day_id',
          viejos.map(dia => dia.id),
        ),
    )) ?? [];
  await deleteUnscheduled(candidatas.map(row => row.id));
}

export async function setAssignments(
  actor: Actor,
  routineId: string,
  assignments: readonly RoutineAssignment[],
): Promise<Routine> {
  const antes = await ownedRoutine(actor, routineId);
  await maybe(
    db().rpc('set_routine_assignments', {
      p_trainer_id: actor.profileId,
      p_routine_id: routineId,
      p_assignments: assignments.map(item => ({
        studentId: item.studentId,
        startDate: dateIn(item.startDate),
        endDate: dateIn(item.endDate),
      })),
    }),
  );
  // La funcion SQL borra lo pendiente desde hoy; esto cubre lo que queda en
  // la semana en curso antes del nuevo inicio (ver `staleSessionWindow`).
  const hoy = new Date().toISOString().slice(0, 10);
  for (const item of assignments) {
    const ventana = staleSessionWindow(hoy, dateIn(item.startDate));
    if (ventana !== null) {
      await removeStaleSessions(item.studentId, ventana);
    }
  }

  const previos = new Set(antes.assignments.map(item => item.studentId));
  for (const item of assignments) {
    if (!previos.has(item.studentId)) {
      await notify(await userIdOfStudent(item.studentId), {
        kind: 'routine',
        title: 'Tienes una rutina nueva',
        body: antes.name,
        targetType: 'routine',
        targetId: routineId,
      });
    }
  }
  return loadRoutine(routineId);
}

/**
 * Borra las sesiones no completadas del alumno dentro de la ventana. Las que
 * una cita de la agenda referencia se dejan: borrarlas romperia la clave
 * foranea de `scheduled_sessions` y con ella todo el guardado.
 */
async function removeStaleSessions(studentId: string, ventana: DateWindow): Promise<void> {
  const candidatas =
    (await maybe<{ id: string }[]>(
      db()
        .from('workout_sessions')
        .select('id')
        .eq('student_id', studentId)
        .neq('status', 'completed')
        .gte('scheduled_date', ventana.from)
        .lt('scheduled_date', ventana.to),
    )) ?? [];
  await deleteUnscheduled(candidatas.map(row => row.id));
}

/** Borra las sesiones que ninguna cita de la agenda referencia. */
async function deleteUnscheduled(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const enAgenda =
    (await maybe<{ workout_session_id: string }[]>(
      db().from('scheduled_sessions').select('workout_session_id').in('workout_session_id', ids),
    )) ?? [];
  const usadas = new Set(enAgenda.map(row => row.workout_session_id));
  const borrables = ids.filter(id => !usadas.has(id));
  if (borrables.length > 0) {
    // Logs y series se van en cascada.
    await maybe(db().from('workout_sessions').delete().in('id', borrables));
  }
}

/** Sale de la biblioteca y libera a sus alumnos. El historial no se toca. */
export async function removeRoutine(actor: Actor, routineId: string): Promise<void> {
  await ownedRoutine(actor, routineId);
  await maybe(
    db().rpc('set_routine_assignments', {
      p_trainer_id: actor.profileId,
      p_routine_id: routineId,
      p_assignments: [],
    }),
  );
  await maybe(
    db().from('routines').update({ deleted_at: new Date().toISOString() }).eq('id', routineId),
  );
}

// ── Sesiones de entrenamiento ──────────────────────────────────────────────
/** Dias hacia atras y hacia adelante que se materializan desde la asignacion. */
const PAST_DAYS = 56;
const FUTURE_DAYS = 14;
const DAY_MS = 86_400_000;

function isoWeekdayUtc(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Crea las sesiones que tocan segun la rutina asignada.
 *
 * Es perezosa e idempotente: se llama antes de leer, y el indice unico
 * (alumno, dia de rutina, fecha) evita duplicados. Copia la prescripcion a
 * cada sesion: editar la rutina despues no reescribe lo ya entrenado.
 */
export async function ensureWorkoutSessions(studentId: string): Promise<void> {
  const assignment = await activeAssignment(studentId);
  if (assignment === null) {
    return;
  }
  const days = await must<RoutineDayRow[]>(
    db()
      .from('routine_days')
      .select('*, routine_exercises(*)')
      .eq('routine_id', assignment.routine_id)
      .is('deleted_at', null),
  );
  if (days.length === 0) {
    return;
  }

  const hoy = Date.parse(new Date().toISOString().slice(0, 10));
  const desde = Math.max(Date.parse(assignment.start_date), hoy - PAST_DAYS * DAY_MS);
  const hasta = Math.min(
    assignment.end_date === null ? Infinity : Date.parse(assignment.end_date),
    hoy + FUTURE_DAYS * DAY_MS,
  );

  const candidatas: Record<string, unknown>[] = [];
  for (let t = desde; t <= hasta; t += DAY_MS) {
    const fecha = new Date(t);
    const day = days.find(item => item.weekday === isoWeekdayUtc(fecha));
    if (day === undefined) {
      continue;
    }
    const scheduledDate = fecha.toISOString().slice(0, 10);
    candidatas.push({
      student_id: studentId,
      routine_id: assignment.routine_id,
      routine_day_id: day.id,
      title: day.title,
      scheduled_date: scheduledDate,
      // A la hora del dia en Chile; sin hora, mediodia UTC (mismo dia).
      scheduled_for: sessionInstant(scheduledDate, day.start_time?.slice(0, 5)),
      estimated_minutes: day.estimated_minutes,
    });
  }
  if (candidatas.length === 0) {
    return;
  }

  const nuevas = await must<{ id: string; routine_day_id: string }[]>(
    db()
      .from('workout_sessions')
      .upsert(candidatas, {
        onConflict: 'student_id,routine_day_id,scheduled_date',
        ignoreDuplicates: true,
      })
      .select('id, routine_day_id'),
  );

  const logs = nuevas.flatMap(session => {
    const day = days.find(item => item.id === session.routine_day_id);
    return (day?.routine_exercises ?? [])
      .filter(exercise => exercise.deleted_at === null)
      .map(exercise => ({
        workout_session_id: session.id,
        routine_exercise_id: exercise.id,
        exercise_id: exercise.exercise_id,
        position: exercise.position,
        name: exercise.name,
        target_sets: exercise.sets,
        target_reps: exercise.reps,
        rest_seconds: exercise.rest_seconds,
        weight_kg: exercise.weight_kg,
        load: exercise.load,
        measure: exercise.measure,
        duration_seconds: exercise.duration_seconds,
      }));
  });
  if (logs.length > 0) {
    await maybe(db().from('workout_exercise_logs').insert(logs));
  }
}

export async function listWorkouts(
  actor: Actor,
  studentId: string,
  range: DateRange | null,
): Promise<WorkoutSession[]> {
  await assertCanSeeStudent(actor, studentId);
  await ensureWorkoutSessions(studentId);
  let query = db().from('workout_sessions').select(WORKOUT_SELECT).eq('student_id', studentId);
  if (range !== null) {
    query = query.gte('scheduled_for', range.from).lte('scheduled_for', range.to);
  }
  const rows = await must<WorkoutSessionRow[]>(query.order('scheduled_for'));
  return rows.map(toWorkoutSession);
}

export async function loadWorkout(sessionId: string): Promise<WorkoutSession> {
  const row = await must<WorkoutSessionRow>(
    db().from('workout_sessions').select(WORKOUT_SELECT).eq('id', sessionId).maybeSingle(),
  );
  return toWorkoutSession(row);
}

/**
 * El alumno mueve un entrenamiento a otro dia de su semana (A-3).
 *
 * Solo cambia `scheduled_for` (lo que la app muestra). `scheduled_date`
 * conserva el dia original: es la clave del indice unico con que se generan
 * las sesiones, y asi el dia que quedo libre no se vuelve a llenar. La hora
 * del dia se mantiene.
 */
export async function rescheduleWorkout(
  actor: Actor,
  sessionId: string,
  newDay: string,
): Promise<WorkoutSession> {
  if (actor.role !== 'student') {
    return fail('forbidden');
  }
  const actual = await getWorkout(actor, sessionId);
  const fila = await must<{ scheduled_date: string }>(
    db().from('workout_sessions').select('scheduled_date').eq('id', sessionId).single(),
  );
  const ahora = zonedParts(actual.scheduledFor);
  const error = rescheduleError(
    actual,
    fila.scheduled_date,
    ahora.day,
    newDay,
    zonedParts(new Date().toISOString()).day,
  );
  if (error !== null) {
    return fail('validation', error);
  }
  await maybe(
    db()
      .from('workout_sessions')
      .update({ scheduled_for: sessionInstant(newDay, ahora.time) })
      .eq('id', sessionId),
  );
  return loadWorkout(sessionId);
}

export async function getWorkout(actor: Actor, sessionId: string): Promise<WorkoutSession> {
  const session = await loadWorkout(sessionId);
  if (actor.role === 'student' && session.studentId !== actor.profileId) {
    return fail('not_found');
  }
  if (actor.role === 'trainer') {
    await assertCanSeeStudent(actor, session.studentId);
  }
  return session;
}

/**
 * Aplica una mutacion del alumno sobre su sesion y la guarda en una
 * transaccion. Devuelve la sesion tal como quedo en la base.
 */
export async function mutateWorkout(
  actor: Actor,
  sessionId: string,
  change: (session: WorkoutSession, now: string) => WorkoutSession,
  note: string | null = null,
): Promise<WorkoutSession> {
  const actual = await loadWorkout(sessionId);
  if (actor.role !== 'student' || actual.studentId !== actor.profileId) {
    return fail('not_found');
  }
  const siguiente = change(actual, new Date().toISOString());
  await maybe(db().rpc('save_workout_session', { p_session: siguiente, p_note: note }));
  return loadWorkout(sessionId);
}
