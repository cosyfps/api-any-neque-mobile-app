import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Student } from '@app/domain/students/model/student.model';

import { fn } from '@testing/typed-mock';

import { StudentFormComponent, StudentFormValue } from './student-form.component';

const ALUMNO: Student = {
  id: 'std-001',
  trainerId: 'trn-001',
  trainerName: 'Kelvin Moreno',
  firstName: 'Alejandra',
  lastName: 'Acosta',
  email: 'alejandra@neque.cl',
  phone: '+56 9 1111 1111',
  avatarUrl: null,
  status: 'active',
  birthDate: '1998-04-12',
  heightCm: 165,
  goal: 'Ganar masa',
  joinedAt: '2026-01-10T00:00:00.000Z',
};

describe('StudentFormComponent', () => {
  let fixture: ComponentFixture<StudentFormComponent>;
  let form: StudentFormComponent;
  let emitido: StudentFormValue | null;

  // Los `input()` senal no se pueden asignar sobre una instancia suelta:
  // este componente se prueba renderizado, como el resto de ui/shared.
  const crear = (mode: 'create' | 'edit' = 'create', student: Student | null = null): void => {
    emitido = null;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [StudentFormComponent] });

    fixture = TestBed.createComponent(StudentFormComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('student', student);
    form = fixture.componentInstance;
    form.submitted.subscribe(value => (emitido = value));
    fixture.detectChanges();
  };

  const llenar = (email = 'nueva@neque.cl'): void => {
    form.form.patchValue({ firstName: 'Nueva', lastName: 'Alumna', email });
  };

  beforeEach(() => crear());

  describe('alta', () => {
    it('muestra el campo de correo', () => {
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(texto).toContain('Correo');
    });

    it('no emite con el formulario incompleto', () => {
      form.onSubmit();

      expect(emitido).toBeNull();
    });

    it('marca el correo invalido solo tras intentar enviar', () => {
      llenar('no-es-correo');

      expect(form.emailError()).toBeNull();
      form.onSubmit();

      expect(form.emailError()).toBe('Ese correo no es válido.');
    });

    it('exige el correo', () => {
      form.form.patchValue({ firstName: 'Nueva', lastName: 'Alumna', email: '' });

      form.onSubmit();

      expect(form.emailError()).toBe('Ingresa un correo.');
    });

    // Un correo pegado con espacios es valido para cualquiera menos para
    // `Validators.email`: hay que normalizarlo antes de validar.
    it('recorta y baja a minuscula el correo antes de validar', () => {
      llenar('  NUEVA@Neque.CL  ');

      form.onSubmit();

      expect(emitido).not.toBeNull();
      expect(emitido?.email).toBe('nueva@neque.cl');
    });

    it('deja los opcionales vacios en null', () => {
      llenar();

      form.onSubmit();

      expect(emitido).toMatchObject({ phone: null, birthDate: null, goal: null, heightCm: null });
    });

    it('recorta nombre y apellido', () => {
      form.form.patchValue({
        firstName: '  Nueva ',
        lastName: ' Alumna  ',
        email: 'nueva@neque.cl',
      });

      form.onSubmit();

      expect(emitido).toMatchObject({ firstName: 'Nueva', lastName: 'Alumna' });
    });

    it('entrega la estatura como numero', () => {
      llenar();
      form.form.controls.heightCm.setValue(168);

      form.onSubmit();

      expect(emitido?.heightCm).toBe(168);
    });
  });

  describe('edicion', () => {
    beforeEach(() => {
      crear('edit', ALUMNO);
      form.reset();
    });

    it('precarga los datos del alumno', () => {
      expect(form.form.getRawValue()).toMatchObject({
        firstName: 'Alejandra',
        lastName: 'Acosta',
        phone: '+56 9 1111 1111',
        heightCm: 165,
      });
    });

    // Cambiar el correo dejaria invitaciones apuntando a otra persona.
    it('no muestra el campo de correo', () => {
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(texto).not.toContain('Correo');
    });

    it('emite con los datos precargados corregidos', () => {
      form.form.controls.goal.setValue('Bajar grasa');

      form.onSubmit();

      expect(emitido).toMatchObject({ goal: 'Bajar grasa', email: 'alejandra@neque.cl' });
    });
  });

  describe('reset()', () => {
    it('vacia el formulario sin alumno', () => {
      llenar();

      form.reset();

      expect(form.form.controls.firstName.value).toBe('');
    });

    it('borra el error del correo', () => {
      llenar('no-es-correo');
      form.onSubmit();

      form.reset();

      expect(form.emailError()).toBeNull();
    });
  });

  describe('ids', () => {
    // El alta y la edicion pueden convivir en el DOM: con ids fijos, la
    // etiqueta de una apuntaria al campo de la otra.
    it('son unicos por instancia', () => {
      const primero = form.id('nombre');
      crear();

      expect(form.id('nombre')).not.toBe(primero);
    });
  });

  describe('cancelled', () => {
    it('avisa al pulsar cancelar', () => {
      const cancelado = fn<() => void>();
      form.cancelled.subscribe(cancelado);

      const boton = (fixture.nativeElement as HTMLElement).querySelector(
        'button[type="button"]',
      ) as HTMLButtonElement;
      boton.click();

      expect(cancelado).toHaveBeenCalled();
    });
  });
});
