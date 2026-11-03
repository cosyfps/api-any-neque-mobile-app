import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { TrainerInvitationFacade } from '@app/application/trainers/trainer-invitation.facade';
import { TrainerStudentDetailFacade } from '@app/application/trainers/trainer-student-detail.facade';
import { INVITATION_PORT } from '@app/domain/auth/port/invitation.port';
import { Routine } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { PUBLIC_APP_URL } from '@app/domain/shared/port/public-url.port';
import { Anamnesis } from '@app/domain/students/model/anamnesis.model';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student } from '@app/domain/students/model/student.model';
import { ANAMNESIS_PORT, AnamnesisPort } from '@app/domain/students/port/anamnesis.port';
import { ASSESSMENTS_PORT, AssessmentsPort } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT, StudentsPort } from '@app/domain/students/port/students.port';

import { fn, MockOf } from '@testing/typed-mock';

import { StudentDetailPage } from './student-detail.page';

const AHORA = new Date('2026-09-20T10:00:00.000Z');

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

const evaluacion = (id: string, takenAt: string, weightKg: number): Assessment => ({
  id,
  studentId: 'std-001',
  takenAt,
  weightKg,
  heightCm: 165,
  bodyFatPct: null,
  muscleMassKg: null,
  measurements: { chestCm: null, waistCm: null, hipCm: null, armCm: null, thighCm: null },
  notes: null,
});

