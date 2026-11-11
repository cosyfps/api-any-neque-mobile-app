import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, firstValueFrom, map, of, tap, throwError } from 'rxjs';

import { SESSION_STORAGE_PORT } from '@app/domain/auth/port/session-storage.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { DateRange } from '@app/domain/shared/model/date-range';
import { Id, IsoDateString } from '@app/domain/shared/model/ids';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import * as rules from '@app/domain/workouts/model/workout-rules';
import {
  WorkoutCompletion,
  WorkoutSession,
} from '@app/domain/workouts/model/workout-session.model';
import { SkipReason, WorkoutSetInput } from '@app/domain/workouts/model/workout-set.model';
import { WorkoutSyncPort } from '@app/domain/workouts/port/workout-sync.port';

import { WorkoutsHttpAdapter } from '../workouts/workouts.http-adapter';

import { isNetworkError, readCache, withCache, writeCache } from './offline-cache';

/** Una escritura del runner que espera conexion, con la hora en que ocurrio. */
export type QueuedOp =
  | { readonly kind: 'start'; readonly sessionId: Id; readonly at: IsoDateString }
  | {
      readonly kind: 'mark';
      readonly sessionId: Id;
      readonly exerciseId: Id;
      readonly done: boolean;
      readonly at: IsoDateString;
    }
  | {
      readonly kind: 'set';
      readonly sessionId: Id;
      readonly exerciseId: Id;
      readonly set: WorkoutSetInput;
      readonly at: IsoDateString;
    }
  | {
      readonly kind: 'skip';
      readonly sessionId: Id;
      readonly exerciseId: Id;
      readonly reason: SkipReason | null;
      readonly at: IsoDateString;
    }
  | {
      readonly kind: 'complete';
      readonly sessionId: Id;
      readonly completion: WorkoutCompletion;
      readonly at: IsoDateString;
    };

const QUEUE_PREFIX = 'neque.queue.';

/**
 * Sesiones del alumno con modo sin conexion (PRD §7.1).
 *
 * Las lecturas guardan la ultima respuesta y la entregan si no hay red. Las
 * escrituras del runner que fallan por red se aplican en local con las mismas
 * reglas del BFF y quedan en una cola persistida, que se reproduce en orden y
 * de a una al volver la conexion. Cada operacion lleva su hora real: la
 * sesion es un hecho historico y el servidor la registra tal como ocurrio.
 */
@Injectable()
export class OfflineWorkoutsAdapter extends WorkoutsHttpAdapter implements WorkoutSyncPort {
  private readonly storage = inject(SESSION_STORAGE_PORT);
  private readonly clock = inject(CLOCK);

  private readonly _pending = signal(this.readQueue().length);
  private readonly pending$ = toObservable(this._pending);
  private flushing = false;

