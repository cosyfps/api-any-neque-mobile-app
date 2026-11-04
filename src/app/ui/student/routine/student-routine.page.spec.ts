import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { StudentRoutineFacade } from '@app/application/routines/student-routine.facade';
import { Routine, RoutineExercise } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT, RoutinesPort } from '@app/domain/routines/port/routines.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { toIsoDate } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { StudentRoutinePage } from './student-routine.page';

// Jueves 17 de septiembre de 2026: dia 4 en convencion ISO.
const NOW = new Date(2026, 8, 17, 10, 0, 0);

const EXERCISE: RoutineExercise = {
  id: 'rex-009',
  exerciseId: 'ex-007',
  name: 'Dominadas',
  order: 1,
  sets: 4,
  reps: 8,
  restSeconds: 90,
  weightKg: null,
  notes: null,
};

const ROUTINE: Routine = {
  id: 'rtn-001',
  trainerId: 'trn-001',
  name: 'Hipertrofia',
  goal: 'Masa muscular',
  assignments: [{ studentId: 'std-001', startDate: '2026-09-01T00:00:00.000Z', endDate: null }],
  days: [
    {
      id: 'day-004',
      weekday: 4,
      title: 'Tracción',
      focus: 'back',
      estimatedMinutes: 50,
      exercises: [EXERCISE],
    },
  ],
};

const sessionWith = (
  done: boolean,
  status: WorkoutSession['status'] = 'scheduled',
): WorkoutSession => ({
  id: 'wks-today',
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-004',
  title: 'Tracción',
  scheduledFor: toIsoDate(new Date(2026, 8, 17, 18)),
  startedAt: null,
  completedAt: null,
  status,
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
      completedSets: done ? 4 : 0,
      done,
      sets: [],
    },
  ],
});

let moverResultado: ReturnType<WorkoutsPort['reschedule']> | null = null;

