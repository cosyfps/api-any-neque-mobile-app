import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Exercise } from '@app/domain/routines/model/exercise.model';
import {
  Routine,
  RoutineDayInput,
  RoutineExerciseInput,
  RoutineInput,
} from '@app/domain/routines/model/routine.model';

import { RoutineBuilderComponent } from './routine-builder.component';

const PUBLICO: Exercise = {
  id: 'ex-001',
  name: 'Sentadilla',
  muscleGroup: 'legs',
  equipment: null,
  thumbnailUrl: null,
  instructions: [],
  ownerTrainerId: null,
};

const PROPIO: Exercise = { ...PUBLICO, id: 'ex-900', name: 'Búlgara', ownerTrainerId: 'trn-001' };

const PLANCHA: Exercise = {
  ...PUBLICO,
  id: 'ex-014',
  name: 'Plancha',
  defaultLoad: 'bodyweight',
  defaultMeasure: 'time',
};

const RUTINA: Routine = {
  id: 'rtn-001',
  trainerId: 'trn-001',
  name: 'Hipertrofia',
  goal: 'Ganar masa',
  assignments: [
    {
      studentId: 'std-001',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-12-01T00:00:00.000Z',
    },
  ],
  days: [
    {
      id: 'day-001',
      weekday: 1,
      title: 'Tren inferior',
      focus: 'legs',
      estimatedMinutes: 55,
      exercises: [
        {
          id: 'rex-001',
          exerciseId: 'ex-001',
          name: 'Sentadilla',
          order: 1,
          sets: 4,
          reps: 8,
          restSeconds: 90,
          weightKg: 40,
          notes: null,
        },
      ],
    },
  ],
};

