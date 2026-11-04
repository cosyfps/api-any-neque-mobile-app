import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { SessionFacade } from '@app/application/auth/session.facade';
import { Routine, RoutineDay, dayForWeekday } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { DomainError, toDomainError } from '@app/domain/shared/model/app-error';
import { Weekday, isWithinRange, isoWeekday, weekRange } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { localDay, rescheduleOptions } from '@app/domain/workouts/model/reschedule-rules';
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

  /**
   * Sesiones de la semana en curso (sin las omitidas). Solo esta semana: antes,
   * sin sesion hoy, se tomaba la de ese dia semanas adelante y el grafico
   * semanal (que cuenta por fecha) no subia.
   */
  private readonly weekSessions: Signal<WorkoutSession[]> = computed(() => {
    const semana = weekRange(this.clock.now());
    return (this.sessions.data() ?? []).filter(
      item => item.status !== 'skipped' && isWithinRange(item.scheduledFor, semana),
    );
  });

  /**
   * Sesion del dia seleccionado segun su FECHA. Un entrenamiento movido a otro
   * dia (A-3) aparece en el dia al que se movio, no en su dia de rutina.
   */
  readonly selectedSession: Signal<WorkoutSession | null> = computed(() =>
    this.sessionOn(this._selectedWeekday()),
  );

  /** Lo que se muestra: el dia de rutina de la sesion, o el que toca ese dia. */
  readonly selectedDay: Signal<RoutineDay | null> = computed(() => {
    const session = this.selectedSession();
    if (session !== null) {
      const delaSesion = this.days().find(day => day.id === session.routineDayId);
      if (delaSesion !== undefined) {
        return delaSesion;
      }
    }
    return this.routineDayOn(this._selectedWeekday());
  });

  /**
   * Si el entrenamiento de rutina de este dia se movio a otro dia de la
   * semana, la fecha a la que se movio. Ese dia ya no se entrena aqui.
   */
  readonly movedAway: Signal<Date | null> = computed(() => {
    if (this.selectedSession() !== null) {
      return null;
    }
    const day = this.routineDayOn(this._selectedWeekday());
    const movida =
      day === null ? undefined : this.weekSessions().find(item => item.routineDayId === day.id);
    return movida === undefined ? null : new Date(movida.scheduledFor);
  });

  /** Dia de la semana desde el que se movio la sesion seleccionada, si se movio. */
  readonly movedFrom: Signal<Weekday | null> = computed(() => {
    const session = this.selectedSession();
    const origen = this.days().find(day => day.id === session?.routineDayId);
    return origen !== undefined && origen.weekday !== this._selectedWeekday()
      ? origen.weekday
      : null;
  });

  /** Para el punto del selector: ese dia hay algo que entrenar esta semana. */
  hasTrainingOn(weekday: Weekday): boolean {
    if (this.sessionOn(weekday) !== null) {
      return true;
    }
    const day = this.routineDayOn(weekday);
    // Un dia de rutina cuyo entrenamiento se movio a otro dia queda libre.
    return (
      day !== null &&
      !this.weekSessions().some(
        item => item.routineDayId === day.id && isoWeekday(new Date(item.scheduledFor)) !== weekday,
      )
    );
  }

  private sessionOn(weekday: Weekday): WorkoutSession | null {
    return (
      this.weekSessions().find(item => isoWeekday(new Date(item.scheduledFor)) === weekday) ?? null
    );
  }

  private routineDayOn(weekday: Weekday): RoutineDay | null {
    const routine = this.routine.data();
    return routine === null || routine === undefined ? null : dayForWeekday(routine, weekday);
  }

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

  /**
   * Dias (`yyyy-MM-dd`) a los que se puede mover la sesion seleccionada: el
   * resto de su semana desde hoy. Vacio si ya empezo o no hay sesion (A-3).
   */
  readonly moveOptions: Signal<string[]> = computed(() => {
    const session = this.selectedSession();
    if (session === null || session.status !== 'scheduled' || session.startedAt !== null) {
      return [];
    }
    const dia = localDay(new Date(session.scheduledFor));
    // Dias con otro entrenamiento: no se ofrecen.
    const ocupados = (this.sessions.data() ?? [])
      .filter(item => item.id !== session.id && item.status !== 'skipped')
      .map(item => localDay(new Date(item.scheduledFor)));
    return rescheduleOptions(dia, dia, localDay(this.clock.now()), ocupados);
  });

  private readonly _moveError = signal<DomainError | null>(null);
  readonly moveError: Signal<DomainError | null> = this._moveError.asReadonly();

  /** Mueve la sesion seleccionada a otro dia de su semana. */
  moveSelectedSession(day: string): Promise<boolean> {
    const session = this.selectedSession();
    if (session === null) {
      return Promise.resolve(false);
    }
    this._moveError.set(null);
    return new Promise(resolve => {
      this.workouts.reschedule(session.id, day).subscribe({
        next: updated => {
          this.replace(updated);
          resolve(true);
        },
        error: (cause: unknown) => {
          this._moveError.set(toDomainError(cause));
          resolve(false);
        },
      });
    });
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
