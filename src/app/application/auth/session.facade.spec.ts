import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthSession } from '@app/domain/auth/model/auth-user.model';
import { AUTH_PORT, AuthPort } from '@app/domain/auth/port/auth.port';
import {
  SESSION_STORAGE_PORT,
  SessionStoragePort,
} from '@app/domain/auth/port/session-storage.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';

import { fn, MockOf } from '@testing/typed-mock';

import { SessionFacade } from './session.facade';

const NOW = new Date('2026-09-17T10:00:00.000Z');

const sessionFor = (role: 'trainer' | 'student', expiresAt: string): AuthSession => ({
  user: {
    id: `usr-${role}`,
    email: `${role}@neque.cl`,
    role,
    displayName: role === 'trainer' ? 'Kelvin Moreno' : 'Alejandra Acosta',
    avatarUrl: null,
    profileId: role === 'trainer' ? 'trn-001' : 'std-001',
  },
  token: 'token',
  expiresAt,
});

const VALID_STUDENT = sessionFor('student', '2026-09-24T10:00:00.000Z');
const VALID_TRAINER = sessionFor('trainer', '2026-09-24T10:00:00.000Z');
const EXPIRED = sessionFor('student', '2026-09-10T10:00:00.000Z');

describe('SessionFacade', () => {
  let login: MockOf<AuthPort['login']>;
  let signOut: MockOf<AuthPort['signOut']>;
  let storage: jest.Mocked<SessionStoragePort>;

  const build = (): SessionFacade => {
    TestBed.configureTestingModule({
      providers: [
        SessionFacade,
        { provide: CLOCK, useValue: { now: () => NOW } },
        {
          provide: AUTH_PORT,
          useValue: {
            login,
            signOut,
            requestPasswordReset: () => of(undefined),
            verifyOtp: () => of(VALID_STUDENT),
          },
        },
        { provide: SESSION_STORAGE_PORT, useValue: storage },
      ],
    });
    return TestBed.inject(SessionFacade);
  };

  beforeEach(() => {
    login = fn<AuthPort['login']>().mockReturnValue(of(VALID_STUDENT));
    signOut = fn<AuthPort['signOut']>().mockReturnValue(of(undefined));
    storage = {
      read: fn<SessionStoragePort['read']>().mockReturnValue(null),
      write: fn<SessionStoragePort['write']>(),
      clear: fn<SessionStoragePort['clear']>(),
    };
  });

  describe('estado inicial', () => {
    it('arranca sin sesion', () => {
      const facade = build();
      expect(facade.isAuthenticated()).toBe(false);
      expect(facade.user()).toBeNull();
      expect(facade.role()).toBeNull();
      expect(facade.profileId()).toBeNull();
      expect(facade.displayName()).toBe('');
      expect(facade.status()).toBe('idle');
      expect(facade.isSubmitting()).toBe(false);
    });
  });

  describe('restore()', () => {
    it('rehidrata una sesion vigente', () => {
      storage.read.mockReturnValue(VALID_TRAINER);
      const facade = build();

      facade.restore();

      expect(facade.isAuthenticated()).toBe(true);
      expect(facade.role()).toBe('trainer');
      expect(facade.profileId()).toBe('trn-001');
    });

    it('descarta y limpia una sesion expirada', () => {
      storage.read.mockReturnValue(EXPIRED);
      const facade = build();

      facade.restore();

      expect(facade.isAuthenticated()).toBe(false);
      expect(storage.clear).toHaveBeenCalledTimes(1);
    });

    it('descarta una sesion con fecha no parseable', () => {
      storage.read.mockReturnValue(sessionFor('student', 'no-es-fecha'));
      const facade = build();

      facade.restore();

      expect(facade.isAuthenticated()).toBe(false);
      expect(storage.clear).toHaveBeenCalledTimes(1);
    });

    it('no hace nada si no hay sesion guardada', () => {
      const facade = build();

      facade.restore();

      expect(facade.isAuthenticated()).toBe(false);
      expect(storage.clear).not.toHaveBeenCalled();
    });

    it('no vuelve a leer el storage si ya hay sesion en memoria', () => {
      storage.read.mockReturnValue(VALID_TRAINER);
      const facade = build();

      facade.restore();
      facade.restore();

      expect(storage.read).toHaveBeenCalledTimes(1);
    });
  });

  describe('login()', () => {
    it('publica la sesion, la persiste y devuelve el home del rol', async () => {
      const facade = build();

      const route = await facade.login({ email: 'alejandra@neque.cl', password: 'x' });

      expect(route).toBe('/student/home');
      expect(facade.isAuthenticated()).toBe(true);
      expect(facade.displayName()).toBe('Alejandra Acosta');
      expect(storage.write).toHaveBeenCalledWith(VALID_STUDENT);
      expect(facade.status()).toBe('idle');
    });

    it('devuelve el home del entrenador cuando el rol es trainer', async () => {
      login.mockReturnValue(of(VALID_TRAINER));
      const facade = build();

      expect(await facade.login({ email: 'k@neque.cl', password: 'x' })).toBe('/trainer/home');
    });

    it('devuelve null y expone el error ante credenciales invalidas', async () => {
      login.mockReturnValue(throwError(() => domainError('invalid_credentials')));
      const facade = build();

      const route = await facade.login({ email: 'alejandra@neque.cl', password: 'mala' });

      expect(route).toBeNull();
      expect(facade.isAuthenticated()).toBe(false);
      expect(facade.status()).toBe('error');
      expect(facade.loginError()?.code).toBe('invalid_credentials');
      expect(storage.write).not.toHaveBeenCalled();
    });

    it('limpia el error de un intento previo', async () => {
      login.mockReturnValue(throwError(() => domainError('invalid_credentials')));
      const facade = build();
      await facade.login({ email: 'alejandra@neque.cl', password: 'mala' });

      login.mockReturnValue(of(VALID_STUDENT));
      await facade.login({ email: 'alejandra@neque.cl', password: 'buena' });

      expect(facade.loginError()).toBeNull();
      expect(facade.status()).toBe('idle');
    });
  });

  describe('adopt()', () => {
    it('publica una sesion obtenida por otro flujo', () => {
      const facade = build();

      const route = facade.adopt(VALID_STUDENT);

      expect(route).toBe('/student/home');
      expect(facade.isAuthenticated()).toBe(true);
      expect(storage.write).toHaveBeenCalledWith(VALID_STUDENT);
    });
  });

  describe('signOut()', () => {
    it('limpia la sesion y el storage', async () => {
      const facade = build();
      await facade.login({ email: 'alejandra@neque.cl', password: 'x' });

      await facade.signOut();

      expect(facade.isAuthenticated()).toBe(false);
      expect(storage.clear).toHaveBeenCalledTimes(1);
    });

    it('limpia igual aunque el backend falle', async () => {
      signOut.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      await facade.login({ email: 'alejandra@neque.cl', password: 'x' });

      await facade.signOut();

      expect(facade.isAuthenticated()).toBe(false);
      expect(storage.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearError()', () => {
    it('descarta el error y vuelve a idle', async () => {
      login.mockReturnValue(throwError(() => domainError('invalid_credentials')));
      const facade = build();
      await facade.login({ email: 'alejandra@neque.cl', password: 'mala' });

      facade.clearError();

      expect(facade.loginError()).toBeNull();
      expect(facade.status()).toBe('idle');
    });

    it('no altera el estado cuando no hay error', () => {
      const facade = build();

      facade.clearError();

      expect(facade.status()).toBe('idle');
    });
  });
});
