import { Id } from '@app/domain/shared/model/ids';
import {
  WorkoutCompletion,
  WorkoutExerciseLog,
  WorkoutSession,
  isResolved,
  withDerivedStatus,
} from '@app/domain/workouts/model/workout-session.model';
import {
  SkipReason,
  WorkoutSet,
  WorkoutSetInput,
} from '@app/domain/workouts/model/workout-set.model';

/**
 * Reglas de mutacion de una sesion de entrenamiento.
 *
 * Son funciones puras: reciben la sesion completa y devuelven la nueva. El
 * repositorio la persiste en una transaccion. Toda mutacion termina en
 * `withDerivedStatus`, la misma regla de estado que usa el front.
 */

export function startSession(session: WorkoutSession, now: string): WorkoutSession {
  return derive({ ...session, status: 'in_progress', startedAt: session.startedAt ?? now }, now);
}

export function markExercise(
  session: WorkoutSession,
  routineExerciseId: Id,
  done: boolean,
  now: string,
): WorkoutSession {
  return derive(
    {
      ...session,
      exercises: session.exercises.map(exercise =>
        exercise.routineExerciseId === routineExerciseId
          ? {
              ...exercise,
              done,
              // Marcar a mano un ejercicio saltado lo da por hecho.
              skipped: false,
              skipReason: null,
              completedSets: done ? exercise.targetSets : 0,
              // Desmarcar borra lo registrado: no queda serie huerfana.
              sets: done ? exercise.sets.filter(item => item.skipped !== true) : [],
            }
          : exercise,
      ),
    },
    now,
  );
}

export function logSet(
  session: WorkoutSession,
  routineExerciseId: Id,
  input: WorkoutSetInput,
  now: string,
): WorkoutSession {
  return derive(
    {
      ...session,
      exercises: session.exercises.map(exercise =>
        exercise.routineExerciseId === routineExerciseId ? withSet(exercise, input, now) : exercise,
      ),
    },
    now,
  );
}

/** Salta las series que le quedan al ejercicio. */
export function skipExercise(
  session: WorkoutSession,
  routineExerciseId: Id,
  reason: SkipReason | null,
  now: string,
): WorkoutSession {
  return derive(
    {
      ...session,
      exercises: session.exercises.map(exercise => {
        if (exercise.routineExerciseId !== routineExerciseId) {
          return exercise;
        }
        const registradas = new Set(exercise.sets.map(item => item.setNumber));
        let actualizado = exercise;
        for (let numero = 1; numero <= exercise.targetSets; numero++) {
          if (!registradas.has(numero)) {
            actualizado = withSet(
              actualizado,
              { setNumber: numero, reps: null, weightKg: null, skipped: true, skipReason: reason },
              now,
            );
          }
        }
        return actualizado;
      }),
    },
    now,
  );
}

export function completeSession(
  session: WorkoutSession,
  completion: WorkoutCompletion,
  now: string,
): WorkoutSession {
  return derive(
    {
      ...session,
      status: 'completed',
      completedAt: now,
      durationMinutes: completion.durationMinutes,
      exercises: session.exercises.map(exercise =>
        isResolved(exercise)
          ? exercise
          : { ...exercise, done: true, completedSets: exercise.targetSets },
      ),
    },
    now,
  );
}

function derive(session: WorkoutSession, now: string): WorkoutSession {
  return withDerivedStatus(session, now);
}

function withSet(
  exercise: WorkoutExerciseLog,
  input: WorkoutSetInput,
  now: string,
): WorkoutExerciseLog {
  const setNumber = Math.max(1, Math.min(input.setNumber, exercise.targetSets));
  const saltada = input.skipped === true;
  const registrada: WorkoutSet = {
    // El id real lo pone la base al guardar.
    id: '',
    setNumber,
    reps: saltada ? null : input.reps,
    weightKg: saltada ? null : input.weightKg,
    durationSeconds: saltada ? null : (input.durationSeconds ?? null),
    skipped: saltada,
    skipReason: saltada ? (input.skipReason ?? null) : null,
    completedAt: now,
  };
  const sets = [...exercise.sets.filter(item => item.setNumber !== setNumber), registrada].sort(
    (a, b) => a.setNumber - b.setNumber,
  );
  const hechas = sets.filter(item => item.skipped !== true).length;
  const completas = sets.length >= exercise.targetSets;
  const ultimoSalto = [...sets].reverse().find(item => item.skipped === true);

  return {
    ...exercise,
    sets,
    completedSets: hechas,
    // Con todas registradas: hecho si se hizo al menos una, saltado si ninguna.
    done: completas && hechas > 0,
    skipped: completas && hechas === 0,
    skipReason: completas && hechas === 0 ? (ultimoSalto?.skipReason ?? null) : null,
  };
}
