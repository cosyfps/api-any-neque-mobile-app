import { ElementRef, QueryList } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { AuthSession, PasswordResetTicket } from '@app/domain/auth/model/auth-user.model';
import { AUTH_PORT, AuthPort } from '@app/domain/auth/port/auth.port';
import {
  SESSION_STORAGE_PORT,
  SessionStoragePort,
} from '@app/domain/auth/port/session-storage.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';

import { fn, MockOf } from '@testing/typed-mock';

import { ForgotPasswordPage } from './forgot-password.page';

const STUDENT_SESSION: AuthSession = {
  user: {
    id: 'usr-1',
    email: 'kelvin@duocuc.cl',
    role: 'student',
    displayName: 'Alejandra Acosta',
    avatarUrl: null,
    profileId: 'std-001',
  },
  token: 'token',
  expiresAt: '2026-12-31T00:00:00.000Z',
};

const TICKET: PasswordResetTicket = { email: 'kelvin@duocuc.cl', token: 'reset-1' };

describe('ForgotPasswordPage', () => {
  let page: ForgotPasswordPage;
  let router: Router;
  let inputs: HTMLInputElement[];
  let requestPasswordReset: MockOf<AuthPort['requestPasswordReset']>;
  let verifyOtp: MockOf<AuthPort['verifyOtp']>;
  let resetPassword: MockOf<AuthPort['resetPassword']>;

  /** Sustituye el @ViewChildren('otpInput') por inputs reales de jsdom. */
  const attachOtpInputs = (): void => {
    inputs = Array.from({ length: page.otpLength }, () => {
      const el = document.createElement('input');
      document.body.appendChild(el);
      return el;
    });
    const list = new QueryList<ElementRef<HTMLInputElement>>();
    list.reset(inputs.map(el => new ElementRef(el)));
    page.otpInputs = list;
  };

  const typeOtp = (index: number, value: string): void => {
    const input = inputs[index] as HTMLInputElement;
    input.value = value;
    page.onOtpInput(index, { target: input } as unknown as Event);
  };

  beforeEach(() => {
    requestPasswordReset = fn<AuthPort['requestPasswordReset']>().mockReturnValue(of(undefined));
    verifyOtp = fn<AuthPort['verifyOtp']>().mockReturnValue(of(TICKET));
    resetPassword = fn<AuthPort['resetPassword']>().mockReturnValue(of(STUDENT_SESSION));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CLOCK, useValue: { now: () => new Date('2026-09-17T10:00:00.000Z') } },
        {
          provide: AUTH_PORT,
          useValue: {
            login: () => of(STUDENT_SESSION),
            signOut: () => of(undefined),
            requestPasswordReset,
            verifyOtp,
            resetPassword,
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
      ],
    });
    router = TestBed.inject(Router);
    // Ninguna prueba debe navegar de verdad: el router de prueba no declara rutas.
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    page = TestBed.runInInjectionContext(() => new ForgotPasswordPage());
    attachOtpInputs();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  describe('estado inicial', () => {
    it('arranca en el paso de email con el OTP vacio', () => {
      expect(page.step()).toBe('email');
      expect(page.otpValues()).toEqual(['', '', '', '', '', '']);
      expect(page.otpComplete()).toBe(false);
      expect(page.emailError()).toBeNull();
      expect(page.canResend()).toBe(false);
    });
  });

  describe('validacion de email', () => {
    it('exige el campo cuando esta vacio y ya fue tocado', () => {
      page.markEmailTouched();

      expect(page.emailError()).toBe('El correo es obligatorio');
      expect(page.emailValid()).toBe(false);
    });

    it('rechaza un formato invalido', () => {
      page.markEmailTouched();
      page.emailForm.controls.email.setValue('kelvin@sin-tld');

      expect(page.emailError()).toBe('Ingresa un correo válido');
    });

    it('acepta un email valido', () => {
      page.markEmailTouched();
      page.emailForm.controls.email.setValue('kelvin@duocuc.cl');

      expect(page.emailError()).toBeNull();
      expect(page.emailValid()).toBe(true);
    });
  });

  describe('maskedEmail()', () => {
    it('enmascara el usuario dejando primera y ultima letra', () => {
      page.emailForm.controls.email.setValue('kelvin@duocuc.cl');

      expect(page.maskedEmail()).toBe('k****n@duocuc.cl');
    });

    it('no enmascara usuarios de dos caracteres o menos', () => {
      page.emailForm.controls.email.setValue('ab@duocuc.cl');

      expect(page.maskedEmail()).toBe('ab@duocuc.cl');
    });

    it('devuelve el texto tal cual si no hay arroba', () => {
      page.emailForm.controls.email.setValue('sin-arroba');

      expect(page.maskedEmail()).toBe('sin-arroba');
    });
  });

  describe('onSendCode()', () => {
    beforeEach(() => jest.useFakeTimers());

    it('no envia si el email es invalido', () => {
      page.onSendCode();

      expect(page.emailTouched()).toBe(true);
      expect(page.isSending()).toBe(false);
      expect(page.step()).toBe('email');
    });

    it('pasa al paso OTP y arranca el countdown tras el envio', () => {
      const pending = new Subject<void>();
      requestPasswordReset.mockReturnValue(pending);
      page.emailForm.controls.email.setValue('kelvin@duocuc.cl');

      page.onSendCode();
      expect(page.isSending()).toBe(true);

      pending.next();

      expect(page.isSending()).toBe(false);
      expect(page.step()).toBe('otp');
      expect(page.resendCountdown()).toBe(60);
      expect(page.canResend()).toBe(false);
    });

    it('llama al puerto con el correo ingresado', () => {
      page.emailForm.controls.email.setValue('kelvin@duocuc.cl');

      page.onSendCode();

      expect(requestPasswordReset).toHaveBeenCalledWith('kelvin@duocuc.cl');
    });

    it('ignora un segundo envio mientras hay uno en curso', () => {
      requestPasswordReset.mockReturnValue(new Subject<void>());
      page.emailForm.controls.email.setValue('kelvin@duocuc.cl');
      page.onSendCode();

      page.onSendCode();

      expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    });

    it('expone el error del backend sin avanzar de paso', () => {
      requestPasswordReset.mockReturnValue(throwError(() => domainError('not_found')));
      page.emailForm.controls.email.setValue('kelvin@duocuc.cl');

      page.onSendCode();

      expect(page.isSending()).toBe(false);
      expect(page.step()).toBe('email');
      expect(page.requestError()).toBe('No encontramos lo que buscabas.');
    });

    // QA-20
    it('borra el error del backend al corregir el correo', () => {
      requestPasswordReset.mockReturnValue(throwError(() => domainError('network')));
      page.emailForm.controls.email.setValue('kelvin@duocuc.cl');
      page.onSendCode();

      page.emailForm.controls.email.setValue('kelvin@duoc.cl');

      expect(page.requestError()).toBeNull();
    });

    // QA-16: el login tolera el espacio final del teclado de iOS; aqui no.
    it('acepta el espacio final y envia el correo recortado y en minuscula', () => {
      page.emailForm.controls.email.setValue('Kelvin@DuocUC.cl ');

      page.onSendCode();

      expect(requestPasswordReset).toHaveBeenCalledWith('kelvin@duocuc.cl');
    });

    it('recorta el correo al salir del campo', () => {
      page.emailForm.controls.email.setValue('  kelvin@duocuc.cl ');

      page.markEmailTouched();

      expect(page.emailForm.controls.email.value).toBe('kelvin@duocuc.cl');
    });
  });

  describe('entrada del OTP', () => {
    it('guarda el digito y avanza al siguiente input', () => {
      const focus = jest.spyOn(inputs[1] as HTMLInputElement, 'focus');

      typeOtp(0, '4');

      expect(page.otpValues()[0]).toBe('4');
      expect(focus).toHaveBeenCalled();
    });

    it('descarta caracteres no numericos', () => {
      typeOtp(0, 'a');

      expect(page.otpValues()[0]).toBe('');
    });

    it('se queda en el ultimo input sin desbordar', () => {
      typeOtp(5, '9');

      expect(page.otpValues()[5]).toBe('9');
    });

    it('backspace en un input vacio limpia y enfoca el anterior', () => {
      typeOtp(0, '1');
      const focus = jest.spyOn(inputs[0] as HTMLInputElement, 'focus');

      page.onOtpKeydown(1, new KeyboardEvent('keydown', { key: 'Backspace' }));

      expect(page.otpValues()[0]).toBe('');
      expect(focus).toHaveBeenCalled();
    });

    it('backspace no hace nada si el input tiene contenido', () => {
      typeOtp(1, '7');

      page.onOtpKeydown(1, new KeyboardEvent('keydown', { key: 'Backspace' }));

      expect(page.otpValues()[1]).toBe('7');
    });

    it('onOtpFocus selecciona el contenido del input', () => {
      const select = jest.spyOn(inputs[2] as HTMLInputElement, 'select');

      page.onOtpFocus(2);

      expect(select).toHaveBeenCalled();
    });
  });

  describe('pegado del OTP', () => {
    const pasteEvent = (text: string): ClipboardEvent =>
      ({
        preventDefault: fn<Event['preventDefault']>(),
        clipboardData: { getData: () => text },
      }) as unknown as ClipboardEvent;

    it('reparte los 6 digitos desde el primer input', () => {
      page.onOtpPaste(pasteEvent('123456'));

      expect(page.otpValues()).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(page.otpComplete()).toBe(true);
    });

    it('empieza en el input enfocado y no desborda', () => {
      (inputs[4] as HTMLInputElement).focus();

      page.onOtpPaste(pasteEvent('987654'));

      expect(page.otpValues()).toEqual(['', '', '', '', '9', '8']);
    });

    it('ignora un pegado sin digitos', () => {
      page.onOtpPaste(pasteEvent('sin-numeros'));

      expect(page.otpValues()).toEqual(['', '', '', '', '', '']);
    });

    it('descarta separadores del texto pegado', () => {
      page.onOtpPaste(pasteEvent('12-34 56'));

      expect(page.otpValues()).toEqual(['1', '2', '3', '4', '5', '6']);
    });
  });

  describe('onVerifyOtp()', () => {
    it('no verifica con el codigo incompleto', () => {
      page.onVerifyOtp();

      expect(page.isVerifying()).toBe(false);
      expect(verifyOtp).not.toHaveBeenCalled();
    });

    it('entra en verificacion con el codigo completo', () => {
      verifyOtp.mockReturnValue(new Subject<PasswordResetTicket>());
      page.otpValues.set(['1', '2', '3', '4', '5', '6']);

      page.onVerifyOtp();

      expect(page.isVerifying()).toBe(true);
    });

    it('envia el codigo concatenado junto al correo', () => {
      page.emailForm.controls.email.setValue('kelvin@duocuc.cl');
      page.otpValues.set(['1', '2', '3', '4', '5', '6']);

      page.onVerifyOtp();

      expect(verifyOtp).toHaveBeenCalledWith('kelvin@duocuc.cl', '123456');
    });

    // Verificar el codigo ya no abre sesion: un OTP no puede valer lo mismo
    // que la contrasena.
    it('pasa al paso de contrasena nueva sin navegar ni abrir sesion', () => {
      page.otpValues.set(['1', '2', '3', '4', '5', '6']);

      page.onVerifyOtp();

      expect(page.isVerifying()).toBe(false);
      expect(page.step()).toBe('password');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('expone el error de un codigo invalido', () => {
      verifyOtp.mockReturnValue(throwError(() => domainError('invalid_credentials')));
      page.otpValues.set(['0', '0', '0', '0', '0', '0']);

      page.onVerifyOtp();

      expect(page.isVerifying()).toBe(false);
      expect(page.requestError()).toBe('Correo o contraseña incorrectos.');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('onSetPassword()', () => {
    const reachPasswordStep = (): void => {
      page.otpValues.set(['1', '2', '3', '4', '5', '6']);
      page.onVerifyOtp();
    };

    const fillPassword = (password: string, confirm = password): void => {
      page.passwordForm.controls.password.setValue(password);
      page.passwordForm.controls.confirm.setValue(confirm);
    };

    it('no guarda sin haber verificado el codigo', () => {
      fillPassword('Abcdefg1!');

      page.onSetPassword();

      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('no guarda con una contrasena que no cumple las reglas', () => {
      reachPasswordStep();
      fillPassword('corta');

      page.onSetPassword();

      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('no guarda si la confirmacion no coincide', () => {
      reachPasswordStep();
      fillPassword('Abcdefg1!', 'Otra1234!');

      page.onSetPassword();

      expect(page.confirmsMatch()).toBe(false);
      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('avisa de la confirmacion distinta una vez tocado el campo', () => {
      reachPasswordStep();
      fillPassword('Abcdefg1!', 'Otra1234!');
      page.markConfirmTouched();

      expect(page.confirmError()).toBe('Las contraseñas no coinciden');
    });

    it('no avisa antes de tocar el campo', () => {
      reachPasswordStep();
      fillPassword('Abcdefg1!', 'Otra1234!');

      expect(page.confirmError()).toBeNull();
    });

    it('guarda la contrasena y navega al home del rol', () => {
      reachPasswordStep();
      fillPassword('Abcdefg1!');

      page.onSetPassword();

      expect(resetPassword).toHaveBeenCalledWith(TICKET, 'Abcdefg1!');
      expect(page.isSaving()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/student/home'], { replaceUrl: true });
    });

    it('ignora el segundo envio mientras guarda', () => {
      resetPassword.mockReturnValue(new Subject<AuthSession>());
      reachPasswordStep();
      fillPassword('Abcdefg1!');

      page.onSetPassword();
      page.onSetPassword();

      expect(resetPassword).toHaveBeenCalledTimes(1);
      expect(page.isSaving()).toBe(true);
    });

    it('expone el error de un ticket ya usado', () => {
      resetPassword.mockReturnValue(throwError(() => domainError('unauthorized')));
      reachPasswordStep();
      fillPassword('Abcdefg1!');

      page.onSetPassword();

      expect(page.isSaving()).toBe(false);
      expect(page.requestError()).not.toBeNull();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    // QA-17: el codigo ya se uso; volver con el puesto dejaba la pantalla
    // sin salida (codigo inservible y reenvio detenido).
    it('vuelve al paso del codigo limpio y con el reenvio disponible', () => {
      reachPasswordStep();

      page.backToOtp();

      expect(page.step()).toBe('otp');
      expect(page.otpValues()).toEqual(['', '', '', '', '', '']);
      expect(page.canResend()).toBe(true);
    });

    it('tras volver ya no guarda con el ticket consumido', () => {
      reachPasswordStep();
      page.backToOtp();
      fillPassword('Abcdefg1!');

      page.onSetPassword();

      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('alterna la visibilidad de la contrasena', () => {
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

  describe('reenvio de codigo', () => {
    beforeEach(() => jest.useFakeTimers());

    it('no reenvia mientras el countdown sigue corriendo', () => {
      page.resendCode();

      expect(page.resendCountdown()).toBe(60);
    });

    it('descuenta un segundo por tick y habilita el reenvio al llegar a cero', () => {
      page.emailForm.controls.email.setValue('kelvin@duocuc.cl');
      page.onSendCode();

      jest.advanceTimersByTime(1000);
      expect(page.resendCountdown()).toBe(59);

      jest.advanceTimersByTime(59_000);
      expect(page.resendCountdown()).toBe(0);
      expect(page.canResend()).toBe(true);
    });

    it('reinicia el countdown al reenviar', () => {
      page.canResend.set(true);

      page.resendCode();

      expect(page.canResend()).toBe(false);
      expect(page.resendCountdown()).toBe(60);
    });
  });

  describe('navegacion entre pasos', () => {
    it('backToEmail() vuelve al paso inicial y limpia el OTP', () => {
      page.step.set('otp');
      page.otpValues.set(['1', '2', '3', '4', '5', '6']);
      page.isVerifying.set(true);

      page.backToEmail();

      expect(page.step()).toBe('email');
      expect(page.otpValues()).toEqual(['', '', '', '', '', '']);
      expect(page.isVerifying()).toBe(false);
    });

    it('goBack() navega al inicio', () => {
      const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);

      page.goBack();

      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('ngAfterViewInit()', () => {
    it('enfoca el primer input al entrar al paso OTP', () => {
      jest.useFakeTimers();
      const focus = jest.spyOn(inputs[0] as HTMLInputElement, 'focus');
      TestBed.runInInjectionContext(() => page.ngAfterViewInit());
      page.step.set('otp');

      page.otpInputs.notifyOnChanges();
      jest.advanceTimersByTime(100);

      expect(focus).toHaveBeenCalled();
    });

    it('no enfoca nada si sigue en el paso de email', () => {
      jest.useFakeTimers();
      const focus = jest.spyOn(inputs[0] as HTMLInputElement, 'focus');
      TestBed.runInInjectionContext(() => page.ngAfterViewInit());

      page.otpInputs.notifyOnChanges();
      jest.advanceTimersByTime(100);

      expect(focus).not.toHaveBeenCalled();
    });
  });
});
