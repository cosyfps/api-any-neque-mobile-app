import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { SessionFacade } from '@app/application/auth/session.facade';
import { Routine, RoutineDay, dayForWeekday } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { Weekday, isSameDay, isoWeekday, parseIsoDate } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import {
  WorkoutSession,
  sessionProgress,
  skippedExercises,
} from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/** Rutina vigente del alumno y su avance del dia seleccionado. */
// Scoped a la ruta /student: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class StudentRoutineFacade {
  private readonly routines = inject(ROUTINES_PORT);
  private readonly workouts = inject(WORKOUTS_PORT);
  private readonly session = inject(SessionFacade);
  private readonly clock = inject(CLOCK);

  // El dia inicial sale del puerto: con `new Date()` el spec no es determinista
  // y el `CLOCK` inyectado arriba quedaba de adorno.
  private readonly _selectedWeekday = signal<Weekday>(isoWeekday(this.clock.now()));

  readonly routine: AsyncState<Routine | null> = asyncState<Routine | null>({
    // Un alumno sin rutina asignada es un estado vacio legitimo.
    isEmpty: value => value === null,
  });
  readonly sessions: AsyncState<WorkoutSession[]> = asyncState<WorkoutSession[]>();

  readonly selectedWeekday: Signal<Weekday> = this._selectedWeekday.asReadonly();

  /** Dias con entrenamiento, para el selector superior. */
  readonly days: Signal<readonly RoutineDay[]> = computed(() => this.routine.data()?.days ?? []);

  readonly selectedDay: Signal<RoutineDay | null> = computed(() => {
    const routine = this.routine.data();
    return routine === null || routine === undefined
      ? null
      : dayForWeekday(routine, this._selectedWeekday());
  });

  /** Sesion asociada al dia seleccionado dentro de la semana en curso. */
  readonly selectedSession: Signal<WorkoutSession | null> = computed(() => {
    const day = this.selectedDay();
    if (day === null) {
      return null;
    }
    const today = this.clock.now();
    const candidates = (this.sessions.data() ?? []).filter(
      item => item.routineDayId === day.id && item.status !== 'skipped',
    );

    const ofToday = candidates.find(item => {
      const scheduled = parseIsoDate(item.scheduledFor);
      return scheduled !== null && isSameDay(scheduled, today);
    });

    return ofToday ?? candidates[candidates.length - 1] ?? null;
  });

  /** Avance del dia seleccionado, entre 0 y 1. */
  readonly dayProgress: Signal<number> = computed(() => {
    const session = this.selectedSession();
    return session === null ? 0 : sessionProgress(session);
  });

  readonly isDayCompleted: Signal<boolean> = computed(
    () => this.selectedSession()?.status === 'completed',
  );

  /** Ejercicios saltados enteros en la sesion del dia seleccionado. */
  readonly daySkipped: Signal<number> = computed(() => {
    const session = this.selectedSession();
    return session === null ? 0 : skippedExercises(session);
  });

  /** Sesiones ya celebradas: desmarcar y volver a marcar no repite el festejo. */
  private readonly celebradas = new Set<string>();

  readonly viewState: Signal<ViewState> = this.routine.viewState;

  load(): void {
    const studentId = this.session.profileId();
    if (studentId === null) {
      return;
    }
    this.routine.load(() => this.routines.getActiveForStudent(studentId));
    this.sessions.load(() => this.workouts.listByStudent(studentId));
    this._selectedWeekday.set(isoWeekday(this.clock.now()));
  }

  reload(): void {
    this.routine.reload();
    this.sessions.reload();
  }

  selectDay(weekday: Weekday): void {
    this._selectedWeekday.set(weekday);
  }

  /** Marca o desmarca un ejercicio de la sesion del dia seleccionado. */
  toggleExercise(routineExerciseId: string, done: boolean): Promise<boolean> {
    const session = this.selectedSession();
    if (session === null) {
      return Promise.resolve(false);
    }

    return new Promise(resolve => {
      this.workouts.markExercise(session.id, routineExerciseId, done).subscribe({
        next: updated => {
          this.replace(updated);
          resolve(true);
        },
        error: () => resolve(false),
      });
    });
  }

  /** Cierra la sesion del dia seleccionado. */
  completeSelectedSession(durationMinutes: number): Promise<boolean> {
    const session = this.selectedSession();
    if (session === null) {
      return Promise.resolve(false);
    }

    return new Promise(resolve => {
      this.workouts.complete(session.id, { durationMinutes, note: null }).subscribe({
        next: updated => {
          this.replace(updated);
          resolve(true);
        },
        error: () => resolve(false),
      });
    });
  }

  /**
   * True la primera vez que la sesion seleccionada queda completada.
   * La celebracion es un premio, no algo que se repite a voluntad.
   */
  claimCelebration(): boolean {
    const session = this.selectedSession();
    if (session === null || session.status !== 'completed' || this.celebradas.has(session.id)) {
      return false;
    }
    this.celebradas.add(session.id);
    return true;
  }

  private replace(updated: WorkoutSession): void {
    this.sessions.set(
      (this.sessions.data() ?? []).map(item => (item.id === updated.id ? updated : item)),
    );
  }
}
