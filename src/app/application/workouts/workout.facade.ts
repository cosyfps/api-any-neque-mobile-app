import { Injectable, Signal, computed, inject } from '@angular/core';

import { SessionFacade } from '@app/application/auth/session.facade';
import { Routine } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { isSameDay, parseIsoDate, startOfWeek } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { WeeklyProgress, weeklyProgress } from '@app/domain/workouts/model/weekly-progress';
import {
  WorkoutCompletion,
  WorkoutSession,
} from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/** Sesiones del alumno: alimenta el home y el resumen semanal. */
// Scoped a la ruta /student: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class WorkoutFacade {
  private readonly port = inject(WORKOUTS_PORT);
  private readonly routines = inject(ROUTINES_PORT);
  private readonly session = inject(SessionFacade);
  private readonly clock = inject(CLOCK);

  readonly sessions: AsyncState<WorkoutSession[]> = asyncState<WorkoutSession[]>();

  /** Rutina vigente: solo sus sesiones se muestran en el home. */
  readonly activeRoutine: AsyncState<Routine | null> = asyncState<Routine | null>({
    isEmpty: () => false,
  });

  /**
   * Sesiones de la rutina vigente. Al asignar otra rutina, lo entrenado con la
   * anterior queda guardado (historial del entrenador, racha) pero el alumno
   * ya no lo ve en su semana ni como "ultimo entrenamiento". Sin rutina
   * vigente no hay nada que mostrar.
   */
  readonly all: Signal<readonly WorkoutSession[]> = computed(() => {
    const routineId = this.activeRoutine.data()?.id;
    return routineId === undefined
      ? []
      : (this.sessions.data() ?? []).filter(item => item.routineId === routineId);
  });

  /** Sesion agendada para hoy, si existe. */
  readonly todaySession: Signal<WorkoutSession | null> = computed(() => {
    const today = this.clock.now();
    return (
      this.all().find(item => {
        const scheduled = parseIsoDate(item.scheduledFor);
        return scheduled !== null && isSameDay(scheduled, today);
      }) ?? null
    );
  });

  /** Ultima sesion completada, de la mas reciente hacia atras. */
  readonly latestCompleted: Signal<WorkoutSession | null> = computed(() => {
    const completed = this.all().filter(item => item.status === 'completed');
    return completed.length === 0 ? null : (completed[completed.length - 1] ?? null);
  });

  /** Proximas sesiones agendadas, de la mas cercana a la mas lejana. */
  readonly upcoming: Signal<readonly WorkoutSession[]> = computed(() => {
    const now = this.clock.now().getTime();
    return this.all().filter(item => {
      if (item.status === 'completed' || item.status === 'skipped') {
        return false;
      }
      const scheduled = parseIsoDate(item.scheduledFor);
      return scheduled !== null && scheduled.getTime() >= now;
    });
  });

  readonly weekly: Signal<WeeklyProgress> = computed(() => {
    const today = this.clock.now();
    return weeklyProgress(this.all(), startOfWeek(today), today);
  });

  readonly viewState: Signal<ViewState> = this.sessions.viewState;

  /**
   * True si el dia de rutina de la sesion tiene hora de inicio. Sin ella, el
   * BFF agenda a mediodia UTC solo para fijar el dia: esa hora no se muestra.
   */
  hasStartTime(session: WorkoutSession): boolean {
    const day = this.activeRoutine.data()?.days.find(item => item.id === session.routineDayId);
    return Boolean(day?.startTime);
  }

  load(): void {
    const studentId = this.session.profileId();
    if (studentId === null) {
      return;
    }
    this.activeRoutine.load(() => this.routines.getActiveForStudent(studentId));
    this.sessions.load(() => this.port.listByStudent(studentId));
  }

  reload(): void {
    this.activeRoutine.reload();
    this.sessions.reload();
  }

  /** Cierra una sesion y refleja el cambio sin volver a pedir la lista. */
  completeSession(sessionId: string, completion: WorkoutCompletion): Promise<boolean> {
    return new Promise(resolve => {
      this.port.complete(sessionId, completion).subscribe({
        next: updated => {
          this.replace(updated);
          resolve(true);
        },
        error: () => resolve(false),
      });
    });
  }

  private replace(updated: WorkoutSession): void {
    this.sessions.set(
      (this.sessions.data() ?? []).map(item => (item.id === updated.id ? updated : item)),
    );
  }
}
