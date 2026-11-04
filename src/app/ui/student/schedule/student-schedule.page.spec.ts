import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { ScheduleFacade } from '@app/application/schedule/schedule.facade';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { MonthCell } from '@app/domain/schedule/model/month-grid';
import { ScheduledSession } from '@app/domain/schedule/model/scheduled-session.model';
import { SCHEDULE_PORT, SchedulePort } from '@app/domain/schedule/port/schedule.port';
import { toIsoDate } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { StudentSchedulePage } from './student-schedule.page';

const NOW = new Date(2026, 8, 17, 10, 0, 0);

const SESSION: ScheduledSession = {
  id: 'sch-001',
  studentId: 'std-001',
  trainerId: 'trn-001',
  title: 'Tracción',
  startsAt: toIsoDate(new Date(2026, 8, 17, 18)),
  endsAt: toIsoDate(new Date(2026, 8, 17, 19)),
  location: 'Box Providencia',
  kind: 'training',
  status: 'pending',
  workoutSessionId: null,
  cancellationReason: null,
  cancellationNote: null,
  cancelledAt: null,
};

describe('StudentSchedulePage', () => {
  let page: StudentSchedulePage;
  let router: Router;
  let confirm: MockOf<SchedulePort['confirm']>;

  const createPage = (): StudentSchedulePage => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ScheduleFacade,
        { provide: CLOCK, useValue: { now: () => NOW } },
        { provide: SessionFacade, useValue: { profileId: () => 'std-001' } },
        {
          provide: SCHEDULE_PORT,
          useValue: {
            listByStudent: () => of([SESSION]),
            confirm,
            cancel: fn<SchedulePort['cancel']>(),
          },
        },
        { provide: ROUTINES_PORT, useValue: { getActiveForStudent: () => of(null) } },
        { provide: WORKOUTS_PORT, useValue: { listByStudent: () => of([]) } },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new StudentSchedulePage());
  };

  beforeEach(() => {
    confirm = fn<SchedulePort['confirm']>().mockReturnValue(
      of({ ...SESSION, status: 'confirmed' as const }),
    );
    page = createPage();
  });

  describe('estado inicial', () => {
    it('declara los siete encabezados de la semana', () => {
      expect(page.weekdayHeaders).toHaveLength(7);
    });

    it('selecciona el dia de hoy', () => {
      expect(page.facade.selectedDay()?.getDate()).toBe(17);
    });

    it('muestra las sesiones del dia', () => {
      expect(page.facade.daySessions()).toHaveLength(1);
    });
  });

  describe('monthLabel()', () => {
    it('capitaliza el nombre del mes', () => {
      expect(page.monthLabel().charAt(0)).toBe(page.monthLabel().charAt(0).toUpperCase());
    });
  });

  describe('selectedLabel()', () => {
    it('capitaliza el dia seleccionado', () => {
      expect(page.selectedLabel().charAt(0)).toBe(page.selectedLabel().charAt(0).toUpperCase());
    });

    it('invita a elegir cuando no hay dia', () => {
      page.facade.nextMonth();

      expect(page.selectedLabel()).toBe('Selecciona un día');
    });
  });

  /** Celda de hoy dentro de la grilla. Falla el test si no existe. */
  const todayCell = (): MonthCell => {
    const cell = page.facade
      .grid()
      .flat()
      .find(item => item.isToday);
    if (cell === undefined) {
      throw new Error('la grilla no contiene el dia de hoy');
    }
    return cell;
  };

  describe('isSelected()', () => {
    it('marca el dia elegido', () => {
      expect(page.isSelected(todayCell())).toBe(true);
    });

    it('no marca otro dia', () => {
      const otro = page.facade
        .grid()
        .flat()
        .find(cell => !cell.isToday);
      expect(otro).toBeDefined();
      expect(page.isSelected(otro as MonthCell)).toBe(false);
    });
  });

  describe('dayAria()', () => {
    it('avisa cuando el dia tiene sesiones', () => {
      expect(page.dayAria(todayCell())).toContain('con sesiones');
    });

    it('incluye la fecha completa, no solo el numero', () => {
      expect(page.dayAria(todayCell())).toMatch(/\d+ de \w+/);
    });

    it('marca el dia de hoy', () => {
      expect(page.dayAria(todayCell())).toContain(', hoy');
    });

    it('omite hoy y sesiones en un dia cualquiera', () => {
      const otro = { ...todayCell(), isToday: false, date: new Date(2099, 0, 1) };

      const label = page.dayAria(otro as MonthCell);

      expect(label).not.toContain(', hoy');
      expect(label).not.toContain('con sesiones');
    });
  });

  describe('formato de sesion', () => {
    it('muestra la hora de inicio', () => {
      expect(page.timeOf(SESSION.startsAt)).toMatch(/\d{2}:\d{2}/);
    });

    it('calcula la duracion en minutos', () => {
      expect(page.durationOf(SESSION)).toBe('60 min');
    });

    it('traduce el tipo de cita', () => {
      expect(page.kindLabel('training')).toBe('Entrenamiento');
      expect(page.kindLabel('assessment')).toBe('Evaluación');
    });

    it('traduce el estado', () => {
      expect(page.statusLabel('pending')).toBe('Por confirmar');
    });

    it.each([
      ['confirmed', 'nq-badge-success'],
      ['cancelled', 'nq-badge-danger'],
      ['pending', 'nq-badge-warning'],
    ] as const)('asigna la insignia de %s', (status, expected) => {
      expect(page.badgeClass(status)).toBe(expected);
    });
  });

  describe('confirm()', () => {
    it('confirma la sesion', () => {
      page.confirm('sch-001');

      expect(confirm).toHaveBeenCalledWith('sch-001');
    });
  });

  describe('goBack()', () => {
    it('vuelve al home del alumno', () => {
      page.goBack();

      expect(router.navigate).toHaveBeenCalledWith(['/student/home']);
    });
  });

  describe('confirm()', () => {
    it('marca la sesion que se esta confirmando y la libera al terminar', async () => {
      const pending = page.facade.daySessions()[0];

      await page.confirm(pending?.id ?? 'sch-001');

      expect(page.confirming()).toBeNull();
    });

    it('ignora el segundo toque mientras confirma', async () => {
      page.confirming.set('sch-001');

      await page.confirm('sch-002');

      expect(page.confirming()).toBe('sch-001');
    });
  });

  describe('entrenamiento de la rutina', () => {
    it('traduce cada estado', () => {
      expect(page.trainingLabel('done')).toBe('Completado');
      expect(page.trainingLabel('planned')).toBe('Planificado');
    });

    it('usa un color por estado', () => {
      expect(page.trainingBadge('done')).toBe('nq-badge-success');
      expect(page.trainingBadge('missed')).toBe('nq-badge-danger');
      expect(page.trainingBadge('planned')).toBe('nq-badge-primary');
    });

    it('tocarlo lleva a la rutina', () => {
      page.goToRoutine();

      expect(router.navigate).toHaveBeenCalledWith(['/student/routine']);
    });
  });

  describe('reload', () => {
    it('es un campo arrow invocable', () => {
      expect(() => page.reload()).not.toThrow();
    });
  });
});
