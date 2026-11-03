import { TestBed } from '@angular/core/testing';
import { Route, Router, UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthSession } from '@app/domain/auth/model/auth-user.model';
import { AUTH_PORT } from '@app/domain/auth/port/auth.port';
import {
  SESSION_STORAGE_PORT,
  SessionStoragePort,
} from '@app/domain/auth/port/session-storage.port';
import { CLOCK } from '@app/domain/shared/port/clock.port';

import { fn } from '@testing/typed-mock';

import { authGuard, publicOnlyGuard, roleGuard } from './auth.guard';

const NOW = new Date('2026-09-17T10:00:00.000Z');

const sessionFor = (role: 'trainer' | 'student'): AuthSession => ({
  user: {
    id: `usr-${role}`,
    email: `${role}@neque.cl`,
    role,
    displayName: role === 'trainer' ? 'Kelvin Moreno' : 'Alejandra Acosta',
    avatarUrl: null,
    profileId: role === 'trainer' ? 'trn-001' : 'std-001',
  },
  token: 'token',
  expiresAt: '2026-09-24T10:00:00.000Z',
});

const ROUTE: Route = { path: 'x' };
const SEGMENTS: UrlSegment[] = [];

describe('guards de autenticacion', () => {
  const setup = (stored: AuthSession | null): Router => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CLOCK, useValue: { now: () => NOW } },
        {
          provide: AUTH_PORT,
          useValue: {
            login: () => of(sessionFor('student')),
            signOut: () => of(undefined),
            requestPasswordReset: () => of(undefined),
            verifyOtp: () => of(sessionFor('student')),
          },
        },
        {
          provide: SESSION_STORAGE_PORT,
          useValue: {
            read: () => stored,
            write: fn<SessionStoragePort['write']>(),
            clear: fn<SessionStoragePort['clear']>(),
          },
        },
      ],
    });
    return TestBed.inject(Router);
  };

  const run = (guard: typeof authGuard): boolean | UrlTree =>
    TestBed.runInInjectionContext(() => guard(ROUTE, SEGMENTS)) as boolean | UrlTree;

  describe('authGuard', () => {
    it('deja pasar con sesion activa', () => {
      setup(sessionFor('student'));
      expect(run(authGuard)).toBe(true);
    });

    it('redirige a la raiz sin sesion', () => {
      const router = setup(null);
      expect(run(authGuard)).toEqual(router.parseUrl('/'));
    });
  });

  describe('roleGuard', () => {
    it('deja pasar cuando el rol calza', () => {
      setup(sessionFor('student'));
      expect(run(roleGuard('student'))).toBe(true);
    });

    it('manda al alumno a su home si intenta entrar al shell del entrenador', () => {
      const router = setup(sessionFor('student'));
      expect(run(roleGuard('trainer'))).toEqual(router.parseUrl('/student/home'));
    });

    it('manda al entrenador a su dashboard si intenta entrar al shell del alumno', () => {
      const router = setup(sessionFor('trainer'));
      expect(run(roleGuard('student'))).toEqual(router.parseUrl('/trainer/home'));
    });

    it('redirige a la raiz sin sesion', () => {
      const router = setup(null);
      expect(run(roleGuard('student'))).toEqual(router.parseUrl('/'));
    });
  });

  describe('publicOnlyGuard', () => {
    it('deja ver el login sin sesion', () => {
      setup(null);
      expect(run(publicOnlyGuard)).toBe(true);
    });

    it('manda al home del rol si ya hay sesion', () => {
      const router = setup(sessionFor('trainer'));
      expect(run(publicOnlyGuard)).toEqual(router.parseUrl('/trainer/home'));
    });
  });
});
