import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { WorkoutRunnerFacade } from '@app/application/workouts/workout-runner.facade';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import {
  WorkoutExerciseLog,
  WorkoutSession,
} from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { WorkoutRunnerPage } from './workout-runner.page';

const NOW = new Date('2026-09-17T18:00:00.000Z');

const SESSION: WorkoutSession = {
  id: 'wks-001',
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-001',
  title: 'Tracción',
  scheduledFor: NOW.toISOString(),
  startedAt: null,
  completedAt: null,
  status: 'scheduled',
  durationMinutes: null,
  estimatedMinutes: 50,
  exercises: [
    {
      routineExerciseId: 'a',
      exerciseId: 'ex-a',
      name: 'Dominadas',
      targetSets: 2,
      targetReps: 8,
      restSeconds: 60,
      weightKg: null,
      completedSets: 0,
      done: false,
      sets: [],
    },
    {
      routineExerciseId: 'b',
      exerciseId: 'ex-b',
      name: 'Remo',
      targetSets: 1,
      targetReps: 10,
      restSeconds: 45,
      weightKg: 25,
      completedSets: 0,
      done: false,
      sets: [],
    },
  ],
};

const [DOMINADAS, REMO] = SESSION.exercises as [WorkoutExerciseLog, WorkoutExerciseLog];

jest.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: {
    keepAwake: jest.fn<Promise<void>, []>(() => Promise.resolve()),
    allowSleep: jest.fn<Promise<void>, []>(() => Promise.resolve()),
  },
}));

