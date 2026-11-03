import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';

import { measureOf, usesKg } from '@app/domain/routines/model/prescription';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import {
  WorkoutExerciseLog,
  WorkoutSession,
  isResolved,
} from '@app/domain/workouts/model/workout-session.model';
import { SkipReason, WorkoutSetInput } from '@app/domain/workouts/model/workout-set.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/** Fases de la ejecucion guiada de una sesion. */
export type RunnerPhase = 'idle' | 'exercise' | 'rest' | 'summary';

const TICK_MS = 1000;
const EXTRA_REST_SECONDS = 15;

/**
 * Maquina de estados de "Start Workout".
 *
 * El temporizador se limpia en `DestroyRef.onDestroy`, el mismo patron que
 * ya usa `forgot-password.page.ts` para su countdown.
 */
@Injectable()
export class WorkoutRunnerFacade {
  private readonly port = inject(WORKOUTS_PORT);
  private readonly clock = inject(CLOCK);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _phase = signal<RunnerPhase>('idle');
  private readonly _exerciseIndex = signal(0);
  private readonly _setIndex = signal(0);
  private readonly _restRemaining = signal(0);
  private readonly _startedAt = signal<number | null>(null);
  private readonly _elapsedSeconds = signal(0);
  private readonly _workRemaining = signal<number | null>(null);
  private readonly _workRunning = signal(false);

  private restTimer: ReturnType<typeof setInterval> | null = null;
  private elapsedTimer: ReturnType<typeof setInterval> | null = null;
  private workTimer: ReturnType<typeof setInterval> | null = null;

  readonly session: AsyncState<WorkoutSession> = asyncState<WorkoutSession>();

  readonly phase: Signal<RunnerPhase> = this._phase.asReadonly();
  readonly exerciseIndex: Signal<number> = this._exerciseIndex.asReadonly();
  readonly restRemaining: Signal<number> = this._restRemaining.asReadonly();
  readonly elapsedSeconds: Signal<number> = this._elapsedSeconds.asReadonly();
  /** Segundos que le quedan a la serie por tiempo; null si no se inicio. */
  readonly workRemaining: Signal<number | null> = this._workRemaining.asReadonly();
  readonly workRunning: Signal<boolean> = this._workRunning.asReadonly();

  readonly exercises: Signal<readonly WorkoutExerciseLog[]> = computed(
    () => this.session.data()?.exercises ?? [],
  );

  readonly currentExercise: Signal<WorkoutExerciseLog | null> = computed(
    () => this.exercises()[this._exerciseIndex()] ?? null,
  );

  /** Numero de serie en curso, empezando en 1. */
  readonly currentSet: Signal<number> = computed(() => this._setIndex() + 1);

  readonly totalSets: Signal<number> = computed(() => this.currentExercise()?.targetSets ?? 0);

  readonly isLastExercise: Signal<boolean> = computed(
    () => this._exerciseIndex() >= this.exercises().length - 1,
  );

  /** Avance global de la sesion, entre 0 y 1. Lo saltado tambien avanza. */
  readonly totalProgress: Signal<number> = computed(() => {
    const all = this.exercises();
    if (all.length === 0) {
      return 0;
    }
    return all.filter(isResolved).length / all.length;
  });

  readonly restTotal: Signal<number> = computed(() => this.currentExercise()?.restSeconds ?? 0);

