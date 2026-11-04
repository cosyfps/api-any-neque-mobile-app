import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { Routine } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { ScheduledSession } from '@app/domain/schedule/model/scheduled-session.model';
import { SCHEDULE_PORT, SchedulePort } from '@app/domain/schedule/port/schedule.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { toIsoDate } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { ScheduleFacade } from './schedule.facade';

// Jueves 17 de septiembre de 2026.
const NOW = new Date(2026, 8, 17, 10, 0, 0);

const scheduled = (
  id: string,
  date: Date,
  status: ScheduledSession['status'] = 'pending',
): ScheduledSession => ({
  id,
  studentId: 'std-001',
  trainerId: 'trn-001',
  title: 'Entrenamiento',
  startsAt: toIsoDate(date),
  endsAt: toIsoDate(new Date(date.getTime() + 3_600_000)),
  location: 'Box',
  kind: 'training',
  status,
  workoutSessionId: null,
  cancellationReason: null,
  cancellationNote: null,
  cancelledAt: null,
});

const SESSIONS: ScheduledSession[] = [
  scheduled('a', new Date(2026, 8, 17, 18)),
  scheduled('b', new Date(2026, 8, 19, 10), 'confirmed'),
  scheduled('c', new Date(2026, 8, 22, 18), 'cancelled'),
];

// Rutina con entrenamiento los jueves (17 y 24 de septiembre).
const RUTINA: Routine = {
  id: 'rtn-001',
  trainerId: 'trn-001',
  name: 'Fuerza',
  goal: 'Fuerza',
  days: [
    { id: 'd4', weekday: 4, title: 'Pierna', focus: 'legs', estimatedMinutes: 50, exercises: [] },
  ],
  assignments: [{ studentId: 'std-001', startDate: '2026-09-01', endDate: null }],
};