describe('StudentRoutinePage', () => {
  let page: StudentRoutinePage;
  let router: Router;
  let markExercise: MockOf<WorkoutsPort['markExercise']>;
  let complete: MockOf<WorkoutsPort['complete']>;

  const createPage = (session = sessionWith(false)): StudentRoutinePage => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        StudentRoutineFacade,
        { provide: CLOCK, useValue: { now: () => NOW } },
        { provide: SessionFacade, useValue: { profileId: () => 'std-001' } },
        {
          provide: ROUTINES_PORT,
          useValue: {
            getActiveForStudent: () => of(ROUTINE),
            listByTrainer: fn<RoutinesPort['listByTrainer']>(),
            getById: fn<RoutinesPort['getById']>(),
          },
        },
        {
          provide: WORKOUTS_PORT,
          useValue: {
            listByStudent: () => of([session]),
            markExercise,
            complete,
            reschedule: (_id: string, dia: string) =>
              moverResultado ??
              of({ ...session, scheduledFor: new Date(`${dia}T21:00:00.000Z`).toISOString() }),
            getById: fn<WorkoutsPort['getById']>(),
            start: fn<WorkoutsPort['start']>(),
            logSet: fn<WorkoutsPort['logSet']>(),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new StudentRoutinePage());
  };

  beforeEach(() => {
    markExercise = fn<WorkoutsPort['markExercise']>().mockReturnValue(of(sessionWith(true)));
    complete = fn<WorkoutsPort['complete']>().mockReturnValue(of(sessionWith(true, 'completed')));
    page = createPage();
  });

  describe('estado inicial', () => {
    it('selecciona el dia de hoy', () => {
      expect(page.facade.selectedWeekday()).toBe(4);
      expect(page.facade.selectedDay()?.title).toBe('Tracción');
    });

    it('declara los siete dias de la semana', () => {
      expect(page.weekdays).toHaveLength(7);
    });

    it('arranca sin celebracion ni operaciones en curso', () => {
      expect(page.showCelebration()).toBe(false);
      expect(page.busyId()).toBeNull();
    });
  });

  describe('hasTraining()', () => {
    it('es verdadero en un dia con entrenamiento', () => {
      expect(page.hasTraining(4)).toBe(true);
    });

    it('es falso en un dia de descanso', () => {
      expect(page.hasTraining(3)).toBe(false);
    });
  });

  describe('isDone()', () => {
    it('es falso sin marcar', () => {
      expect(page.isDone('rex-009')).toBe(false);
    });

    it('es verdadero cuando el ejercicio esta hecho', () => {
      page = createPage(sessionWith(true));
      expect(page.isDone('rex-009')).toBe(true);
    });

    it('es falso para un ejercicio que no existe', () => {
      expect(page.isDone('rex-999')).toBe(false);
    });
  });

  describe('checkLabel()', () => {
    const exercise = { id: 'rex-009', name: 'Sentadilla' } as RoutineExercise;

    it('ofrece marcar cuando esta pendiente', () => {
      expect(page.checkLabel(exercise)).toBe('Marcar Sentadilla');
    });

    it('ofrece desmarcar cuando ya esta hecho', () => {
      page = createPage(sessionWith(true));

      expect(page.checkLabel(exercise)).toBe('Desmarcar Sentadilla');
    });
  });

  describe('progressPercent()', () => {
    it('es cero sin nada marcado', () => {
      expect(page.progressPercent()).toBe(0);
    });

    it('es cien con todo marcado', () => {
      page = createPage(sessionWith(true));
      expect(page.progressPercent()).toBe(100);
    });
  });

  describe('toggle()', () => {
    it('marca el ejercicio y libera el bloqueo', async () => {
      await page.toggle(EXERCISE);

      expect(markExercise).toHaveBeenCalledWith('wks-today', 'rex-009', true);
      expect(page.busyId()).toBeNull();
    });

    it('ignora un segundo toque mientras hay uno en curso', async () => {
      page.busyId.set('rex-009');

      await page.toggle(EXERCISE);

      expect(markExercise).not.toHaveBeenCalled();
    });
  });

  // Ya no hay "Marcar como completada": la sesion se cierra marcando sus
  // ejercicios o terminando el entrenamiento guiado.
  it('no ofrece cerrar la sesion sin hacer los ejercicios', () => {
    expect('completeSession' in page).toBe(false);
  });

  it('dismissCelebration() cierra el modal', () => {
    page.showCelebration.set(true);

    page.dismissCelebration();

    expect(page.showCelebration()).toBe(false);
  });

  describe('celebracion una sola vez', () => {
    // Marcar el ultimo ejercicio completa la sesion: se celebra.
    it('toggle() que completa la sesion celebra', async () => {
      markExercise.mockReturnValue(of(sessionWith(true, 'completed')));

      await page.toggle(EXERCISE);

      expect(page.showCelebration()).toBe(true);
    });

    it('desmarcar y volver a marcar no repite la celebracion', async () => {
      markExercise.mockReturnValue(of(sessionWith(true, 'completed')));
      await page.toggle(EXERCISE);
      page.dismissCelebration();

      markExercise.mockReturnValue(of(sessionWith(false, 'in_progress')));
      await page.toggle(EXERCISE);
      markExercise.mockReturnValue(of(sessionWith(true, 'completed')));
      await page.toggle(EXERCISE);

      expect(page.showCelebration()).toBe(false);
    });

    it('marcar sin completar la sesion no celebra', async () => {
      markExercise.mockReturnValue(of(sessionWith(true, 'in_progress')));

      await page.toggle(EXERCISE);

      expect(page.showCelebration()).toBe(false);
    });
  });

  describe('banner de sesion completada', () => {
    it('sin saltos invita a sumar la semana', () => {
      page = createPage(sessionWith(true, 'completed'));

      expect(page.doneSubtitle()).toBe('Sumaste una sesión a tu semana.');
    });

    it('con saltos dice cuantos', () => {
      const base = sessionWith(false, 'completed');
      page = createPage({
        ...base,
        exercises: base.exercises.map(item => ({ ...item, skipped: true })),
      });

      expect(page.doneSubtitle()).toBe('1 ejercicio saltado.');
    });
  });

  describe('ejercicio saltado', () => {
    const saltada = (skipReason: 'pain' | null): WorkoutSession => {
      const base = sessionWith(false, 'in_progress');
      return {
        ...base,
        exercises: base.exercises.map(item => ({ ...item, skipped: true, skipReason })),
      };
    };

    it('muestra el motivo', () => {
      page = createPage(saltada('pain'));

      expect(page.skipLabel('rex-009')).toBe('Saltado · Molestia o dolor');
    });

    it('sin motivo solo dice saltado', () => {
      page = createPage(saltada(null));

      expect(page.skipLabel('rex-009')).toBe('Saltado');
    });

    it('no marca un ejercicio que no se salto', () => {
      expect(page.skipLabel('rex-009')).toBeNull();
    });
  });

  describe('prescripcion()', () => {
    it.each([
      [{ weightKg: 30 }, '4 × 8 · 30 kg'],
      [{ weightKg: null }, '4 × 8 · Peso corporal'],
      [{ weightKg: 10, load: 'weighted_bodyweight' as const }, '4 × 8 · peso extra · 10kg'],
      [
        { weightKg: null, measure: 'time' as const, durationSeconds: 45, sets: 3 },
        '3 × 45 s · Peso corporal',
      ],
      [{ weightKg: null, load: 'weight' as const }, '4 × 8'],
    ])('%o → %s', (cambios, texto) => {
      expect(page.prescripcion({ ...EXERCISE, ...cambios })).toBe(texto);
    });
  });

  describe('startWorkout()', () => {
    it('navega al runner con el id de la sesion', () => {
      page.startWorkout();

      expect(router.navigate).toHaveBeenCalledWith(['/student/workout', 'wks-today']);
    });

    it('no navega en un dia sin sesion', () => {
      page.facade.selectDay(2);

      page.startWorkout();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('cambiar de dia (A-3)', () => {
    afterEach(() => (moverResultado = null));

    it('abre y cierra el selector de dias', () => {
      page.openMove();
      expect(page.moving()).toBe(true);

      page.closeMove();
      expect(page.moving()).toBe(false);
    });

    it('mover cierra el selector', async () => {
      page.openMove();

      await page.move('2026-09-19');

      expect(page.moving()).toBe(false);
      expect(page.movingBusy()).toBe(false);
    });

    it('un rechazo deja el selector abierto', async () => {
      moverResultado = throwError(() => domainError('validation', 'No se puede.'));
      page.openMove();

      await page.move('2026-09-19');

      expect(page.moving()).toBe(true);
    });

    it('ignora un segundo toque mientras mueve', async () => {
      page.movingBusy.set(true);
      page.openMove();

      await page.move('2026-09-19');

      expect(page.moving()).toBe(true);
    });

    it('nombra el dia de origen en minusculas', () => {
      expect(page.nombreDia(1)).toBe('lunes');
      expect(page.nombreDia(7)).toBe('domingo');
    });

    it('nombra el dia en espanol', () => {
      expect(page.etiquetaDia('2026-09-19')).toBe('Sábado, 19 de septiembre');
      expect(page.diaLargo(new Date(2026, 8, 19))).toBe('sábado, 19 de septiembre');
    });
  });

  describe('reload', () => {
    it('es un campo arrow invocable', () => {
      expect(() => page.reload()).not.toThrow();
    });
  });
});
