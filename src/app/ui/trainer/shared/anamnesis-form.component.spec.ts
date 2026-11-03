import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Anamnesis, AnamnesisInput } from '@app/domain/students/model/anamnesis.model';

import { AnamnesisFormComponent } from './anamnesis-form.component';

const REGISTRADA: Anamnesis = {
  id: 'anm-001',
  studentId: 'std-001',
  medicalHistory: 'Hipertensión controlada',
  previousInjuries: null,
  surgeries: null,
  medications: null,
  allergies: null,
  previousActivity: 'Corría los fines de semana',
  declaredGoal: 'Ganar masa',
  weeklyAvailability: [1, 3, 5],
  emergencyContact: { name: 'Luis Acosta', phone: '+56 9 2222', relation: 'Padre' },
  updatedAt: '2026-03-05T10:00:00.000Z',
};

describe('AnamnesisFormComponent', () => {
  let fixture: ComponentFixture<AnamnesisFormComponent>;
  let form: AnamnesisFormComponent;
  let emitido: Omit<AnamnesisInput, 'studentId'> | null;

  // Los `input()` senal no se pueden asignar sobre una instancia suelta:
  // este componente se prueba renderizado, como el resto de ui/shared.
  const crear = (anamnesis: Anamnesis | null = null): void => {
    emitido = null;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [AnamnesisFormComponent] });

    fixture = TestBed.createComponent(AnamnesisFormComponent);
    fixture.componentRef.setInput('anamnesis', anamnesis);
    form = fixture.componentInstance;
    form.submitted.subscribe(value => (emitido = value));
    fixture.detectChanges();
    form.reset();
  };

  const llenarMinimo = (): void => {
    form.form.controls.declaredGoal.setValue('Bajar grasa');
    form.toggleDay(2);
  };

  beforeEach(() => crear());

  describe('validaciones obligatorias', () => {
    it('no emite vacio', () => {
      form.onSubmit();

      expect(emitido).toBeNull();
    });

    // Sin objetivo no se puede planificar una rutina.
    it('exige el objetivo declarado', () => {
      form.toggleDay(2);

      form.onSubmit();

      expect(form.goalError()).toContain('Sin objetivo');
      expect(emitido).toBeNull();
    });

    it('exige al menos un dia disponible', () => {
      form.form.controls.declaredGoal.setValue('Bajar grasa');

      form.onSubmit();

      expect(form.daysError()).toBe(true);
      expect(emitido).toBeNull();
    });

    it('no muestra errores antes del primer intento', () => {
      expect(form.goalError()).toBeNull();
      expect(form.daysError()).toBe(false);
    });

    it('emite con lo minimo', () => {
      llenarMinimo();

      form.onSubmit();

      expect(emitido).toMatchObject({ declaredGoal: 'Bajar grasa', weeklyAvailability: [2] });
    });
  });

  describe('dias', () => {
    it('marca y desmarca', () => {
      form.toggleDay(3);
      expect(form.isOn(3)).toBe(true);

      form.toggleDay(3);
      expect(form.isOn(3)).toBe(false);
    });

    it('los mantiene ordenados', () => {
      form.toggleDay(5);
      form.toggleDay(1);
      form.toggleDay(3);

      expect(form.selectedDays()).toEqual([1, 3, 5]);
    });
  });

  describe('contacto de urgencia', () => {
    // Un contacto a medias no sirve: sin telefono no se puede llamar.
    it('rechaza un contacto sin telefono', () => {
      llenarMinimo();
      form.form.controls.contactName.setValue('Luis');

      form.onSubmit();

      expect(form.contactError()).toBe(true);
      expect(emitido).toBeNull();
    });

    it('rechaza un telefono sin nombre', () => {
      llenarMinimo();
      form.form.controls.contactPhone.setValue('+56 9 2222');

      form.onSubmit();

      expect(form.contactError()).toBe(true);
    });

    it('acepta el contacto completo', () => {
      llenarMinimo();
      form.form.patchValue({
        contactName: 'Luis',
        contactPhone: '+56 9 2222',
        contactRelation: 'Padre',
      });

      form.onSubmit();

      expect(emitido?.emergencyContact).toEqual({
        name: 'Luis',
        phone: '+56 9 2222',
        relation: 'Padre',
      });
    });

    it('rellena el parentesco cuando no se indica', () => {
      llenarMinimo();
      form.form.patchValue({ contactName: 'Luis', contactPhone: '+56 9 2222' });

      form.onSubmit();

      expect(emitido?.emergencyContact?.relation).toBe('Sin especificar');
    });

    it('deja null cuando no hay contacto', () => {
      llenarMinimo();

      form.onSubmit();

      expect(emitido?.emergencyContact).toBeNull();
    });
  });

  describe('campos clinicos', () => {
    it('los vacios viajan como null', () => {
      llenarMinimo();

      form.onSubmit();

      expect(emitido).toMatchObject({
        medicalHistory: null,
        previousInjuries: null,
        surgeries: null,
        medications: null,
        allergies: null,
        previousActivity: null,
      });
    });

    it('recorta lo que se escribe', () => {
      llenarMinimo();
      form.form.controls.allergies.setValue('  Polen  ');

      form.onSubmit();

      expect(emitido?.allergies).toBe('Polen');
    });
  });

  describe('con anamnesis registrada', () => {
    beforeEach(() => crear(REGISTRADA));

    it('precarga todo, incluidos los dias', () => {
      expect(form.form.controls.declaredGoal.value).toBe('Ganar masa');
      expect(form.selectedDays()).toEqual([1, 3, 5]);
      expect(form.form.controls.medicalHistory.value).toBe('Hipertensión controlada');
    });

    it('precarga el contacto de urgencia', () => {
      expect(form.form.controls.contactName.value).toBe('Luis Acosta');
      expect(form.form.controls.contactRelation.value).toBe('Padre');
    });

    it('guardar de nuevo emite lo editado', () => {
      form.form.controls.declaredGoal.setValue('Mantener');

      form.onSubmit();

      expect(emitido?.declaredGoal).toBe('Mantener');
    });
  });

  describe('ids', () => {
    // Los sheets conviven en el DOM: con ids fijos, una etiqueta apuntaria
    // al campo del otro formulario.
    it('son unicos por instancia', () => {
      const primero = form.id('objetivo');
      crear();

      expect(form.id('objetivo')).not.toBe(primero);
    });
  });
});
