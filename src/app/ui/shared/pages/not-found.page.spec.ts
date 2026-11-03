import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthSession } from '@app/domain/auth/model/auth-user.model';
import { AUTH_PORT } from '@app/domain/auth/port/auth.port';
import {
  SESSION_STORAGE_PORT,
  SessionStoragePort,
} from '@app/domain/auth/port/session-storage.port';
import { CLOCK } from '@app/domain/shared/port/clock.port';

import { fn } from '@testing/typed-mock';

import { NotFoundPage } from './not-found.page';

const sessionFor = (role: 'trainer' | 'student'): AuthSession => ({
  user: {
    id: `usr-${role}`,
    email: `${role}@neque.cl`,
    role,
    displayName: 'Persona',
    avatarUrl: null,
    profileId: 'p-1',
  },
  token: 'token',
  expiresAt: '2026-09-24T10:00:00.000Z',
});

describe('NotFoundPage', () => {
  let router: Router;

  const createPage = (stored: AuthSession | null): NotFoundPage => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CLOCK, useValue: { now: () => new Date('2026-09-17T10:00:00.000Z') } },
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
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new NotFoundPage());
  };

  describe('sin sesion', () => {
    it('ofrece ir a ingresar', () => {
      expect(createPage(null).ctaLabel()).toBe('Ir a ingresar');
    });

    it('navega a la raiz', () => {
      createPage(null).goHome();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('con sesion', () => {
    it('ofrece volver al inicio', () => {
      expect(createPage(sessionFor('student')).ctaLabel()).toBe('Volver al inicio');
    });

    it('lleva al alumno a su home', () => {
      createPage(sessionFor('student')).goHome();
      expect(router.navigate).toHaveBeenCalledWith(['/student/home']);
    });

    it('lleva al entrenador a su dashboard', () => {
      createPage(sessionFor('trainer')).goHome();
      expect(router.navigate).toHaveBeenCalledWith(['/trainer/home']);
    });
  });
});
