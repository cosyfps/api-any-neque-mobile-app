import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Assessment } from '@app/domain/students/model/assessment.model';

import { fn } from '@testing/typed-mock';

import { AssessmentFormComponent } from './assessment-form.component';

type Emitido = Omit<Assessment, 'id' | 'studentId' | 'takenAt'>;

describe('AssessmentFormComponent', () => {
  let fixture: ComponentFixture<AssessmentFormComponent>;
  let form: AssessmentFormComponent;
  let emitido: Emitido | null;

  // Los `input()` senal no se pueden asignar sobre una instancia suelta:
  // este componente se prueba renderizado, como el resto de ui/shared.
  const crear = (defaultHeightCm: number | null = 165): void => {
    emitido = null;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AssessmentFormComponent] });

    fixture = TestBed.createComponent(AssessmentFormComponent);
    fixture.componentRef.setInput('defaultHeightCm', defaultHeightCm);
    form = fixture.componentInstance;
    form.submitted.subscribe(value => (emitido = value));
    fixture.detectChanges();
    form.reset();
  };

  beforeEach(() => crear());

  describe('validacion', () => {
    // De peso y estatura sale el IMC que el alumno ve en su Inicio.
    it('no emite sin peso', () => {
      form.onSubmit();

      expect(emitido).toBeNull();
      expect(form.requiredError()).toBe(true);
    });

    it('no muestra el error antes del primer intento', () => {
      expect(form.requiredError()).toBe(false);
    });

    it('emite con peso y estatura', () => {
      form.form.controls.weightKg.setValue(61.4);

      form.onSubmit();

      expect(emitido).toMatchObject({ weightKg: 61.4, heightCm: 165 });
    });
  });

  describe('reset()', () => {
    it('precarga la estatura de la ficha', () => {
      expect(form.form.controls.heightCm.value).toBe(165);
    });

    it('la deja vacia cuando la ficha no la tiene', () => {
      crear(null);

      expect(form.form.controls.heightCm.value).toBeNull();
    });

    it('limpia el peso de la evaluacion anterior', () => {
      form.form.controls.weightKg.setValue(61.4);

      form.reset();

      expect(form.form.controls.weightKg.value).toBeNull();
    });
  });

  describe('medidas', () => {
    it('las vacias viajan en null', () => {
      form.form.controls.weightKg.setValue(60);

      form.onSubmit();

      expect(emitido?.measurements).toEqual({
        chestCm: null,
        waistCm: null,
        hipCm: null,
        armCm: null,
        thighCm: null,
      });
    });

    it('agrupa las cinco medidas', () => {
      form.form.patchValue({ weightKg: 60, chestCm: 90, waistCm: 70 });

      form.onSubmit();

      expect(emitido?.measurements).toMatchObject({ chestCm: 90, waistCm: 70 });
    });
  });

  describe('notas', () => {
    it('una nota vacia viaja en null', () => {
      form.form.controls.weightKg.setValue(60);

      form.onSubmit();

      expect(emitido?.notes).toBeNull();
    });

    it('recorta la nota', () => {
      form.form.patchValue({ weightKg: 60, notes: '  Buen avance  ' });

      form.onSubmit();

      expect(emitido?.notes).toBe('Buen avance');
    });
  });

  describe('ids', () => {
    it('son unicos por instancia', () => {
      const primero = form.id('peso');
      crear();

      expect(form.id('peso')).not.toBe(primero);
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
