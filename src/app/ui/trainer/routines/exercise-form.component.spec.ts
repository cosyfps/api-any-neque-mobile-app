import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExerciseInput } from '@app/domain/routines/model/exercise.model';

import { fn } from '@testing/typed-mock';

import { ExerciseFormComponent } from './exercise-form.component';

type Emitido = Omit<ExerciseInput, 'ownerTrainerId'>;

describe('ExerciseFormComponent', () => {
  let fixture: ComponentFixture<ExerciseFormComponent>;
  let form: ExerciseFormComponent;
  let emitido: Emitido | null;

  // Los `input()` senal no se pueden asignar sobre una instancia suelta:
  // este componente se prueba renderizado, como el resto de los compartidos.
  const crear = (): void => {
    emitido = null;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [ExerciseFormComponent] });

    fixture = TestBed.createComponent(ExerciseFormComponent);
    form = fixture.componentInstance;
    form.submitted.subscribe(value => (emitido = value));
    fixture.detectChanges();
    form.reset();
  };

  beforeEach(() => crear());

  describe('validacion', () => {
    it('no emite sin nombre', () => {
      form.onSubmit();

      expect(emitido).toBeNull();
      expect(form.nameError()).toBe(true);
    });

    it('no muestra el error antes del primer intento', () => {
      expect(form.nameError()).toBe(false);
    });

    it('emite con solo el nombre', () => {
      form.form.controls.name.setValue('Zancada');

      form.onSubmit();

      expect(emitido).toMatchObject({ name: 'Zancada', muscleGroup: 'fullbody' });
    });

    // QA-11
    it('un nombre con solo espacios no es un nombre', () => {
      form.form.controls.name.setValue('    ');

      form.onSubmit();

      expect(emitido).toBeNull();
      expect(form.nameError()).toBe(true);
    });

    it('limita las instrucciones a 20 pasos', () => {
      form.form.patchValue({
        name: 'Zancada',
        instructions: Array.from({ length: 21 }, (_v, i) => `Paso ${i + 1}`).join('\n'),
      });

      form.onSubmit();

      expect(emitido).toBeNull();
      expect(form.instructionsError()).toBe('Hasta 20 pasos; ahora hay 21.');
    });

    it('limita cada paso a 500 caracteres', () => {
      form.form.patchValue({ name: 'Zancada', instructions: 'x'.repeat(501) });

      form.onSubmit();

      expect(emitido).toBeNull();
      expect(form.instructionsError()).toContain('500 caracteres');
    });
  });

  describe('campos', () => {
    beforeEach(() => form.form.controls.name.setValue('Zancada'));

    it('recorta el nombre', () => {
      form.form.controls.name.setValue('  Zancada  ');

      form.onSubmit();

      expect(emitido?.name).toBe('Zancada');
    });

    it('un equipamiento vacio viaja en null', () => {
      form.onSubmit();

      expect(emitido?.equipment).toBeNull();
    });

    it('conserva el grupo muscular elegido', () => {
      form.form.controls.muscleGroup.setValue('legs');

      form.onSubmit();

      expect(emitido?.muscleGroup).toBe('legs');
    });

    // Una linea por paso: es como los renderiza la ficha del ejercicio.
    it('parte las instrucciones por linea', () => {
      form.form.controls.instructions.setValue('Apoya el pie\n  Baja a 90 grados  \n\n');

      form.onSubmit();

      expect(emitido?.instructions).toEqual(['Apoya el pie', 'Baja a 90 grados']);
    });

    it('sin instrucciones emite un arreglo vacio', () => {
      form.onSubmit();

      expect(emitido?.instructions).toEqual([]);
    });
  });

  describe('reset()', () => {
    it('con un ejercicio precarga sus datos para editarlo', () => {
      form.reset({
        id: 'ex-900',
        name: 'Búlgara',
        muscleGroup: 'legs',
        equipment: 'Banco',
        thumbnailUrl: null,
        instructions: ['Paso uno', 'Paso dos'],
        ownerTrainerId: 'trn-001',
      });

      expect(form.form.getRawValue()).toEqual({
        name: 'Búlgara',
        muscleGroup: 'legs',
        equipment: 'Banco',
        instructions: ['Paso uno', 'Paso dos'].join('\n'),
      });
    });

    it('el boton usa la etiqueta recibida', () => {
      fixture.componentRef.setInput('submitLabel', 'Guardar cambios');
      fixture.detectChanges();

      const boton = (fixture.nativeElement as HTMLElement).querySelector('button[type=submit]');
      expect(boton?.textContent).toContain('Guardar cambios');
    });

    it('limpia lo del ejercicio anterior', () => {
      form.form.controls.name.setValue('Zancada');

      form.reset();

      expect(form.form.controls.name.value).toBe('');
      expect(form.form.controls.muscleGroup.value).toBe('fullbody');
    });

    it('borra el error del nombre', () => {
      form.onSubmit();

      form.reset();

      expect(form.nameError()).toBe(false);
    });
  });

  describe('ids', () => {
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