describe('RoutineBuilderComponent', () => {
  let fixture: ComponentFixture<RoutineBuilderComponent>;
  let builder: RoutineBuilderComponent;
  let emitido: Omit<RoutineInput, 'trainerId'> | null;

  // Los `input()` senal no se pueden asignar sobre una instancia suelta:
  // este componente se prueba renderizado, como el resto de los compartidos.
  const crear = (routine: Routine | null = null): void => {
    emitido = null;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [RoutineBuilderComponent] });

    fixture = TestBed.createComponent(RoutineBuilderComponent);
    fixture.componentRef.setInput('routine', routine);
    fixture.componentRef.setInput('publicExercises', [PUBLICO, PLANCHA]);
    fixture.componentRef.setInput('ownExercises', [PROPIO]);
    builder = fixture.componentInstance;
    builder.submitted.subscribe(value => (emitido = value));
    fixture.detectChanges();
    builder.reset();
  };

  const seleccionar = (value: string): Event => ({ target: { value } }) as unknown as Event;

  /** El dia en esa posicion. `noUncheckedIndexedAccess` obliga a comprobar. */
  const dia = (index: number): RoutineDayInput => {
    const value = builder.days()[index];
    if (value === undefined) {
      throw new Error(`no hay dia en la posicion ${index}`);
    }
    return value;
  };

  const llenarCabecera = (): void => {
    builder.form.patchValue({
      name: 'Hipertrofia',
      goal: 'Ganar masa',
    });
  };

  beforeEach(() => crear());

  describe('validaciones', () => {
    it('no emite vacio', () => {
      builder.onSubmit();

      expect(emitido).toBeNull();
      expect(builder.validationError()).toContain('Completa nombre');
    });

    // Una rutina sin dias no se puede asignar.
    it('exige al menos un dia', () => {
      llenarCabecera();

      builder.onSubmit();

      expect(builder.validationError()).toContain('al menos un día');
      expect(emitido).toBeNull();
    });

    // Un dia sin ejercicios no le dice nada al alumno en el runner.
    it('exige ejercicios en cada dia', () => {
      llenarCabecera();
      builder.addDay();

      builder.onSubmit();

      expect(builder.validationError()).toContain('al menos un ejercicio');
    });

    it('rechaza dos dias en el mismo dia de la semana', () => {
      llenarCabecera();
      builder.addDay();
      builder.addExercise(dia(0), seleccionar('ex-001'));
      builder.addDay();
      builder.addExercise(dia(1), seleccionar('ex-001'));
      builder.setWeekday(1, seleccionar('1'));

      builder.onSubmit();

      expect(builder.validationError()).toContain('mismo día de la semana');
    });

    it('no muestra errores antes del primer intento', () => {
      expect(builder.validationError()).toBeNull();
    });

    // QA-01: el backend rechazaba el dia sin titulo con un 400 tecnico.
    it.each(['', '   '])('exige titulo en cada dia (%p)', titulo => {
      llenarCabecera();
      builder.addDay();
      builder.setTitle(0, seleccionar(titulo));
      builder.addExercise(dia(0), seleccionar('ex-001'));

      builder.onSubmit();

      expect(builder.validationError()).toBe('Cada día necesita un título.');
      expect(emitido).toBeNull();
    });

    // QA-12
    it('un nombre con solo espacios no completa la cabecera', () => {
      builder.form.patchValue({ name: '   ', goal: 'Ganar masa' });

      builder.onSubmit();

      expect(builder.validationError()).toContain('Completa nombre');
    });
  });

  // QA-02 / QA-03: los `min`/`max` del input no se aplicaban y el backend
  // devolvia 400 con series en 0, decimales o valores enormes.
  describe('rangos de la prescripcion', () => {
    beforeEach(() => {
      builder.addDay();
      builder.addExercise(dia(0), seleccionar('ex-001'));
    });

    it.each([
      ['sets', '0', 1],
      ['sets', '2.6', 3],
      ['sets', '999', 20],
      ['reps', '0', 1],
      ['reps', '5000', 100],
      ['restSeconds', '99999', 600],
      ['weightKg', '5000', 1000],
    ] as const)('acota %s=%s a %p', (campo, escrito, esperado) => {
      const evento = seleccionar(escrito);

      builder.setPrescription(dia(0), 0, campo, evento);

      expect(dia(0).exercises[0]?.[campo]).toBe(esperado);
      expect((evento.target as HTMLInputElement).value).toBe(String(esperado));
    });

    it.each([
      ['5', 10],
      ['45.4', 45],
      ['1000', 180],
    ])('acota los minutos %p a %p', (escrito, esperado) => {
      const evento = seleccionar(escrito);

      builder.setMinutes(0, evento);

      expect(dia(0).estimatedMinutes).toBe(esperado);
      expect((evento.target as HTMLInputElement).value).toBe(String(esperado));
    });
  });

  describe('dias', () => {
    it('agregar elige el primer dia libre', () => {
      builder.addDay();
      builder.addDay();

      expect(builder.days().map(day => day.weekday)).toEqual([1, 2]);
    });

    it('agregar deja el dia nuevo abierto', () => {
      builder.addDay();

      expect(builder.openDay()).toBe(0);
    });

    it('tocar la cabecera abre y cierra', () => {
      builder.addDay();

      builder.toggleDay(0);

      expect(builder.openDay()).toBeNull();
    });

    it('quitar lo saca de la lista', () => {
      builder.addDay();

      builder.removeDay(0);

      expect(builder.days()).toHaveLength(0);
    });

    it('cambia dia de la semana, foco, titulo y minutos', () => {
      builder.addDay();

      builder.setWeekday(0, seleccionar('3'));
      builder.setFocus(0, seleccionar('back'));
      builder.setTitle(0, seleccionar('Tracción'));
      builder.setMinutes(0, seleccionar('45'));

      expect(builder.days()[0]).toMatchObject({
        weekday: 3,
        focus: 'back',
        title: 'Tracción',
        estimatedMinutes: 45,
      });
    });

    it('unos minutos invalidos vuelven al valor por defecto', () => {
      builder.addDay();

      builder.setMinutes(0, seleccionar(''));

      expect(builder.days()[0]?.estimatedMinutes).toBe(50);
    });

    it('etiqueta cada dia en espanol', () => {
      expect(builder.etiquetaDia(3)).toBe('Miércoles');
    });
  });

  describe('ejercicios del dia', () => {
    beforeEach(() => builder.addDay());

    it('agrega del catalogo publico con prescripcion por defecto', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));

      expect(builder.days()[0]?.exercises[0]).toMatchObject({
        exerciseId: 'ex-001',
        name: 'Sentadilla',
        order: 1,
        sets: 3,
        reps: 10,
        restSeconds: 60,
        weightKg: null,
      });
    });

    it('agrega tambien de los propios', () => {
      builder.addExercise(dia(0), seleccionar('ex-900'));

      expect(builder.days()[0]?.exercises[0]?.name).toBe('Búlgara');
    });

    it('la opcion vacia no agrega nada', () => {
      builder.addExercise(dia(0), seleccionar(''));

      expect(builder.days()[0]?.exercises).toHaveLength(0);
    });

    it('un id desconocido no agrega nada', () => {
      builder.addExercise(dia(0), seleccionar('ex-999'));

      expect(builder.days()[0]?.exercises).toHaveLength(0);
    });

    it('quitar renumera el orden', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));
      builder.addExercise(dia(0), seleccionar('ex-900'));

      builder.removeExercise(dia(0), 0);

      expect(builder.days()[0]?.exercises).toHaveLength(1);
      expect(builder.days()[0]?.exercises[0]?.order).toBe(1);
    });

    it('edita la prescripcion', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));

      builder.setPrescription(dia(0), 0, 'sets', seleccionar('5'));
      builder.setPrescription(dia(0), 0, 'weightKg', seleccionar('42.5'));

      expect(builder.days()[0]?.exercises[0]).toMatchObject({ sets: 5, weightKg: 42.5 });
    });

    // Solo la carga admite "sin dato": sin series el runner no sabe cuantas.
    it('vaciar la carga la deja en null', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));

      builder.setPrescription(dia(0), 0, 'weightKg', seleccionar(''));

      expect(builder.days()[0]?.exercises[0]?.weightKg).toBeNull();
    });

    it('vaciar las series conserva el valor anterior', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));

      builder.setPrescription(dia(0), 0, 'sets', seleccionar(''));

      expect(builder.days()[0]?.exercises[0]?.sets).toBe(3);
    });
  });

  describe('carga y medida', () => {
    const ejercicio = (): RoutineExerciseInput => {
      const value = builder.days()[0]?.exercises[0];
      if (value === undefined) {
        throw new Error('sin ejercicio');
      }
      return value;
    };

    beforeEach(() => builder.addDay());

    it('un ejercicio sin sugerencia nace con peso y repeticiones', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));

      expect(ejercicio()).toMatchObject({ load: 'weight', measure: 'reps', durationSeconds: null });
    });

    it('usa la sugerencia del catalogo', () => {
      builder.addExercise(dia(0), seleccionar('ex-014'));

      expect(ejercicio()).toMatchObject({
        load: 'bodyweight',
        measure: 'time',
        durationSeconds: 60,
      });
      expect(builder.usaKg(ejercicio())).toBe(false);
    });

    it('elegir peso corporal borra los kg', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));
      builder.setPrescription(dia(0), 0, 'weightKg', seleccionar('20'));

      builder.setLoad(dia(0), 0, seleccionar('bodyweight'));

      expect(ejercicio()).toMatchObject({ load: 'bodyweight', weightKg: null });
    });

    it('con peso extra conserva los kg', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));
      builder.setPrescription(dia(0), 0, 'weightKg', seleccionar('10'));

      builder.setLoad(dia(0), 0, seleccionar('weighted_bodyweight'));

      expect(ejercicio()).toMatchObject({ load: 'weighted_bodyweight', weightKg: 10 });
    });

    it('pasar a tiempo propone un minuto', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));

      builder.setMeasure(dia(0), 0, seleccionar('time'));

      expect(ejercicio()).toMatchObject({ measure: 'time', durationSeconds: 60 });
    });

    it('arma la duracion con minutos y segundos', () => {
      builder.addExercise(dia(0), seleccionar('ex-014'));

      builder.setDuration(dia(0), 0, 'min', seleccionar('15'));
      builder.setDuration(dia(0), 0, 'seg', seleccionar('30'));

      expect(ejercicio().durationSeconds).toBe(930);
      expect(builder.minutos(ejercicio())).toBe(15);
      expect(builder.segundos(ejercicio())).toBe(30);
    });

    it('la duracion no baja de 5 segundos ni acepta negativos', () => {
      builder.addExercise(dia(0), seleccionar('ex-014'));

      builder.setDuration(dia(0), 0, 'min', seleccionar('0'));
      builder.setDuration(dia(0), 0, 'seg', seleccionar('0'));
      expect(ejercicio().durationSeconds).toBe(5);

      builder.setDuration(dia(0), 0, 'seg', seleccionar('-10'));
      expect(ejercicio().durationSeconds).toBe(5);
    });

    // El teclado decimal de iOS en espanol trae coma.
    it('acepta kg con coma y los muestra con coma', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));

      builder.setPrescription(dia(0), 0, 'weightKg', seleccionar('32,5'));

      expect(ejercicio().weightKg).toBe(32.5);
      expect(builder.kgTexto(ejercicio())).toBe('32,5');
    });

    it('ignora kg negativos', () => {
      builder.addExercise(dia(0), seleccionar('ex-001'));

      builder.setPrescription(dia(0), 0, 'weightKg', seleccionar('-4'));

      expect(ejercicio().weightKg).toBeNull();
    });
  });

  describe('emision', () => {
    // Los alumnos y sus fechas se eligen al asignar, no al disenar la rutina.
    it('emite la plantilla sin alumnos ni fechas', () => {
      llenarCabecera();
      builder.addDay();
      builder.setTitle(0, seleccionar('Tren inferior'));
      builder.addExercise(dia(0), seleccionar('ex-001'));

      builder.onSubmit();

      expect(emitido).not.toBeNull();
      expect(emitido).not.toHaveProperty('studentId');
      expect(emitido).not.toHaveProperty('startDate');
      expect(emitido).not.toHaveProperty('assignments');
    });

    it('recorta nombre y objetivo', () => {
      llenarCabecera();
      builder.form.patchValue({ name: '  Hipertrofia  ', goal: '  Ganar masa  ' });
      builder.addDay();
      builder.setTitle(0, seleccionar('Tren inferior'));
      builder.addExercise(dia(0), seleccionar('ex-001'));

      builder.onSubmit();

      expect(emitido).toMatchObject({ name: 'Hipertrofia', goal: 'Ganar masa' });
    });
  });

  // La pagina cambia la rutina y llama a reset() en el mismo paso, antes de
  // que el input la reciba: sin pasarsela, editar abria el constructor vacio.
  it('reset(rutina) carga la rutina aunque el input aun no la tenga', () => {
    builder.reset(RUTINA);

    expect(builder.days()).toHaveLength(1);
    expect(builder.form.getRawValue().name).toBe('Hipertrofia');
  });

  // QA-33: con [value] en el select, el valor se aplicaba antes de crear las
  // opciones y se veia la primera ("Lunes", "Pecho") en vez de la guardada.
  it('los selectores de dia y foco muestran el valor del dia', () => {
    builder.reset({ ...RUTINA, days: RUTINA.days.map(day => ({ ...day, weekday: 3 })) });
    builder.toggleDay(0);
    fixture.detectChanges();

    const selects = (fixture.nativeElement as HTMLElement).querySelectorAll('select');
    expect(selects[0]?.value).toBe('3');
    expect(selects[1]?.value).toBe('legs');
  });

  it('un dia nuevo muestra el foco con que nace', () => {
    builder.addDay();
    fixture.detectChanges();

    const foco = (fixture.nativeElement as HTMLElement).querySelectorAll('select')[1];
    expect(foco?.value).toBe('fullbody');
  });

  it('reset(null) deja el constructor en blanco', () => {
    crear(RUTINA);

    builder.reset(null);

    expect(builder.days()).toEqual([]);
  });

  describe('edicion de una rutina existente', () => {
    beforeEach(() => crear(RUTINA));

    it('conserva carga y medida de cada ejercicio', () => {
      expect(builder.days()[0]?.exercises[0]).toMatchObject({ load: 'weight', measure: 'reps' });
    });

    it('precarga nombre y objetivo', () => {
      expect(builder.form.getRawValue()).toEqual({ name: 'Hipertrofia', goal: RUTINA.goal });
    });

    it('precarga los dias con sus ejercicios', () => {
      expect(builder.days()).toHaveLength(1);
      expect(builder.days()[0]?.exercises[0]).toMatchObject({ name: 'Sentadilla', sets: 4 });
    });

    it('emite lo editado sin los ids de la rutina anterior', () => {
      builder.onSubmit();

      expect(emitido?.days[0]).not.toHaveProperty('id');
      expect(emitido?.days[0]?.exercises[0]).not.toHaveProperty('id');
    });
  });

  describe('ids', () => {
    it('son unicos por instancia', () => {
      const primero = builder.id('nombre');
      crear();

      expect(builder.id('nombre')).not.toBe(primero);
    });
  });
});
