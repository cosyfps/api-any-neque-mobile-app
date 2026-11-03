import { TestBed } from '@angular/core/testing';

import { STUDENT_TOUR, TRAINER_TOUR } from './tour-steps';
import { TOUR_DONE_PREFIX, TourService, TourStep } from './tour.service';

const PASOS: readonly TourStep[] = [
  { title: 'Uno', text: 'a' },
  { title: 'Dos', text: 'b', route: '/x', target: 'y' },
];

describe('TourService', () => {
  let tour: TourService;

  beforeEach(() => {
    localStorage.clear();
    tour = TestBed.inject(TourService);
  });

  afterEach(() => localStorage.clear());

  it('arranca en el primer ingreso', () => {
    tour.startIfFirstTime('student.u1', PASOS);

    expect(tour.active()).toBe(true);
    expect(tour.step()?.title).toBe('Uno');
  });

  it('avanza y al terminar recuerda que ya se vio', () => {
    tour.startIfFirstTime('student.u1', PASOS);

    tour.next();
    expect(tour.isLast()).toBe(true);
    tour.next();

    expect(tour.active()).toBe(false);
    expect(localStorage.getItem(`${TOUR_DONE_PREFIX}student.u1`)).toBe('1');
  });

  it('omitir tambien cuenta como visto', () => {
    tour.startIfFirstTime('student.u1', PASOS);

    tour.finish();

    expect(tour.active()).toBe(false);
    tour.startIfFirstTime('student.u1', PASOS);
    expect(tour.active()).toBe(false);
  });

  it('cada usuario lo ve una vez en el dispositivo', () => {
    tour.startIfFirstTime('student.u1', PASOS);
    tour.finish();

    tour.startIfFirstTime('student.u2', PASOS);

    expect(tour.active()).toBe(true);
  });

  it('desde Perfil se puede volver a ver aunque ya se haya visto', () => {
    tour.startIfFirstTime('trainer.u1', PASOS);
    tour.finish();

    tour.start('trainer.u1', PASOS);

    expect(tour.index()).toBe(0);
    expect(tour.active()).toBe(true);
  });

  it.each([
    ['alumno', STUDENT_TOUR, '/student/'],
    ['entrenador', TRAINER_TOUR, '/trainer/'],
  ])('los pasos del %s solo van a pantallas de su rol', (_rol, pasos, prefijo) => {
    expect(pasos.length).toBeGreaterThan(3);
    expect(pasos.every(paso => paso.route?.startsWith(prefijo) ?? true)).toBe(true);
  });
});
