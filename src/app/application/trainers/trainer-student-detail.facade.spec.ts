import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { Routine } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { Anamnesis } from '@app/domain/students/model/anamnesis.model';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student } from '@app/domain/students/model/student.model';
import { ANAMNESIS_PORT, AnamnesisPort } from '@app/domain/students/port/anamnesis.port';
import { ASSESSMENTS_PORT, AssessmentsPort } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT, StudentsPort } from '@app/domain/students/port/students.port';

import { fn, MockOf } from '@testing/typed-mock';

import { TrainerStudentDetailFacade } from './trainer-student-detail.facade';

const ALUMNO: Student = {
  id: 'std-001',
  trainerId: 'trn-001',
  trainerName: 'Kelvin Moreno',
  firstName: 'Alejandra',
  lastName: 'Acosta',
  email: 'alejandra@neque.cl',
  phone: null,
  avatarUrl: null,
  status: 'active',
  birthDate: null,
  heightCm: 165,
  goal: 'Ganar masa',
  joinedAt: '2026-01-10T00:00:00.000Z',
};

const ANAMNESIS: Anamnesis = {
  id: 'anm-001',
  studentId: 'std-001',
  medicalHistory: null,
  previousInjuries: null,
  surgeries: null,
  medications: null,
  allergies: null,
  previousActivity: null,
  declaredGoal: 'Ganar masa',
  weeklyAvailability: [1, 3, 5],
  emergencyContact: null,
  updatedAt: '2026-03-05T10:00:00.000Z',
};

const evaluacion = (id: string, takenAt: string): Assessment => ({
  id,
  studentId: 'std-001',
  takenAt,
  weightKg: 60,
  heightCm: 165,
  bodyFatPct: null,
  muscleMassKg: null,
  measurements: { chestCm: null, waistCm: null, hipCm: null, armCm: null, thighCm: null },
  notes: null,
});

const RUTINA = { id: 'rtn-001', name: 'Hipertrofia' } as Routine;

