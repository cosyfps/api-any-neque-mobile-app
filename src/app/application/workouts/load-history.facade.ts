import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { SessionFacade } from '@app/application/auth/session.facade';
import { ExerciseLoadHistory, loadHistory } from '@app/domain/workouts/model/load-history';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/**
 * Historial de cargas del alumno (A-2): cuanto levanta en cada ejercicio y
 * como cambio. Sale de las series registradas en todas sus sesiones.
 */
// Scoped a la ruta /student: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class LoadHistoryFacade {
  private readonly port = inject(WORKOUTS_PORT);
  private readonly session = inject(SessionFacade);

  readonly sessions: AsyncState<WorkoutSession[]> = asyncState<WorkoutSession[]>({
    isEmpty: sesiones => loadHistory(sesiones).length === 0,
  });

  readonly viewState: Signal<ViewState> = this.sessions.viewState;

  readonly exercises: Signal<ExerciseLoadHistory[]> = computed(() =>
    loadHistory(this.sessions.data() ?? []),
  );

  private readonly _selectedId = signal<string | null>(null);

  /** El elegido, o el entrenado mas recientemente. */
  readonly selected: Signal<ExerciseLoadHistory | null> = computed(() => {
    const lista = this.exercises();
    const id = this._selectedId();
    return lista.find(item => item.exerciseId === id) ?? lista[0] ?? null;
  });

  load(): void {
    const studentId = this.session.profileId();
    if (studentId === null) {
      return;
    }
    this.sessions.load(() => this.port.listByStudent(studentId));
  }

  reload(): void {
    this.sessions.reload();
  }

  select(exerciseId: string): void {
    this._selectedId.set(exerciseId);
  }
}
