import {
  WORKOUT_STATUS_LABEL,
  WorkoutExerciseLog,
  WorkoutSession,
  isResolved,
  sessionProgress,
  skippedExercises,
  totalCompletedSets,
  totalTargetSets,
  withDerivedStatus,
} from './workout-session.model';

const log = (overrides: Partial<WorkoutExerciseLog> = {}): WorkoutExerciseLog => ({
  routineExerciseId: 'rex-1',
  exerciseId: 'ex-1',
  name: 'Sentadilla',
  targetSets: 4,
  targetReps: 8,
  restSeconds: 90,
  weightKg: 40,
  completedSets: 0,
  done: false,
  sets: [],
  ...overrides,
});

const session = (exercises: WorkoutExerciseLog[]): WorkoutSession => ({
  id: 'wks-001',
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-001',
  title: 'Tren inferior',
  scheduledFor: '2026-09-17T18:00:00.000Z',
  startedAt: null,
  completedAt: null,
  status: 'scheduled',
  durationMinutes: null,
  estimatedMinutes: 55,
  exercises,
});

const AHORA = '2026-09-17T19:00:00.000Z';

describe('workout-session model', () => {
  describe('isResolved()', () => {
    it.each([
      [{ done: true }, true],
      [{ skipped: true }, true],
      [{}, false],
    ])('%o → %s', (overrides, esperado) => {
      expect(isResolved(log(overrides))).toBe(esperado);
    });
  });

  describe('skippedExercises()', () => {
    it('cuenta solo los saltados enteros', () => {
      expect(skippedExercises(session([log({ skipped: true }), log({ done: true }), log()]))).toBe(
        1,
      );
    });
  });

  describe('withDerivedStatus()', () => {
    it('completa la sesion cuando todo esta hecho o saltado', () => {
      const result = withDerivedStatus(
        session([log({ done: true }), log({ skipped: true })]),
        AHORA,
      );

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBe(AHORA);
    });

    // El bug: "Sesion completada" con 0% al desmarcar.
    it('reabre una sesion completada si un ejercicio deja de estar resuelto', () => {
      const cerrada: WorkoutSession = {
        ...session([log({ done: true }), log()]),
        status: 'completed',
        completedAt: AHORA,
        durationMinutes: 40,
      };

      const result = withDerivedStatus(cerrada, AHORA);

      expect(result.status).toBe('in_progress');
      expect(result.completedAt).toBeNull();
      expect(result.durationMinutes).toBeNull();
    });

    it('pasa a en curso cuando se empieza a registrar', () => {
      expect(withDerivedStatus(session([log({ done: true }), log()]), AHORA).status).toBe(
        'in_progress',
      );
    });

    it('deja programada una sesion intacta', () => {
      expect(withDerivedStatus(session([log()]), AHORA).status).toBe('scheduled');
    });

    it('conserva la fecha de cierre original', () => {
      const cerrada: WorkoutSession = {
        ...session([log({ done: true })]),
        status: 'completed',
        completedAt: '2026-09-17T18:45:00.000Z',
      };

      expect(withDerivedStatus(cerrada, AHORA).completedAt).toBe('2026-09-17T18:45:00.000Z');
    });

    it('una sesion sin ejercicios no se completa sola', () => {
      expect(withDerivedStatus(session([]), AHORA).status).toBe('scheduled');
    });
  });

  describe('sessionProgress()', () => {
    it('devuelve cero sin ejercicios', () => {
      expect(sessionProgress(session([]))).toBe(0);
    });

    it('devuelve cero sin nada marcado', () => {
      expect(sessionProgress(session([log(), log()]))).toBe(0);
    });

    it('lo saltado tambien cuenta como avance', () => {
      expect(sessionProgress(session([log({ skipped: true }), log()]))).toBe(0.5);
    });

    it('devuelve la mitad con uno de dos marcados', () => {
      expect(sessionProgress(session([log({ done: true }), log()]))).toBe(0.5);
    });

    it('devuelve uno con todo marcado', () => {
      expect(sessionProgress(session([log({ done: true }), log({ done: true })]))).toBe(1);
    });
  });

  describe('totalTargetSets()', () => {
    it('suma las series prescritas', () => {
      expect(totalTargetSets(session([log({ targetSets: 4 }), log({ targetSets: 3 })]))).toBe(7);
    });

    it('devuelve cero sin ejercicios', () => {
      expect(totalTargetSets(session([]))).toBe(0);
    });
  });

  describe('totalCompletedSets()', () => {
    it('suma las series hechas', () => {
      expect(
        totalCompletedSets(session([log({ completedSets: 4 }), log({ completedSets: 1 })])),
      ).toBe(5);
    });
  });

  it('cada estado tiene etiqueta en espanol', () => {
    expect(WORKOUT_STATUS_LABEL.completed).toBe('Completado');
    expect(Object.keys(WORKOUT_STATUS_LABEL)).toHaveLength(4);
  });
});
