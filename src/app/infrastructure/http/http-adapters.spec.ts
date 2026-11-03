import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';

import {
  SESSION_STORAGE_PORT,
  SessionStoragePort,
} from '@app/domain/auth/port/session-storage.port';
import { DomainError } from '@app/domain/shared/model/app-error';

import { fn } from '@testing/typed-mock';

import { AuthHttpAdapter, InvitationHttpAdapter } from '../auth/auth.http-adapter';
import {
  NotificationsHttpAdapter,
  ProgressPhotosHttpAdapter,
  ScheduleHttpAdapter,
} from '../engagement.http-adapters';
import { ExerciseCatalogHttpAdapter, RoutinesHttpAdapter } from '../routines/routines.http-adapter';
import {
  AnamnesisHttpAdapter,
  AssessmentsHttpAdapter,
  StudentsHttpAdapter,
  TrainersHttpAdapter,
} from '../students/students.http-adapter';
import { WorkoutsHttpAdapter } from '../workouts/workouts.http-adapter';

import { API_BASE_URL, resolveApiBaseUrl, toDomainError } from './api-client';
import { StoredSession, authInterceptor, setSessionExpiredHandler } from './auth.interceptor';
import { dataUrlToBlob, isDataUrl } from './uploads';

const BASE = '/api/v1';
const RANGE = { from: '2026-11-01T00:00:00.000Z', to: '2026-11-30T23:59:59.000Z' };

class MemoryStorage implements SessionStoragePort {
  value: StoredSession | null = null;
  read() {
    return this.value;
  }
  write(session: StoredSession) {
    this.value = session;
  }
  clear() {
    this.value = null;
  }
}

function session(token: string, refreshToken = 'r1'): StoredSession {
  return {
    user: {
      id: 'u1',
      email: 'a@b.cl',
      role: 'trainer',
      displayName: 'A',
      avatarUrl: null,
      profileId: 't1',
    },
    token,
    expiresAt: '2030-01-01T00:00:00.000Z',
    refreshToken,
  };
}

