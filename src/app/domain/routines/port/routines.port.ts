import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Id } from '@app/domain/shared/model/ids';

import { Exercise, ExerciseInput } from '../model/exercise.model';
import { Routine, RoutineAssignment, RoutineInput } from '../model/routine.model';

export interface RoutinesPort {
  /** Rutina que hace el alumno. Null si todavia no tiene una asignada. */
  getActiveForStudent(studentId: Id): Observable<Routine | null>;
  listByTrainer(trainerId: Id): Observable<Routine[]>;
  getById(routineId: Id): Observable<Routine>;

  /** Crea la rutina como plantilla, sin alumnos. */
  create(input: RoutineInput): Observable<Routine>;
  /** Cambia la plantilla. Sus alumnos siguen asignados y ven el cambio. */
  update(routineId: Id, changes: RoutineInput): Observable<Routine>;
  /**
   * Reemplaza la lista de alumnos de la rutina.
   *
   * Un alumno hace una sola rutina: el que llega desde otra sale de aquella
   * en la misma operacion. En dos pasos quedaria un hueco donde el alumno
   * tiene dos rutinas o ninguna.
   */
  setAssignments(routineId: Id, assignments: readonly RoutineAssignment[]): Observable<Routine>;
  /**
   * Elimina la plantilla y libera a sus alumnos, que quedan sin rutina.
   *
   * Las sesiones que ya entrenaron con ella no se tocan: el BFF la marca con
   * `deletedAt` en vez de borrar la fila, asi el historial sigue resolviendo.
   */
  remove(routineId: Id): Observable<void>;
}

export const ROUTINES_PORT = new InjectionToken<RoutinesPort>('RoutinesPort');

/**
 * Catalogo de ejercicios.
 *
 * `listForTrainer` devuelve el catalogo publico mas los propios de ese
 * entrenador. Nunca los de otro: los ejercicios propios son privados.
 */
export interface ExerciseCatalogPort {
  list(): Observable<Exercise[]>;
  listForTrainer(trainerId: Id): Observable<Exercise[]>;
  getById(exerciseId: Id): Observable<Exercise>;
  create(input: ExerciseInput): Observable<Exercise>;
}

export const EXERCISE_CATALOG_PORT = new InjectionToken<ExerciseCatalogPort>('ExerciseCatalogPort');
