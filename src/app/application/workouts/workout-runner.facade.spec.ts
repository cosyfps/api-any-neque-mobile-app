import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { domainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import {
  WorkoutExerciseLog,
  WorkoutSession,
} from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { WorkoutRunnerFacade } from './workout-runner.facade';

const NOW = new Date('2026-09-17T18:00:00.000Z');

const log = (id: string, sets: number, rest: number, done = false): WorkoutExerciseLog => ({
  routineExerciseId: id,
  exerciseId: `ex-${id}`,
  name: `Ejercicio ${id}`,
  targetSets: sets,
  targetReps: 10,
  restSeconds: rest,
  weightKg: null,
  completedSets: done ? sets : 0,
  done,
  sets: [],
});

const session = (exercises: WorkoutExerciseLog[]): WorkoutSession => ({
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
  exercises,
});

const TWO_EXERCISES = session([log('a', 2, 60), log('b', 1, 45)]);

describe('WorkoutRunnerFacade', () => {
  let getById: MockOf<WorkoutsPort['getById']>;
  let start: MockOf<WorkoutsPort['start']>;
  let logSet: MockOf<WorkoutsPort['logSet']>;
  let complete: MockOf<WorkoutsPort['complete']>;
  let skipExercise: MockOf<WorkoutsPort['skipExercise']>;
  let current: WorkoutSession;

  const build = (): WorkoutRunnerFacade => {
    TestBed.configureTestingModule({
      providers: [
        WorkoutRunnerFacade,
        { provide: CLOCK, useValue: { now: () => NOW } },
        {
          provide: WORKOUTS_PORT,
          useValue: {
            getById,
            start,
            logSet,
            complete,
            skipExercise,
            listByStudent: fn<WorkoutsPort['listByStudent']>(),
            markExercise: fn<WorkoutsPort['markExercise']>(),
          },
        },
      ],
    });
    return TestBed.inject(WorkoutRunnerFacade);
  };

  /**
   * Los mocks hacen eco de la sesion en uso. Si devolvieran una fija, la
   * respuesta del puerto reemplazaria la sesion del test a mitad de flujo.
   */
  const useSession = (value: WorkoutSession): void => {
    current = value;
  };

  const opened = (): WorkoutRunnerFacade => {
    const facade = build();
    facade.open('wks-001');
    return facade;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    current = TWO_EXERCISES;
    getById = fn<WorkoutsPort['getById']>().mockImplementation(() => of(current));
    start = fn<WorkoutsPort['start']>().mockImplementation(() =>
      of({ ...current, status: 'in_progress' as const }),
    );
    logSet = fn<WorkoutsPort['logSet']>().mockImplementation(() => of(current));
    complete = fn<WorkoutsPort['complete']>().mockImplementation(() =>
      of({ ...current, status: 'completed' as const }),
    );
    skipExercise = fn<WorkoutsPort['skipExercise']>().mockImplementation(() => of(current));
  });

  afterEach(() => jest.useRealTimers());

  describe('open()', () => {
    it('carga la sesion', () => {
      const facade = opened();

      expect(getById).toHaveBeenCalledWith('wks-001');
      expect(facade.viewState()).toBe('success');
      expect(facade.exercises()).toHaveLength(2);
    });

    it('arranca en idle', () => {
      expect(opened().phase()).toBe('idle');
    });

    it('queda en error si la sesion no existe', () => {
      getById.mockReturnValue(throwError(() => domainError('not_found')));

      expect(opened().viewState()).toBe('error');
    });
  });

  describe('start()', () => {
    it('pasa a la fase de ejercicio', () => {
      const facade = opened();
      facade.start();

      expect(facade.phase()).toBe('exercise');
      expect(facade.currentExercise()?.routineExerciseId).toBe('a');
      expect(facade.currentSet()).toBe(1);
    });

    it('avisa al puerto', () => {
      opened().start();
      expect(start).toHaveBeenCalledWith('wks-001');
    });

    it('retoma desde el primer ejercicio pendiente', () => {
      useSession(session([log('a', 2, 60, true), log('b', 1, 45)]));
      const facade = opened();

      facade.start();

      expect(facade.currentExercise()?.routineExerciseId).toBe('b');
    });

    it('no hace nada sin sesion cargada', () => {
      getById.mockReturnValue(throwError(() => domainError('not_found')));
      const facade = opened();

      facade.start();

      expect(facade.phase()).toBe('idle');
    });

    it('cuenta el tiempo transcurrido', () => {
      const facade = opened();
      facade.start();

      jest.advanceTimersByTime(3000);

      expect(facade.elapsedSeconds()).toBe(3);
    });
  });

  describe('completeSet()', () => {
    it('entra en descanso si quedan series', () => {
      const facade = opened();
      facade.start();

      facade.completeSet();

      expect(facade.phase()).toBe('rest');
      expect(facade.restRemaining()).toBe(60);
      expect(facade.currentSet()).toBe(2);
    });

    // Confirmar sin tocar nada manda lo prescrito: un toque, igual que antes.
    it('registra la serie con lo prescrito', () => {
      const facade = opened();
      facade.start();

      facade.completeSet();

      expect(logSet).toHaveBeenCalledWith('wks-001', 'a', {
        setNumber: 1,
        reps: 10,
        weightKg: null,
        durationSeconds: null,
      });
    });

    it('registra el peso y las repeticiones corregidas', () => {
      useSession(session([{ ...log('a', 2, 60), weightKg: 40 }]));
      const facade = opened();
      facade.start();

      facade.completeSet(8, 45);

      expect(logSet).toHaveBeenCalledWith('wks-001', 'a', {
        setNumber: 1,
        reps: 8,
        weightKg: 45,
        durationSeconds: null,
      });
    });

    // Peso corporal: no hay kg que registrar aunque llegue uno.
    it('no registra kg en un ejercicio de peso corporal', () => {
      const facade = opened();
      facade.start();

      facade.completeSet(8, 45);

      expect(logSet).toHaveBeenCalledWith(
        'wks-001',
        'a',
        expect.objectContaining({ weightKg: null }),
      );
    });

    it('por tiempo registra la duracion y no repeticiones', () => {
      useSession(session([{ ...log('a', 1, 0), measure: 'time', durationSeconds: 45 }]));
      const facade = opened();
      facade.start();

      facade.completeSet(null, null, 40);

      expect(logSet).toHaveBeenCalledWith('wks-001', 'a', {
        setNumber: 1,
        reps: null,
        weightKg: null,
        durationSeconds: 40,
      });
    });

    it('por tiempo sin corregir registra la duracion prescrita', () => {
      useSession(session([{ ...log('a', 1, 0), measure: 'time', durationSeconds: 45 }]));
      const facade = opened();
      facade.start();

      facade.completeSet();

      expect(logSet).toHaveBeenCalledWith(
        'wks-001',
        'a',
        expect.objectContaining({ durationSeconds: 45 }),
      );
    });

    it('avanza al siguiente ejercicio tras la ultima serie', () => {
      const facade = opened();
      facade.start();
      facade.completeSet();
      facade.skipRest();

      facade.completeSet();

      expect(facade.exerciseIndex()).toBe(1);
      expect(facade.currentSet()).toBe(1);
    });

    it('termina en summary tras el ultimo ejercicio', () => {
      useSession(session([log('solo', 1, 30)]));
      const facade = opened();
      facade.start();

      facade.completeSet();

      expect(facade.phase()).toBe('summary');
    });

    it('salta el descanso cuando el ejercicio no lo define', () => {
      useSession(session([log('a', 2, 0), log('b', 1, 0)]));
      const facade = opened();
      facade.start();

      facade.completeSet();

      expect(facade.phase()).toBe('exercise');
    });

    it('no hace nada sin sesion', () => {
      getById.mockReturnValue(throwError(() => domainError('not_found')));
      const facade = opened();

      facade.completeSet();

      expect(facade.phase()).toBe('idle');
    });
  });

  describe('saltar', () => {
    it('skipSet() registra la serie saltada con su motivo y pasa a la siguiente sin descanso', () => {
      const facade = opened();
      facade.start();

      facade.skipSet('equipment_busy');

      expect(logSet).toHaveBeenCalledWith('wks-001', 'a', {
        setNumber: 1,
        reps: null,
        weightKg: null,
        skipped: true,
        skipReason: 'equipment_busy',
      });
      expect(facade.phase()).toBe('exercise');
      expect(facade.currentSet()).toBe(2);
    });

    it('skipSet() en la ultima serie pasa al siguiente ejercicio', () => {
      const facade = opened();
      facade.start();
      facade.skipSet();
      facade.skipSet();

      expect(facade.exerciseIndex()).toBe(1);
      expect(facade.phase()).toBe('exercise');
    });

    it('skipExercise() salta lo que queda y pasa al siguiente', () => {
      const facade = opened();
      facade.start();

      facade.skipExercise('pain');

      expect(skipExercise).toHaveBeenCalledWith('wks-001', 'a', 'pain');
      expect(facade.exerciseIndex()).toBe(1);
      expect(facade.currentSet()).toBe(1);
    });

    it('skipExercise() en el ultimo ejercicio va al resumen', () => {
      const facade = opened();
      facade.start();
      facade.next();

      facade.skipExercise(null);

      expect(facade.phase()).toBe('summary');
    });

    it('sin sesion no hace nada', () => {
      const facade = build();

      facade.skipSet();
      facade.skipExercise();

      expect(logSet).not.toHaveBeenCalled();
      expect(skipExercise).not.toHaveBeenCalled();
    });
  });

  describe('cuenta regresiva por tiempo', () => {
    it('inicia desde los segundos dados y descuenta', () => {
      const facade = opened();
      facade.start();

      facade.toggleWork(45);
      jest.advanceTimersByTime(3000);

      expect(facade.workRunning()).toBe(true);
      expect(facade.workRemaining()).toBe(42);
    });

    it('pausar y reanudar sigue desde donde quedo', () => {
      const facade = opened();
      facade.start();
      facade.toggleWork(45);
      jest.advanceTimersByTime(5000);

      facade.toggleWork(45);
      jest.advanceTimersByTime(5000);
      expect(facade.workRemaining()).toBe(40);

      facade.toggleWork(45);
      jest.advanceTimersByTime(1000);
      expect(facade.workRemaining()).toBe(39);
    });

    it('se detiene sola en cero', () => {
      const facade = opened();
      facade.start();
      facade.toggleWork(2);

      jest.advanceTimersByTime(5000);

      expect(facade.workRemaining()).toBe(0);
      expect(facade.workRunning()).toBe(false);
    });

    it('resetWork() la vuelve al inicio, detenida', () => {
      const facade = opened();
      facade.start();
      facade.toggleWork(45);
      jest.advanceTimersByTime(2000);

      facade.resetWork();

      expect(facade.workRemaining()).toBeNull();
      expect(facade.workRunning()).toBe(false);
    });

    it('cerrar la serie la limpia', () => {
      const facade = opened();
      facade.start();
      facade.toggleWork(45);

      facade.completeSet();

      expect(facade.workRemaining()).toBeNull();
    });
  });

  describe('descanso', () => {
    const resting = (): WorkoutRunnerFacade => {
      const facade = opened();
      facade.start();
      facade.completeSet();
      return facade;
    };

    it('descuenta un segundo por tick', () => {
      const facade = resting();

      jest.advanceTimersByTime(1000);

      expect(facade.restRemaining()).toBe(59);
    });

    it('vuelve a ejercicio al llegar a cero', () => {
      const facade = resting();

      jest.advanceTimersByTime(60_000);

      expect(facade.restRemaining()).toBe(0);
      expect(facade.phase()).toBe('exercise');
    });

    it('addRest() suma quince segundos', () => {
      const facade = resting();

      facade.addRest();

      expect(facade.restRemaining()).toBe(75);
    });

    it('addRest() no hace nada fuera del descanso', () => {
      const facade = opened();
      facade.start();

      facade.addRest();

      expect(facade.restRemaining()).toBe(0);
    });

    it('skipRest() termina el descanso de inmediato', () => {
      const facade = resting();

      facade.skipRest();

      expect(facade.phase()).toBe('exercise');
      expect(facade.restRemaining()).toBe(0);
    });

    it('skipRest() no hace nada fuera del descanso', () => {
      const facade = opened();
      facade.start();

      facade.skipRest();

      expect(facade.phase()).toBe('exercise');
    });

    it('el temporizador se detiene al saltar', () => {
      const facade = resting();
      facade.skipRest();

      jest.advanceTimersByTime(5000);

      expect(facade.restRemaining()).toBe(0);
      expect(facade.phase()).toBe('exercise');
    });
  });

  describe('navegacion manual', () => {
    it('next() avanza de ejercicio', () => {
      const facade = opened();
      facade.start();

      facade.next();

      expect(facade.exerciseIndex()).toBe(1);
    });

    it('next() en el ultimo ejercicio termina la sesion', () => {
      const facade = opened();
      facade.start();
      facade.next();

      facade.next();

      expect(facade.phase()).toBe('summary');
    });

    it('previous() retrocede de ejercicio', () => {
      const facade = opened();
      facade.start();
      facade.next();

      facade.previous();

      expect(facade.exerciseIndex()).toBe(0);
    });

    it('previous() no retrocede del primero', () => {
      const facade = opened();
      facade.start();

      facade.previous();

      expect(facade.exerciseIndex()).toBe(0);
    });
  });

  describe('totalProgress()', () => {
    it('es cero sin nada hecho', () => {
      expect(opened().totalProgress()).toBe(0);
    });

    it('refleja los ejercicios marcados', () => {
      useSession(session([log('a', 2, 60, true), log('b', 1, 45)]));

      expect(opened().totalProgress()).toBe(0.5);
    });

    it('es cero sin ejercicios', () => {
      useSession(session([]));

      expect(opened().totalProgress()).toBe(0);
    });
  });

  describe('finish()', () => {
    it('cierra la sesion y pasa a summary', async () => {
      const facade = opened();
      facade.start();
      jest.advanceTimersByTime(120_000);

      const ok = await facade.finish();

      expect(ok).toBe(true);
      expect(facade.phase()).toBe('summary');
      expect(complete).toHaveBeenCalledWith('wks-001', { durationMinutes: 2, note: null });
    });

    it('nunca reporta menos de un minuto', async () => {
      const facade = opened();
      facade.start();

      await facade.finish();

      expect(complete).toHaveBeenCalledWith('wks-001', { durationMinutes: 1, note: null });
    });

    it('devuelve false si el puerto falla', async () => {
      complete.mockReturnValue(throwError(() => domainError('network')));
      const facade = opened();
      facade.start();

      expect(await facade.finish()).toBe(false);
    });

    it('devuelve false sin sesion', async () => {
      getById.mockReturnValue(throwError(() => domainError('not_found')));

      expect(await opened().finish()).toBe(false);
    });
  });

  describe('reload()', () => {
    it('vuelve a consultar la sesion', () => {
      const facade = opened();
      facade.reload();

      expect(getById).toHaveBeenCalledTimes(2);
    });
  });
});
