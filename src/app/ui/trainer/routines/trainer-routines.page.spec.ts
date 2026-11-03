import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import {
  RoutineRow,
  TrainerRoutinesFacade,
} from '@app/application/trainers/trainer-routines.facade';
import { Exercise } from '@app/domain/routines/model/exercise.model';
import { Routine, RoutineAssignment } from '@app/domain/routines/model/routine.model';
import {
  EXERCISE_CATALOG_PORT,
  ExerciseCatalogPort,
  ROUTINES_PORT,
  RoutinesPort,
} from '@app/domain/routines/port/routines.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Student } from '@app/domain/students/model/student.model';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';

import { fn, MockOf } from '@testing/typed-mock';

import { TrainerRoutinesPage } from './trainer-routines.page';

const alumno = (id: string, firstName: string, status: Student['status'] = 'active'): Student => ({
  id,
  trainerId: 'trn-001',
  trainerName: 'Kelvin Moreno',
  firstName,
  lastName: 'Acosta',
  email: `${id}@neque.cl`,
  phone: null,
  avatarUrl: null,
  status,
  birthDate: null,
  heightCm: null,
  goal: null,
  joinedAt: '2026-01-10T00:00:00.000Z',
});

const asignacion = (studentId: string): RoutineAssignment => ({
  studentId,
  startDate: '2026-09-01T00:00:00.000Z',
  endDate: null,
});

const rutina = (id: string, name: string, alumnos: string[] = []): Routine => ({
  id,
  trainerId: 'trn-001',
  name,
  goal: 'Ganar masa',
  days: [],
  assignments: alumnos.map(asignacion),
});

const ejercicio = (id: string, name: string, owner: string | null): Exercise => ({
  id,
  name,
  muscleGroup: 'legs',
  equipment: null,
  thumbnailUrl: null,
  instructions: [],
  ownerTrainerId: owner,
});

const ENTRADA = {
  name: 'Hipertrofia',
  goal: 'Ganar masa',
  days: [],
};

