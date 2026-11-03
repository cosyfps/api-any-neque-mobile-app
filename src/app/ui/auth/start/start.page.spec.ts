import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
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

import { StartPage, consumeSessionEndNotice } from './start.page';

const STUDENT_SESSION: AuthSession = {
  user: {
    id: 'usr-1',
    email: 'alejandra@neque.cl',
    role: 'student',
    displayName: 'Alejandra Acosta',
    avatarUrl: null,
    profileId: 'std-001',
  },
  token: 'token',
  expiresAt: '2026-12-31T00:00:00.000Z',
};

describe('StartPage', () => {
  let page: StartPage;
  let router: Router;
  let login: MockOf<AuthPort['login']>;

  const createPage = (): StartPage => TestBed.runInInjectionContext(() => new StartPage());

  beforeEach(() => {
    login = fn<AuthPort['login']>().mockReturnValue(of(STUDENT_SESSION));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CLOCK, useValue: { now: () => new Date('2026-09-17T10:00:00.000Z') } },
        {
          provide: AUTH_PORT,
          useValue: {
            login,
            signOut: () => of(undefined),
            requestPasswordReset: () => of(undefined),
            verifyOtp: () => of(STUDENT_SESSION),
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
    page = createPage();
  });

  describe('estado inicial', () => {
    it('arranca con el panel de login cerrado y sin envio en curso', () => {
      expect(page.showLogin).toBe(false);
      expect(page.showPassword).toBe(false);
      expect(page.isSubmitting()).toBe(false);
      expect(page.formValid()).toBe(false);
    });

    it('no muestra error de email antes de tocar el campo', () => {
      expect(page.emailError()).toBeNull();

      page.form.controls.email.setValue('no-es-un-email');

      expect(page.emailError()).toBeNull();
    });
  });

  describe('validacion de email', () => {
    it('exige el campo cuando esta vacio y ya fue tocado', () => {
      page.markEmailTouched();
      page.form.controls.email.setValue('');

      expect(page.emailError()).toBe('El correo es obligatorio');
    });

    it('rechaza un formato invalido', () => {
      page.markEmailTouched();
      page.form.controls.email.setValue('kelvin@sin-tld');

      expect(page.emailError()).toBe('Ingresa un correo válido');
    });

    it('acepta un email valido', () => {
      page.markEmailTouched();
      page.form.controls.email.setValue('kelvin.moreno@duocuc.cl');

      expect(page.emailError()).toBeNull();
    });

    // La sugerencia del teclado de iOS deja un espacio al final del correo.
    it('acepta espacios en los bordes y los recorta al perder el foco', () => {
      page.form.controls.email.setValue('  kelvin@duocuc.cl ');
      expect(page.form.controls.email.valid).toBe(true);

      page.markEmailTouched();

      expect(page.form.controls.email.value).toBe('kelvin@duocuc.cl');
      expect(page.emailError()).toBeNull();
    });

    it('rechaza espacios dentro del correo', () => {
      page.markEmailTouched();
      page.form.controls.email.setValue('kelvin @duocuc.cl');

      expect(page.emailError()).toBe('Ingresa un correo válido');
    });
  });

  describe('focusPassword()', () => {
    it('evita el envio implicito del Enter en el correo', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });

      page.focusPassword(event);

      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('validacion de password', () => {
    it('oculta los requisitos antes de enfocar o tocar el campo', () => {
      expect(page.showRequirements()).toBe(false);
    });

    it('muestra los requisitos mientras el campo tiene foco', () => {
      page.passwordFocused.set(true);

      expect(page.showRequirements()).toBe(true);
    });

    it('los mantiene visibles al salir si la contrasena quedo incompleta', () => {
      page.form.controls.password.setValue('abc');
      page.markPasswordTouched();

      expect(page.showRequirements()).toBe(true);
      expect(page.passwordValid()).toBe(false);
    });

    it('los oculta al salir si la contrasena cumple todo', () => {
      page.form.controls.password.setValue('Abcdefg1!');
      page.markPasswordTouched();

      expect(page.showRequirements()).toBe(false);
      expect(page.passwordValid()).toBe(true);
    });

    it.each([
      ['abcdefgh', [true, false, false, false]],
      ['Abcdefgh', [true, true, false, false]],
      ['Abcdefg1', [true, true, true, false]],
      ['Abcdefg1!', [true, true, true, true]],
    ])('evalua %s regla por regla', (value, expected) => {
      page.form.controls.password.setValue(value);

      expect(page.pwdRequirements().map(req => req.met)).toEqual(expected);
    });

    it('expone el valor actual de la contrasena', () => {
      page.form.controls.password.setValue('Abcdefg1!');

      expect(page.passwordValue()).toBe('Abcdefg1!');
    });

    it('marca el campo como tocado', () => {
      expect(page.passwordTouched()).toBe(false);

      page.markPasswordTouched();

      expect(page.passwordTouched()).toBe(true);
    });
  });

  describe('formValid()', () => {
    it('exige email valido y password valida a la vez', () => {
      page.form.controls.email.setValue('kelvin@duocuc.cl');
      expect(page.formValid()).toBe(false);

      page.form.controls.password.setValue('Abcdefg1!');
      expect(page.formValid()).toBe(true);

      page.form.controls.password.setValue('sinreglas');
      expect(page.formValid()).toBe(false);
    });
  });

  describe('onLogin()', () => {
    const fillValidForm = (): void => {
      page.form.controls.email.setValue('kelvin@duocuc.cl');
      page.form.controls.password.setValue('Abcdefg1!');
    };

    it('con el formulario invalido marca los campos y no envia', async () => {
      await page.onLogin();

      expect(page.isSubmitting()).toBe(false);
      expect(page.emailTouched()).toBe(true);
      expect(page.passwordTouched()).toBe(true);
      expect(page.emailError()).toBe('El correo es obligatorio');
      expect(page.showRequirements()).toBe(true);
      expect(login).not.toHaveBeenCalled();
    });

    it('envia el correo en minusculas', async () => {
      fillValidForm();
      page.form.controls.email.setValue('Kelvin@DuocUC.cl');

      await page.onLogin();

      expect(login).toHaveBeenCalledWith({ email: 'kelvin@duocuc.cl', password: 'Abcdefg1!' });
    });

    it('marca ambos campos como tocados y llama al puerto', async () => {
      fillValidForm();

      await page.onLogin();

      expect(page.emailTouched()).toBe(true);
      expect(page.passwordTouched()).toBe(true);
      expect(login).toHaveBeenCalledWith({
        email: 'kelvin@duocuc.cl',
        password: 'Abcdefg1!',
      });
    });

    it('envia el correo sin espacios en los bordes', async () => {
      fillValidForm();
      page.form.controls.email.setValue('kelvin@duocuc.cl ');

      await page.onLogin();

      expect(login).toHaveBeenCalledWith({ email: 'kelvin@duocuc.cl', password: 'Abcdefg1!' });
    });

    it('navega al home del rol tras autenticarse', async () => {
      const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
      fillValidForm();

      await page.onLogin();

      expect(navigate).toHaveBeenCalledWith(['/student/home']);
      expect(page.isSubmitting()).toBe(false);
    });

    it('ignora un segundo submit mientras hay uno en curso', async () => {
      fillValidForm();
      page.isSubmitting.set(true);

      await page.onLogin();

      expect(login).not.toHaveBeenCalled();
    });

    describe('credenciales invalidas', () => {
      beforeEach(() => {
        login.mockReturnValue(throwError(() => domainError('invalid_credentials')));
      });

      it('expone el mensaje de error y no navega', async () => {
        const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
        fillValidForm();

        await page.onLogin();

        expect(page.loginError()).toBe('Correo o contraseña incorrectos.');
        expect(navigate).not.toHaveBeenCalled();
        expect(page.isSubmitting()).toBe(false);
      });

      it('limpia el error al editar el formulario', async () => {
        fillValidForm();
        await page.onLogin();
        expect(page.loginError()).not.toBeNull();

        page.form.controls.password.setValue('Otra1234!');

        expect(page.loginError()).toBeNull();
      });
    });
  });

  describe('requirementsSummary()', () => {
    it('queda vacio sin foco en la contrasena', () => {
      page.form.controls.password.setValue('Abc');

      expect(page.requirementsSummary()).toBe('');
    });

    it('cuenta los requisitos cumplidos mientras se escribe', () => {
      page.passwordFocused.set(true);
      page.form.controls.password.setValue('Abcdefgh');

      expect(page.requirementsSummary()).toBe('2 de 4 requisitos cumplidos');
    });
  });

  describe('panel de ingreso', () => {
    it('openLogin() abre el panel', () => {
      page.openLogin();

      expect(page.showLogin).toBe(true);
    });

    describe('onPanelTransitionEnd()', () => {
      const panel = document.createElement('div');
      const transition = (propertyName: string, target: EventTarget = panel): TransitionEvent =>
        ({ propertyName, target, currentTarget: panel }) as unknown as TransitionEvent;

      it('enfoca el correo al terminar de subir el panel', () => {
        page.openLogin();

        expect(() => page.onPanelTransitionEnd(transition('transform'))).not.toThrow();
      });

      it.each([
        ['el panel esta cerrado', false, transition('transform')],
        [
          'la transicion es de un hijo',
          true,
          transition('transform', document.createElement('input')),
        ],
        ['la propiedad no es transform', true, transition('opacity')],
      ])('no hace nada si %s', (_caso, abierto, event) => {
        page.showLogin = abierto;
        const focus = jest.spyOn(HTMLElement.prototype, 'focus');

        page.onPanelTransitionEnd(event);

        expect(focus).not.toHaveBeenCalled();
        focus.mockRestore();
      });
    });

    it('closeLogin() lo cierra, oculta la contrasena y descarta el error', async () => {
      login.mockReturnValue(throwError(() => domainError('invalid_credentials')));
      page.form.controls.email.setValue('kelvin@duocuc.cl');
      page.form.controls.password.setValue('Abcdefg1!');
      page.openLogin();
      page.showPassword = true;
      await page.onLogin();
      expect(page.loginError()).not.toBeNull();

      page.closeLogin();

      expect(page.showLogin).toBe(false);
      expect(page.showPassword).toBe(false);
      expect(page.loginError()).toBeNull();
    });

    it('muestra el mensaje de bloqueo por intentos', async () => {
      login.mockReturnValue(throwError(() => domainError('too_many_attempts')));
      page.form.controls.email.setValue('kelvin@duocuc.cl');
      page.form.controls.password.setValue('Abcdefg1!');

      await page.onLogin();

      expect(page.loginError()).toBe(
        'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.',
      );
    });
  });

  describe('navegacion', () => {
    it('goToForgotPassword() navega a /forgot-password', () => {
      const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);

      page.goToForgotPassword();

      expect(navigate).toHaveBeenCalledWith(['/forgot-password']);
    });
  });
});

// Sesion unica: el interceptor deja el motivo antes de recargar.
describe('consumeSessionEndNotice', () => {
  afterEach(() => sessionStorage.clear());

  it('explica el cierre por otro dispositivo y lo muestra una sola vez', () => {
    sessionStorage.setItem('neque.session-end', 'session_replaced');

    expect(consumeSessionEndNotice()).toBe(
      'Tu sesión se cerró porque ingresaste desde otro dispositivo.',
    );
    expect(consumeSessionEndNotice()).toBeNull();
  });

  it('sin motivo guardado no muestra nada', () => {
    expect(consumeSessionEndNotice()).toBeNull();
  });
});

describe('StartPage › modal de sesion cerrada', () => {
  afterEach(() => sessionStorage.clear());

  const render = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StartPage],
      providers: [
        provideRouter([]),
        { provide: CLOCK, useValue: { now: () => new Date('2026-11-03T12:00:00.000Z') } },
        { provide: AUTH_PORT, useValue: {} },
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
    const fixture = TestBed.createComponent(StartPage);
    fixture.detectChanges();
    return fixture;
  };

  it('se abre con el motivo y se cierra con Entendido', () => {
    sessionStorage.setItem('neque.session-end', 'session_replaced');
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    const overlay = (): Element | null => el.querySelector('.nq-overlay');

    expect(overlay()?.classList.contains('open')).toBe(true);
    expect(el.querySelector('[role="alertdialog"]')?.textContent).toContain(
      'ingresaste desde otro dispositivo',
    );

    (el.querySelector('.notice .nq-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(overlay()?.classList.contains('open')).toBe(false);
  });

  it('sin cierre forzado el modal queda cerrado', () => {
    const fixture = render();

    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('.nq-overlay')
        ?.classList.contains('open'),
    ).toBe(false);
  });
});
