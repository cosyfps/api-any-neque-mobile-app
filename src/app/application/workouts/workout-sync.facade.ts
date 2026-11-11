import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { WORKOUT_SYNC_PORT } from '@app/domain/workouts/port/workout-sync.port';

/**
 * Lo entrenado sin conexion que aun no llega al servidor.
 *
 * Vive en los providers de la ruta /student: su puerto solo existe ahi.
 */
@Injectable()
export class WorkoutSyncFacade {
  private readonly port = inject(WORKOUT_SYNC_PORT);

  readonly pending: Signal<number> = toSignal(this.port.pending(), { initialValue: 0 });
  readonly hasPending: Signal<boolean> = computed(() => this.pending() > 0);
}