describe('adapters HTTP', () => {
  let http: HttpTestingController;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: SESSION_STORAGE_PORT, useValue: storage },
        AuthHttpAdapter,
        InvitationHttpAdapter,
        StudentsHttpAdapter,
        AnamnesisHttpAdapter,
        AssessmentsHttpAdapter,
        TrainersHttpAdapter,
        RoutinesHttpAdapter,
        ExerciseCatalogHttpAdapter,
        WorkoutsHttpAdapter,
        ProgressPhotosHttpAdapter,
        ScheduleHttpAdapter,
        NotificationsHttpAdapter,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cases: [string, () => Observable<unknown>, string, string][] = [
    [
      'login',
      () => TestBed.inject(AuthHttpAdapter).login({ email: 'a', password: 'b' }),
      'POST',
      '/auth/login',
    ],
    ['signOut', () => TestBed.inject(AuthHttpAdapter).signOut(), 'POST', '/auth/logout'],
    [
      'requestPasswordReset',
      () => TestBed.inject(AuthHttpAdapter).requestPasswordReset('a'),
      'POST',
      '/auth/password-reset',
    ],
    [
      'verifyOtp',
      () => TestBed.inject(AuthHttpAdapter).verifyOtp('a', '123456'),
      'POST',
      '/auth/password-reset/verify',
    ],
    [
      'resetPassword',
      () => TestBed.inject(AuthHttpAdapter).resetPassword({ email: 'a', token: 't' }, 'x'),
      'POST',
      '/auth/password-reset/complete',
    ],
    [
      'changePassword',
      () => TestBed.inject(AuthHttpAdapter).changePassword('a', 'b', 'c'),
      'POST',
      '/auth/password/change',
    ],
    [
      'invitation.resolve',
      () => TestBed.inject(InvitationHttpAdapter).resolve('tk'),
      'GET',
      '/invitations/tk',
    ],
    [
      'invitation.accept',
      () => TestBed.inject(InvitationHttpAdapter).accept('tk', 'p'),
      'POST',
      '/invitations/tk/accept',
    ],
    [
      'invitation.getForStudent',
      () => TestBed.inject(InvitationHttpAdapter).getForStudent('s1'),
      'GET',
      '/students/s1/invitation',
    ],
    [
      'invitation.create',
      () => TestBed.inject(InvitationHttpAdapter).create('s1'),
      'POST',
      '/students/s1/invitation',
    ],
    [
      'invitation.revoke',
      () => TestBed.inject(InvitationHttpAdapter).revoke('tk'),
      'POST',
      '/invitations/tk/revoke',
    ],
    [
      'students.getById',
      () => TestBed.inject(StudentsHttpAdapter).getById('s1'),
      'GET',
      '/students/s1',
    ],
    [
      'students.listByTrainer',
      () => TestBed.inject(StudentsHttpAdapter).listByTrainer('t1'),
      'GET',
      '/trainers/t1/students',
    ],
    [
      'students.update',
      () => TestBed.inject(StudentsHttpAdapter).update('s1', { phone: '1' }),
      'PATCH',
      '/students/s1/self',
    ],
    [
      'students.create',
      () =>
        TestBed.inject(StudentsHttpAdapter).create({
          trainerId: 't1',
          firstName: 'A',
          lastName: 'B',
          email: 'a@b.cl',
          phone: null,
          birthDate: null,
          heightCm: null,
          goal: null,
        }),
      'POST',
      '/students',
    ],
    [
      'students.edit',
      () => TestBed.inject(StudentsHttpAdapter).edit('s1', { goal: 'x' }),
      'PATCH',
      '/students/s1',
    ],
    [
      'students.setStatus',
      () => TestBed.inject(StudentsHttpAdapter).setStatus('s1', 'suspended'),
      'PUT',
      '/students/s1/status',
    ],
    [
      'anamnesis.get',
      () => TestBed.inject(AnamnesisHttpAdapter).getByStudent('s1'),
      'GET',
      '/students/s1/anamnesis',
    ],
    [
      'anamnesis.save',
      () =>
        TestBed.inject(AnamnesisHttpAdapter).save({
          studentId: 's1',
          medicalHistory: null,
          previousInjuries: null,
          surgeries: null,
          medications: null,
          allergies: null,
          previousActivity: null,
          declaredGoal: 'x',
          weeklyAvailability: [1],
          emergencyContact: null,
        }),
      'PUT',
      '/students/s1/anamnesis',
    ],
    [
      'assessments.list',
      () => TestBed.inject(AssessmentsHttpAdapter).listByStudent('s1'),
      'GET',
      '/students/s1/assessments',
    ],
    [
      'assessments.latest',
      () => TestBed.inject(AssessmentsHttpAdapter).latestByStudent('s1'),
      'GET',
      '/students/s1/assessments/latest',
    ],
    [
      'assessments.create',
      () =>
        TestBed.inject(AssessmentsHttpAdapter).create({
          studentId: 's1',
          weightKg: 70,
          heightCm: 170,
          bodyFatPct: null,
          muscleMassKg: null,
          measurements: { chestCm: null, waistCm: null, hipCm: null, armCm: null, thighCm: null },
          notes: null,
        }),
      'POST',
      '/students/s1/assessments',
    ],
    [
      'trainers.getById',
      () => TestBed.inject(TrainersHttpAdapter).getById('t1'),
      'GET',
      '/trainers/t1',
    ],
    [
      'trainers.update',
      () => TestBed.inject(TrainersHttpAdapter).update('t1', { bio: 'x' }),
      'PATCH',
      '/trainers/t1',
    ],
    [
      'routines.active',
      () => TestBed.inject(RoutinesHttpAdapter).getActiveForStudent('s1'),
      'GET',
      '/students/s1/routine',
    ],
    [
      'routines.list',
      () => TestBed.inject(RoutinesHttpAdapter).listByTrainer('t1'),
      'GET',
      '/trainers/t1/routines',
    ],
    [
      'routines.getById',
      () => TestBed.inject(RoutinesHttpAdapter).getById('r1'),
      'GET',
      '/routines/r1',
    ],
    [
      'routines.create',
      () =>
        TestBed.inject(RoutinesHttpAdapter).create({
          trainerId: 't1',
          name: 'R',
          goal: 'g',
          days: [],
        }),
      'POST',
      '/routines',
    ],
    [
      'routines.update',
      () =>
        TestBed.inject(RoutinesHttpAdapter).update('r1', {
          trainerId: 't1',
          name: 'R',
          goal: 'g',
          days: [],
        }),
      'PUT',
      '/routines/r1',
    ],
    [
      'routines.assign',
      () => TestBed.inject(RoutinesHttpAdapter).setAssignments('r1', []),
      'PUT',
      '/routines/r1/assignments',
    ],
    [
      'routines.remove',
      () => TestBed.inject(RoutinesHttpAdapter).remove('r1'),
      'DELETE',
      '/routines/r1',
    ],
    ['catalog.list', () => TestBed.inject(ExerciseCatalogHttpAdapter).list(), 'GET', '/exercises'],
    [
      'catalog.forTrainer',
      () => TestBed.inject(ExerciseCatalogHttpAdapter).listForTrainer('t1'),
      'GET',
      '/trainers/t1/exercises',
    ],
    [
      'catalog.getById',
      () => TestBed.inject(ExerciseCatalogHttpAdapter).getById('e1'),
      'GET',
      '/exercises/e1',
    ],
    [
      'catalog.create',
      () =>
        TestBed.inject(ExerciseCatalogHttpAdapter).create({
          name: 'E',
          muscleGroup: 'legs',
          equipment: null,
          thumbnailUrl: null,
          instructions: [],
          ownerTrainerId: 't1',
        }),
      'POST',
      '/exercises',
    ],
    [
      'workouts.list',
      () => TestBed.inject(WorkoutsHttpAdapter).listByStudent('s1'),
      'GET',
      '/students/s1/workouts',
    ],
    [
      'workouts.getById',
      () => TestBed.inject(WorkoutsHttpAdapter).getById('w1'),
      'GET',
      '/workouts/w1',
    ],
    [
      'workouts.start',
      () => TestBed.inject(WorkoutsHttpAdapter).start('w1'),
      'POST',
      '/workouts/w1/start',
    ],
    [
      'workouts.mark',
      () => TestBed.inject(WorkoutsHttpAdapter).markExercise('w1', 'x1', true),
      'PUT',
      '/workouts/w1/exercises/x1/done',
    ],
    [
      'workouts.logSet',
      () =>
        TestBed.inject(WorkoutsHttpAdapter).logSet('w1', 'x1', {
          setNumber: 1,
          reps: 10,
          weightKg: 20,
        }),
      'POST',
      '/workouts/w1/exercises/x1/sets',
    ],
    [
      'workouts.skip',
      () => TestBed.inject(WorkoutsHttpAdapter).skipExercise('w1', 'x1', 'pain'),
      'POST',
      '/workouts/w1/exercises/x1/skip',
    ],
    [
      'workouts.complete',
      () => TestBed.inject(WorkoutsHttpAdapter).complete('w1', { durationMinutes: 30, note: null }),
      'POST',
      '/workouts/w1/complete',
    ],
    [
      'photos.list',
      () => TestBed.inject(ProgressPhotosHttpAdapter).listByStudent('s1'),
      'GET',
      '/students/s1/photos',
    ],
    [
      'photos.remove',
      () => TestBed.inject(ProgressPhotosHttpAdapter).remove('p1'),
      'DELETE',
      '/photos/p1',
    ],
    [
      'schedule.confirm',
      () => TestBed.inject(ScheduleHttpAdapter).confirm('c1'),
      'POST',
      '/schedule/c1/confirm',
    ],
    [
      'schedule.cancel',
      () => TestBed.inject(ScheduleHttpAdapter).cancel('c1', 'other', 'x'),
      'POST',
      '/schedule/c1/cancel',
    ],
    [
      'notifications.list',
      () => TestBed.inject(NotificationsHttpAdapter).listByUser('u1'),
      'GET',
      '/me/notifications',
    ],
    [
      'notifications.read',
      () => TestBed.inject(NotificationsHttpAdapter).markRead('n1'),
      'POST',
      '/notifications/n1/read',
    ],
    [
      'notifications.readAll',
      () => TestBed.inject(NotificationsHttpAdapter).markAllRead('u1'),
      'POST',
      '/me/notifications/read-all',
    ],
  ];

  it.each(cases)('%s → %s %s', async (_name, call, method, path) => {
    const result = firstValueFrom(call());
    const req = http.expectOne(`${BASE}${path}`);
    expect(req.request.method).toBe(method);
    req.flush(null);
    await result;
  });

  it('envia el rango de fechas como query', async () => {
    const workouts = firstValueFrom(TestBed.inject(WorkoutsHttpAdapter).listByStudent('s1', RANGE));
    http
      .expectOne(
        req => req.url === `${BASE}/students/s1/workouts` && req.params.get('from') === RANGE.from,
      )
      .flush([]);
    await workouts;

    const schedule = firstValueFrom(TestBed.inject(ScheduleHttpAdapter).listByStudent('s1', RANGE));
    http
      .expectOne(
        req => req.url === `${BASE}/students/s1/schedule` && req.params.get('to') === RANGE.to,
      )
      .flush([]);
    await schedule;
  });

  it('traduce el error del BFF a DomainError', async () => {
    const result = firstValueFrom(TestBed.inject(StudentsHttpAdapter).getById('s1'));
    http
      .expectOne(`${BASE}/students/s1`)
      .flush(
        { error: { code: 'conflict', message: 'Ya existe.' } },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(result).rejects.toMatchObject({ code: 'conflict', message: 'Ya existe.' });
  });

  it('rechaza una foto que no es data URL sin llamar al BFF', async () => {
    const add = TestBed.inject(ProgressPhotosHttpAdapter).add({
      studentId: 's1',
      takenAt: RANGE.from,
      url: 'https://x/y.jpg',
      angle: 'front',
      weightKg: null,
      note: null,
    });
    await expect(firstValueFrom(add)).rejects.toBeInstanceOf(DomainError);
  });

  describe('interceptor', () => {
    it('agrega el token y no lo agrega al login', async () => {
      storage.value = session('a1');
      const list = firstValueFrom(TestBed.inject(StudentsHttpAdapter).listByTrainer('t1'));
      const req = http.expectOne(`${BASE}/trainers/t1/students`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer a1');
      req.flush([]);
      await list;

      const login = firstValueFrom(
        TestBed.inject(AuthHttpAdapter).login({ email: 'a', password: 'b' }),
      );
      const loginReq = http.expectOne(`${BASE}/auth/login`);
      expect(loginReq.request.headers.has('Authorization')).toBe(false);
      loginReq.flush(session('a2'));
      await login;
    });

    it('ante un 401 renueva el token una vez y reintenta', async () => {
      storage.value = session('viejo');
      const result = firstValueFrom(TestBed.inject(TrainersHttpAdapter).getById('t1'));
      http
        .expectOne(`${BASE}/trainers/t1`)
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      const refresh = http.expectOne(`${BASE}/auth/refresh`);
      expect(refresh.request.body).toEqual({ refreshToken: 'r1' });
      refresh.flush(session('nuevo', 'r2'));
      const retry = http.expectOne(`${BASE}/trainers/t1`);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer nuevo');
      retry.flush({ id: 't1' });
      await expect(result).resolves.toEqual({ id: 't1' });
      expect(storage.value?.token).toBe('nuevo');
    });

    it('si el refresh falla, cierra la sesion', async () => {
      const expired = fn<() => void>();
      setSessionExpiredHandler(expired);
      storage.value = session('viejo');
      const result = firstValueFrom(TestBed.inject(TrainersHttpAdapter).getById('t1'));
      http
        .expectOne(`${BASE}/trainers/t1`)
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      http
        .expectOne(`${BASE}/auth/refresh`)
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
      expect(storage.value).toBeNull();
      expect(expired).toHaveBeenCalled();
    });
  });
});

describe('utilidades HTTP', () => {
  it('resuelve la base de la API segun la plataforma', () => {
    expect(resolveApiBaseUrl('https://neque.vercel.app/', true)).toBe(
      'https://neque.vercel.app/api/v1',
    );
    expect(resolveApiBaseUrl('https://neque.vercel.app', false)).toBe('/api/v1');
  });

  it('mapea errores de red y desconocidos', () => {
    expect(toDomainError(new HttpErrorResponse({ status: 0 })).code).toBe('network');
    expect(toDomainError(new HttpErrorResponse({ status: 401 })).code).toBe('unauthorized');
    expect(
      toDomainError(new HttpErrorResponse({ status: 500, error: { error: { code: 'raro' } } }))
        .code,
    ).toBe('unknown');
    expect(toDomainError(Object.assign(new Error('t'), { name: 'TimeoutError' })).code).toBe(
      'network',
    );
    expect(toDomainError('x').code).toBe('unknown');
  });

  it('convierte un data URL en Blob con su tipo', () => {
    const blob = dataUrlToBlob('data:image/png;base64,aGk=');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(2);
    expect(isDataUrl('data:x')).toBe(true);
    expect(isDataUrl(null)).toBe(false);
  });
});
