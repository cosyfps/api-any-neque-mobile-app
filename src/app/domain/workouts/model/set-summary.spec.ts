import { describeSet, trainedSessions } from './set-summary';
import { WorkoutExerciseLog, WorkoutSession } from './workout-session.model';
import { WorkoutSet } from './workout-set.model';

const ejercicio = (overrides: Partial<WorkoutExerciseLog> = {}): WorkoutExerciseLog => ({
  routineExerciseId: 'rex-1',
  exerciseId: 'ex-1',
  name: 'Sentadilla',
  targetSets: 3,
  targetReps: 8,
  restSeconds: 90,
  weightKg: 60,
  completedSets: 0,
  done: false,
  sets: [],
  ...overrides,
});

const serie = (overrides: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 'set-1',
  setNumber: 1,
  reps: 8,
  weightKg: 60,
  completedAt: '2026-11-03T12:00:00.000Z',
  ...overrides,
});

const sesion = (id: string, overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id,
  studentId: 'std-1',
  routineId: 'rtn-1',
  routineDayId: 'day-1',
  title: 'Pierna',
  scheduledFor: '2026-11-03T12:00:00.000Z',
  startedAt: null,
  completedAt: null,
  status: 'scheduled',
  durationMinutes: null,
  estimatedMinutes: 55,
  exercises: [],
  ...overrides,
});

describe('describeSet()', () => {
  it('reps por peso', () => {
    expect(describeSet(serie(), ejercicio())).toBe('8 × 60 kg');
  });

  it('sin reps corregidas usa las prescritas', () => {
    expect(describeSet(serie({ reps: null, weightKg: 70 }), ejercicio())).toBe('8 × 70 kg');
  });

  it('sin peso solo las reps', () => {
    expect(describeSet(serie({ reps: 12, weightKg: null }), ejercicio())).toBe('12 reps');
  });

  it('por tiempo muestra los segundos de la serie o los prescritos', () => {
    const plancha = ejercicio({ measure: 'time', durationSeconds: 30 });

    expect(describeSet(serie({ durationSeconds: 45 }), plancha)).toBe('45 s');
    expect(describeSet(serie({ durationSeconds: null }), plancha)).toBe('30 s');
    expect(describeSet(serie(), ejercicio({ measure: 'time' }))).toBe('Hecha');
  });

  it('una serie saltada dice el motivo si lo hay', () => {
    expect(describeSet(serie({ skipped: true, skipReason: 'pain' }), ejercicio())).toBe(
      'Saltada · Molestia o dolor',
    );
    expect(describeSet(serie({ skipped: true }), ejercicio())).toBe('Saltada');
  });
});

describe('trainedSessions()', () => {
  it('deja solo lo entrenado, de lo mas reciente a lo mas antiguo', () => {
    const lista = trainedSessions([
      sesion('agendada'),
      sesion('vieja', { status: 'completed', completedAt: '2026-11-01T20:00:00.000Z' }),
      sesion('nueva', { status: 'completed', completedAt: '2026-11-03T20:00:00.000Z' }),
      sesion('a-medias', {
        status: 'in_progress',
        startedAt: '2026-11-02T20:00:00.000Z',
        exercises: [ejercicio({ sets: [serie()] })],
      }),
      sesion('marcada', {
        scheduledFor: '2026-10-30T12:00:00.000Z',
        exercises: [ejercicio({ done: true })],
      }),
    ]);

    expect(lista.map(item => item.id)).toEqual(['nueva', 'a-medias', 'vieja', 'marcada']);
  });
});
