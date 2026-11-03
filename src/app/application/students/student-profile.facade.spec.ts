import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { AUTH_PORT, AuthPort } from '@app/domain/auth/port/auth.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student } from '@app/domain/students/model/student.model';
import { ASSESSMENTS_PORT, AssessmentsPort } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT, StudentsPort } from '@app/domain/students/port/students.port';
import { Trainer } from '@app/domain/trainers/model/trainer.model';
import { TRAINERS_PORT, TrainersPort } from '@app/domain/trainers/port/trainers.port';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { StudentProfileFacade } from './student-profile.facade';

const STUDENT: Student = {
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
  goal: 'Ganar masa muscular',
  joinedAt: '2026-03-02T00:00:00.000Z',
};

const ASSESSMENT: Assessment = {
  id: 'asm-004',
  studentId: 'std-001',
  takenAt: '2026-09-07T10:00:00.000Z',
  weightKg: 58.9,
  heightCm: 165,
  bodyFatPct: 23.1,
  muscleMassKg: 43,
  measurements: { chestCm: 86, waistCm: 68, hipCm: 93, armCm: 28.5, thighCm: 55.5 },
  notes: null,
};

const TRAINER: Trainer = {
  id: 'trn-001',
  userId: 'usr-trn',
  firstName: 'Kelvin',
  lastName: 'Moreno',
  email: 'kelvin@neque.cl',
  phone: '+56 9 1234 5678',
  avatarUrl: null,
  specialty: 'Hipertrofia',
  certifications: ['Entrenador personal certificado'],
  bio: 'Entreno a personas que quieren cambiar.',
  joinedAt: '2025-11-01T12:00:00.000Z',
};

const getTrainer = fn<TrainersPort['getById']>(() => of(TRAINER));

