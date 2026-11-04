import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { Routine } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { ScheduledSession } from '@app/domain/schedule/model/scheduled-session.model';
import { SCHEDULE_PORT, SchedulePort } from '@app/domain/schedule/port/schedule.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Student } from '@app/domain/students/model/student.model';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { TrainerAgendaFacade } from './trainer-agenda.facade';

// Martes 22 de septiembre de 2026, 10:00.
const AHORA = new Date(2026, 8, 22, 10, 0);

const alumno = (id: string, nombre: string, status: Student['status'] = 'active'): Student =>
  ({ id, firstName: nombre, lastName: 'Prueba', status }) as Student;

const cita = (id: string, inicio: Date, status: ScheduledSession['status'] = 'pending') =>
  ({
    id,
    studentId: 'std-001',
    trainerId: 'trn-001',
    title: 'Evaluación',
    startsAt: inicio.toISOString(),
    endsAt: new Date(inicio.getTime() + 3_600_000).toISOString(),
    location: null,
    kind: 'assessment',
    status,
  }) as ScheduledSession;

const sesion = (id: string, alumnoId: string, fecha: Date, status: WorkoutSession['status']) =>
  ({
    id,
    studentId: alumnoId,
    routineDayId: 'day-001',
    title: 'Pierna',
    scheduledFor: fecha.toISOString(),
    status,
    estimatedMinutes: 55,
  }) as WorkoutSession;

describe('TrainerAgendaFacade', () => {
  let listByTrainer: MockOf<SchedulePort['listByTrainer']>;
  let listWorkouts: MockOf<WorkoutsPort['listByStudent']>;
  let profileId: string | null;
  let cartera: Student[];
  let rutina: Routine | null;

  const build = (): TrainerAgendaFacade => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TrainerAgendaFacade,
        { provide: CLOCK, useValue: { now: () => AHORA } },
        { provide: SessionFacade, useValue: { profileId: () => profileId } },
        { provide: STUDENTS_PORT, useValue: { listByTrainer: () => of(cartera) } },
        { provide: SCHEDULE_PORT, useValue: { listByTrainer } },
        { provide: WORKOUTS_PORT, useValue: { listByStudent: listWorkouts } },
        { provide: ROUTINES_PORT, useValue: { getActiveForStudent: () => of(rutina) } },
      ],
    });
    return TestBed.inject(TrainerAgendaFacade);
  };

  beforeEach(() => {
    profileId = 'trn-001';
    cartera = [alumno('std-001', 'Ana'), alumno('std-002', 'Luis', 'suspended')];
    rutina = { days: [{ id: 'day-001', startTime: '18:30' }] } as unknown as Routine;
    listByTrainer = fn<SchedulePort['listByTrainer']>().mockReturnValue(
      of([cita('cit-1', new Date(2026, 8, 22, 9, 0)), cita('cit-2', new Date(2026, 8, 24, 9, 0))]),
    );
    listWorkouts = fn<WorkoutsPort['listByStudent']>().mockReturnValue(
      of([sesion('wks-1', 'std-001', new Date(2026, 8, 22, 21, 30), 'scheduled')]),
    );
  });

  it('junta citas y entrenamientos del dia, ordenados por hora', () => {
    const facade = build();
    facade.load();

    expect(facade.dayItems().map(item => item.id)).toEqual(['cit-1', 'wks-1']);
    expect(facade.dayItems()[0]).toMatchObject({
      type: 'appointment',
      studentName: 'Ana Prueba',
      detail: 'Evaluación',
      status: 'Por confirmar',
      tone: 'warning',
      hasTime: true,
    });
    expect(facade.dayItems()[1]).toMatchObject({
      type: 'training',
      detail: 'Rutina · 55 min',
      status: 'Planificado',
      tone: 'neutral',
      hasTime: true,
    });
  });

  it('pide los entrenamientos solo de los alumnos activos', () => {
    build().load();

    expect(listWorkouts).toHaveBeenCalledTimes(1);
    expect(listWorkouts.mock.calls[0]?.[0]).toBe('std-001');
  });

  it('un entrenamiento de un dia sin hora no muestra hora', () => {
    rutina = { days: [{ id: 'day-001', startTime: null }] } as unknown as Routine;
    const facade = build();
    facade.load();

    expect(facade.dayItems().find(item => item.type === 'training')?.hasTime).toBe(false);
  });

  it('colorea los estados de citas y entrenamientos', () => {
    listByTrainer.mockReturnValue(
      of([
        cita('c-ok', new Date(2026, 8, 22, 8, 0), 'confirmed'),
        cita('c-no', new Date(2026, 8, 22, 8, 30), 'cancelled'),
      ]),
    );
    listWorkouts.mockReturnValue(
      of([
        sesion('w-ok', 'std-001', new Date(2026, 8, 22, 12), 'completed'),
        sesion('w-no', 'std-001', new Date(2026, 8, 22, 13), 'skipped'),
        sesion('w-en', 'std-001', new Date(2026, 8, 22, 14), 'in_progress'),
      ]),
    );
    const facade = build();
    facade.load();

    expect(facade.dayItems().map(item => item.tone)).toEqual([
      'success',
      'danger',
      'success',
      'danger',
      'warning',
    ]);
  });

  it('marca los dias con actividad y cambia de dia', () => {
    const facade = build();
    facade.load();

    expect(facade.hasItems(new Date(2026, 8, 24))).toBe(true);
    expect(facade.hasItems(new Date(2026, 8, 23))).toBe(false);

    facade.selectDay(new Date(2026, 8, 24, 15));
    expect(facade.dayItems().map(item => item.id)).toEqual(['cit-2']);
  });

  it('cambia de mes y vuelve a pedir el rango', () => {
    const facade = build();
    facade.load();

    facade.nextMonth();
    expect(facade.monthLabel()).toBe('Octubre de 2026');
    expect(facade.selectedDay()).toBeNull();

    facade.prevMonth();
    expect(facade.monthLabel()).toBe('Septiembre de 2026');
    expect(listByTrainer).toHaveBeenCalledTimes(3);
  });

  it('sin seleccion muestra el dia de hoy', () => {
    const facade = build();
    facade.load();
    facade.nextMonth();
    facade.prevMonth();

    expect(facade.dayItems().map(item => item.id)).toEqual(['cit-1', 'wks-1']);
  });

  it('sin alumnos activos no pide entrenamientos', () => {
    cartera = [];
    const facade = build();
    facade.load();

    expect(listWorkouts).not.toHaveBeenCalled();
    expect(facade.dayItems().map(item => item.id)).toEqual(['cit-1']);
  });

  it('una cita de alguien fuera de la cartera activa se nombra como alumno', () => {
    cartera = [];
    const facade = build();
    facade.load();

    expect(facade.dayItems()[0]?.studentName).toBe('Alumno');
  });

  it('sin entrenador en sesion no carga', () => {
    profileId = null;
    const facade = build();
    facade.load();

    expect(listByTrainer).not.toHaveBeenCalled();
    expect(facade.items()).toEqual([]);
  });

  it('expone el error y recarga', () => {
    listByTrainer.mockReturnValue(throwError(() => domainError('network')));
    const facade = build();
    facade.load();
    expect(facade.viewState()).toBe('error');

    listByTrainer.mockReturnValue(of([]));
    facade.reload();
    expect(facade.viewState()).not.toBe('error');
  });

  it('arma la grilla del mes', () => {
    const facade = build();

    expect(facade.grid().length).toBeGreaterThanOrEqual(4);
  });
});
