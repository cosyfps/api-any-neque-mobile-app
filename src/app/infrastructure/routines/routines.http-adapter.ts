import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { Exercise, ExerciseInput } from '@app/domain/routines/model/exercise.model';
import { Routine, RoutineAssignment, RoutineInput } from '@app/domain/routines/model/routine.model';
import { ExerciseCatalogPort, RoutinesPort } from '@app/domain/routines/port/routines.port';
import { Id } from '@app/domain/shared/model/ids';

import { ApiClient } from '../http/api-client';

@Injectable()
export class RoutinesHttpAdapter implements RoutinesPort {
  private readonly api = inject(ApiClient);

  getActiveForStudent(studentId: Id): Observable<Routine | null> {
    return this.api.get<Routine | null>(`/students/${studentId}/routine`);
  }

  listByTrainer(trainerId: Id): Observable<Routine[]> {
    return this.api.get<Routine[]>(`/trainers/${trainerId}/routines`);
  }

  getById(routineId: Id): Observable<Routine> {
    return this.api.get<Routine>(`/routines/${routineId}`);
  }

  create(input: RoutineInput): Observable<Routine> {
    return this.api.post<Routine>('/routines', input);
  }

  update(routineId: Id, changes: RoutineInput): Observable<Routine> {
    return this.api.put<Routine>(`/routines/${routineId}`, changes);
  }

  setAssignments(routineId: Id, assignments: readonly RoutineAssignment[]): Observable<Routine> {
    return this.api.put<Routine>(`/routines/${routineId}/assignments`, { assignments });
  }

  remove(routineId: Id): Observable<void> {
    return this.api.delete<null>(`/routines/${routineId}`).pipe(map((): void => undefined));
  }
}

@Injectable()
export class ExerciseCatalogHttpAdapter implements ExerciseCatalogPort {
  private readonly api = inject(ApiClient);

  list(): Observable<Exercise[]> {
    return this.api.get<Exercise[]>('/exercises');
  }

  listForTrainer(trainerId: Id): Observable<Exercise[]> {
    return this.api.get<Exercise[]>(`/trainers/${trainerId}/exercises`);
  }

  getById(exerciseId: Id): Observable<Exercise> {
    return this.api.get<Exercise>(`/exercises/${exerciseId}`);
  }

  create(input: ExerciseInput): Observable<Exercise> {
    return this.api.post<Exercise>('/exercises', input);
  }

  update(exerciseId: Id, changes: ExerciseInput): Observable<Exercise> {
    return this.api.put<Exercise>(`/exercises/${exerciseId}`, changes);
  }

  remove(exerciseId: Id): Observable<void> {
    return this.api.delete<null>(`/exercises/${exerciseId}`).pipe(map((): void => undefined));
  }
}