describe('ScheduleFacade', () => {
  let rutina: Routine | null;
  let listByStudent: MockOf<SchedulePort['listByStudent']>;
  let confirm: MockOf<SchedulePort['confirm']>;
  let cancel: MockOf<SchedulePort['cancel']>;
  let profileId: string | null;

  const build = (): ScheduleFacade => {
    TestBed.configureTestingModule({
      providers: [
        ScheduleFacade,
        { provide: CLOCK, useValue: { now: () => NOW } },
        { provide: SessionFacade, useValue: { profileId: () => profileId } },
        { provide: SCHEDULE_PORT, useValue: { listByStudent, confirm, cancel } },
        { provide: ROUTINES_PORT, useValue: { getActiveForStudent: () => of(rutina) } },
        { provide: WORKOUTS_PORT, useValue: { listByStudent: () => of([]) } },
      ],
    });
    return TestBed.inject(ScheduleFacade);
  };

  beforeEach(() => {
    listByStudent = fn<SchedulePort['listByStudent']>().mockReturnValue(of(SESSIONS));
    confirm = fn<SchedulePort['confirm']>();
    cancel = fn<SchedulePort['cancel']>();
    profileId = 'std-001';
    rutina = RUTINA;
  });

  describe('entrenamiento de la rutina', () => {
    it('el dia de hoy muestra el entrenamiento de la rutina', () => {
      const facade = build();
      facade.load();

      expect(facade.dayTraining()?.day.title).toBe('Pierna');
    });

    // Las sesiones solo se generan dos semanas adelante: la agenda usa la rutina.
    it('marca los dias de entrenamiento aunque no tengan cita', () => {
      const facade = build();
      facade.load();

      expect(facade.hasSessions(new Date(2026, 8, 24))).toBe(true);
      expect(facade.hasSessions(new Date(2026, 8, 23))).toBe(false);
    });

    it('sin rutina vigente no hay entrenamiento', () => {
      rutina = null;
      const facade = build();
      facade.load();

      expect(facade.dayTraining()).toBeNull();
    });

    it('sin sesion de usuario no calcula entrenamiento', () => {
      const facade = build();
      facade.load();
      profileId = null;

      expect(facade.trainingOn(NOW)).toBeNull();
    });
  });

  describe('load()', () => {
    it('consulta el mes en curso', () => {
      build().load();
      expect(listByStudent).toHaveBeenCalledTimes(1);
      expect(listByStudent.mock.calls[0]?.[0]).toBe('std-001');
    });

    it('no consulta nada sin sesion', () => {
      profileId = null;
      build().load();
      expect(listByStudent).not.toHaveBeenCalled();
    });

    it('selecciona el dia de hoy', () => {
      const facade = build();
      facade.load();

      expect(facade.selectedDay()?.getDate()).toBe(17);
    });

    it('queda en error si el puerto falla', () => {
      listByStudent.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(facade.viewState()).toBe('error');
    });
  });

  describe('grid()', () => {
    it('devuelve seis semanas de siete dias', () => {
      const facade = build();
      facade.load();

      expect(facade.grid()).toHaveLength(6);
      expect(facade.grid()[0]).toHaveLength(7);
    });
  });

  describe('monthLabel()', () => {
    it('describe el mes en curso', () => {
      const facade = build();
      facade.load();

      expect(facade.monthLabel().toLowerCase()).toContain('septiembre');
    });
  });

  describe('navegacion de mes', () => {
    it('nextMonth() avanza y vuelve a consultar', () => {
      const facade = build();
      facade.load();

      facade.nextMonth();

      expect(facade.month().getMonth()).toBe(9);
      expect(listByStudent).toHaveBeenCalledTimes(2);
    });

    it('prevMonth() retrocede', () => {
      const facade = build();
      facade.load();

      facade.prevMonth();

      expect(facade.month().getMonth()).toBe(7);
    });

    it('cambiar de mes limpia el dia seleccionado', () => {
      const facade = build();
      facade.load();

      facade.nextMonth();

      expect(facade.selectedDay()).toBeNull();
    });
  });

  describe('daySessions()', () => {
    it('filtra por el dia seleccionado', () => {
      const facade = build();
      facade.load();

      expect(facade.daySessions().map(item => item.id)).toEqual(['a']);
    });

    it('cambia al seleccionar otro dia', () => {
      const facade = build();
      facade.load();

      facade.selectDay(new Date(2026, 8, 19));

      expect(facade.daySessions().map(item => item.id)).toEqual(['b']);
    });

    it('es vacio en un dia sin sesiones', () => {
      const facade = build();
      facade.load();

      facade.selectDay(new Date(2026, 8, 18));

      expect(facade.daySessions()).toEqual([]);
    });
  });

  describe('hasSessions()', () => {
    it('es verdadero en un dia con sesion', () => {
      const facade = build();
      facade.load();

      expect(facade.hasSessions(new Date(2026, 8, 17))).toBe(true);
    });

    it('es falso en un dia sin sesiones', () => {
      const facade = build();
      facade.load();

      expect(facade.hasSessions(new Date(2026, 8, 18))).toBe(false);
    });

    it('ignora las canceladas', () => {
      const facade = build();
      facade.load();

      expect(facade.hasSessions(new Date(2026, 8, 22))).toBe(false);
    });
  });

  describe('confirm()', () => {
    it('actualiza la sesion en la lista', async () => {
      confirm.mockReturnValue(of(scheduled('a', new Date(2026, 8, 17, 18), 'confirmed')));
      const facade = build();
      facade.load();

      const ok = await facade.confirm('a');

      expect(ok).toBe(true);
      expect(facade.all().find(item => item.id === 'a')?.status).toBe('confirmed');
    });

    it('devuelve false si el puerto falla', async () => {
      confirm.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(await facade.confirm('a')).toBe(false);
    });
  });

  describe('cancel()', () => {
    it('actualiza la sesion en la lista', async () => {
      cancel.mockReturnValue(of(scheduled('a', new Date(2026, 8, 17, 18), 'cancelled')));
      const facade = build();
      facade.load();

      const ok = await facade.cancel('a', 'illness', 'Resfriado');

      expect(ok).toBe(true);
      expect(facade.all().find(item => item.id === 'a')?.status).toBe('cancelled');
    });

    it('devuelve false si el puerto falla', async () => {
      cancel.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(await facade.cancel('a', 'travel')).toBe(false);
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