describe('StudentProfileFacade', () => {
  let getById: MockOf<StudentsPort['getById']>;
  let latestByStudent: MockOf<AssessmentsPort['latestByStudent']>;
  let update: MockOf<StudentsPort['update']>;
  let changePassword: MockOf<AuthPort['changePassword']>;
  let listSessions: MockOf<WorkoutsPort['listByStudent']>;
  let profileId: string | null;

  const build = (): StudentProfileFacade => {
    TestBed.configureTestingModule({
      providers: [
        StudentProfileFacade,
        {
          provide: STUDENTS_PORT,
          useValue: { getById, listByTrainer: fn<StudentsPort['listByTrainer']>(), update },
        },
        {
          provide: ASSESSMENTS_PORT,
          useValue: {
            latestByStudent,
            listByStudent: fn<AssessmentsPort['listByStudent']>(),
            create: fn<AssessmentsPort['create']>(),
          },
        },
        { provide: WORKOUTS_PORT, useValue: { listByStudent: listSessions } },
        { provide: AUTH_PORT, useValue: { changePassword } },
        {
          provide: TRAINERS_PORT,
          useValue: { getById: getTrainer, update: fn<TrainersPort['update']>() },
        },
        // Miercoles 23 de septiembre de 2026.
        { provide: CLOCK, useValue: { now: () => new Date(2026, 8, 23, 12) } },
        {
          provide: SessionFacade,
          useValue: {
            profileId: () => profileId,
            user: () => (profileId === null ? null : { email: 'alejandra@neque.cl' }),
          },
        },
      ],
    });
    return TestBed.inject(StudentProfileFacade);
  };

  beforeEach(() => {
    getById = fn<StudentsPort['getById']>().mockReturnValue(of(STUDENT));
    latestByStudent = fn<AssessmentsPort['latestByStudent']>().mockReturnValue(of(ASSESSMENT));
    update = fn<StudentsPort['update']>().mockImplementation(
      (_id: string, cambios: Partial<Student>) => of({ ...STUDENT, ...cambios }),
    );
    changePassword = fn<AuthPort['changePassword']>().mockReturnValue(of(undefined));
    listSessions = fn<WorkoutsPort['listByStudent']>().mockReturnValue(of([]));
    profileId = 'std-001';
  });

  // Lo que el entrenador escribe en su perfil ahora lo ve su alumno.
  describe('loadTrainer()', () => {
    it('carga el entrenador de la ficha', () => {
      getTrainer.mockClear();
      const facade = build();
      facade.load();

      facade.loadTrainer();

      expect(getTrainer).toHaveBeenCalledWith('trn-001');
      expect(facade.trainer.data()?.specialty).toBe('Hipertrofia');
    });

    it('sin ficha cargada no pide nada', () => {
      getTrainer.mockClear();
      const facade = build();

      facade.loadTrainer();

      expect(getTrainer).not.toHaveBeenCalled();
    });
  });

  describe('racha', () => {
    const sesion = (fecha: Date): WorkoutSession => ({
      id: `wks-${fecha.getTime()}`,
      studentId: 'std-001',
      routineId: 'rtn-001',
      routineDayId: 'day-1',
      title: 'Sesion',
      scheduledFor: fecha.toISOString(),
      startedAt: null,
      completedAt: null,
      status: 'completed',
      durationMinutes: null,
      estimatedMinutes: 45,
      exercises: [],
    });

    it('cuenta las semanas seguidas con la agenda cumplida', () => {
      listSessions.mockReturnValue(
        of([sesion(new Date(2026, 8, 14, 18)), sesion(new Date(2026, 8, 7, 18))]),
      );
      const facade = build();
      facade.load();

      expect(listSessions).toHaveBeenCalledWith('std-001');
      expect(facade.streakWeeks()).toBe(2);
    });

    it('es cero sin sesiones', () => {
      const facade = build();
      facade.load();

      expect(facade.streakWeeks()).toBe(0);
    });
  });

  describe('edicion del perfil', () => {
    it('saveProfile() actualiza la ficha con lo que devuelve el puerto', async () => {
      const facade = build();
      facade.load();

      expect(await facade.saveProfile({ lastName: 'Rivas' })).toBe(true);

      expect(update).toHaveBeenCalledWith('std-001', { lastName: 'Rivas' });
      expect(facade.displayName()).toBe('Alejandra Rivas');
      expect(facade.busy()).toBe(false);
    });

    it('setAvatar() guarda la foto como avatarUrl', async () => {
      const facade = build();
      facade.load();

      await facade.setAvatar('data:image/png;base64,AAA');

      expect(update).toHaveBeenCalledWith('std-001', { avatarUrl: 'data:image/png;base64,AAA' });
      expect(facade.student.data()?.avatarUrl).toBe('data:image/png;base64,AAA');
    });

    it('expone el error si el puerto falla', async () => {
      update.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(await facade.saveProfile({ phone: null })).toBe(false);
      expect(facade.actionError()?.code).toBe('network');

      facade.clearActionError();
      expect(facade.actionError()).toBeNull();
    });

    it('sin sesion no guarda', async () => {
      profileId = null;

      expect(await build().saveProfile({ phone: null })).toBe(false);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('changePassword()', () => {
    it('cambia la contrasena del correo de la sesion', async () => {
      const facade = build();

      expect(await facade.changePassword('Alumno1234!', 'Nueva5678!')).toBe(true);
      expect(changePassword).toHaveBeenCalledWith(
        'alejandra@neque.cl',
        'Alumno1234!',
        'Nueva5678!',
      );
    });

    it('con la actual incorrecta expone el error', async () => {
      changePassword.mockReturnValue(throwError(() => domainError('invalid_credentials')));
      const facade = build();

      expect(await facade.changePassword('Mala1234!', 'Nueva5678!')).toBe(false);
      expect(facade.actionError()?.code).toBe('invalid_credentials');
    });

    it('sin sesion no hace nada', async () => {
      profileId = null;

      expect(await build().changePassword('a', 'b')).toBe(false);
      expect(changePassword).not.toHaveBeenCalled();
    });

    // Un doble toque no dispara dos cambios.
    it('ignora un segundo envio mientras hay uno en curso', async () => {
      const pendiente = new Subject<void>();
      changePassword.mockReturnValue(pendiente);
      const facade = build();

      void facade.changePassword('Alumno1234!', 'Nueva5678!');
      expect(await facade.changePassword('Alumno1234!', 'Nueva5678!')).toBe(false);

      expect(changePassword).toHaveBeenCalledTimes(1);
      pendiente.next();
      pendiente.complete();
    });
  });

  describe('load()', () => {
    it('consulta ambos puertos con el id de la sesion', () => {
      build().load();

      expect(getById).toHaveBeenCalledWith('std-001');
      expect(latestByStudent).toHaveBeenCalledWith('std-001');
    });

    it('no consulta nada sin sesion', () => {
      profileId = null;
      build().load();

      expect(getById).not.toHaveBeenCalled();
    });

    it('queda en success con datos', () => {
      const facade = build();
      facade.load();

      expect(facade.viewState()).toBe('success');
      expect(facade.displayName()).toBe('Alejandra Acosta');
      expect(facade.firstName()).toBe('Alejandra');
      expect(facade.avatarInitials()).toBe('AA');
    });

    it('queda en loading mientras el puerto no responde', () => {
      getById.mockReturnValue(new Subject<Student>());
      const facade = build();
      facade.load();

      expect(facade.viewState()).toBe('loading');
    });

    it('queda en error si falla la ficha', () => {
      getById.mockReturnValue(throwError(() => domainError('not_found')));
      const facade = build();
      facade.load();

      expect(facade.viewState()).toBe('error');
    });
  });

  describe('bmi()', () => {
    it('lo calcula desde la ultima evaluacion', () => {
      const facade = build();
      facade.load();

      expect(facade.bmi()?.value).toBe(21.6);
      expect(facade.bmi()?.category).toBe('normal');
    });

    it('es null sin evaluaciones', () => {
      latestByStudent.mockReturnValue(of(null));
      const facade = build();
      facade.load();

      expect(facade.bmi()).toBeNull();
      // Un alumno sin evaluaciones no rompe la pantalla.
      expect(facade.viewState()).toBe('success');
    });

    it('es null si la evaluacion trae datos invalidos', () => {
      latestByStudent.mockReturnValue(of({ ...ASSESSMENT, heightCm: 0 }));
      const facade = build();
      facade.load();

      expect(facade.bmi()).toBeNull();
    });
  });

  describe('peso y altura', () => {
    it('salen de la ultima evaluacion', () => {
      const facade = build();
      facade.load();

      expect(facade.weightKg()).toBe(58.9);
      expect(facade.heightCm()).toBe(165);
    });

    it('la altura cae a la ficha si no hay evaluacion', () => {
      latestByStudent.mockReturnValue(of(null));
      const facade = build();
      facade.load();

      expect(facade.weightKg()).toBeNull();
      expect(facade.heightCm()).toBe(165);
    });
  });

  describe('reload()', () => {
    it('vuelve a consultar ambos puertos', () => {
      const facade = build();
      facade.load();
      facade.reload();

      expect(getById).toHaveBeenCalledTimes(2);
      expect(latestByStudent).toHaveBeenCalledTimes(2);
    });
  });

  describe('estado inicial', () => {
    it('arranca vacio', () => {
      const facade = build();

      expect(facade.displayName()).toBe('');
      expect(facade.avatarInitials()).toBe('');
      expect(facade.bmi()).toBeNull();
      expect(facade.viewState()).toBe('loading');
    });
  });
});
