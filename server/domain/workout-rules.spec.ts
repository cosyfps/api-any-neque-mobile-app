import { DomainErrorCode } from '@app/domain/shared/model/app-error';
import {
  WorkoutExerciseLog,
  WorkoutSession,
} from '@app/domain/workouts/model/workout-session.model';

import { ApiError, fromDbError } from './api-error';
import { completeSession, logSet, markExercise, skipExercise, startSession } from './workout-rules';

const NOW = '2026-11-02T15:00:00.000Z';

const log = (id: string, targetSets: number): WorkoutExerciseLog => ({
  routineExerciseId: id,
  exerciseId: `ex-${id}`,
  name: `Ejercicio ${id}`,
  targetSets,
  targetReps: 10,
  restSeconds: 60,
  weightKg: 40,
  completedSets: 0,
  done: false,
  sets: [],
});

const session = (exercises: WorkoutExerciseLog[]): WorkoutSession => ({
  id: 'w1',
  studentId: 's1',
  routineId: 'r1',
  routineDayId: 'd1',
  title: 'Pierna',
  scheduledFor: '2026-11-02T12:00:00.000Z',
  startedAt: null,
  completedAt: null,
  status: 'scheduled',
  durationMinutes: null,
  estimatedMinutes: 45,
  exercises,
});

describe('workout-rules', () => {
  it('startSession pasa a en curso y conserva la hora de inicio', () => {
    const started = startSession(session([log('a', 2)]), NOW);
    expect(started.status).toBe('in_progress');
    expect(started.startedAt).toBe(NOW);
    expect(startSession({ ...started, startedAt: 'antes' }, NOW).startedAt).toBe('antes');
  });

  it('logSet registra la carga real y cierra el ejercicio con todas sus series', () => {
    let current = session([log('a', 2), log('b', 1)]);
    current = logSet(current, 'a', { setNumber: 1, reps: 10, weightKg: 62.5 }, NOW);
    expect(current.exercises[0]?.completedSets).toBe(1);
    expect(current.exercises[0]?.done).toBe(false);
    expect(current.status).toBe('in_progress');

    current = logSet(current, 'a', { setNumber: 2, reps: 8, weightKg: 62.5 }, NOW);
    expect(current.exercises[0]?.done).toBe(true);
    expect(current.exercises[0]?.sets.map(set => set.weightKg)).toEqual([62.5, 62.5]);
  });

  it('logSet reemplaza una serie repetida en vez de duplicarla', () => {
    let current = logSet(
      session([log('a', 3)]),
      'a',
      { setNumber: 1, reps: 10, weightKg: 40 },
      NOW,
    );
    current = logSet(current, 'a', { setNumber: 1, reps: 12, weightKg: 45 }, NOW);
    expect(current.exercises[0]?.sets).toHaveLength(1);
    expect(current.exercises[0]?.sets[0]?.reps).toBe(12);
  });

  it('skipExercise salta las series que faltan con su motivo', () => {
    const current = skipExercise(session([log('a', 3), log('b', 1)]), 'a', 'pain', NOW);
    const exercise = current.exercises[0];
    expect(exercise?.skipped).toBe(true);
    expect(exercise?.skipReason).toBe('pain');
    expect(exercise?.sets.every(set => set.skipped === true)).toBe(true);
  });

  it('markExercise false borra lo registrado y reabre la sesion', () => {
    const done = markExercise(session([log('a', 2)]), 'a', true, NOW);
    expect(done.status).toBe('completed');
    const undone = markExercise(done, 'a', false, NOW);
    expect(undone.exercises[0]?.sets).toEqual([]);
    expect(undone.status).toBe('in_progress');
  });

  it('completeSession da por hechos los pendientes y guarda la duracion', () => {
    const completed = completeSession(
      session([log('a', 2)]),
      { durationMinutes: 40, note: null },
      NOW,
    );
    expect(completed.status).toBe('completed');
    expect(completed.durationMinutes).toBe(40);
    expect(completed.exercises[0]?.done).toBe(true);
  });
});

describe('api-error', () => {
  it.each<[string, DomainErrorCode, number]>([
    ['23505', 'conflict', 409],
    ['P0002', 'not_found', 404],
    ['PGRST116', 'not_found', 404],
    ['23514', 'validation', 400],
    ['XX000', 'unknown', 500],
  ])('%s → %s', (code, expected, status) => {
    const error: ApiError = fromDbError({ code });
    expect(error.code).toBe(expected);
    expect(error.status).toBe(status);
  });
});
