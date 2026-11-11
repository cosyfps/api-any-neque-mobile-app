import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { InvitationFacade } from '@app/application/auth/invitation.facade';
import { SessionFacade } from '@app/application/auth/session.facade';
import { AuthSession } from '@app/domain/auth/model/auth-user.model';
import { AUTH_PORT } from '@app/domain/auth/port/auth.port';
import {
  INVITATION_PORT,
  InvitationPort,
  InvitationDetails,
} from '@app/domain/auth/port/invitation.port';
import {
  SESSION_STORAGE_PORT,
  SessionStoragePort,
} from '@app/domain/auth/port/session-storage.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';

import { fn, MockOf } from '@testing/typed-mock';

import { InvitePage } from './invite.page';

const NOW = new Date('2026-09-17T10:00:00.000Z');

const INVITATION: InvitationDetails = {
  token: 'inv-valida',
  studentId: 'std-002',
  studentName: 'Camila Soto',
  email: 'camila@neque.cl',
  trainerName: 'Kelvin Moreno',
  expiresAt: '2026-12-31T23:59:59.000Z',
  status: 'pending',
};

const SESSION: AuthSession = {
  user: {
    id: 'usr-std-002',
    email: 'camila@neque.cl',
    role: 'student',
    displayName: 'Camila Soto',
    avatarUrl: null,
    profileId: 'std-002',
  },
  token: 'token',
  expiresAt: '2026-09-24T10:00:00.000Z',
};

