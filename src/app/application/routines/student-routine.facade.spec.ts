import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { Routine } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT, RoutinesPort } from '@app/domain/routines/port/routines.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { toIsoDate } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { StudentRoutineFacade } from './student-routine.facade';

// Jueves 17 de septiembre de 2026.
const NOW = new Date(2026, 8, 17, 10, 0, 0);

const ROUTINE: Routine = {
  id: 'rtn-001',
  trainerId: 'trn-001',
  name: 'Hipertrofia',
  goal: 'Masa muscular',
  assignments: [{ studentId: 'std-001', startDate: '2026-09-01T00:00:00.000Z', endDate: null }],
  days: [
    {
      id: 'day-001',
      weekday: 1,
      title: 'Tren inferior',
      focus: 'legs',
      estimatedMinutes: 55,
      exercises: [
        {
          id: 'rex-001',
          exerciseId: 'ex-001',
          name: 'Sentadilla',
          order: 1,
          sets: 4,
          reps: 8,
          restSeconds: 90,
          weightKg: 40,
          notes: null,
        },
      ],
    },
    {
      id: 'day-004',
      weekday: 4,
      title: 'Tracción',
      focus: 'back',
      estimatedMinutes: 50,
      exercises: [
        {
          id: 'rex-009',
          exerciseId: 'ex-007',
          name: 'Dominadas',
          order: 1,
          sets: 4,
          reps: 8,
          restSeconds: 90,
          weightKg: null,
          notes: null,
        },
        {
          id: 'rex-010',
          exerciseId: 'ex-008',
          name: 'Remo',
          order: 2,
          sets: 3,
          reps: 10,
          restSeconds: 75,
          weightKg: 25,
          notes: null,
        },
      ],
    },
  ],
};

const todaySession = (done: boolean[]): WorkoutSession => ({
  id: 'wks-today',
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-004',
  title: 'Tracción',
  scheduledFor: toIsoDate(new Date(2026, 8, 17, 18)),
  startedAt: null,
  completedAt: null,
  status: 'scheduled',
  durationMinutes: null,
  estimatedMinutes: 50,
  exercises: [
    {
      routineExerciseId: 'rex-009',
      exerciseId: 'ex-007',
      name: 'Dominadas',
      targetSets: 4,
      targetReps: 8,
      restSeconds: 90,
      weightKg: null,
      completedSets: done[0] === true ? 4 : 0,
      done: done[0] === true,
      sets: [],
    },
    {
      routineExerciseId: 'rex-010',
      exerciseId: 'ex-008',
      name: 'Remo',
      targetSets: 3,
      targetReps: 10,
      restSeconds: 75,
      weightKg: 25,
      completedSets: done[1] === true ? 3 : 0,
      done: done[1] === true,
      sets: [],
    },
  ],
});

