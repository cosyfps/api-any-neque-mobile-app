import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { Exercise } from '@app/domain/routines/model/exercise.model';
import { Routine, RoutineAssignment } from '@app/domain/routines/model/routine.model';
import {
  EXERCISE_CATALOG_PORT,
  ExerciseCatalogPort,
  ROUTINES_PORT,
  RoutinesPort,
} from '@app/domain/routines/port/routines.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { Student } from '@app/domain/students/model/student.model';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';

import { fn, MockOf } from '@testing/typed-mock';

import { TrainerRoutinesFacade } from './trainer-routines.facade';

const alumno = (
  id: string,
  firstName: string,
  status: Student['status'] = 'active',
  goal: string | null = null,
): Student => ({
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
  goal,
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

describe('TrainerRoutinesFacade', () => {
  let facade: TrainerRoutinesFacade;
  let listByTrainer: MockOf<RoutinesPort['listByTrainer']>;
  let create: MockOf<RoutinesPort['create']>;
  let update: MockOf<RoutinesPort['update']>;
  let setAssignments: MockOf<RoutinesPort['setAssignments']>;
  let remove: MockOf<RoutinesPort['remove']>;
  let createExercise: MockOf<ExerciseCatalogPort['create']>;
  let updateExercise: MockOf<ExerciseCatalogPort['update']>;
  let removeExercise: MockOf<ExerciseCatalogPort['remove']>;

  const createFacade = (
    trainerId: string | null = 'trn-001',
    rutinas: Routine[] = [
      rutina('rtn-002', 'Zeta', ['std-002']),
      rutina('rtn-001', 'Alfa', ['std-001']),
      rutina('rtn-003', 'Libre'),
    ],
  ): TrainerRoutinesFacade => {
    listByTrainer = fn<RoutinesPort['listByTrainer']>().mockReturnValue(of(rutinas));
    create = fn<RoutinesPort['create']>().mockReturnValue(of(rutina('rtn-nueva', 'Nueva')));
    update = fn<RoutinesPort['update']>().mockReturnValue(
      of(rutina('rtn-001', 'Alfa', ['std-001'])),
    );
    setAssignments = fn<RoutinesPort['setAssignments']>().mockReturnValue(
      of(rutina('rtn-003', 'Libre', ['std-003'])),
    );
    remove = fn<RoutinesPort['remove']>().mockReturnValue(of(undefined));
    createExercise = fn<ExerciseCatalogPort['create']>().mockReturnValue(
      of(ejercicio('ex-901', 'Zancada', 'trn-001')),
    );
    updateExercise = fn<ExerciseCatalogPort['update']>().mockReturnValue(
      of(ejercicio('ex-900', 'Búlgara con salto', 'trn-001')),
    );
    removeExercise = fn<ExerciseCatalogPort['remove']>().mockReturnValue(of(undefined));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TrainerRoutinesFacade,
        { provide: SessionFacade, useValue: { profileId: () => trainerId } },
        {
          provide: ROUTINES_PORT,
          useValue: { listByTrainer, create, update, setAssignments, remove },
        },
        {
          provide: STUDENTS_PORT,
          useValue: {
            listByTrainer: () =>
              of([
                alumno('std-001', 'Alejandra'),
                alumno('std-002', 'Diego', 'suspended'),
                alumno('std-003', 'Camila', 'active', 'Ganar masa muscular'),
                alumno('std-004', 'Benjamín', 'suspended'),
              ]),
          },
        },
        {
          provide: EXERCISE_CATALOG_PORT,
          useValue: {
            listForTrainer: () =>
              of([
                ejercicio('ex-002', 'Zancada', null),
                ejercicio('ex-001', 'Sentadilla', null),
                ejercicio('ex-900', 'Búlgara', 'trn-001'),
              ]),
            create: createExercise,
            update: updateExercise,
            remove: removeExercise,
          },
        },
      ],
    });
    return TestBed.inject(TrainerRoutinesFacade);
  };

  beforeEach(() => {
    facade = createFacade();
    facade.load();
  });

  describe('load()', () => {
    it('pide la biblioteca del entrenador de la sesion', () => {
      expect(listByTrainer).toHaveBeenCalledWith('trn-001');
    });

    it('no consulta sin entrenador en sesion', () => {
      const sinSesion = createFacade(null);

      sinSesion.load();

      expect(listByTrainer).not.toHaveBeenCalled();
    });

    it('resuelve los nombres de los alumnos de cada rutina', () => {
      expect(facade.visible()[0]?.studentNames).toEqual(['Alejandra Acosta']);
    });
  });

  describe('visible()', () => {
    it('muestra las asignadas ordenadas por nombre', () => {
      expect(facade.visible().map(row => row.routine.id)).toEqual(['rtn-001', 'rtn-002']);
    });

    it('cambia a las que no tienen alumnos', () => {
      facade.selectFilter('unassigned');

      expect(facade.visible().map(row => row.routine.id)).toEqual(['rtn-003']);
    });
  });

  describe('contadores', () => {
    it('cuenta asignadas y sin alumnos por separado', () => {
      expect(facade.assignedCount()).toBe(2);
      expect(facade.unassignedCount()).toBe(1);
    });
  });

  describe('assignmentOptions()', () => {
    const opciones = (routineId: string) => {
      const routine = facade.rows.data()?.find(row => row.routine.id === routineId)?.routine;
      return facade.assignmentOptions(routine as Routine);
    };

    it('pone primero a los de objetivo parecido', () => {
      const lista = opciones('rtn-003');

      expect(lista.map(item => item.student.id)).toEqual(['std-003', 'std-001']);
      expect(lista[0]?.sameGoal).toBe(true);
    });

    // A un alumno suspendido no se le puede asignar una rutina.
    it('deja fuera a los suspendidos que no la hacen', () => {
      expect(opciones('rtn-003').some(item => item.student.id === 'std-004')).toBe(false);
    });

    // Si no apareciera, al guardar saldria de la rutina sin que nadie lo desmarque.
    it('mantiene al suspendido que ya la hace', () => {
      const diego = opciones('rtn-002').find(item => item.student.id === 'std-002');

      expect(diego?.assignment?.studentId).toBe('std-002');
    });

    it('avisa que el alumno viene de otra rutina', () => {
      const alejandra = opciones('rtn-003').find(item => item.student.id === 'std-001');

      expect(alejandra?.otherRoutine).toBe('Alfa');
    });

    it('no avisa si el alumno ya hace esta misma rutina', () => {
      const alejandra = opciones('rtn-001').find(item => item.student.id === 'std-001');

      expect(alejandra?.otherRoutine).toBeNull();
    });
  });

  describe('catalogo', () => {
    it('separa publicos de propios y los ordena', () => {
      expect(facade.publicExercises().map(item => item.name)).toEqual(['Sentadilla', 'Zancada']);
      expect(facade.ownExercises().map(item => item.name)).toEqual(['Búlgara']);
    });
  });

  describe('create()', () => {
    it('agrega el entrenador de la sesion', async () => {
      await facade.create(ENTRADA);

      expect(create).toHaveBeenCalledWith({ ...ENTRADA, trainerId: 'trn-001' });
    });

    it('devuelve el id de la rutina creada', async () => {
      expect(await facade.create(ENTRADA)).toBe('rtn-nueva');
    });

    it('expone el rechazo del puerto', async () => {
      create.mockReturnValue(throwError(() => domainError('conflict')));

      expect(await facade.create(ENTRADA)).toBeNull();
      expect(facade.actionError()?.code).toBe('conflict');
      expect(facade.busy()).toBe(false);
    });

    it('no crea sin entrenador en sesion', async () => {
      const sinSesion = createFacade(null);

      expect(await sinSesion.create(ENTRADA)).toBeNull();
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('manda la rutina completa con su entrenador', async () => {
      await facade.update('rtn-001', ENTRADA);

      expect(update).toHaveBeenCalledWith('rtn-001', { ...ENTRADA, trainerId: 'trn-001' });
    });

    it('no edita sin entrenador en sesion', async () => {
      const sinSesion = createFacade(null);

      expect(await sinSesion.update('rtn-001', ENTRADA)).toBeNull();
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('saveAssignments()', () => {
    it('manda la lista completa al puerto', async () => {
      const lista = [asignacion('std-003')];

      expect(await facade.saveAssignments('rtn-003', lista)).toBe(true);
      expect(setAssignments).toHaveBeenCalledWith('rtn-003', lista);
    });

    // Mover a un alumno lo saca de otra rutina que no vuelve en la respuesta:
    // parchear la lista en memoria la dejaria mintiendo.
    it('relee la biblioteca despues', async () => {
      await facade.saveAssignments('rtn-003', []);

      expect(listByTrainer).toHaveBeenCalledTimes(2);
    });

    it('devuelve false si el puerto rechaza', async () => {
      setAssignments.mockReturnValue(throwError(() => domainError('conflict')));

      expect(await facade.saveAssignments('rtn-003', [])).toBe(false);
      expect(facade.actionError()?.code).toBe('conflict');
    });
  });

  describe('remove()', () => {
    it('elimina y relee la biblioteca sin la rutina', async () => {
      listByTrainer.mockReturnValue(
        of([rutina('rtn-002', 'Zeta', ['std-002']), rutina('rtn-003', 'Libre')]),
      );

      expect(await facade.remove('rtn-001')).toBe(true);

      expect(remove).toHaveBeenCalledWith('rtn-001');
      expect(facade.rows.data()?.map(row => row.routine.id)).toEqual(['rtn-002', 'rtn-003']);
      expect(facade.busy()).toBe(false);
    });

    it('expone el error y no toca la lista si el puerto rechaza', async () => {
      remove.mockReturnValue(throwError(() => domainError('not_found')));

      expect(await facade.remove('rtn-001')).toBe(false);

      expect(facade.actionError()?.code).toBe('not_found');
      expect(facade.rows.data()).toHaveLength(3);
      expect(facade.busy()).toBe(false);
    });

    it('no hace nada sin entrenador en sesion', async () => {
      facade = createFacade(null);

      expect(await facade.remove('rtn-001')).toBe(false);
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe('updateExercise()', () => {
    const CAMBIOS = {
      name: 'Búlgara con salto',
      muscleGroup: 'legs' as const,
      equipment: null,
      thumbnailUrl: null,
      instructions: [],
    };

    it('lo reemplaza en el catalogo propio y relee las rutinas', async () => {
      listByTrainer.mockClear();

      expect(await facade.updateExercise('ex-900', CAMBIOS)).not.toBeNull();
      expect(updateExercise).toHaveBeenCalledWith('ex-900', {
        ...CAMBIOS,
        ownerTrainerId: 'trn-001',
      });
      expect(facade.ownExercises().map(item => item.name)).toEqual(['Búlgara con salto']);
      expect(listByTrainer).toHaveBeenCalled();
    });

    it('expone el rechazo del puerto', async () => {
      updateExercise.mockReturnValue(throwError(() => domainError('not_found')));

      expect(await facade.updateExercise('ex-900', CAMBIOS)).toBeNull();
      expect(facade.actionError()?.code).toBe('not_found');
    });
  });

  describe('removeExercise()', () => {
    it('lo saca del catalogo propio', async () => {
      expect(await facade.removeExercise('ex-900')).toBe(true);
      expect(removeExercise).toHaveBeenCalledWith('ex-900');
      expect(facade.ownExercises()).toEqual([]);
    });

    // El BFF lo rechaza si una rutina vigente lo usa, y nombra cual.
    it('si una rutina lo usa, lo conserva y expone el motivo', async () => {
      removeExercise.mockReturnValue(
        throwError(() => domainError('conflict', 'Este ejercicio está en la rutina «Alfa».')),
      );

      expect(await facade.removeExercise('ex-900')).toBe(false);
      expect(facade.actionError()?.message).toContain('«Alfa»');
      expect(facade.ownExercises()).toHaveLength(1);
    });

    it('no elimina sin entrenador en sesion', async () => {
      const sinSesion = createFacade(null);

      expect(await sinSesion.removeExercise('ex-900')).toBe(false);
    });
  });

  describe('createExercise()', () => {
    const NUEVO = {
      name: 'Zancada',
      muscleGroup: 'legs' as const,
      equipment: null,
      thumbnailUrl: null,
      instructions: [],
    };

    it('lo deja a nombre del entrenador de la sesion', async () => {
      await facade.createExercise(NUEVO);

      expect(createExercise).toHaveBeenCalledWith({ ...NUEVO, ownerTrainerId: 'trn-001' });
    });

    it('lo suma al catalogo propio sin releer', async () => {
      await facade.createExercise(NUEVO);

      expect(facade.ownExercises().map(item => item.id)).toContain('ex-901');
    });

    it('expone el rechazo del puerto', async () => {
      createExercise.mockReturnValue(throwError(() => domainError('conflict')));

      expect(await facade.createExercise(NUEVO)).toBeNull();
      expect(facade.actionError()?.code).toBe('conflict');
    });

    it('no crea sin entrenador en sesion', async () => {
      const sinSesion = createFacade(null);

      expect(await sinSesion.createExercise(NUEVO)).toBeNull();
      expect(createExercise).not.toHaveBeenCalled();
    });
  });

  describe('clearActionError()', () => {
    it('limpia el error anterior', async () => {
      create.mockReturnValue(throwError(() => domainError('conflict')));
      await facade.create(ENTRADA);

      facade.clearActionError();

      expect(facade.actionError()).toBeNull();
    });
  });

  describe('reload()', () => {
    it('vuelve a consultar la biblioteca', () => {
      facade.reload();

      expect(listByTrainer).toHaveBeenCalledTimes(2);
    });
  });
});