describe('TrainerStudentDetailFacade', () => {
  let facade: TrainerStudentDetailFacade;
  let students: {
    getById: MockOf<StudentsPort['getById']>;
    edit: MockOf<StudentsPort['edit']>;
    setStatus: MockOf<StudentsPort['setStatus']>;
  };
  let save: MockOf<AnamnesisPort['save']>;
  let createAssessment: MockOf<AssessmentsPort['create']>;

  const createFacade = (alumno: Student = ALUMNO): TrainerStudentDetailFacade => {
    save = fn<AnamnesisPort['save']>().mockImplementation(input => of({ ...ANAMNESIS, ...input }));
    createAssessment = fn<AssessmentsPort['create']>().mockImplementation(input =>
      of({ ...input, id: 'asm-003', takenAt: '2026-09-20T10:00:00.000Z' }),
    );
    students = {
      getById: fn<StudentsPort['getById']>().mockReturnValue(of(alumno)),
      edit: fn<StudentsPort['edit']>().mockImplementation((_id, changes) =>
        of({ ...alumno, ...changes }),
      ),
      setStatus: fn<StudentsPort['setStatus']>().mockImplementation((_id, status) =>
        of({ ...alumno, status }),
      ),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TrainerStudentDetailFacade,
        { provide: STUDENTS_PORT, useValue: students },
        { provide: ANAMNESIS_PORT, useValue: { getByStudent: () => of(ANAMNESIS), save } },
        {
          provide: ASSESSMENTS_PORT,
          useValue: {
            listByStudent: () =>
              of([
                evaluacion('asm-001', '2026-03-05T10:00:00.000Z'),
                evaluacion('asm-002', '2026-06-04T10:00:00.000Z'),
              ]),
            create: createAssessment,
          },
        },
        { provide: ROUTINES_PORT, useValue: { getActiveForStudent: () => of(RUTINA) } },
      ],
    });
    return TestBed.inject(TrainerStudentDetailFacade);
  };

  beforeEach(() => {
    facade = createFacade();
    facade.load('std-001');
  });

  describe('load()', () => {
    it('carga los cuatro bloques de la ficha', () => {
      expect(students.getById).toHaveBeenCalledWith('std-001');
      expect(facade.anamnesis.data()?.declaredGoal).toBe('Ganar masa');
      expect(facade.assessments.data()).toHaveLength(2);
      expect(facade.routine.data()?.name).toBe('Hipertrofia');
    });

    it('expone nombre e iniciales listos para mostrar', () => {
      expect(facade.displayName()).toBe('Alejandra Acosta');
      expect(facade.avatarInitials()).toBe('AA');
    });

    it('recuerda de quien es la ficha', () => {
      expect(facade.studentId()).toBe('std-001');
    });
  });

  describe('assessmentHistory()', () => {
    it('ordena de la mas reciente a la mas antigua', () => {
      expect(facade.assessmentHistory().map(item => item.id)).toEqual(['asm-002', 'asm-001']);
    });

    it('la ultima evaluacion es la de arriba', () => {
      expect(facade.latestAssessment()?.id).toBe('asm-002');
    });
  });

  describe('edit()', () => {
    it('manda solo los campos corregidos', async () => {
      await facade.edit({ phone: '+56 9 1111 1111' });

      expect(students.edit).toHaveBeenCalledWith('std-001', { phone: '+56 9 1111 1111' });
      expect(facade.student.data()?.phone).toBe('+56 9 1111 1111');
    });

    it('expone el rechazo del puerto', async () => {
      students.edit.mockReturnValue(throwError(() => domainError('conflict')));

      expect(await facade.edit({ goal: 'x' })).toBe(false);
      expect(facade.actionError()?.code).toBe('conflict');
      expect(facade.busy()).toBe(false);
    });

    it('no edita sin ficha cargada', async () => {
      const vacia = createFacade();

      expect(await vacia.edit({ goal: 'x' })).toBe(false);
      expect(students.edit).not.toHaveBeenCalled();
    });
  });

  describe('saveAnamnesis()', () => {
    const ENTRADA = {
      declaredGoal: 'Bajar grasa',
      weeklyAvailability: [2, 4] as const,
      medicalHistory: null,
      previousInjuries: null,
      surgeries: null,
      medications: null,
      allergies: null,
      previousActivity: null,
      emergencyContact: null,
    };

    it('agrega el alumno de la ficha', async () => {
      await facade.saveAnamnesis(ENTRADA);

      expect(save).toHaveBeenCalledWith({ ...ENTRADA, studentId: 'std-001' });
    });

    it('deja la anamnesis guardada en la ficha', async () => {
      await facade.saveAnamnesis(ENTRADA);

      expect(facade.anamnesis.data()?.declaredGoal).toBe('Bajar grasa');
    });

    it('expone el rechazo del puerto', async () => {
      save.mockReturnValue(throwError(() => domainError('conflict')));

      expect(await facade.saveAnamnesis(ENTRADA)).toBe(false);
      expect(facade.actionError()?.code).toBe('conflict');
    });

    it('no guarda sin ficha cargada', async () => {
      const vacia = createFacade();

      expect(await vacia.saveAnamnesis(ENTRADA)).toBe(false);
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe('addAssessment()', () => {
    const ENTRADA = {
      weightKg: 58,
      heightCm: 165,
      bodyFatPct: null,
      muscleMassKg: null,
      measurements: { chestCm: null, waistCm: null, hipCm: null, armCm: null, thighCm: null },
      notes: null,
    };

    it('agrega el alumno de la ficha', async () => {
      await facade.addAssessment(ENTRADA);

      expect(createAssessment).toHaveBeenCalledWith({ ...ENTRADA, studentId: 'std-001' });
    });

    // El historial se amplia sin releer: la nueva es la mas reciente.
    it('suma la evaluacion al historial', async () => {
      await facade.addAssessment(ENTRADA);

      expect(facade.assessments.data()).toHaveLength(3);
      expect(facade.latestAssessment()?.id).toBe('asm-003');
    });

    it('expone el rechazo del puerto', async () => {
      createAssessment.mockReturnValue(throwError(() => domainError('network')));

      expect(await facade.addAssessment(ENTRADA)).toBe(false);
      expect(facade.actionError()?.code).toBe('network');
    });

    it('no registra sin ficha cargada', async () => {
      const vacia = createFacade();

      expect(await vacia.addAssessment(ENTRADA)).toBe(false);
      expect(createAssessment).not.toHaveBeenCalled();
    });
  });

  describe('toggleStatus()', () => {
    it('suspende a un alumno activo', async () => {
      await facade.toggleStatus();

      expect(students.setStatus).toHaveBeenCalledWith('std-001', 'suspended');
      expect(facade.suspended()).toBe(true);
    });

    // El alumno nunca se elimina: se suspende y se reactiva.
    it('reactiva a uno suspendido', async () => {
      facade = createFacade({ ...ALUMNO, status: 'suspended' });
      facade.load('std-001');

      await facade.toggleStatus();

      expect(students.setStatus).toHaveBeenCalledWith('std-001', 'active');
    });

    // Con una respuesta instantanea el guard no se nota; hace falta una en
    // vuelo, que es justo el caso que protege.
    it('un doble toque no dispara dos cambios', async () => {
      const respuesta = new Subject<Student>();
      students.setStatus.mockReturnValue(respuesta);

      const primera = facade.toggleStatus();
      const segunda = facade.toggleStatus();
      expect(await segunda).toBe(false);

      respuesta.next({ ...ALUMNO, status: 'suspended' });
      await primera;

      expect(students.setStatus).toHaveBeenCalledTimes(1);
    });

    it('no cambia el estado sin ficha cargada', async () => {
      const vacia = createFacade();

      expect(await vacia.toggleStatus()).toBe(false);
      expect(students.setStatus).not.toHaveBeenCalled();
    });
  });

  describe('reload()', () => {
    it('vuelve a pedir la ficha', () => {
      facade.reload();

      expect(students.getById).toHaveBeenCalledTimes(2);
    });
  });
});