describe('StudentRoutineFacade', () => {
  let getActiveForStudent: MockOf<RoutinesPort['getActiveForStudent']>;
  let listByStudent: MockOf<WorkoutsPort['listByStudent']>;
  let markExercise: MockOf<WorkoutsPort['markExercise']>;
  let complete: MockOf<WorkoutsPort['complete']>;
  let profileId: string | null;

  const build = (): StudentRoutineFacade => {
    TestBed.configureTestingModule({
      providers: [
        StudentRoutineFacade,
        { provide: CLOCK, useValue: { now: () => NOW } },
        { provide: SessionFacade, useValue: { profileId: () => profileId } },
        {
          provide: ROUTINES_PORT,
          useValue: {
            getActiveForStudent,
            listByTrainer: fn<RoutinesPort['listByTrainer']>(),
            getById: fn<RoutinesPort['getById']>(),
          },
        },
        {
          provide: WORKOUTS_PORT,
          useValue: {
            listByStudent,
            markExercise,
            complete,
            getById: fn<WorkoutsPort['getById']>(),
            start: fn<WorkoutsPort['start']>(),
            logSet: fn<WorkoutsPort['logSet']>(),
          },
        },
      ],
    });
    return TestBed.inject(StudentRoutineFacade);
  };

  beforeEach(() => {
    getActiveForStudent = fn<RoutinesPort['getActiveForStudent']>().mockReturnValue(of(ROUTINE));
    listByStudent = fn<WorkoutsPort['listByStudent']>().mockReturnValue(
      of([todaySession([false, false])]),
    );
    markExercise = fn<WorkoutsPort['markExercise']>();
    complete = fn<WorkoutsPort['complete']>();
    profileId = 'std-001';
  });

  describe('load()', () => {
    it('consulta ambos puertos', () => {
      build().load();

      expect(getActiveForStudent).toHaveBeenCalledWith('std-001');
      expect(listByStudent).toHaveBeenCalledWith('std-001');
    });

    it('no consulta nada sin sesion', () => {
      profileId = null;
      build().load();

      expect(getActiveForStudent).not.toHaveBeenCalled();
    });

    it('selecciona el dia de hoy', () => {
      const facade = build();
      facade.load();

      // Jueves es 4 en convencion ISO.
      expect(facade.selectedWeekday()).toBe(4);
      expect(facade.selectedDay()?.title).toBe('Tracción');
    });

    it('queda en empty sin rutina asignada', () => {
      getActiveForStudent.mockReturnValue(of(null));
      const facade = build();
      facade.load();

      expect(facade.viewState()).toBe('empty');
    });

    it('queda en error si el puerto falla', () => {
      getActiveForStudent.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(facade.viewState()).toBe('error');
    });
  });

  describe('selectDay()', () => {
    it('cambia el dia seleccionado', () => {
      const facade = build();
      facade.load();

      facade.selectDay(1);

      expect(facade.selectedDay()?.title).toBe('Tren inferior');
    });

    // Caso real: el alumno eligio "Lun" y completo la sesion de un lunes dos
    // semanas adelante; el grafico de esta semana no subio.
    describe('solo sesiones de la semana en curso', () => {
      const lunes = (dia: number): WorkoutSession => ({
        ...todaySession([false, false]),
        id: `wks-lun-${dia}`,
        routineDayId: 'day-001',
        scheduledFor: toIsoDate(new Date(2026, 8, dia, 9)),
      });

      it('elige el lunes de esta semana y no uno futuro', () => {
        listByStudent.mockReturnValue(of([lunes(14), lunes(28)]));
        const facade = build();
        facade.load();

        facade.selectDay(1);

        expect(facade.selectedSession()?.id).toBe('wks-lun-14');
      });

      it('sin sesion esta semana no ofrece una de otra semana', () => {
        listByStudent.mockReturnValue(of([lunes(21), lunes(28)]));
        const facade = build();
        facade.load();

        facade.selectDay(1);

        expect(facade.selectedDay()?.title).toBe('Tren inferior');
        expect(facade.selectedSession()).toBeNull();
      });
    });

    it('un dia sin entrenamiento deja selectedDay en null', () => {
      const facade = build();
      facade.load();

      facade.selectDay(3);

      expect(facade.selectedDay()).toBeNull();
    });
  });

  describe('dayProgress()', () => {
    it('es cero sin nada marcado', () => {
      const facade = build();
      facade.load();

      expect(facade.dayProgress()).toBe(0);
    });

    it('refleja el avance de la sesion', () => {
      listByStudent.mockReturnValue(of([todaySession([true, false])]));
      const facade = build();
      facade.load();

      expect(facade.dayProgress()).toBe(0.5);
    });

    it('es cero en un dia sin sesion', () => {
      const facade = build();
      facade.load();
      facade.selectDay(1);

      expect(facade.dayProgress()).toBe(0);
    });
  });

  describe('isDayCompleted()', () => {
    it('es falso con la sesion abierta', () => {
      const facade = build();
      facade.load();

      expect(facade.isDayCompleted()).toBe(false);
    });

    it('es verdadero con la sesion cerrada', () => {
      listByStudent.mockReturnValue(
        of([{ ...todaySession([true, true]), status: 'completed' as const }]),
      );
      const facade = build();
      facade.load();

      expect(facade.isDayCompleted()).toBe(true);
    });
  });

  describe('toggleExercise()', () => {
    it('llama al puerto con la sesion del dia', async () => {
      markExercise.mockReturnValue(of(todaySession([true, false])));
      const facade = build();
      facade.load();

      await facade.toggleExercise('rex-009', true);

      expect(markExercise).toHaveBeenCalledWith('wks-today', 'rex-009', true);
    });

    it('refleja el cambio sin volver a consultar la lista', async () => {
      markExercise.mockReturnValue(of(todaySession([true, false])));
      const facade = build();
      facade.load();
      listByStudent.mockClear();

      await facade.toggleExercise('rex-009', true);

      expect(listByStudent).not.toHaveBeenCalled();
      expect(facade.dayProgress()).toBe(0.5);
    });

    it('devuelve false sin sesion para el dia', async () => {
      const facade = build();
      facade.load();
      facade.selectDay(1);

      expect(await facade.toggleExercise('rex-001', true)).toBe(false);
      expect(markExercise).not.toHaveBeenCalled();
    });

    it('devuelve false si el puerto falla', async () => {
      markExercise.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(await facade.toggleExercise('rex-009', true)).toBe(false);
    });
  });

  describe('completeSelectedSession()', () => {
    it('cierra la sesion del dia', async () => {
      complete.mockReturnValue(of({ ...todaySession([true, true]), status: 'completed' as const }));
      const facade = build();
      facade.load();

      const ok = await facade.completeSelectedSession(50);

      expect(ok).toBe(true);
      expect(complete).toHaveBeenCalledWith('wks-today', { durationMinutes: 50, note: null });
      expect(facade.isDayCompleted()).toBe(true);
    });

    it('devuelve false sin sesion para el dia', async () => {
      const facade = build();
      facade.load();
      facade.selectDay(1);

      expect(await facade.completeSelectedSession(50)).toBe(false);
    });

    it('devuelve false si el puerto falla', async () => {
      complete.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(await facade.completeSelectedSession(50)).toBe(false);
    });
  });

  describe('reload()', () => {
    it('vuelve a consultar ambos puertos', () => {
      const facade = build();
      facade.load();
      facade.reload();

      expect(getActiveForStudent).toHaveBeenCalledTimes(2);
      expect(listByStudent).toHaveBeenCalledTimes(2);
    });
  });

  describe('days()', () => {
    it('expone los dias de la rutina', () => {
      const facade = build();
      facade.load();

      expect(facade.days().map(day => day.weekday)).toEqual([1, 4]);
    });

    it('es vacio sin rutina', () => {
      getActiveForStudent.mockReturnValue(of(null));
      const facade = build();
      facade.load();

      expect(facade.days()).toEqual([]);
    });
  });
});
