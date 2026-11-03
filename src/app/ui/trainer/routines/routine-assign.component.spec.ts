import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignmentOption } from '@app/application/trainers/trainer-routines.facade';
import { RoutineAssignment } from '@app/domain/routines/model/routine.model';
import { Student } from '@app/domain/students/model/student.model';

import { RoutineAssignComponent } from './routine-assign.component';

const alumno = (id: string, firstName: string, goal: string | null = null): Student => ({
  id,
  trainerId: 'trn-001',
  trainerName: 'Kelvin Moreno',
  firstName,
  lastName: 'Acosta',
  email: `${id}@neque.cl`,
  phone: null,
  avatarUrl: null,
  status: 'active',
  birthDate: null,
  heightCm: null,
  goal,
  joinedAt: '2026-01-10T00:00:00.000Z',
});

const YA_ASIGNADA: AssignmentOption = {
  student: alumno('std-001', 'Alejandra', 'Ganar masa'),
  sameGoal: true,
  assignment: {
    studentId: 'std-001',
    startDate: '2026-09-01T03:00:00.000Z',
    endDate: '2026-11-30T03:00:00.000Z',
  },
  otherRoutine: null,
};

const LIBRE: AssignmentOption = {
  student: alumno('std-002', 'Camila'),
  sameGoal: false,
  assignment: null,
  otherRoutine: 'Fuerza base',
};

describe('RoutineAssignComponent', () => {
  let fixture: ComponentFixture<RoutineAssignComponent>;
  let form: RoutineAssignComponent;
  let emitido: RoutineAssignment[] | null;

  const crear = (options: AssignmentOption[] = [YA_ASIGNADA, LIBRE]): void => {
    emitido = null;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [RoutineAssignComponent] });

    fixture = TestBed.createComponent(RoutineAssignComponent);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('today', '2026-09-26');
    form = fixture.componentInstance;
    form.submitted.subscribe(value => (emitido = value));
    fixture.detectChanges();
    form.reset();
  };

  const escribir = (value: string): Event => ({ target: { value } }) as unknown as Event;

  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => crear());

  describe('reset()', () => {
    it('marca a quienes ya la hacen, con sus fechas', () => {
      expect(form.seleccion()).toEqual({ 'std-001': { start: '2026-09-01', end: '2026-11-30' } });
    });

    // La pagina se las pasa antes de que el input reciba las de la rutina nueva.
    it('acepta las opciones por parametro', () => {
      form.reset([LIBRE]);

      expect(form.seleccion()).toEqual({});
    });
  });

  describe('toggle()', () => {
    it('marcar propone hoy como inicio y sin fin', () => {
      form.toggle(LIBRE);

      expect(form.seleccion()['std-002']).toEqual({ start: '2026-09-26', end: '' });
    });

    it('desmarcar lo quita', () => {
      form.toggle(YA_ASIGNADA);

      expect(form.seleccion()['std-001']).toBeUndefined();
    });
  });

  describe('setFecha()', () => {
    it('cambia la fecha del alumno marcado', () => {
      form.setFecha(YA_ASIGNADA, 'end', escribir('2026-12-15'));

      expect(form.seleccion()['std-001']?.end).toBe('2026-12-15');
    });

    it('ignora a un alumno sin marcar', () => {
      form.setFecha(LIBRE, 'start', escribir('2026-10-01'));

      expect(form.seleccion()['std-002']).toBeUndefined();
    });
  });

  describe('onSubmit()', () => {
    it('emite cada alumno marcado con sus fechas en ISO', () => {
      form.toggle(LIBRE);

      form.onSubmit();

      expect(emitido?.map(item => item.studentId)).toEqual(['std-001', 'std-002']);
      expect(emitido?.[0]?.endDate).toContain('2026-11-30');
      expect(emitido?.[1]?.endDate).toBeNull();
    });

    // Quitar a todos es valido: la rutina vuelve a la biblioteca.
    it('sin nadie marcado emite la lista vacia', () => {
      form.toggle(YA_ASIGNADA);

      form.onSubmit();

      expect(emitido).toEqual([]);
    });

    it('no emite sin fecha de inicio', () => {
      form.setFecha(YA_ASIGNADA, 'start', escribir(''));

      form.onSubmit();

      expect(emitido).toBeNull();
      expect(form.validationError()).toContain('fecha de inicio');
    });

    it('no emite con el fin antes del inicio', () => {
      form.setFecha(YA_ASIGNADA, 'end', escribir('2026-08-01'));

      form.onSubmit();

      expect(emitido).toBeNull();
      expect(form.validationError()).toContain('anterior');
    });

    it('no muestra errores antes de intentar guardar', () => {
      form.setFecha(YA_ASIGNADA, 'start', escribir(''));

      expect(form.validationError()).toBeNull();
    });
  });

  describe('plantilla', () => {
    it('marca a los de objetivo parecido', () => {
      expect(texto()).toContain('Mismo objetivo');
    });

    it('avisa que el alumno viene de otra rutina', () => {
      expect(texto()).toContain('Hoy hace «Fuerza base»');
    });

    it('muestra quien no tiene objetivo registrado', () => {
      expect(texto()).toContain('Sin objetivo registrado');
    });

    it('explica la lista vacia', () => {
      crear([]);

      expect(texto()).toContain('Todavía no tienes alumnos activos');
    });
  });

  it('los ids son unicos por instancia', () => {
    const primero = form.id(LIBRE, 'inicio');
    crear();

    expect(form.id(LIBRE, 'inicio')).not.toBe(primero);
  });

  // Sin FormsModule el submit nativo recargaba la pagina y se perdia lo elegido.
  it('el submit del formulario no recarga la pagina', () => {
    const evento = new Event('submit', { cancelable: true });

    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(evento);

    expect(evento.defaultPrevented).toBe(true);
    expect(emitido?.map(item => item.studentId)).toEqual(['std-001']);
  });

  it('arma el nombre completo', () => {
    expect(form.nombreDe(LIBRE)).toBe('Camila Acosta');
  });
});