describe('InvitePage', () => {
  let page: InvitePage;
  let router: Router;
  let resolveInvitation: MockOf<InvitationPort['resolve']>;
  let accept: MockOf<InvitationPort['accept']>;

  const createPage = (token = 'inv-valida'): InvitePage => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        InvitationFacade,
        { provide: CLOCK, useValue: { now: () => NOW } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => token } } },
        },
        { provide: INVITATION_PORT, useValue: { resolve: resolveInvitation, accept } },
        {
          provide: AUTH_PORT,
          useValue: {
            login: () => of(SESSION),
            signOut: () => of(undefined),
            requestPasswordReset: () => of(undefined),
            verifyOtp: () => of(SESSION),
          },
        },
        {
          provide: SESSION_STORAGE_PORT,
          useValue: {
            read: () => null,
            write: fn<SessionStoragePort['write']>(),
            clear: fn<SessionStoragePort['clear']>(),
          },
        },
        SessionFacade,
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new InvitePage());
  };

  beforeEach(() => {
    resolveInvitation = fn<InvitationPort['resolve']>().mockReturnValue(of(INVITATION));
    accept = fn<InvitationPort['accept']>().mockReturnValue(of(SESSION));
    page = createPage();
  });

  describe('carga de la invitacion', () => {
    it('resuelve el token de la url', () => {
      expect(resolveInvitation).toHaveBeenCalledWith('inv-valida');
      expect(page.facade.viewState()).toBe('success');
    });

    it('expone los nombres para el saludo', () => {
      expect(page.facade.studentName()).toBe('Camila Soto');
      expect(page.facade.trainerName()).toBe('Kelvin Moreno');
    });

    it('queda en error con un token invalido', () => {
      resolveInvitation.mockReturnValue(
        throwError(() => domainError('invalid_invitation', 'Esta invitación expiró.')),
      );
      page = createPage('inv-expirada');

      expect(page.facade.viewState()).toBe('error');
      expect(page.facade.errorMessage()).toBe('Esta invitación expiró.');
      expect(page.facade.linkRejected()).toBe(true);
    });

    // QA-26: sin red el enlace puede estar bien; decir "no valida" lo
    // daba por perdido y no habia como reintentar.
    it('un fallo de red no marca el enlace como rechazado y se puede reintentar', () => {
      resolveInvitation.mockReturnValue(throwError(() => domainError('network')));
      page = createPage('inv-sin-red');
      expect(page.facade.linkRejected()).toBe(false);

      resolveInvitation.mockReturnValue(of(INVITATION));
      page.retryLoad();

      expect(page.facade.viewState()).toBe('success');
    });
  });

  describe('validacion del formulario', () => {
    it('arranca invalido', () => {
      expect(page.formValid()).toBe(false);
    });

    it('exige las cuatro reglas de contrasena', () => {
      page.form.controls.password.setValue('corta');

      expect(page.passwordValid()).toBe(false);
      expect(page.rules().filter(rule => rule.met).length).toBeLessThan(4);
    });

    it('acepta una contrasena que cumple las cuatro reglas', () => {
      page.form.controls.password.setValue('Alumno1234!');

      expect(page.passwordValid()).toBe(true);
    });

    it('exige que la confirmacion coincida', () => {
      page.form.controls.password.setValue('Alumno1234!');
      page.form.controls.confirm.setValue('Otra1234!');

      expect(page.confirmsMatch()).toBe(false);
      expect(page.formValid()).toBe(false);
    });

    it('es valido cuando ambas coinciden', () => {
      page.form.controls.password.setValue('Alumno1234!');
      page.form.controls.confirm.setValue('Alumno1234!');

      expect(page.formValid()).toBe(true);
    });
  });

  describe('confirmError()', () => {
    it('no muestra error antes de tocar el campo', () => {
      page.form.controls.password.setValue('Alumno1234!');
      page.form.controls.confirm.setValue('Otra1234!');

      expect(page.confirmError()).toBeNull();
    });

    it('avisa cuando no coinciden y ya se toco', () => {
      page.form.controls.password.setValue('Alumno1234!');
      page.form.controls.confirm.setValue('Otra1234!');
      page.markConfirmTouched();

      expect(page.confirmError()).toBe('Las contraseñas no coinciden');
    });

    it('no avisa con el campo vacio', () => {
      page.markConfirmTouched();

      expect(page.confirmError()).toBeNull();
    });
  });

  describe('togglePassword()', () => {
    it('alterna la visibilidad', () => {
      expect(page.showPassword()).toBe(false);

      page.togglePassword();

      expect(page.showPassword()).toBe(true);
    });

    it('cada campo tiene su propio ojo: mostrar uno no revela el otro', () => {
      page.togglePassword();
      expect(page.showPassword()).toBe(true);
      expect(page.showConfirm()).toBe(false);

      page.toggleConfirm();
      page.togglePassword();
      expect(page.showPassword()).toBe(false);
      expect(page.showConfirm()).toBe(true);
    });
  });

  describe('onSubmit()', () => {
    const fillValid = (): void => {
      page.form.controls.password.setValue('Alumno1234!');
      page.form.controls.confirm.setValue('Alumno1234!');
    };

    it('no envia con el formulario invalido', async () => {
      await page.onSubmit();

      expect(accept).not.toHaveBeenCalled();
    });

    it('acepta la invitacion y navega al home del alumno', async () => {
      fillValid();

      await page.onSubmit();

      expect(accept).toHaveBeenCalledWith('inv-valida', 'Alumno1234!');
      expect(router.navigate).toHaveBeenCalledWith(['/student/home']);
    });

    it('expone el error del backend sin navegar', async () => {
      accept.mockReturnValue(
        throwError(() => domainError('invalid_invitation', 'La contraseña no cumple.')),
      );
      fillValid();

      await page.onSubmit();

      expect(page.facade.submitError()).toBe('La contraseña no cumple.');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('limpia el error al editar el formulario', async () => {
      accept.mockReturnValue(throwError(() => domainError('invalid_invitation')));
      fillValid();
      await page.onSubmit();
      expect(page.facade.submitError()).not.toBeNull();

      page.form.controls.password.setValue('Otra1234!');

      expect(page.facade.submitError()).toBeNull();
    });
  });

  describe('goToLogin()', () => {
    it('vuelve a la pantalla de ingreso', () => {
      page.goToLogin();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