describe('TrainerRoutinesPage', () => {
  let page: TrainerRoutinesPage;
  let create: MockOf<RoutinesPort['create']>;
  let update: MockOf<RoutinesPort['update']>;
  let setAssignments: MockOf<RoutinesPort['setAssignments']>;
  let remove: MockOf<RoutinesPort['remove']>;
  let createExercise: MockOf<ExerciseCatalogPort['create']>;

  const createPage = (
    opciones: {
      rutinas?: Routine[];
      cartera?: Student[];
      ejercicios?: Exercise[];
      falla?: boolean;
    } = {},
  ): TrainerRoutinesPage => {
    const {
      rutinas = [rutina('rtn-001', 'Hipertrofia', ['std-001'])],
      cartera = [alumno('std-001', 'Alejandra'), alumno('std-002', 'Diego', 'suspended')],
      ejercicios = [
        ejercicio('ex-001', 'Sentadilla', null),
        ejercicio('ex-900', 'Búlgara', 'trn-001'),
      ],
      falla = false,
    } = opciones;

    create = fn<RoutinesPort['create']>().mockReturnValue(of(rutina('rtn-nueva', 'Nueva')));
    update = fn<RoutinesPort['update']>().mockReturnValue(
      of(rutina('rtn-001', 'Editada', ['std-001'])),
    );
    setAssignments = fn<RoutinesPort['setAssignments']>().mockReturnValue(
      of(rutina('rtn-001', 'Hipertrofia', ['std-001'])),
    );
    remove = fn<RoutinesPort['remove']>().mockReturnValue(of(undefined));
    createExercise = fn<ExerciseCatalogPort['create']>().mockReturnValue(
      of(ejercicio('ex-901', 'Zancada', 'trn-001')),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        // La pagina la declara en sus `providers`; aqui hay que darla a mano.
        TrainerRoutinesFacade,
        { provide: SessionFacade, useValue: { profileId: () => 'trn-001' } },
        { provide: CLOCK, useValue: { now: () => new Date(2026, 8, 26, 10) } },
        {
          provide: ROUTINES_PORT,
          useValue: {
            listByTrainer: () => (falla ? throwError(() => new Error('boom')) : of(rutinas)),
            create,
            update,
            setAssignments,
            remove,
          },
        },
        { provide: STUDENTS_PORT, useValue: { listByTrainer: () => of(cartera) } },
        {
          provide: EXERCISE_CATALOG_PORT,
          useValue: { listForTrainer: () => of(ejercicios), create: createExercise },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new TrainerRoutinesPage());
  };

  beforeEach(() => {
    page = createPage();
  });

  describe('biblioteca', () => {
    it('resuelve los nombres de los alumnos de cada rutina', () => {
      page = createPage({ rutinas: [rutina('rtn-001', 'Masa', ['std-001', 'std-002'])] });

      expect(page.facade.visible()[0]?.studentNames).toEqual(['Alejandra Acosta', 'Diego Acosta']);
    });

    it('avisa cuando el alumno ya no esta en la cartera', () => {
      page = createPage({ rutinas: [rutina('rtn-001', 'Vieja', ['std-999'])] });

      expect(page.facade.visible()[0]?.studentNames).toEqual(['Alumno desconocido']);
    });

    it('muestra las asignadas por defecto', () => {
      expect(page.facade.filter()).toBe('assigned');
      expect(page.facade.assignedCount()).toBe(1);
    });

    it('cambia a las que esperan alumnos', () => {
      page = createPage({
        rutinas: [rutina('rtn-001', 'A', ['std-001']), rutina('rtn-002', 'B')],
      });

      page.facade.selectFilter('unassigned');

      expect(page.facade.visible().map(row => row.routine.id)).toEqual(['rtn-002']);
    });

    // Una biblioteca con rutinas pero ninguna libre muestra ese vacio.
    it('la pestana sin rutinas queda en empty', () => {
      page.facade.selectFilter('unassigned');

      expect(page.facade.viewState()).toBe('empty');
      expect(page.emptyTitle()).toBe('Nada sin asignar');
    });

    it('invita a crear la primera con la biblioteca vacia', () => {
      page = createPage({ rutinas: [] });

      expect(page.emptyTitle()).toBe('Ninguna rutina asignada');
      expect(page.emptyMessage()).toContain('Crea una rutina');
    });

    it('propaga el error del puerto', () => {
      page = createPage({ falla: true });

      expect(page.facade.viewState()).toBe('error');
    });
  });

  describe('textos de la tarjeta', () => {
    it('cuenta los alumnos', () => {
      expect(page.alumnos(0)).toBe('Sin alumnos');
      expect(page.alumnos(1)).toBe('1 alumno');
      expect(page.alumnos(3)).toBe('3 alumnos');
    });

    it('sabe si la rutina tiene alumnos', () => {
      expect(page.asignada(rutina('rtn-001', 'A', ['std-001']))).toBe(true);
      expect(page.asignada(rutina('rtn-002', 'B'))).toBe(false);
    });
  });

  describe('catalogo de ejercicios', () => {
    it('separa los publicos de los propios', () => {
      expect(page.facade.publicExercises().map(item => item.id)).toEqual(['ex-001']);
      expect(page.facade.ownExercises().map(item => item.id)).toEqual(['ex-900']);
    });
  });

  describe('secciones', () => {
    it('abre en rutinas', () => {
      expect(page.seccion()).toBe('routines');
      expect(page.addLabel()).toBe('Crear una rutina');
    });

    it('el boton de alta cambia con la seccion', () => {
      page.selectSeccion('exercises');

      expect(page.addLabel()).toBe('Crear un ejercicio');
    });
  });

  describe('constructor de rutinas', () => {
    it('el sheet nace cerrado', () => {
      expect(page.building()).toBe(false);
    });

    it('crear abre el constructor en blanco', () => {
      page.openCreate();

      expect(page.building()).toBe(true);
      expect(page.editing()).toBeNull();
      expect(page.builderTitle()).toBe('Nueva rutina');
    });

    it('editar abre el constructor con la rutina', () => {
      const actual = rutina('rtn-001', 'Hipertrofia', ['std-001']);

      page.openEdit(actual);

      expect(page.editing()).toBe(actual);
      expect(page.builderTitle()).toBe('Editar rutina');
    });

    it('guardar una nueva agrega el entrenador de la sesion', async () => {
      page.openCreate();

      await page.saveRoutine(ENTRADA);

      expect(create).toHaveBeenCalledWith({ ...ENTRADA, trainerId: 'trn-001' });
      expect(page.building()).toBe(false);
    });

    // Una rutina nace sin alumnos: sin el salto de pestana el entrenador la
    // guarda y no la ve por ninguna parte.
    it('tras crear salta a la pestana donde queda', async () => {
      page.openCreate();

      await page.saveRoutine(ENTRADA);

      expect(page.facade.filter()).toBe('unassigned');
    });

    it('tras crear abre la hoja para asignarla', async () => {
      page = createPage({ rutinas: [rutina('rtn-nueva', 'Nueva')] });
      page.openCreate();

      await page.saveRoutine(ENTRADA);

      expect(page.assigning()?.id).toBe('rtn-nueva');
    });

    it('tras editar no abre la hoja de asignar', async () => {
      page.openEdit(rutina('rtn-001', 'Hipertrofia', ['std-001']));

      await page.saveRoutine(ENTRADA);

      expect(page.assigning()).toBeNull();
    });

    it('guardar una existente la actualiza', async () => {
      page.openEdit(rutina('rtn-001', 'Hipertrofia', ['std-001']));

      await page.saveRoutine(ENTRADA);

      expect(update).toHaveBeenCalledWith('rtn-001', { ...ENTRADA, trainerId: 'trn-001' });
      expect(page.building()).toBe(false);
    });

    it('un rechazo deja el sheet abierto', async () => {
      page.openCreate();
      create.mockReturnValue(throwError(() => domainError('conflict')));

      await page.saveRoutine(ENTRADA);

      expect(page.building()).toBe(true);
      expect(page.facade.actionError()?.code).toBe('conflict');
    });

    it('cerrar lo oculta', () => {
      page.openCreate();

      page.closeBuilder();

      expect(page.building()).toBe(false);
    });
  });

  describe('eliminar rutina', () => {
    const fila = (): RoutineRow => {
      const row = page.facade.visible()[0];
      if (row === undefined) {
        throw new Error('sin filas');
      }
      return row;
    };

    it('askRemove() abre la confirmacion con esa rutina', () => {
      page.askRemove(fila());

      expect(page.removing()?.routine.id).toBe('rtn-001');
    });

    it('avisa que sus alumnos quedan sin rutina', () => {
      page.askRemove(fila());

      expect(page.removeWarning()).toBe(
        'Alejandra Acosta quedará sin rutina. No se puede deshacer.',
      );
    });

    it('junta varios nombres con coma y "y"', () => {
      page = createPage({
        rutinas: [rutina('rtn-001', 'Hipertrofia', ['std-001', 'std-002', 'std-003'])],
        cartera: [alumno('std-001', 'Ana'), alumno('std-002', 'Luis'), alumno('std-003', 'Sofía')],
      });

      page.askRemove(fila());

      expect(page.removeWarning()).toBe(
        'Ana Acosta, Luis Acosta y Sofía Acosta quedarán sin rutina. No se puede deshacer.',
      );
    });

    it('sin alumnos solo avisa que no se puede deshacer', () => {
      page = createPage({ rutinas: [rutina('rtn-009', 'Libre')] });
      page.facade.selectFilter('unassigned');

      page.askRemove(fila());

      expect(page.removeWarning()).toBe('No se puede deshacer.');
    });

    it('confirmRemove() elimina y cierra la confirmacion', async () => {
      page.askRemove(fila());

      await page.confirmRemove();

      expect(remove).toHaveBeenCalledWith('rtn-001');
      expect(page.removing()).toBeNull();
    });

    it('si falla deja la confirmacion abierta con el error', async () => {
      remove.mockReturnValue(throwError(() => domainError('network')));
      page.askRemove(fila());

      await page.confirmRemove();

      expect(page.removing()).not.toBeNull();
      expect(page.facade.actionError()?.code).toBe('network');
    });

    it('cancelRemove() cierra sin eliminar', async () => {
      page.askRemove(fila());

      page.cancelRemove();
      await page.confirmRemove();

      expect(page.removing()).toBeNull();
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe('asignar alumnos', () => {
    const hipertrofia = rutina('rtn-001', 'Hipertrofia', ['std-001']);

    it('la hoja nace cerrada', () => {
      expect(page.assigning()).toBeNull();
      expect(page.assignOptions()).toEqual([]);
    });

    it('abrirla carga las opciones de esa rutina', () => {
      page.openAssign(hipertrofia);

      expect(page.assigning()).toBe(hipertrofia);
      expect(page.assignOptions().map(item => item.student.id)).toEqual(['std-001']);
    });

    it('propone hoy como inicio, en fecha local', () => {
      expect(page.today).toBe('2026-09-26');
    });

    it('guardar manda la lista completa y cierra', async () => {
      page.openAssign(hipertrofia);
      const lista = [asignacion('std-001')];

      await page.saveAssignments(lista);

      expect(setAssignments).toHaveBeenCalledWith('rtn-001', lista);
      expect(page.assigning()).toBeNull();
      expect(page.facade.filter()).toBe('assigned');
    });

    it('quitar a todos la lleva a sin asignar', async () => {
      page.openAssign(hipertrofia);

      await page.saveAssignments([]);

      expect(page.facade.filter()).toBe('unassigned');
    });

    it('un rechazo deja la hoja abierta', async () => {
      page.openAssign(hipertrofia);
      setAssignments.mockReturnValue(throwError(() => domainError('conflict')));

      await page.saveAssignments([]);

      expect(page.assigning()).toBe(hipertrofia);
    });

    it('sin hoja abierta no llama al puerto', async () => {
      await page.saveAssignments([]);

      expect(setAssignments).not.toHaveBeenCalled();
    });

    it('cerrar la oculta', () => {
      page.openAssign(hipertrofia);

      page.closeAssign();

      expect(page.assigning()).toBeNull();
    });
  });

  describe('ejercicio propio', () => {
    const NUEVO = {
      name: 'Zancada',
      muscleGroup: 'legs' as const,
      equipment: null,
      thumbnailUrl: null,
      instructions: [],
    };

    it('el sheet nace cerrado', () => {
      expect(page.creatingExercise()).toBe(false);
    });

    it('el boton de alta lo abre desde la seccion de ejercicios', () => {
      page.selectSeccion('exercises');

      page.openCreate();

      expect(page.creatingExercise()).toBe(true);
      expect(page.building()).toBe(false);
    });

    it('queda con el entrenador que lo crea', async () => {
      await page.saveExercise(NUEVO);

      expect(createExercise).toHaveBeenCalledWith({ ...NUEVO, ownerTrainerId: 'trn-001' });
    });

    it('aparece en el catalogo propio sin releer', async () => {
      await page.saveExercise(NUEVO);

      expect(page.facade.ownExercises().map(item => item.id)).toContain('ex-901');
    });

    it('un rechazo deja el sheet abierto', async () => {
      page.selectSeccion('exercises');
      page.openCreate();
      createExercise.mockReturnValue(throwError(() => domainError('conflict')));

      await page.saveExercise(NUEVO);

      expect(page.creatingExercise()).toBe(true);
    });

    it('cerrar lo oculta', () => {
      page.selectSeccion('exercises');
      page.openCreate();

      page.closeExercise();

      expect(page.creatingExercise()).toBe(false);
    });
  });

  describe('dias()', () => {
    it('usa el singular con un solo dia', () => {
      expect(page.dias(1)).toBe('1 día');
    });

    it('usa el plural con varios', () => {
      expect(page.dias(4)).toBe('4 días');
    });
  });

  describe('grupo()', () => {
    it('traduce el grupo muscular', () => {
      expect(page.grupo('legs')).toBe('Piernas');
    });
  });

  describe('reload', () => {
    it('es un campo arrow para poder pasarlo a [retry]', () => {
      expect(() => page.reload()).not.toThrow();
    });
  });
});