  readonly viewState: Signal<ViewState> = this.session.viewState;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearRestTimer();
      this.clearElapsedTimer();
      this.clearWork();
      this.session.destroy();
    });
  }

  /** Carga la sesion a ejecutar. */
  open(sessionId: string): void {
    this.session.load(() => this.port.getById(sessionId));
  }

  reload(): void {
    this.session.reload();
  }

  /** Arranca la ejecucion desde el primer ejercicio no completado. */
  start(): void {
    const current = this.session.data();
    if (current === null) {
      return;
    }

    const firstPending = current.exercises.findIndex(exercise => !isResolved(exercise));
    this._exerciseIndex.set(firstPending === -1 ? 0 : firstPending);
    this._setIndex.set(0);
    this._phase.set('exercise');
    this._startedAt.set(this.clock.now().getTime());
    this.startElapsedTimer();

    this.port.start(current.id).subscribe({
      next: updated => this.session.set(updated),
      error: () => undefined,
    });
  }

  /**
   * Cierra la serie en curso. Si quedan series, entra en descanso;
   * si era la ultima, marca el ejercicio y avanza.
   *
   * `reps` y `weightKg` en `null` significan "tal como se prescribio": es el
   * caso normal, y evita que confirmar sin tocar nada cueste mas de un toque.
   */
  completeSet(
    reps: number | null = null,
    weightKg: number | null = null,
    durationSeconds: number | null = null,
  ): void {
    const exercise = this.currentExercise();
    const current = this.session.data();
    if (exercise === null || current === null) {
      return;
    }

    const porTiempo = measureOf(exercise) === 'time';
    const serie: WorkoutSetInput = {
      setNumber: this._setIndex() + 1,
      reps: porTiempo ? null : (reps ?? exercise.targetReps),
      weightKg: usesKg(exercise) ? (weightKg ?? exercise.weightKg) : null,
      durationSeconds: porTiempo ? (durationSeconds ?? exercise.durationSeconds ?? null) : null,
    };

    this.registrarYAvanzar(current.id, exercise, serie, true);
  }

  /**
   * Salta la serie en curso. No hay descanso despues: si no se hizo, no hay
   * de que recuperarse.
   */
  skipSet(reason: SkipReason | null = null): void {
    const exercise = this.currentExercise();
    const current = this.session.data();
    if (exercise === null || current === null) {
      return;
    }

    this.registrarYAvanzar(
      current.id,
      exercise,
      {
        setNumber: this._setIndex() + 1,
        reps: null,
        weightKg: null,
        skipped: true,
        skipReason: reason,
      },
      false,
    );
  }

  /** Salta las series que le quedan al ejercicio y pasa al siguiente. */
  skipExercise(reason: SkipReason | null = null): void {
    const exercise = this.currentExercise();
    const current = this.session.data();
    if (exercise === null || current === null) {
      return;
    }

    const wasLastExercise = this.isLastExercise();
    this.clearWork();
    this.clearRestTimer();
    this.port.skipExercise(current.id, exercise.routineExerciseId, reason).subscribe({
      next: updated => this.session.set(updated),
      error: () => undefined,
    });

    if (wasLastExercise) {
      this.finishToSummary();
      return;
    }
    this._exerciseIndex.update(index => index + 1);
    this._setIndex.set(0);
    this._phase.set('exercise');
  }

  /**
   * Cuenta regresiva de una serie por tiempo: inicia, o pausa si ya corre.
   * Reanudar sigue desde donde quedo; al llegar a cero se detiene sola.
   */
  toggleWork(seconds: number): void {
    if (this._workRunning()) {
      this.pauseWork();
      return;
    }
    const pendiente = this._workRemaining();
    this._workRemaining.set(pendiente === null || pendiente <= 0 ? seconds : pendiente);
    this._workRunning.set(true);

    this.workTimer = setInterval(() => {
      const next = (this._workRemaining() ?? 0) - 1;
      this._workRemaining.set(Math.max(0, next));
      if (next <= 0) {
        this.pauseWork();
      }
    }, TICK_MS);
  }

  /** Vuelve la cuenta regresiva al inicio, detenida. */
  resetWork(): void {
    this.clearWork();
  }

  /** Suma 15 segundos al descanso en curso. */
  addRest(): void {
    if (this._phase() !== 'rest') {
      return;
    }
    this._restRemaining.update(value => value + EXTRA_REST_SECONDS);
  }

  /** Termina el descanso de inmediato. */
  skipRest(): void {
    if (this._phase() !== 'rest') {
      return;
    }
    this.clearRestTimer();
    this._restRemaining.set(0);
    this._phase.set('exercise');
  }

  /** Vuelve al ejercicio anterior. */
  previous(): void {
    if (this._exerciseIndex() === 0) {
      return;
    }
    this.clearRestTimer();
    this.clearWork();
    this._exerciseIndex.update(index => index - 1);
    this._setIndex.set(0);
    this._phase.set('exercise');
  }

  /** Salta al siguiente ejercicio sin completar el actual. */
  next(): void {
    if (this.isLastExercise()) {
      this.finishToSummary();
      return;
    }
    this.clearRestTimer();
    this.clearWork();
    this._exerciseIndex.update(index => index + 1);
    this._setIndex.set(0);
    this._phase.set('exercise');
  }

  /** Cierra la sesion contra el puerto. Devuelve true si quedo completada. */
  finish(): Promise<boolean> {
    const current = this.session.data();
    if (current === null) {
      return Promise.resolve(false);
    }

    this.clearRestTimer();
    this.clearElapsedTimer();

    return new Promise(resolve => {
      this.port
        .complete(current.id, {
          durationMinutes: Math.max(1, Math.round(this._elapsedSeconds() / 60)),
          note: null,
        })
        .subscribe({
          next: updated => {
            this.session.set(updated);
            this._phase.set('summary');
            resolve(true);
          },
          error: () => resolve(false),
        });
    });
  }

  private finishToSummary(): void {
    this.clearRestTimer();
    this.clearElapsedTimer();
    this.clearWork();
    this._phase.set('summary');
  }

  /**
   * Registra la serie y mueve el runner: a la siguiente serie, al siguiente
   * ejercicio o al resumen.
   *
   * La decision se toma ANTES de persistir: la respuesta del puerto reemplaza
   * la sesion y moveria `isLastExercise()` bajo nuestros pies.
   */
  private registrarYAvanzar(
    sessionId: string,
    exercise: WorkoutExerciseLog,
    serie: WorkoutSetInput,
    descansar: boolean,
  ): void {
    const nextSetIndex = this._setIndex() + 1;
    const wasLastExercise = this.isLastExercise();
    this.clearWork();
    this.persistSet(sessionId, exercise.routineExerciseId, serie);

    if (nextSetIndex < exercise.targetSets) {
      this._setIndex.set(nextSetIndex);
      this.despuesDeSerie(exercise.restSeconds, descansar);
      return;
    }

    if (wasLastExercise) {
      this.finishToSummary();
      return;
    }

    this._exerciseIndex.update(index => index + 1);
    this._setIndex.set(0);
    this.despuesDeSerie(exercise.restSeconds, descansar);
  }

  private despuesDeSerie(restSeconds: number, descansar: boolean): void {
    if (descansar) {
      this.beginRest(restSeconds);
      return;
    }
    this.clearRestTimer();
    this._phase.set('exercise');
  }

  private pauseWork(): void {
    if (this.workTimer !== null) {
      clearInterval(this.workTimer);
      this.workTimer = null;
    }
    this._workRunning.set(false);
  }

  private clearWork(): void {
    this.pauseWork();
    this._workRemaining.set(null);
  }

  private persistSet(sessionId: string, routineExerciseId: string, set: WorkoutSetInput): void {
    this.port.logSet(sessionId, routineExerciseId, set).subscribe({
      next: updated => this.session.set(updated),
      error: () => undefined,
    });
  }

  private beginRest(seconds: number): void {
    if (seconds <= 0) {
      this._phase.set('exercise');
      return;
    }

    this.clearRestTimer();
    this._restRemaining.set(seconds);
    this._phase.set('rest');

    this.restTimer = setInterval(() => {
      const next = this._restRemaining() - 1;
      this._restRemaining.set(Math.max(0, next));
      if (next <= 0) {
        this.clearRestTimer();
        this._phase.set('exercise');
      }
    }, TICK_MS);
  }

  private startElapsedTimer(): void {
    this.clearElapsedTimer();
    this._elapsedSeconds.set(0);

    this.elapsedTimer = setInterval(() => {
      this._elapsedSeconds.update(value => value + 1);
    }, TICK_MS);
  }

  private clearRestTimer(): void {
    if (this.restTimer !== null) {
      clearInterval(this.restTimer);
      this.restTimer = null;
    }
  }

  private clearElapsedTimer(): void {
    if (this.elapsedTimer !== null) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }
}
