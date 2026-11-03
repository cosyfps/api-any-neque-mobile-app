import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { domainError } from '@app/domain/shared/model/app-error';
import { Student } from '@app/domain/students/model/student.model';
import { STUDENTS_PORT, StudentsPort } from '@app/domain/students/port/students.port';

import { fn, MockOf } from '@testing/typed-mock';

import { TrainerStudentsFacade } from './trainer-students.facade';

const alumno = (
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  status: Student['status'] = 'active',
  goal: string | null = 'Ganar masa',
): Student => ({
  id,
  trainerId: 'trn-001',
  trainerName: 'Kelvin Moreno',
  firstName,
  lastName,
  email,
  phone: null,
  avatarUrl: null,
  status,
  birthDate: null,
  heightCm: null,
  goal,
  joinedAt: '2026-01-10T00:00:00.000Z',
});

const CARTERA = [
  alumno('std-002', 'Camila', 'Soto', 'camila@neque.cl'),
  alumno('std-001', 'Alejandra', 'Acosta', 'alejandra@neque.cl'),
  alumno('std-003', 'Diego', 'Paredes', 'diego@neque.cl', 'suspended'),
  alumno('std-004', 'Benjamín', 'Muñoz', 'benja@neque.cl'),
];

describe('TrainerStudentsFacade', () => {
  let facade: TrainerStudentsFacade;
  let listByTrainer: MockOf<StudentsPort['listByTrainer']>;
  let create: MockOf<StudentsPort['create']>;

  const ALTA = {
    firstName: 'Nueva',
    lastName: 'Alumna',
    email: 'nueva@neque.cl',
    phone: null,
    birthDate: null,
    heightCm: null,
    goal: null,
  };

  const createFacade = (
    trainerId: string | null = 'trn-001',
    source: () => Observable<Student[]> = () => of(CARTERA),
  ): TrainerStudentsFacade => {
    listByTrainer = fn<StudentsPort['listByTrainer']>().mockImplementation(source);
    create = fn<StudentsPort['create']>().mockReturnValue(
      of(alumno('std-009', 'Nueva', 'Alumna', 'nueva@neque.cl')),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TrainerStudentsFacade,
        { provide: SessionFacade, useValue: { profileId: () => trainerId } },
        { provide: STUDENTS_PORT, useValue: { listByTrainer, create } },
      ],
    });
    return TestBed.inject(TrainerStudentsFacade);
  };

  beforeEach(() => {
    facade = createFacade();
    facade.load();
  });

  describe('load()', () => {
    it('pide la cartera del entrenador de la sesion', () => {
      expect(listByTrainer).toHaveBeenCalledWith('trn-001');
    });

    // Sin sesion no hay a quien pedirle la cartera.
    it('no consulta sin entrenador en sesion', () => {
      const sinSesion = createFacade(null);

      sinSesion.load();

      expect(listByTrainer).not.toHaveBeenCalled();
    });
  });

  describe('visible()', () => {
    it('muestra solo los activos por defecto', () => {
      expect(facade.visible().map(student => student.id)).toEqual([
        'std-001',
        'std-004',
        'std-002',
      ]);
    });

    it('ordena por nombre completo', () => {
      expect(facade.visible()[0]?.firstName).toBe('Alejandra');
    });

    it('cambia a los suspendidos', () => {
      facade.selectFilter('suspended');

      expect(facade.visible().map(student => student.id)).toEqual(['std-003']);
    });

    it('busca por nombre', () => {
      facade.search('camila');

      expect(facade.visible()).toHaveLength(1);
    });

    it('busca por correo', () => {
      facade.search('alejandra@neque');

      expect(facade.visible()[0]?.id).toBe('std-001');
    });

    // "Benjamin" tiene que encontrar a "Benjamín".
    it('ignora tildes y mayusculas', () => {
      facade.search('BENJAMIN');

      expect(facade.visible()[0]?.id).toBe('std-004');
    });

    it('el buscador no cruza pestanas', () => {
      facade.search('diego');

      expect(facade.visible()).toHaveLength(0);
    });
  });

  describe('contadores', () => {
    it('cuenta activos y suspendidos por separado', () => {
      expect(facade.activeCount()).toBe(3);
      expect(facade.suspendedCount()).toBe(1);
    });
  });

  describe('viewState()', () => {
    it('es success con alumnos visibles', () => {
      expect(facade.viewState()).toBe('success');
    });

    // Una cartera con alumnos pero sin coincidencias es un vacio, no la lista.
    it('es empty cuando la busqueda no encuentra nada', () => {
      facade.search('zzz');

      expect(facade.viewState()).toBe('empty');
      expect(facade.emptyBySearch()).toBe(true);
    });

    it('distingue el vacio de una cartera sin alumnos', () => {
      const vacia = createFacade('trn-001', () => of([]));
      vacia.load();

      expect(vacia.viewState()).toBe('empty');
      expect(vacia.emptyBySearch()).toBe(false);
    });

    it('propaga el error del puerto', () => {
      const rota = createFacade('trn-001', () => throwError(() => new Error('boom')));
      rota.load();

      expect(rota.viewState()).toBe('error');
    });
  });

  describe('create()', () => {
    it('agrega el entrenador de la sesion al alta', async () => {
      await facade.create(ALTA);

      expect(create).toHaveBeenCalledWith({ ...ALTA, trainerId: 'trn-001' });
    });

    it('devuelve el id del alumno creado', async () => {
      expect(await facade.create(ALTA)).toBe('std-009');
    });

    it('recarga la cartera tras el alta', async () => {
      await facade.create(ALTA);

      expect(listByTrainer).toHaveBeenCalledTimes(2);
    });

    it('expone el rechazo del puerto sin romper la lista', async () => {
      create.mockReturnValue(throwError(() => domainError('conflict')));

      expect(await facade.create(ALTA)).toBeNull();
      expect(facade.saveError()?.code).toBe('conflict');
      expect(facade.saving()).toBe(false);
    });

    it('limpia el error anterior', async () => {
      create.mockReturnValue(throwError(() => domainError('conflict')));
      await facade.create(ALTA);

      facade.clearSaveError();

      expect(facade.saveError()).toBeNull();
    });

    it('no da de alta sin entrenador en sesion', async () => {
      const sinSesion = createFacade(null);

      expect(await sinSesion.create(ALTA)).toBeNull();
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('reload()', () => {
    it('vuelve a consultar el puerto', () => {
      facade.reload();

      expect(listByTrainer).toHaveBeenCalledTimes(2);
    });
  });
});
