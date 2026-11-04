import { measureOf } from '@app/domain/routines/model/prescription';

import { WorkoutExerciseLog, WorkoutSession } from './workout-session.model';
import { SKIP_REASON_LABEL, WorkoutSet } from './workout-set.model';

/**
 * Una serie registrada en texto corto para el entrenador: "8 × 60 kg",
 * "45 s", "Saltada · Máquina ocupada". Sin reps corregidas, vale lo prescrito.
 */
export function describeSet(set: WorkoutSet, exercise: WorkoutExerciseLog): string {
  if (set.skipped === true) {
    return set.skipReason ? `Saltada · ${SKIP_REASON_LABEL[set.skipReason]}` : 'Saltada';
  }
  if (measureOf(exercise) === 'time') {
    const segundos = set.durationSeconds ?? exercise.durationSeconds ?? null;
    return segundos === null ? 'Hecha' : `${segundos} s`;
  }
  const reps = set.reps ?? exercise.targetReps;
  return set.weightKg === null ? `${reps} reps` : `${reps} × ${set.weightKg} kg`;
}

/**
 * Sesiones con algo registrado, de la mas reciente a la mas antigua: las
 * completadas y las que el alumno dejo a medias. Las solo agendadas no son
 * historial.
 */
export function trainedSessions(sessions: readonly WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter(
      sesion =>
        sesion.status === 'completed' ||
        sesion.exercises.some(ejercicio => ejercicio.sets.length > 0 || ejercicio.done),
    )
    .sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)));
}

function fechaDe(sesion: WorkoutSession): string {
  return sesion.completedAt ?? sesion.startedAt ?? sesion.scheduledFor;
}