  constructor() {
    super();
    const retry = (): void => void this.flush();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        retry();
      }
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', onVisible);
    });
    void this.flush();
  }

  pending(): Observable<number> {
    return this.pending$;
  }

  // ── Lecturas ─────────────────────────────────────────────────────────────

  override listByStudent(studentId: Id, range?: DateRange): Observable<WorkoutSession[]> {
    const key = `workouts.${studentId}.${range?.from ?? ''}.${range?.to ?? ''}`;
    return withCache(key, super.listByStudent(studentId, range)).pipe(
      // Con cambios en espera, la version local de cada sesion es la vigente.
      map(sessions => sessions.map(session => this.localOrServer(session))),
      tap(sessions => sessions.forEach(session => this.remember(session))),
    );
  }

  override getById(sessionId: Id): Observable<WorkoutSession> {
    // No usa `withCache`: guardar a ciegas pisaria la version local pendiente.
    return super.getById(sessionId).pipe(
      tap(session => this.remember(session)),
      catchError((error: unknown) => {
        const cached = isNetworkError(error) ? this.cachedSession(sessionId) : null;
        return cached === null ? throwError(() => error) : of(cached);
      }),
      map(session => this.localOrServer(session)),
    );
  }

  // ── Escrituras del runner ────────────────────────────────────────────────

  override start(sessionId: Id): Observable<WorkoutSession> {
    const at = this.now();
    return this.write({ kind: 'start', sessionId, at }, () => super.start(sessionId));
  }

  override markExercise(
    sessionId: Id,
    routineExerciseId: Id,
    done: boolean,
  ): Observable<WorkoutSession> {
    const op: QueuedOp = {
      kind: 'mark',
      sessionId,
      exerciseId: routineExerciseId,
      done,
      at: this.now(),
    };
    return this.write(op, () => super.markExercise(sessionId, routineExerciseId, done));
  }

  override logSet(
    sessionId: Id,
    routineExerciseId: Id,
    set: WorkoutSetInput,
  ): Observable<WorkoutSession> {
    const op: QueuedOp = {
      kind: 'set',
      sessionId,
      exerciseId: routineExerciseId,
      set,
      at: this.now(),
    };
    return this.write(op, () => super.logSet(sessionId, routineExerciseId, set));
  }

  override skipExercise(
    sessionId: Id,
    routineExerciseId: Id,
    reason: SkipReason | null,
  ): Observable<WorkoutSession> {
    const op: QueuedOp = {
      kind: 'skip',
      sessionId,
      exerciseId: routineExerciseId,
      reason,
      at: this.now(),
    };
    return this.write(op, () => super.skipExercise(sessionId, routineExerciseId, reason));
  }

  override complete(sessionId: Id, completion: WorkoutCompletion): Observable<WorkoutSession> {
    const op: QueuedOp = { kind: 'complete', sessionId, completion, at: this.now() };
    return this.write(op, () => super.complete(sessionId, completion));
  }

  /**
   * Reproduce la cola en orden. Se detiene en el primer fallo de red y
   * descarta lo que el servidor rechaza: reintentarlo no lo arreglaria.
   */
  async flush(): Promise<void> {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    try {
      for (let op = this.readQueue()[0]; op !== undefined; op = this.readQueue()[0]) {
        try {
          this.remember(await firstValueFrom(this.send(op)), true);
        } catch (error: unknown) {
          if (isNetworkError(error)) {
            return;
          }
          console.warn('[offline] operacion descartada por el servidor', op.kind);
        }
        this.saveQueue(this.readQueue().slice(1));
      }
    } finally {
      this.flushing = false;
    }
  }

  // ── Internos ─────────────────────────────────────────────────────────────

  /**
   * Con la cola vacia intenta en linea. Sin red, o con operaciones ya en
   * espera (para no desordenarlas), encola y responde con la sesion local.
   */
  private write(
    op: QueuedOp,
    online: () => Observable<WorkoutSession>,
  ): Observable<WorkoutSession> {
    if (this.readQueue().length > 0) {
      return this.enqueue(op, null);
    }
    return online().pipe(
      tap(session => this.remember(session, true)),
      catchError((error: unknown) =>
        isNetworkError(error) ? this.enqueue(op, error) : throwError(() => error),
      ),
    );
  }

  private enqueue(op: QueuedOp, cause: unknown): Observable<WorkoutSession> {
    const local = this.cachedSession(op.sessionId);
    if (local === null) {
      // Sin la sesion en cache no hay como mostrar el cambio: falla como sin red.
      return throwError(() => cause ?? domainError('network'));
    }
    const next = applyOp(local, op);
    this.saveQueue([...this.readQueue(), op]);
    this.remember(next, true);
    return of(next);
  }

  private send(op: QueuedOp): Observable<WorkoutSession> {
    switch (op.kind) {
      case 'start':
        return super.start(op.sessionId, op.at);
      case 'mark':
        return super.markExercise(op.sessionId, op.exerciseId, op.done, op.at);
      case 'set':
        return super.logSet(op.sessionId, op.exerciseId, op.set, op.at);
      case 'skip':
        return super.skipExercise(op.sessionId, op.exerciseId, op.reason, op.at);
      case 'complete':
        return super.complete(op.sessionId, op.completion, op.at);
    }
  }

  /** La sesion local si tiene cambios en espera; si no, la del servidor. */
  private localOrServer(session: WorkoutSession): WorkoutSession {
    const waiting = this.readQueue().some(op => op.sessionId === session.id);
    return waiting ? (this.cachedSession(session.id) ?? session) : session;
  }

  /** Guarda la sesion para el runner. `force` pisa una version local pendiente. */
  private remember(session: WorkoutSession, force = false): void {
    if (force || !this.readQueue().some(op => op.sessionId === session.id)) {
      writeCache(`workout.${session.id}`, session);
    }
  }

  private cachedSession(sessionId: Id): WorkoutSession | null {
    return readCache<WorkoutSession>(`workout.${sessionId}`);
  }

  private queueKey(): string | null {
    const profileId = this.storage.read()?.user.profileId;
    return profileId === undefined ? null : QUEUE_PREFIX + profileId;
  }

  private readQueue(): QueuedOp[] {
    const key = this.queueKey();
    if (key === null) {
      return [];
    }
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? [] : (JSON.parse(raw) as QueuedOp[]);
    } catch {
      return [];
    }
  }

  private saveQueue(queue: readonly QueuedOp[]): void {
    const key = this.queueKey();
    if (key !== null) {
      try {
        if (queue.length === 0) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(queue));
        }
      } catch {
        // Sin almacenamiento la operacion no sobrevive a cerrar la app.
      }
    }
    this._pending.set(queue.length);
  }

  private now(): IsoDateString {
    return this.clock.now().toISOString();
  }
}

/** Aplica en local la misma regla que aplicara el BFF al recibir la operacion. */
export function applyOp(session: WorkoutSession, op: QueuedOp): WorkoutSession {
  switch (op.kind) {
    case 'start':
      return rules.startSession(session, op.at);
    case 'mark':
      return rules.markExercise(session, op.exerciseId, op.done, op.at);
    case 'set':
      return rules.logSet(session, op.exerciseId, op.set, op.at);
    case 'skip':
      return rules.skipExercise(session, op.exerciseId, op.reason, op.at);
    case 'complete':
      return rules.completeSession(session, op.completion, op.at);
  }
}