describe('WorkoutRunnerPage', () => {
  let page: WorkoutRunnerPage;
  let router: Router;
  let complete: MockOf<WorkoutsPort['complete']>;

  const createPage = (session: WorkoutSession = SESSION): WorkoutRunnerPage => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // La pagina la declara en sus `providers`; aqui hay que darla a mano.
        WorkoutRunnerFacade,
        { provide: CLOCK, useValue: { now: () => new Date(Date.now()) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'wks-001' } } },
        },
        {
          provide: WORKOUTS_PORT,
          useValue: {
            getById: () => of(session),
            start: () => of({ ...session, status: 'in_progress' as const }),
            logSet: () => of(session),
            skipExercise: () => of(session),
            complete,
            listByStudent: fn<WorkoutsPort['listByStudent']>(),
            markExercise: fn<WorkoutsPort['markExercise']>(),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new WorkoutRunnerPage());
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    complete = fn<WorkoutsPort['complete']>().mockReturnValue(
      of({ ...SESSION, status: 'completed' as const }),
    );
    page = createPage();
  });

  afterEach(() => jest.useRealTimers());

  describe('carga inicial', () => {
    it('abre la sesion del parametro de ruta', () => {
      expect(page.facade.viewState()).toBe('success');
      expect(page.facade.exercises()).toHaveLength(2);
    });

    it('arranca en idle', () => {
      expect(page.facade.phase()).toBe('idle');
    });
  });

  describe('training()', () => {
    it('solo es true con la sesion en marcha', () => {
      page = createPage();
      expect(page.training()).toBe(false);

      page.facade.start();
      expect(page.training()).toBe(true);

      page.completeSet();
      expect(page.facade.phase()).toBe('rest');
      expect(page.training()).toBe(true);
    });
  });

  describe('elapsedLabel()', () => {
    it('arranca en cero', () => {
      expect(page.elapsedLabel()).toBe('00:00');
    });

    it('formatea minutos y segundos con dos digitos', () => {
      page.facade.start();
      jest.advanceTimersByTime(65_000);

      expect(page.elapsedLabel()).toBe('01:05');
    });
  });

  describe('totalPercent()', () => {
    it('es cero sin ejercicios completados', () => {
      expect(page.totalPercent()).toBe(0);
    });

    it('refleja el avance', () => {
      page = createPage({
        ...SESSION,
        exercises: [
          { ...(SESSION.exercises[0] as (typeof SESSION.exercises)[0]), done: true },
          SESSION.exercises[1] as (typeof SESSION.exercises)[1],
        ],
      });

      expect(page.totalPercent()).toBe(50);
    });
  });

  describe('restProgress()', () => {
    it('es cero fuera del descanso', () => {
      expect(page.restProgress()).toBe(0);
    });

    it('arranca en uno al entrar en descanso', () => {
      page.facade.start();
      page.facade.completeSet();

      expect(page.restProgress()).toBe(1);
    });

    it('baja con el paso del tiempo', () => {
      page.facade.start();
      page.facade.completeSet();

      jest.advanceTimersByTime(30_000);

      expect(page.restProgress()).toBeCloseTo(0.5);
    });
  });

  describe('resumen', () => {
    it('cuenta los ejercicios completados', () => {
      expect(page.completedExercises()).toBe(0);
    });

    it('suma las series hechas', () => {
      expect(page.completedSets()).toBe(0);
    });
  });

  describe('finish()', () => {
    it('cierra la sesion y vuelve a la rutina', async () => {
      page.facade.start();

      await page.finish();

      expect(complete).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/student/routine']);
    });

    it('libera el boton al terminar', async () => {
      page.facade.start();

      await page.finish();

      expect(page.saving()).toBe(false);
    });

    // El doble toque llegaba a guardar dos veces: `saving` era un computed
    // que siempre devolvia false y el boton nunca se deshabilitaba.
    it('ignora el segundo toque mientras guarda', async () => {
      page.facade.start();

      await Promise.all([page.finish(), page.finish()]);

      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  describe('salida con confirmacion', () => {
    it('sale directo si la sesion no ha empezado', () => {
      page.exit();

      expect(page.confirmingExit()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/student/routine']);
    });

    it('pide confirmacion con la sesion en curso', () => {
      page.facade.start();

      page.exit();

      expect(page.confirmingExit()).toBe(true);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('cancelar deja al alumno donde estaba', () => {
      page.facade.start();
      page.exit();

      page.cancelExit();

      expect(page.confirmingExit()).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('confirmar sale a la rutina', () => {
      page.facade.start();
      page.exit();

      page.leave();

      expect(page.confirmingExit()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/student/routine']);
    });
  });

  describe('exit()', () => {
    it('vuelve a la rutina sin cerrar la sesion', () => {
      page.exit();

      expect(complete).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/student/routine']);
    });
  });

  describe('registro de la serie', () => {
    it('muestra lo prescrito mientras el alumno no corrige', () => {
      page.facade.start();

      expect(page.repsValue()).toBe(8);
    });

    it('refleja lo que el alumno ajusta con el stepper', () => {
      page.facade.start();
      page.next();

      page.repsOverride.set(6);
      page.weightOverride.set(27.5);

      expect(page.repsValue()).toBe(6);
      expect(page.weightValue()).toBe(27.5);
    });

    it('manda la correccion al cerrar la serie', () => {
      page.facade.start();
      const completeSet = jest.spyOn(page.facade, 'completeSet');

      page.repsOverride.set(6);
      page.completeSet();

      expect(completeSet).toHaveBeenCalledWith(6, null, null);
    });

    it('vuelve a lo prescrito para la serie siguiente', () => {
      page.facade.start();
      page.repsOverride.set(6);

      page.completeSet();

      expect(page.repsValue()).toBe(8);
    });

    // Lo corregido era del ejercicio anterior.
    it('cambiar de ejercicio descarta lo corregido', () => {
      page.facade.start();
      page.repsOverride.set(3);

      page.next();
      page.previous();

      expect(page.repsValue()).toBe(8);
    });
  });

  describe('carga y medida', () => {
    it('un ejercicio sin kg es de peso corporal: sin campo de kg y lo dice', () => {
      page.facade.start();

      expect(page.conKg()).toBe(false);
      expect(page.metaLine()).toBe('Peso corporal · Descanso 1 min');
    });

    it('un ejercicio con peso muestra el campo de kg', () => {
      page.facade.start();
      page.next();

      expect(page.conKg()).toBe(true);
      expect(page.kgLabel()).toBe('kg');
      expect(page.metaLine()).toBe('Descanso 45 s');
    });

    it('con peso extra los kg se nombran como peso extra', () => {
      page = createPage({
        ...SESSION,
        exercises: [{ ...DOMINADAS, load: 'weighted_bodyweight', weightKg: 10 }],
      });
      page.facade.start();

      expect(page.kgLabel()).toBe('peso extra · kg');
    });

    it('sin descanso no muestra un "0 s"', () => {
      page = createPage({
        ...SESSION,
        exercises: [{ ...REMO, restSeconds: 0 }],
      });
      page.facade.start();

      expect(page.metaLine()).toBe('');
    });

    describe('por tiempo', () => {
      beforeEach(() => {
        page = createPage({
          ...SESSION,
          exercises: [{ ...DOMINADAS, name: 'Plancha', measure: 'time', durationSeconds: 45 }],
        });
        page.facade.start();
      });

      it('se reconoce y muestra la duracion en mm:ss', () => {
        expect(page.porTiempo()).toBe(true);
        expect(page.workLabel()).toBe('0:45');
      });

      it('la cuenta regresiva parte de la duracion ajustada', () => {
        page.durationOverride.set(60);

        page.toggleWork();
        jest.advanceTimersByTime(2000);

        expect(page.workLabel()).toBe('0:58');
      });

      it('pasos de 15 s en series cortas y de 1 min en las largas', () => {
        expect(page.durationStep()).toBe(15);

        page.durationOverride.set(600);

        expect(page.durationStep()).toBe(60);
      });

      it('manda la duracion al cerrar la serie', () => {
        const completeSet = jest.spyOn(page.facade, 'completeSet');
        page.durationOverride.set(40);

        page.completeSet();

        expect(completeSet).toHaveBeenCalledWith(null, null, 40);
      });
    });
  });

  describe('saltar con motivo', () => {
    it('askSkip() abre la hoja con el titulo de lo que se salta', () => {
      page.facade.start();

      page.askSkip('exercise');

      expect(page.skipping()).toBe('exercise');
      expect(page.skipTitle()).toBe('Saltar Dominadas');
    });

    it('ofrece los cuatro motivos', () => {
      expect(page.reasons.map(reason => reason.label)).toEqual([
        'Máquina ocupada',
        'Molestia o dolor',
        'Sin tiempo',
        'Otro motivo',
      ]);
    });

    it('elegir un motivo salta la serie con ese motivo y cierra la hoja', () => {
      page.facade.start();
      const skipSet = jest.spyOn(page.facade, 'skipSet');
      page.askSkip('set');

      page.confirmSkip('equipment_busy');

      expect(skipSet).toHaveBeenCalledWith('equipment_busy');
      expect(page.skipping()).toBeNull();
    });

    it('sin motivo tambien salta', () => {
      page.facade.start();
      const skipExercise = jest.spyOn(page.facade, 'skipExercise');
      page.askSkip('exercise');

      page.confirmSkip(null);

      expect(skipExercise).toHaveBeenCalledWith(null);
    });

    it('cancelar cierra sin saltar', () => {
      page.facade.start();
      const skipSet = jest.spyOn(page.facade, 'skipSet');
      page.askSkip('set');

      page.cancelSkip();
      page.confirmSkip('pain');

      expect(skipSet).not.toHaveBeenCalled();
    });

    it('el resumen cuenta los ejercicios saltados', () => {
      page = createPage({
        ...SESSION,
        exercises: [{ ...DOMINADAS, skipped: true }, REMO],
      });

      expect(page.skippedCount()).toBe(1);
      expect(page.skippedLabel()).toBe('Saltaste 1 ejercicio');
    });
  });

  describe('reload', () => {
    it('es un campo arrow invocable', () => {
      expect(() => page.reload()).not.toThrow();
    });
  });
});
