import { ExerciseLoad, ExerciseMeasure } from '@app/domain/routines/model/prescription';
import { Id, IsoDateString } from '@app/domain/shared/model/ids';

import { SkipReason, WorkoutSet } from './workout-set.model';

export type WorkoutStatus = 'scheduled' | 'in_progress' | 'completed' | 'skipped';

/** Etiquetas en espanol de cada estado. */
export const WORKOUT_STATUS_LABEL: Record<WorkoutStatus, string> = {
  scheduled: 'Programado',
  in_progress: 'En curso',
  completed: 'Completado',
  skipped: 'Omitido',
};

/** Avance del alumno en un ejercicio dentro de una sesion. */
export interface WorkoutExerciseLog {
  readonly routineExerciseId: Id;
  readonly exerciseId: Id;
  readonly name: string;
  readonly targetSets: number;
  readonly targetReps: number;
  readonly restSeconds: number;
  /** Carga prescrita. Lo que el alumno levanto va en `sets`. */
  readonly weightKg: number | null;
  readonly completedSets: number;
  /** Hecho: todas sus series registradas y al menos una realizada. */
  readonly done: boolean;
  /** Series ejecutadas, en orden de registro. */
  readonly sets: readonly WorkoutSet[];
  readonly load?: ExerciseLoad;
  readonly measure?: ExerciseMeasure;
  /** Segundos prescritos por serie cuando se mide por tiempo. */
  readonly durationSeconds?: number | null;
  /** Saltado entero: ninguna serie se hizo. */
  readonly skipped?: boolean;
  readonly skipReason?: SkipReason | null;
}

/** Una sesion de entrenamiento agendada o ya realizada. */
export interface WorkoutSession {
  readonly id: Id;
  readonly studentId: Id;
  readonly routineId: Id;
  readonly routineDayId: Id;
  readonly title: string;
  readonly scheduledFor: IsoDateString;
  readonly startedAt: IsoDateString | null;
  readonly completedAt: IsoDateString | null;
  readonly status: WorkoutStatus;
  readonly durationMinutes: number | null;
  readonly estimatedMinutes: number;
  readonly exercises: readonly WorkoutExerciseLog[];
}

/** Datos con los que se cierra una sesion. */
export interface WorkoutCompletion {
  readonly durationMinutes: number;
  readonly note: string | null;
}

/** Resuelto: hecho o saltado. Es lo que cuenta para cerrar la sesion. */
export function isResolved(exercise: WorkoutExerciseLog): boolean {
  return exercise.done || exercise.skipped === true;
}

/** Fraccion resuelta de la sesion, entre 0 y 1. Lo saltado tambien avanza. */
export function sessionProgress(session: WorkoutSession): number {
  if (session.exercises.length === 0) {
    return 0;
  }
  const resolved = session.exercises.filter(isResolved).length;
  return resolved / session.exercises.length;
}

/** Ejercicios saltados enteros. */
export function skippedExercises(session: WorkoutSession): number {
  return session.exercises.filter(exercise => exercise.skipped === true).length;
}

/**
 * El estado que corresponde al avance, no el que quedo guardado.
 *
 * Completada si y solo si todos sus ejercicios estan resueltos. Antes el
 * estado se escribia una vez y no se recalculaba: al desmarcar ejercicios la
 * sesion seguia "completada" con 0%.
 */
export function withDerivedStatus(session: WorkoutSession, now: IsoDateString): WorkoutSession {
  const all = session.exercises.length > 0 && session.exercises.every(isResolved);
  if (all) {
    return session.status === 'completed'
      ? session
      : { ...session, status: 'completed', completedAt: session.completedAt ?? now };
  }
  if (session.status === 'completed') {
    return { ...session, status: 'in_progress', completedAt: null, durationMinutes: null };
  }
  const touched = session.exercises.some(
    exercise => isResolved(exercise) || exercise.sets.length > 0,
  );
  return touched && session.status !== 'in_progress'
    ? { ...session, status: 'in_progress' }
    : session;
}

/** Total de series prescritas en la sesion. */
export function totalTargetSets(session: WorkoutSession): number {
  return session.exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
}

/** Total de series que el alumno marco como hechas. */
export function totalCompletedSets(session: WorkoutSession): number {
  return session.exercises.reduce((sum, exercise) => sum + exercise.completedSets, 0);
}
