import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { domainError } from '@app/domain/shared/model/app-error';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { LoadHistoryComponent } from './load-history.component';

const sesion = (
  id: string,
  fecha: string,
  kg: number,
  ejercicio = 'sentadilla',
): WorkoutSession => ({
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
  exercises: [
    {
      routineExerciseId: `rex-${ejercicio}`,
      exerciseId: ejercicio,
      name: ejercicio === 'sentadilla' ? 'Sentadilla' : 'Press banca',
      targetSets: 3,
      targetReps: 8,
      restSeconds: 90,
      weightKg: null,
      completedSets: 1,
      done: true,
      sets: [{ id: `set-${id}`, setNumber: 1, reps: 8, weightKg: kg, completedAt: fecha }],
    },
  ],
});

describe('LoadHistoryComponent', () => {
  let fixture: ComponentFixture<LoadHistoryComponent>;
  let cmp: LoadHistoryComponent;
  let listByStudent: MockOf<WorkoutsPort['listByStudent']>;
  let profileId: string | null;

  const crear = (): void => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoadHistoryComponent],
      providers: [
        { provide: SessionFacade, useValue: { profileId: () => profileId } },
        { provide: WORKOUTS_PORT, useValue: { listByStudent } },
      ],
    });
    fixture = TestBed.createComponent(LoadHistoryComponent);
    cmp = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    profileId = 'std-1';
    listByStudent = fn<WorkoutsPort['listByStudent']>().mockReturnValue(
      of([
        sesion('s1', '2026-10-27T21:00:00.000Z', 55),
        sesion('s2', '2026-11-03T21:00:00.000Z', 62.5),
        sesion('s3', '2026-10-20T21:00:00.000Z', 40, 'banca'),
      ]),
    );
    crear();
  });

  it('elige el ejercicio entrenado mas recientemente y resume su progreso', () => {
    expect(cmp.facade.selected()?.name).toBe('Sentadilla');
    expect(cmp.ultima()?.maxKg).toBe(62.5);
    expect(cmp.maxima()).toBe(62.5);
    expect(cmp.delta()).toBe(7.5);
    expect(cmp.deltaLabel()).toBe('+7.5 kg');
    expect(cmp.serie()).toHaveLength(2);
    expect(cmp.recientes().map(punto => punto.sessionId)).toEqual(['s2', 's1']);
    expect(cmp.aria()).toContain('Sentadilla');
  });

  it('cambiar de ejercicio cambia la serie', () => {
    cmp.elegir({ target: { value: 'banca' } } as unknown as Event);

    expect(cmp.facade.selected()?.name).toBe('Press banca');
    expect(cmp.delta()).toBeNull();
    expect(cmp.deltaLabel()).toBe('0 kg');
  });

  it('pinta el selector y el resumen', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('option')).toHaveLength(2);
    expect(el.textContent).toContain('62.5 kg');
  });

  it('sin series con peso muestra el estado vacio', () => {
    listByStudent.mockReturnValue(of([]));
    crear();

    expect(cmp.facade.viewState()).toBe('empty');
    expect(cmp.ultima()).toBeNull();
    expect(cmp.maxima()).toBe(0);
    expect(cmp.delta()).toBeNull();
  });

  it('expone el error y recarga', () => {
    listByStudent.mockReturnValue(throwError(() => domainError('network')));
    crear();
    expect(cmp.facade.viewState()).toBe('error');

    listByStudent.mockReturnValue(of([]));
    cmp.reload();
    expect(cmp.facade.viewState()).toBe('empty');
  });

  it('sin alumno en sesion no carga', () => {
    profileId = null;
    listByStudent.mockClear();
    crear();

    expect(listByStudent).not.toHaveBeenCalled();
  });

  it('formatea la fecha de cada punto', () => {
    expect(cmp.fecha('2026-11-03T21:00:00.000Z')).toMatch(/3/);
  });
});
