import {
  Routine,
  RoutineDay,
  assignmentFor,
  dayForWeekday,
  goalsMatch,
  isAssigned,
  routineCopy,
  totalSets,
} from './routine.model';

const day = (weekday: 1 | 2 | 4, sets: number[]): RoutineDay => ({
  id: `day-${weekday}`,
  weekday,
  title: 'Sesión',
  focus: 'legs',
  estimatedMinutes: 50,
  exercises: sets.map((count, index) => ({
    id: `rex-${weekday}-${index}`,
    exerciseId: 'ex-1',
    name: 'Ejercicio',
    order: index + 1,
    sets: count,
    reps: 10,
    restSeconds: 60,
    weightKg: null,
    notes: null,
  })),
});

const routine: Routine = {
  id: 'rtn-001',
  trainerId: 'trn-001',
  name: 'Hipertrofia',
  goal: 'Masa muscular',
  assignments: [{ studentId: 'std-001', startDate: '2026-09-01T00:00:00.000Z', endDate: null }],
  days: [day(1, [4, 3, 3]), day(2, [4, 4]), day(4, [3])],
};

describe('routineCopy()', () => {
  it('copia dias y ejercicios sin ids ni alumnos, con "(copia)" en el nombre', () => {
    const copia = routineCopy(routine);

    expect(copia.name).toBe('Hipertrofia (copia)');
    expect(copia.goal).toBe('Masa muscular');
    expect(copia).not.toHaveProperty('assignments');
    expect(copia.days).toHaveLength(3);
    expect(copia.days[0]).not.toHaveProperty('id');
    expect(copia.days[0]?.exercises[0]).not.toHaveProperty('id');
    expect(copia.days[0]?.exercises[0]).toMatchObject({ sets: 4, reps: 10, durationSeconds: null });
    expect(copia.days[0]?.startTime).toBeNull();
  });

  it('no se pasa del largo maximo del nombre', () => {
    const copia = routineCopy({ ...routine, name: 'x'.repeat(120) });

    expect(copia.name).toHaveLength(120);
    expect(copia.name.endsWith(' (copia)')).toBe(true);
  });
});

describe('routine model', () => {
  describe('totalSets()', () => {
    it('suma las series del dia', () => {
      expect(totalSets(day(1, [4, 3, 3]))).toBe(10);
    });

    it('devuelve cero sin ejercicios', () => {
      expect(totalSets(day(1, []))).toBe(0);
    });
  });

  describe('dayForWeekday()', () => {
    it('encuentra el dia programado', () => {
      expect(dayForWeekday(routine, 2)?.id).toBe('day-2');
    });

    it('devuelve null en un dia sin entrenamiento', () => {
      expect(dayForWeekday(routine, 3)).toBeNull();
    });

    it('devuelve null en una rutina sin dias', () => {
      expect(dayForWeekday({ ...routine, days: [] }, 1)).toBeNull();
    });
  });

  describe('assignmentFor() e isAssigned()', () => {
    it('encuentra la asignacion del alumno', () => {
      expect(assignmentFor(routine, 'std-001')?.startDate).toBe('2026-09-01T00:00:00.000Z');
    });

    it('devuelve null para un alumno que no la hace', () => {
      expect(assignmentFor(routine, 'std-999')).toBeNull();
    });

    it('una rutina sin alumnos no esta asignada', () => {
      expect(isAssigned(routine)).toBe(true);
      expect(isAssigned({ ...routine, assignments: [] })).toBe(false);
    });
  });

  describe('goalsMatch()', () => {
    it('coincide si comparten una palabra con contenido', () => {
      expect(goalsMatch('Ganar masa muscular y mejorar postura', 'Ganar masa')).toBe(true);
    });

    it('ignora tildes y mayusculas', () => {
      expect(goalsMatch('Bajar GRASA abdominal', 'perder grasa')).toBe(true);
      expect(goalsMatch('Mejorar resistencia aerobica', 'resistencia aeróbica')).toBe(true);
    });

    // "Ganar" lo trae casi todo objetivo y no dice hacia donde va.
    it('no coincide solo por el verbo', () => {
      expect(goalsMatch('Ganar masa', 'Ganar resistencia')).toBe(false);
    });

    it('sin objetivo no coincide con nada', () => {
      expect(goalsMatch(null, 'Ganar masa')).toBe(false);
      expect(goalsMatch('Ganar masa', null)).toBe(false);
    });
  });
});
