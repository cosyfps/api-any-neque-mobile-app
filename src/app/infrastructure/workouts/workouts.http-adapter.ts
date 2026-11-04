import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DateRange } from '@app/domain/shared/model/date-range';
import { Id } from '@app/domain/shared/model/ids';
import {
  WorkoutCompletion,
  WorkoutSession,
} from '@app/domain/workouts/model/workout-session.model';
import { SkipReason, WorkoutSetInput } from '@app/domain/workouts/model/workout-set.model';
import { WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { ApiClient } from '../http/api-client';

/**
 * Sesiones de entrenamiento. El BFF genera las sesiones desde la rutina
 * asignada al listarlas, y cada mutacion devuelve la sesion completa.
 */
@Injectable()
export class WorkoutsHttpAdapter implements WorkoutsPort {
  private readonly api = inject(ApiClient);

  listByStudent(studentId: Id, range?: DateRange): Observable<WorkoutSession[]> {
    return this.api.get<WorkoutSession[]>(
      `/students/${studentId}/workouts`,
      range === undefined ? undefined : { from: range.from, to: range.to },
    );
  }

  reschedule(sessionId: Id, day: string): Observable<WorkoutSession> {
    return this.api.put<WorkoutSession>(`/workouts/${sessionId}/date`, { date: day });
  }

  getById(sessionId: Id): Observable<WorkoutSession> {
    return this.api.get<WorkoutSession>(`/workouts/${sessionId}`);
  }

  start(sessionId: Id): Observable<WorkoutSession> {
    return this.api.post<WorkoutSession>(`/workouts/${sessionId}/start`);
  }

  markExercise(sessionId: Id, routineExerciseId: Id, done: boolean): Observable<WorkoutSession> {
    return this.api.put<WorkoutSession>(
      `/workouts/${sessionId}/exercises/${routineExerciseId}/done`,
      { done },
    );
  }

  logSet(sessionId: Id, routineExerciseId: Id, set: WorkoutSetInput): Observable<WorkoutSession> {
    return this.api.post<WorkoutSession>(
      `/workouts/${sessionId}/exercises/${routineExerciseId}/sets`,
      set,
    );
  }

  skipExercise(
    sessionId: Id,
    routineExerciseId: Id,
    reason: SkipReason | null,
  ): Observable<WorkoutSession> {
    return this.api.post<WorkoutSession>(
      `/workouts/${sessionId}/exercises/${routineExerciseId}/skip`,
      { reason },
    );
  }

  complete(sessionId: Id, completion: WorkoutCompletion): Observable<WorkoutSession> {
    return this.api.post<WorkoutSession>(`/workouts/${sessionId}/complete`, completion);
  }
}
