import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { toIsoDate } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { WorkoutSession, WorkoutStatus } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { WorkoutFacade } from './workout.facade';

// Jueves 17 de septiembre de 2026 a las 10:00.
const NOW = new Date(2026, 8, 17, 10, 0, 0);

const session = (
  id: string,
  date: Date,
  status: WorkoutStatus,
  title = 'Sesión',
): WorkoutSession => ({
  id,
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-001',
  title,
  scheduledFor: toIsoDate(date),
  startedAt: null,
  completedAt: null,
  status,
  durationMinutes: null,
  estimatedMinutes: 50,
  exercises: [],
});

const SESSIONS: WorkoutSession[] = [
  session('s1', new Date(2026, 8, 14, 18), 'completed', 'Tren inferior'),
  session('s2', new Date(2026, 8, 15, 18), 'completed', 'Empuje'),
  session('s3', new Date(2026, 8, 17, 18), 'scheduled', 'Tracción'),
  session('s4', new Date(2026, 8, 18, 18), 'scheduled', 'Full body'),
  session('s5', new Date(2026, 8, 21, 18), 'scheduled', 'Tren inferior'),
];

describe('WorkoutFacade', () => {
  let listByStudent: MockOf<WorkoutsPort['listByStudent']>;
  let complete: MockOf<WorkoutsPort['complete']>;
  let profileId: string | null;
  let activeRoutine: { id: string; days: { id: string; startTime: string | null }[] } | null;

  const build = (): WorkoutFacade => {
    TestBed.configureTestingModule({
      providers: [
        WorkoutFacade,
        { provide: CLOCK, useValue: { now: () => NOW } },
        { provide: SessionFacade, useValue: { profileId: () => profileId } },
        { provide: ROUTINES_PORT, useValue: { getActiveForStudent: () => of(activeRoutine) } },
        {
          provide: WORKOUTS_PORT,
          useValue: {
            listByStudent,
            complete,
            getById: fn<WorkoutsPort['getById']>(),
            start: fn<WorkoutsPort['start']>(),
            markExercise: fn<WorkoutsPort['markExercise']>(),
            logSet: fn<WorkoutsPort['logSet']>(),
          },
        },
      ],
    });
    return TestBed.inject(WorkoutFacade);
  };

  beforeEach(() => {
    listByStudent = fn<WorkoutsPort['listByStudent']>().mockReturnValue(of(SESSIONS));
    complete = fn<WorkoutsPort['complete']>();
    profileId = 'std-001';
    activeRoutine = { id: 'rtn-001', days: [{ id: 'day-001', startTime: null }] };
  });

  describe('load()', () => {
    it('consulta el puerto con el id de la sesion', () => {
      build().load();
      expect(listByStudent).toHaveBeenCalledWith('std-001');
    });

    it('no consulta nada sin sesion', () => {
      profileId = null;
      build().load();
      expect(listByStudent).not.toHaveBeenCalled();
    });

    it('queda en empty sin sesiones', () => {
      listByStudent.mockReturnValue(of([]));
      const facade = build();
      facade.load();

      expect(facade.viewState()).toBe('empty');
    });

    it('queda en error si el puerto falla', () => {
      listByStudent.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(facade.viewState()).toBe('error');
    });
  });

  describe('hasStartTime()', () => {
    it('es falso si el dia de rutina no tiene hora', () => {
      const facade = build();
      facade.load();

      expect(facade.hasStartTime(SESSIONS[0] as WorkoutSession)).toBe(false);
    });

    it('es verdadero si el dia de rutina tiene hora', () => {
      activeRoutine = { id: 'rtn-001', days: [{ id: 'day-001', startTime: '18:30' }] };
      const facade = build();
      facade.load();

      expect(facade.hasStartTime(SESSIONS[0] as WorkoutSession)).toBe(true);
    });
  });

  describe('all()', () => {
    it('oculta las sesiones de rutinas anteriores sin borrarlas', () => {
      listByStudent.mockReturnValue(
        of([...SESSIONS, { ...session('old', NOW, 'completed', 'Leg day'), routineId: 'rtn-old' }]),
      );
      const facade = build();
      facade.load();

      expect(facade.all().map(item => item.id)).not.toContain('old');
      expect(facade.sessions.data()?.map(item => item.id)).toContain('old');
    });

    it('sin rutina vigente no muestra sesiones', () => {
      activeRoutine = null;
      const facade = build();
      facade.load();

      expect(facade.all()).toEqual([]);
    });
  });

  describe('todaySession()', () => {
    it('encuentra la sesion de hoy', () => {
      const facade = build();
      facade.load();

      expect(facade.todaySession()?.id).toBe('s3');
    });

    it('es null si hoy no hay nada', () => {
      listByStudent.mockReturnValue(of([SESSIONS[0] as WorkoutSession]));
      const facade = build();
      facade.load();

      expect(facade.todaySession()).toBeNull();
    });
  });

  describe('latestCompleted()', () => {
    it('devuelve la ultima completada', () => {
      const facade = build();
      facade.load();

      expect(facade.latestCompleted()?.id).toBe('s2');
    });

    it('es null si no hay completadas', () => {
      listByStudent.mockReturnValue(of([SESSIONS[2] as WorkoutSession]));
      const facade = build();
      facade.load();

      expect(facade.latestCompleted()).toBeNull();
    });
  });

  describe('upcoming()', () => {
    it('devuelve las sesiones futuras no cerradas', () => {
      const facade = build();
      facade.load();

      expect(facade.upcoming().map(item => item.id)).toEqual(['s3', 's4', 's5']);
    });

    it('excluye completadas y omitidas', () => {
      const facade = build();
      facade.load();

      expect(facade.upcoming().some(item => item.status === 'completed')).toBe(false);
    });
  });

  describe('weekly()', () => {
    it('resume la semana en curso', () => {
      const facade = build();
      facade.load();

      const weekly = facade.weekly();
      expect(weekly.completed).toBe(2);
      expect(weekly.planned).toBe(4);
      expect(weekly.byDay).toHaveLength(7);
    });

    it('marca el dia de hoy', () => {
      const facade = build();
      facade.load();

      expect(facade.weekly().byDay[3]?.isToday).toBe(true);
    });
  });

  describe('completeSession()', () => {
    it('reemplaza la sesion en la lista sin volver a consultar', () => {
      const closed: WorkoutSession = { ...(SESSIONS[2] as WorkoutSession), status: 'completed' };
      complete.mockReturnValue(of(closed));

      const facade = build();
      facade.load();
      listByStudent.mockClear();

      return facade.completeSession('s3', { durationMinutes: 45, note: null }).then(ok => {
        expect(ok).toBe(true);
        expect(listByStudent).not.toHaveBeenCalled();
        expect(facade.all().find(item => item.id === 's3')?.status).toBe('completed');
      });
    });

    it('devuelve false si el puerto falla', () => {
      complete.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      return facade
        .completeSession('s3', { durationMinutes: 45, note: null })
        .then(ok => expect(ok).toBe(false));
    });
  });

  describe('reload()', () => {
    it('vuelve a consultar el puerto', () => {
      const facade = build();
      facade.load();
      facade.reload();

      expect(listByStudent).toHaveBeenCalledTimes(2);
    });
  });
});
