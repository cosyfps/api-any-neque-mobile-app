import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { AuthSession } from '@app/domain/auth/model/auth-user.model';
import { SESSION_STORAGE_PORT } from '@app/domain/auth/port/session-storage.port';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import {
  WorkoutExerciseLog,
  WorkoutSession,
} from '@app/domain/workouts/model/workout-session.model';

import { API_BASE_URL } from '../http/api-client';

import { writeCache } from './offline-cache';
import { OfflineWorkoutsAdapter, QueuedOp, applyOp } from './offline-workouts.adapter';

const BASE = '/api/v1';
const NOW = '2026-11-10T14:00:00.000Z';

const log = (id: string): WorkoutExerciseLog => ({
  routineExerciseId: id,
  exerciseId: `ex-${id}`,
  name: `Ejercicio ${id}`,
  targetSets: 2,
  targetReps: 10,
  restSeconds: 60,
  weightKg: 40,
  completedSets: 0,
  done: false,
  sets: [],
});

const workout = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'w1',
  studentId: 's1',
  routineId: 'r1',
  routineDayId: 'd1',
  title: 'Pierna',
  scheduledFor: '2026-11-10T12:00:00.000Z',
  startedAt: null,
  completedAt: null,
  status: 'scheduled',
  durationMinutes: null,
  estimatedMinutes: 45,
  exercises: [log('e1')],
  ...overrides,
});

const SESSION: AuthSession = {
  user: {
    id: 'u1',
    email: 'a@b.cl',
    role: 'student',
    displayName: 'A',
    avatarUrl: null,
    profileId: 's1',
  },
  token: 't',
  expiresAt: '2030-01-01T00:00:00.000Z',
};

const SET = { setNumber: 1, reps: 10, weightKg: 42 };
const offline = { status: 0, statusText: 'Unknown Error' };

/** Deja correr las promesas pendientes de `flush()`. */
const settle = () => new Promise(resolve => setTimeout(resolve));

