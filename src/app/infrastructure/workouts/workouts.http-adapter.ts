import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { DateRange } from '@app/domain/shared/model/date-range';
import { Id, IsoDateString } from '@app/domain/shared/model/ids';
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

  start(sessionId: Id, at?: IsoDateString): Observable<WorkoutSession> {
    return this.api.post<WorkoutSession>(`/workouts/${sessionId}/start`, withAt({}, at));
  }

  markExercise(
    sessionId: Id,
    routineExerciseId: Id,
    done: boolean,
    at?: IsoDateString,
  ): Observable<WorkoutSession> {
    return this.api.put<WorkoutSession>(
      `/workouts/${sessionId}/exercises/${routineExerciseId}/done`,
      withAt({ done }, at),
    );
  }

  logSet(
    sessionId: Id,
    routineExerciseId: Id,
    set: WorkoutSetInput,
    at?: IsoDateString,
  ): Observable<WorkoutSession> {
    return this.api.post<WorkoutSession>(
      `/workouts/${sessionId}/exercises/${routineExerciseId}/sets`,
      withAt(set, at),
    );
  }

  skipExercise(
    sessionId: Id,
    routineExerciseId: Id,
    reason: SkipReason | null,
    at?: IsoDateString,
  ): Observable<WorkoutSession> {
    return this.api.post<WorkoutSession>(
      `/workouts/${sessionId}/exercises/${routineExerciseId}/skip`,
      withAt({ reason }, at),
    );
  }

  complete(
    sessionId: Id,
    completion: WorkoutCompletion,
    at?: IsoDateString,
  ): Observable<WorkoutSession> {
    return this.api.post<WorkoutSession>(`/workouts/${sessionId}/complete`, withAt(completion, at));
  }
}

/**
 * `at` es la hora en que el alumno lo hizo, cuando la operacion llega tarde
 * desde la cola sin conexion. En linea se omite y el BFF usa su reloj.
 */
function withAt<T extends object>(body: T, at: IsoDateString | undefined): T {
  return at === undefined ? body : { ...body, at };
}
