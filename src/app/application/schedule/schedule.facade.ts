import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { SessionFacade } from '@app/application/auth/session.facade';
import { Routine } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { MonthCell, buildMonthGrid } from '@app/domain/schedule/model/month-grid';
import { PlannedTraining, plannedTrainingOn } from '@app/domain/schedule/model/planned-training';
import { CancelReason, ScheduledSession } from '@app/domain/schedule/model/scheduled-session.model';
import { SCHEDULE_PORT } from '@app/domain/schedule/port/schedule.port';
import {
  addMonths,
  isSameDay,
  monthRange,
  parseIsoDate,
  startOfDay,
} from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

const MONTH_LABEL = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' });

/** Agenda mensual del alumno. */
// Scoped a la ruta /student: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class ScheduleFacade {
  private readonly port = inject(SCHEDULE_PORT);
  private readonly routines = inject(ROUTINES_PORT);
  private readonly workouts = inject(WORKOUTS_PORT);
  private readonly session = inject(SessionFacade);
  private readonly clock = inject(CLOCK);

  // Igual que el dia seleccionado: el mes inicial sale del puerto.
  private readonly _month = signal(startOfDay(this.clock.now()));
  private readonly _selectedDay = signal<Date | null>(null);

  readonly sessions: AsyncState<ScheduledSession[]> = asyncState<ScheduledSession[]>();

  /**
   * Rutina vigente y sesiones del mes: de ahi salen los dias de entrenamiento.
   * Si fallan, la agenda sigue mostrando las citas; solo faltan esos dias.
   */
  readonly routine: AsyncState<Routine | null> = asyncState<Routine | null>({
    isEmpty: () => false,
  });
  readonly workoutSessions: AsyncState<WorkoutSession[]> = asyncState<WorkoutSession[]>();

  readonly month: Signal<Date> = this._month.asReadonly();
  readonly selectedDay: Signal<Date | null> = this._selectedDay.asReadonly();

  readonly monthLabel: Signal<string> = computed(() => MONTH_LABEL.format(this._month()));

  readonly grid: Signal<MonthCell[][]> = computed(() => {
    const month = this._month();
    return buildMonthGrid(month.getFullYear(), month.getMonth(), this.clock.now());
  });

  readonly all: Signal<readonly ScheduledSession[]> = computed(() => this.sessions.data() ?? []);

  /** Sesiones del dia seleccionado, o del dia de hoy si no hay seleccion. */
  readonly daySessions: Signal<readonly ScheduledSession[]> = computed(() => {
    const day = this._selectedDay() ?? this.clock.now();
    return this.all().filter(item => {
      const startsAt = parseIsoDate(item.startsAt);
      return startsAt !== null && isSameDay(startsAt, day);
    });
  });

  /** Entrenamiento de la rutina en el dia seleccionado (o hoy). */
  readonly dayTraining: Signal<PlannedTraining | null> = computed(() =>
    this.trainingOn(this._selectedDay() ?? this.clock.now()),
  );

  readonly viewState: Signal<ViewState> = this.sessions.viewState;

  /** Entrenamiento que la rutina vigente pone en esa fecha. */
  trainingOn(date: Date): PlannedTraining | null {
    const studentId = this.session.profileId();
    if (studentId === null) {
      return null;
    }
    return plannedTrainingOn(
      this.routine.data() ?? null,
      studentId,
      date,
      this.workoutSessions.data() ?? [],
      this.clock.now(),
    );
  }

  /** True si ese dia tiene una cita no cancelada o entrenamiento de la rutina. */
  hasSessions(date: Date): boolean {
    if (this.trainingOn(date) !== null) {
      return true;
    }
    return this.all().some(item => {
      if (item.status === 'cancelled') {
        return false;
      }
      const startsAt = parseIsoDate(item.startsAt);
      return startsAt !== null && isSameDay(startsAt, date);
    });
  }

  load(): void {
    const studentId = this.session.profileId();
    if (studentId === null) {
      return;
    }
    this._month.set(startOfDay(this.clock.now()));
    this._selectedDay.set(startOfDay(this.clock.now()));
    this.routine.load(() => this.routines.getActiveForStudent(studentId));
    this.fetch();
  }

  reload(): void {
    this.routine.reload();
    this.sessions.reload();
    this.workoutSessions.reload();
  }

  nextMonth(): void {
    this._month.update(value => addMonths(value, 1));
    this._selectedDay.set(null);
    this.fetch();
  }

  prevMonth(): void {
    this._month.update(value => addMonths(value, -1));
    this._selectedDay.set(null);
    this.fetch();
  }

  selectDay(date: Date): void {
    this._selectedDay.set(startOfDay(date));
  }

  confirm(sessionId: string): Promise<boolean> {
    return this.mutate(() => this.port.confirm(sessionId));
  }

  cancel(sessionId: string, reason: CancelReason, note: string | null = null): Promise<boolean> {
    return this.mutate(() => this.port.cancel(sessionId, reason, note));
  }

  private fetch(): void {
    const studentId = this.session.profileId();
    if (studentId === null) {
      return;
    }
    const range = monthRange(this._month());
    this.sessions.load(() => this.port.listByStudent(studentId, range));
    this.workoutSessions.load(() => this.workouts.listByStudent(studentId, range));
  }

  private mutate(run: () => ReturnType<typeof this.port.confirm>): Promise<boolean> {
    return new Promise(resolve => {
      run().subscribe({
        next: updated => {
          this.sessions.set(this.all().map(item => (item.id === updated.id ? updated : item)));
          resolve(true);
        },
        error: () => resolve(false),
      });
    });
  }
}