describe('OfflineWorkoutsAdapter', () => {
  let http: HttpTestingController;

  const build = (): OfflineWorkoutsAdapter => TestBed.inject(OfflineWorkoutsAdapter);
  const queue = (): QueuedOp[] =>
    JSON.parse(localStorage.getItem('neque.queue.s1') ?? '[]') as QueuedOp[];
  const failNetwork = (url: string) =>
    http.expectOne(`${BASE}${url}`).error(new ProgressEvent('error'), offline);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: SESSION_STORAGE_PORT, useValue: { read: () => SESSION } },
        { provide: CLOCK, useValue: { now: () => new Date(NOW) } },
        OfflineWorkoutsAdapter,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  describe('lecturas', () => {
    it('sin red entrega la ultima sesion guardada', async () => {
      const adapter = build();
      const online = firstValueFrom(adapter.getById('w1'));
      http.expectOne(`${BASE}/workouts/w1`).flush(workout());
      await online;

      const sinRed = firstValueFrom(adapter.getById('w1'));
      failNetwork('/workouts/w1');
      await expect(sinRed).resolves.toEqual(workout());
    });

    it('sin red y sin cache propaga el error', async () => {
      const sinRed = firstValueFrom(build().getById('w1'));
      failNetwork('/workouts/w1');
      await expect(sinRed).rejects.toMatchObject({ code: 'network' });
    });

    it('un error que no es de red no usa la cache', async () => {
      writeCache('workout.w1', workout());
      const result = firstValueFrom(build().getById('w1'));
      http
        .expectOne(`${BASE}/workouts/w1`)
        .flush({ error: { code: 'not_found' } }, { status: 404, statusText: 'Not Found' });
      await expect(result).rejects.toMatchObject({ code: 'not_found' });
    });

    it('la lista guarda cada sesion para abrirla luego en el runner', async () => {
      const adapter = build();
      const list = firstValueFrom(adapter.listByStudent('s1'));
      http.expectOne(`${BASE}/students/s1/workouts`).flush([workout()]);
      await list;

      const runner = firstValueFrom(adapter.getById('w1'));
      failNetwork('/workouts/w1');
      await expect(runner).resolves.toEqual(workout());
    });

    it('con cambios en espera la lista muestra la version local', async () => {
      const adapter = build();
      writeCache('workout.w1', workout());
      const logged = firstValueFrom(adapter.logSet('w1', 'e1', SET));
      failNetwork('/workouts/w1/exercises/e1/sets');
      await logged;

      const list = firstValueFrom(adapter.listByStudent('s1'));
      http.expectOne(`${BASE}/students/s1/workouts`).flush([workout()]);
      const [primera] = await list;
      expect(primera?.exercises[0]?.sets).toHaveLength(1);
    });
  });

  describe('escrituras sin conexion', () => {
    it('aplica la serie en local, la encola con su hora y avisa que hay pendientes', async () => {
      const adapter = build();
      const pending: number[] = [];
      adapter.pending().subscribe(value => pending.push(value));
      writeCache('workout.w1', workout());

      const result = firstValueFrom(adapter.logSet('w1', 'e1', SET));
      failNetwork('/workouts/w1/exercises/e1/sets');
      const local = await result;

      expect(local.status).toBe('in_progress');
      expect(local.exercises[0]?.sets[0]).toMatchObject({ weightKg: 42, completedAt: NOW });
      expect(queue()).toEqual([
        { kind: 'set', sessionId: 'w1', exerciseId: 'e1', set: SET, at: NOW },
      ]);
      TestBed.flushEffects();
      expect(pending.at(-1)).toBe(1);
    });

    it('con la cola en espera, lo siguiente se encola detras sin llamar al servidor', async () => {
      const adapter = build();
      writeCache('workout.w1', workout());
      const first = firstValueFrom(adapter.start('w1'));
      failNetwork('/workouts/w1/start');
      await first;

      await firstValueFrom(adapter.complete('w1', { durationMinutes: 30, note: null }));
      http.expectNone(`${BASE}/workouts/w1/complete`);
      expect(queue().map(op => op.kind)).toEqual(['start', 'complete']);
    });

    it('sin la sesion en cache falla como sin red', async () => {
      const result = firstValueFrom(build().skipExercise('w1', 'e1', 'pain'));
      failNetwork('/workouts/w1/exercises/e1/skip');
      await expect(result).rejects.toMatchObject({ code: 'network' });
      expect(queue()).toEqual([]);
    });

    it('un error del servidor no se encola', async () => {
      writeCache('workout.w1', workout());
      const result = firstValueFrom(build().markExercise('w1', 'e1', true));
      http
        .expectOne(`${BASE}/workouts/w1/exercises/e1/done`)
        .flush({ error: { code: 'conflict' } }, { status: 409, statusText: 'Conflict' });
      await expect(result).rejects.toMatchObject({ code: 'conflict' });
      expect(queue()).toEqual([]);
    });

    it('en linea guarda la respuesta del servidor', async () => {
      const adapter = build();
      const result = firstValueFrom(adapter.start('w1'));
      http.expectOne(`${BASE}/workouts/w1/start`).flush(workout({ status: 'in_progress' }));
      await result;

      const sinRed = firstValueFrom(adapter.getById('w1'));
      failNetwork('/workouts/w1');
      await expect(sinRed).resolves.toMatchObject({ status: 'in_progress' });
    });
  });

  describe('sincronizacion', () => {
    const enqueueOffline = async (adapter: OfflineWorkoutsAdapter) => {
      writeCache('workout.w1', workout());
      const first = firstValueFrom(adapter.start('w1'));
      failNetwork('/workouts/w1/start');
      await first;
      await firstValueFrom(adapter.logSet('w1', 'e1', SET));
    };

    it('reproduce la cola en orden con la hora real y la vacia', async () => {
      const adapter = build();
      await enqueueOffline(adapter);

      const done = adapter.flush();
      const start = http.expectOne(`${BASE}/workouts/w1/start`);
      expect(start.request.body).toEqual({ at: NOW });
      start.flush(workout({ status: 'in_progress' }));
      await settle();
      const set = http.expectOne(`${BASE}/workouts/w1/exercises/e1/sets`);
      expect(set.request.body).toEqual({ ...SET, at: NOW });
      set.flush(workout({ status: 'in_progress' }));
      await done;

      expect(queue()).toEqual([]);
    });

    it('se detiene en el primer fallo de red y conserva lo pendiente', async () => {
      const adapter = build();
      await enqueueOffline(adapter);

      const done = adapter.flush();
      failNetwork('/workouts/w1/start');
      await done;

      expect(queue()).toHaveLength(2);
    });

    it('descarta lo que el servidor rechaza y sigue con lo demas', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const adapter = build();
      await enqueueOffline(adapter);

      const done = adapter.flush();
      http
        .expectOne(`${BASE}/workouts/w1/start`)
        .flush({ error: { code: 'not_found' } }, { status: 404, statusText: 'Not Found' });
      await settle();
      http.expectOne(`${BASE}/workouts/w1/exercises/e1/sets`).flush(workout());
      await done;

      expect(queue()).toEqual([]);
      expect(warn).toHaveBeenCalledWith(expect.any(String), 'start');
      warn.mockRestore();
    });

    it('vuelve a intentar al recuperar la conexion', async () => {
      const adapter = build();
      await enqueueOffline(adapter);

      window.dispatchEvent(new Event('online'));
      http.expectOne(`${BASE}/workouts/w1/start`).flush(workout());
      await settle();
      http.expectOne(`${BASE}/workouts/w1/exercises/e1/sets`).flush(workout());
      await settle();

      expect(queue()).toEqual([]);
    });

    it('no corre dos sincronizaciones a la vez', async () => {
      const adapter = build();
      await enqueueOffline(adapter);

      const first = adapter.flush();
      await adapter.flush();
      failNetwork('/workouts/w1/start');
      await first;
    });
  });
});

describe('applyOp', () => {
  it('aplica cada operacion con la regla compartida del BFF', () => {
    const base = workout();
    const iniciada = applyOp(base, { kind: 'start', sessionId: 'w1', at: NOW });
    expect(iniciada).toMatchObject({ status: 'in_progress', startedAt: NOW });

    const marcada = applyOp(base, {
      kind: 'mark',
      sessionId: 'w1',
      exerciseId: 'e1',
      done: true,
      at: NOW,
    });
    expect(marcada.exercises[0]?.done).toBe(true);

    const saltada = applyOp(base, {
      kind: 'skip',
      sessionId: 'w1',
      exerciseId: 'e1',
      reason: 'pain',
      at: NOW,
    });
    expect(saltada.exercises[0]?.skipped).toBe(true);

    const cerrada = applyOp(base, {
      kind: 'complete',
      sessionId: 'w1',
      completion: { durationMinutes: 40, note: null },
      at: NOW,
    });
    expect(cerrada).toMatchObject({ status: 'completed', completedAt: NOW, durationMinutes: 40 });
  });
});
