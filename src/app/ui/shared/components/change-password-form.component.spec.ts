import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChangePasswordFormComponent, PasswordChange } from './change-password-form.component';

describe('ChangePasswordFormComponent', () => {
  let fixture: ComponentFixture<ChangePasswordFormComponent>;
  let form: ChangePasswordFormComponent;
  let enviados: PasswordChange[];

  beforeEach(() => {
    fixture = TestBed.createComponent(ChangePasswordFormComponent);
    form = fixture.componentInstance;
    enviados = [];
    form.submitted.subscribe(value => enviados.push(value));
    fixture.detectChanges();
  });

  const llenar = (current: string, next: string, confirm: string): void => {
    form.form.setValue({ current, next, confirm });
  };

  it('no muestra errores antes de intentar guardar', () => {
    expect(form.currentError()).toBeNull();
    expect(form.newError()).toBeNull();
    expect(form.confirmError()).toBeNull();
  });

  it('las reglas se actualizan mientras se escribe', () => {
    llenar('', 'Abcdefgh', '');

    expect(form.rules().map(rule => rule.met)).toEqual([true, true, false, false]);
  });

  it('envia con todo valido', () => {
    llenar('Alumno1234!', 'Nueva5678!', 'Nueva5678!');

    form.onSubmit();

    expect(enviados).toEqual([{ currentPassword: 'Alumno1234!', newPassword: 'Nueva5678!' }]);
  });

  it.each([
    ['sin la actual', '', 'Nueva5678!', 'Nueva5678!', 'current'],
    ['con una nueva debil', 'Alumno1234!', 'nueva', 'nueva', 'new'],
    ['con la nueva igual a la actual', 'Alumno1234!', 'Alumno1234!', 'Alumno1234!', 'new'],
    ['sin coincidir la confirmacion', 'Alumno1234!', 'Nueva5678!', 'Otra5678!', 'confirm'],
  ])('no envia %s', (_caso, current, next, confirm, campo) => {
    llenar(current, next, confirm);

    form.onSubmit();

    expect(enviados).toEqual([]);
    const errores = {
      current: form.currentError(),
      new: form.newError(),
      confirm: form.confirmError(),
    };
    expect(errores[campo as keyof typeof errores]).not.toBeNull();
  });

  it('no envia mientras hay un guardado en curso', () => {
    fixture.componentRef.setInput('busy', true);
    llenar('Alumno1234!', 'Nueva5678!', 'Nueva5678!');

    form.onSubmit();

    expect(enviados).toEqual([]);
  });

  it('muestra el error que llega de afuera', () => {
    fixture.componentRef.setInput('errorMessage', 'La contraseña actual no es correcta.');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'La contraseña actual no es correcta.',
    );
  });

  it('reset() limpia campos, errores y visibilidad', () => {
    llenar('x', 'y', 'z');
    form.onSubmit();
    form.visible.set(true);

    form.reset();

    expect(form.form.getRawValue()).toEqual({ current: '', next: '', confirm: '' });
    expect(form.currentError()).toBeNull();
    expect(form.visible()).toBe(false);
  });

  it('cancelar avisa', () => {
    let cancelado = false;
    form.cancelled.subscribe(() => (cancelado = true));

    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find(item => item.textContent?.includes('Cancelar'));
    boton?.click();

    expect(cancelado).toBe(true);
  });
});