describe('StudentDetailPage', () => {
  let page: StudentDetailPage;
  let router: Router;
  let setStatus: MockOf<StudentsPort['setStatus']>;
  let edit: MockOf<StudentsPort['edit']>;
  let save: MockOf<AnamnesisPort['save']>;
  let createAssessment: MockOf<AssessmentsPort['create']>;
  let accionPedida: string | null;

  const createPage = (
    alumno: Student = ALUMNO,
    anamnesis: Anamnesis | null = ANAMNESIS,
    rutina: Routine | null = null,
    evaluaciones: Assessment[] = [],
  ): StudentDetailPage => {
    save = fn<AnamnesisPort['save']>().mockImplementation(input => of({ ...ANAMNESIS, ...input }));
    createAssessment = fn<AssessmentsPort['create']>().mockImplementation(input =>
      of({ ...input, id: 'asm-nueva', takenAt: '2026-09-20T10:00:00.000Z' }),
    );
    setStatus = fn<StudentsPort['setStatus']>().mockImplementation((_id, status) =>
      of({ ...alumno, status }),
    );
    edit = fn<StudentsPort['edit']>().mockImplementation((_id, changes) =>
      of({ ...alumno, ...changes }),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // La pagina las declara en sus `providers`; aqui hay que darlas a mano.
        TrainerStudentDetailFacade,
        TrainerInvitationFacade,
        { provide: PUBLIC_APP_URL, useValue: 'https://neque.vercel.app' },
        { provide: CLOCK, useValue: { now: () => AHORA } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'std-001' },
              queryParamMap: { get: () => accionPedida },
            },
          },
        },
        {
          provide: STUDENTS_PORT,
          useValue: { getById: () => of(alumno), edit, setStatus },
        },
        { provide: ANAMNESIS_PORT, useValue: { getByStudent: () => of(anamnesis), save } },
        {
          provide: ASSESSMENTS_PORT,
          useValue: { listByStudent: () => of(evaluaciones), create: createAssessment },
        },
        { provide: ROUTINES_PORT, useValue: { getActiveForStudent: () => of(rutina) } },
        { provide: INVITATION_PORT, useValue: { getForStudent: () => of(null) } },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new StudentDetailPage());
  };

  beforeEach(() => {
    accionPedida = null;
    page = createPage();
  });

  // El inicio del entrenador llega con ?accion= para resolver un pendiente.
  describe('accion pedida por el inicio', () => {
    it('?accion=anamnesis abre la hoja de anamnesis al cargar', () => {
      accionPedida = 'anamnesis';
      page = createPage();
      TestBed.flushEffects();

      expect(page.editingAnamnesis()).toBe(true);
      expect(page.addingAssessment()).toBe(false);
    });

    it('?accion=evaluacion abre la hoja de evaluacion al cargar', () => {
      accionPedida = 'evaluacion';
      page = createPage();
      TestBed.flushEffects();

      expect(page.addingAssessment()).toBe(true);
    });

    it('una accion desconocida no abre nada', () => {
      accionPedida = 'borrar';
      page = createPage();
      TestBed.flushEffects();

      expect(page.editingAnamnesis()).toBe(false);
      expect(page.addingAssessment()).toBe(false);
    });

    // Cerrarla no la vuelve a abrir: la accion se atiende una sola vez.
    it('se abre una sola vez', () => {
      accionPedida = 'anamnesis';
      page = createPage();
      TestBed.flushEffects();

      page.closeAnamnesis();
      page.reload();
      TestBed.flushEffects();

      expect(page.editingAnamnesis()).toBe(false);
    });
  });

  describe('carga inicial', () => {
    it('abre la ficha del parametro de ruta', () => {
      expect(page.facade.viewState()).toBe('success');
      expect(page.facade.displayName()).toBe('Alejandra Acosta');
    });

    it('pide tambien la invitacion del alumno', () => {
      expect(page.invitation.invitation()).toBeNull();
    });
  });

  describe('height()', () => {
    it('muestra la estatura con unidad', () => {
      expect(page.height()).toBe('165 cm');
    });

    it('avisa cuando no esta registrada', () => {
      page = createPage({ ...ALUMNO, heightCm: null });

      expect(page.height()).toBe('Sin registrar');
    });
  });

  describe('availability()', () => {
    it('traduce los dias ISO a etiquetas', () => {
      expect(page.availability()).toBe('Lun, Mié, Vie');
    });

    it('avisa cuando no hay anamnesis', () => {
      page = createPage(ALUMNO, null);

      expect(page.availability()).toBe('Sin registrar');
    });

    it('avisa cuando la anamnesis no trae dias', () => {
      page = createPage(ALUMNO, { ...ANAMNESIS, weeklyAvailability: [] });

      expect(page.availability()).toBe('Sin registrar');
    });
  });

  describe('emergency()', () => {
    it('avisa cuando no hay contacto', () => {
      expect(page.emergency()).toBe('Sin registrar');
    });

    it('junta nombre, parentesco y telefono', () => {
      page = createPage(ALUMNO, {
        ...ANAMNESIS,
        emergencyContact: { name: 'Luis Acosta', phone: '+56 9 2222', relation: 'Padre' },
      });

      expect(page.emergency()).toBe('Luis Acosta (Padre) · +56 9 2222');
    });
  });

  describe('avisos clinicos', () => {
    it('no avisa sin antecedentes', () => {
      expect(page.clinicalFlags()).toBe(false);
    });

    // El entrenador tiene que leerlos antes de prescribir.
    it('avisa cuando hay antecedentes registrados', () => {
      page = createPage(ALUMNO, { ...ANAMNESIS, previousInjuries: 'Esguince de tobillo' });

      expect(page.clinicalFlags()).toBe(true);
    });
  });

  describe('sinRutina()', () => {
    it('invita a crear una cuando la anamnesis sirve', () => {
      expect(page.planificable()).toBe(true);
      expect(page.sinRutina()).toContain('Ya puedes crearle una');
    });

    // Sin objetivo ni disponibilidad no hay con que planificar.
    it('pide la anamnesis primero cuando falta', () => {
      page = createPage(ALUMNO, null);

      expect(page.sinRutina()).toContain('Registra primero su anamnesis');
    });
  });

  describe('editar datos', () => {
    const VALORES = {
      firstName: 'Alejandra',
      lastName: 'Acosta',
      email: 'alejandra@neque.cl',
      phone: '+56 9 3333 3333',
      birthDate: null,
      heightCm: 167,
      goal: 'Bajar grasa',
    };

    it('el sheet nace cerrado', () => {
      expect(page.editing()).toBe(false);
    });

    it('abrir lo muestra', () => {
      page.openEdit();

      expect(page.editing()).toBe(true);
    });

    // Cambiar el correo dejaria invitaciones apuntando a otra persona.
    it('guarda todo menos el correo', async () => {
      page.openEdit();

      await page.saveEdit(VALORES);

      expect(edit).toHaveBeenCalledWith('std-001', {
        firstName: 'Alejandra',
        lastName: 'Acosta',
        phone: '+56 9 3333 3333',
        birthDate: null,
        heightCm: 167,
        goal: 'Bajar grasa',
      });
      expect(page.editing()).toBe(false);
    });

    it('un rechazo deja el sheet abierto', async () => {
      page.openEdit();
      edit.mockReturnValue(throwError(() => domainError('conflict')));

      await page.saveEdit(VALORES);

      expect(page.editing()).toBe(true);
      expect(page.facade.actionError()?.code).toBe('conflict');
    });

    it('cerrar lo oculta', () => {
      page.openEdit();

      page.closeEdit();

      expect(page.editing()).toBe(false);
    });
  });

  describe('suspender y reactivar', () => {
    it('el sheet nace cerrado', () => {
      expect(page.confirmingStatus()).toBe(false);
    });

    it('pide confirmacion antes de suspender', () => {
      page.askStatus();

      expect(page.confirmingStatus()).toBe(true);
      expect(page.statusTitle()).toBe('¿Suspender la cuenta?');
      expect(page.statusDescription()).toContain('se conservan');
      expect(setStatus).not.toHaveBeenCalled();
    });

    it('cancelar no toca el estado', () => {
      page.askStatus();

      page.cancelStatus();

      expect(page.confirmingStatus()).toBe(false);
      expect(setStatus).not.toHaveBeenCalled();
    });

    it('confirmar suspende y cierra el sheet', async () => {
      page.askStatus();

      await page.confirmStatus();

      expect(setStatus).toHaveBeenCalledWith('std-001', 'suspended');
      expect(page.confirmingStatus()).toBe(false);
    });

    it('con la cuenta suspendida ofrece reactivar', () => {
      page = createPage({ ...ALUMNO, status: 'suspended' });

      expect(page.statusTitle()).toBe('¿Reactivar la cuenta?');
      expect(page.statusDescription()).toContain('Volverá a poder ingresar');
    });
  });

  describe('anamnesis', () => {
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

    it('el sheet nace cerrado', () => {
      expect(page.editingAnamnesis()).toBe(false);
    });

    it('guardar cierra el sheet', async () => {
      page.openAnamnesis();

      await page.saveAnamnesis(ENTRADA);

      expect(save).toHaveBeenCalledWith({ ...ENTRADA, studentId: 'std-001' });
      expect(page.editingAnamnesis()).toBe(false);
    });

    it('un rechazo lo deja abierto', async () => {
      page.openAnamnesis();
      save.mockReturnValue(throwError(() => domainError('network')));

      await page.saveAnamnesis(ENTRADA);

      expect(page.editingAnamnesis()).toBe(true);
    });

    it('cerrar lo oculta', () => {
      page.openAnamnesis();

      page.closeAnamnesis();

      expect(page.editingAnamnesis()).toBe(false);
    });
  });

  describe('evaluaciones', () => {
    const ENTRADA = {
      weightKg: 58,
      heightCm: 165,
      bodyFatPct: null,
      muscleMassKg: null,
      measurements: { chestCm: null, waistCm: null, hipCm: null, armCm: null, thighCm: null },
      notes: null,
    };

    it('el sheet nace cerrado', () => {
      expect(page.addingAssessment()).toBe(false);
    });

    it('registrar cierra el sheet', async () => {
      page.openAssessment();

      await page.saveAssessment(ENTRADA);

      expect(createAssessment).toHaveBeenCalledWith({ ...ENTRADA, studentId: 'std-001' });
      expect(page.addingAssessment()).toBe(false);
    });

    it('un rechazo lo deja abierto', async () => {
      page.openAssessment();
      createAssessment.mockReturnValue(throwError(() => domainError('network')));

      await page.saveAssessment(ENTRADA);

      expect(page.addingAssessment()).toBe(true);
    });

    it('cerrar lo oculta', () => {
      page.openAssessment();

      page.closeAssessment();

      expect(page.addingAssessment()).toBe(false);
    });
  });

  describe('weightSeries()', () => {
    it('es vacia sin evaluaciones', () => {
      expect(page.weightSeries()).toEqual([]);
    });

    // El grafico lee de izquierda a derecha: la mas antigua primero.
    it('va de la mas antigua a la mas reciente', () => {
      page = createPage(ALUMNO, ANAMNESIS, null, [
        evaluacion('asm-002', '2026-06-04T10:00:00.000Z', 60),
        evaluacion('asm-001', '2026-03-05T10:00:00.000Z', 61.4),
      ]);

      expect(page.weightSeries().map(punto => punto.value)).toEqual([61.4, 60]);
    });

    it('etiqueta cada punto con su mes', () => {
      page = createPage(ALUMNO, ANAMNESIS, null, [
        evaluacion('asm-001', '2026-03-05T10:00:00.000Z', 61.4),
      ]);

      expect(page.weightSeries()[0]?.label).toContain('mar');
    });
  });

  describe('goBack()', () => {
    it('vuelve a la cartera', () => {
      page.goBack();

      expect(router.navigate).toHaveBeenCalledWith(['/trainer/students']);
    });
  });

  describe('dias()', () => {
    it('usa el singular con un solo dia', () => {
      expect(page.dias(1)).toBe('1 día a la semana');
    });

    it('usa el plural con varios', () => {
      expect(page.dias(4)).toBe('4 días a la semana');
    });
  });

  describe('fecha()', () => {
    it('formatea en espanol de Chile', () => {
      expect(page.fecha('2026-06-04T10:00:00.000Z')).toContain('junio');
    });
  });

  describe('reload', () => {
    it('es un campo arrow para poder pasarlo a [retry]', () => {
      expect(() => page.reload()).not.toThrow();
    });
  });
});
