import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { AgendaItem, TrainerAgendaFacade } from '@app/application/trainers/trainer-agenda.facade';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { SCHEDULE_PORT } from '@app/domain/schedule/port/schedule.port';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { TrainerAgendaPage } from './trainer-agenda.page';

const AHORA = new Date(2026, 8, 22, 10, 0);

const item = (tone: AgendaItem['tone']): AgendaItem => ({
  id: 'x',
  type: 'appointment',
  studentId: 'std-001',
  studentName: 'Ana',
  title: 'Control',
  startsAt: new Date(2026, 8, 22, 9, 0).toISOString(),
  hasTime: true,
  detail: 'Control',
  status: 'Confirmada',
  tone,
});

describe('TrainerAgendaPage', () => {
  let page: TrainerAgendaPage;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // La pagina la declara en sus `providers`; aqui hay que darla a mano.
        TrainerAgendaFacade,
        { provide: CLOCK, useValue: { now: () => AHORA } },
        { provide: SessionFacade, useValue: { profileId: () => 'trn-001' } },
        { provide: STUDENTS_PORT, useValue: { listByTrainer: () => of([]) } },
        { provide: SCHEDULE_PORT, useValue: { listByTrainer: () => of([]) } },
        { provide: WORKOUTS_PORT, useValue: { listByStudent: () => of([]) } },
        { provide: ROUTINES_PORT, useValue: { getActiveForStudent: () => of(null) } },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    page = TestBed.runInInjectionContext(() => new TrainerAgendaPage());
  });

  it('carga el mes en curso con hoy seleccionado', () => {
    expect(page.facade.monthLabel()).toBe('Septiembre de 2026');
    expect(page.selectedLabel()).toBe('Martes, 22 de septiembre');
  });

  it('invita a elegir un dia al cambiar de mes', () => {
    page.facade.nextMonth();

    expect(page.selectedLabel()).toBe('Selecciona un día');
  });

  it('marca el dia elegido y lo describe completo', () => {
    const celda = { date: new Date(2026, 8, 22), inMonth: true, isToday: true };

    expect(page.isSelected(celda)).toBe(true);
    expect(page.dayAria(celda)).toBe('martes, 22 de septiembre, hoy');
    expect(page.isSelected({ ...celda, date: new Date(2026, 8, 23) })).toBe(false);
  });

  it('formatea la hora en 24 horas', () => {
    expect(page.hora(new Date(2026, 8, 22, 9, 5).toISOString())).toBe('09:05');
  });

  it('elige el color de cada estado', () => {
    expect(page.badgeClass(item('success'))).toBe('nq-badge-success');
    expect(page.badgeClass(item('danger'))).toBe('nq-badge-danger');
    expect(page.badgeClass(item('warning'))).toBe('nq-badge-warning');
    expect(page.badgeClass(item('neutral'))).toBe('nq-badge-primary');
  });

  it('tocar un item abre la ficha del alumno', () => {
    page.openStudent(item('success'));

    expect(router.navigate).toHaveBeenCalledWith(['/trainer/students', 'std-001']);
  });

  it('volver sin historial lleva al inicio', () => {
    jest.spyOn(TestBed.inject(Location), 'getState').mockReturnValue(null);

    page.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/trainer/home']);
  });

  it('reload es un campo arrow invocable', () => {
    expect(() => page.reload()).not.toThrow();
  });
});
