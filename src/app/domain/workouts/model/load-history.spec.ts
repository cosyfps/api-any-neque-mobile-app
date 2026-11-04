import { ExerciseLoadHistory, loadDelta, loadHistory } from './load-history';
import { WorkoutExerciseLog, WorkoutSession } from './workout-session.model';
import { WorkoutSet } from './workout-set.model';

const serie = (kg: number | null, reps: number | null = 8, skipped = false): WorkoutSet => ({
  id: `s-${kg}-${reps}`,
  setNumber: 1,
  reps,
  weightKg: kg,
  completedAt: '2026-11-01T12:00:00.000Z',
  skipped,
});

const ejercicio = (id: string, sets: WorkoutSet[]): WorkoutExerciseLog => ({
  routineExerciseId: `rex-${id}`,
  exerciseId: id,
  name: id === 'sentadilla' ? 'Sentadilla' : 'Press banca',
  targetSets: 3,
  targetReps: 10,
  restSeconds: 90,
  weightKg: null,
  completedSets: sets.length,
  done: true,
  sets,
});

const sesion = (id: string, fecha: string, exercises: WorkoutExerciseLog[]): WorkoutSession => ({
  id,
  studentId: 'std-1',
  routineId: 'rtn-1',
  routineDayId: 'day-1',
  title: 'Pierna',
  scheduledFor: fecha,
  startedAt: null,
  completedAt: fecha,
  status: 'completed',
  durationMinutes: 50,
  estimatedMinutes: 50,
  exercises,
});

describe('loadHistory()', () => {
  const sesiones = [
    sesion('s2', '2026-11-03T21:00:00.000Z', [
      ejercicio('sentadilla', [serie(60), serie(65, 6), serie(70, null, true)]),
    ]),
    sesion('s1', '2026-10-27T21:00:00.000Z', [
      ejercicio('sentadilla', [serie(55)]),
      ejercicio('banca', [serie(40), serie(null)]),
    ]),
  ];

  it('toma la serie con mas carga de cada sesion, sin las saltadas', () => {
    const sentadilla = loadHistory(sesiones).find(item => item.exerciseId === 'sentadilla');

    expect(sentadilla?.points.map(punto => [punto.sessionId, punto.maxKg, punto.reps])).toEqual([
      ['s1', 55, 8],
      ['s2', 65, 6],
    ]);
  });

  it('ordena los ejercicios del entrenado mas recientemente al mas antiguo', () => {
    expect(loadHistory(sesiones).map(item => item.exerciseId)).toEqual(['sentadilla', 'banca']);
  });

  it('sin series con peso no hay historial', () => {
    const sinPeso = [sesion('s1', '2026-10-27T21:00:00.000Z', [ejercicio('banca', [serie(null)])])];

    expect(loadHistory(sinPeso)).toEqual([]);
  });

  it('sin reps corregidas usa las prescritas', () => {
    const lista = loadHistory([
      sesion('s1', '2026-10-27T21:00:00.000Z', [ejercicio('banca', [serie(40, null)])]),
    ]);

    expect(lista[0]?.points[0]?.reps).toBe(10);
  });
});

describe('loadDelta()', () => {
  const historia = (kgs: number[]): ExerciseLoadHistory => ({
    exerciseId: 'x',
    name: 'X',
    points: kgs.map((kg, i) => ({
      sessionId: `s${i}`,
      date: `2026-10-0${i + 1}`,
      maxKg: kg,
      reps: 8,
    })),
  });

  it('resta la primera carga de la ultima', () => {
    expect(loadDelta(historia([55, 60, 62.5]))).toBe(7.5);
    expect(loadDelta(historia([60, 57.5]))).toBe(-2.5);
  });

  it('con un solo punto no hay diferencia', () => {
    expect(loadDelta(historia([60]))).toBeNull();
  });
});
