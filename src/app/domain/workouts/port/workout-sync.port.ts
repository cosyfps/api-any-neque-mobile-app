import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Registros del entrenamiento hechos sin conexion que todavia no llegan al
 * servidor. Se envian solos al recuperar la red.
 */
export interface WorkoutSyncPort {
  /** Cantidad de operaciones en espera; emite cada vez que cambia. */
  pending(): Observable<number>;
}

export const WORKOUT_SYNC_PORT = new InjectionToken<WorkoutSyncPort>('WorkoutSyncPort');
