import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { TrainerProfileFacade } from '@app/application/trainers/trainer-profile.facade';
import { AUTH_PORT, AuthPort } from '@app/domain/auth/port/auth.port';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { Student } from '@app/domain/students/model/student.model';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { Trainer } from '@app/domain/trainers/model/trainer.model';
import { TRAINERS_PORT, TrainersPort } from '@app/domain/trainers/port/trainers.port';
import { WorkoutSession, WorkoutStatus } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { TrainerProfilePage } from './trainer-profile.page';

const ENTRENADOR: Trainer = {
  id: 'trn-001',
  userId: 'usr-001',
  firstName: 'Kelvin',
  lastName: 'Moreno',
  email: 'kelvin@neque.cl',
  phone: null,
  avatarUrl: null,
  specialty: 'Fuerza',
  certifications: ['NSCA-CPT'],
  bio: 'Diez años entrenando.',
  joinedAt: '2025-11-02T00:00:00.000Z',
};

const alumno = (id: string, status: Student['status']): Student => ({
  id,
  trainerId: 'trn-001',
  trainerName: 'Kelvin Moreno',
  firstName: 'Alejandra',
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

const sesion = (status: WorkoutStatus): WorkoutSession => ({
  id: 'wks',
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-1',
  title: 'Sesion',
  scheduledFor: '2026-09-21T18:00:00.000Z',
  startedAt: null,
  completedAt: null,
  status,
  durationMinutes: null,
  estimatedMinutes: 45,
  exercises: [],
});

describe('TrainerProfilePage', () => {
  let page: TrainerProfilePage;
  let router: Router;
  let signOut: MockOf<SessionFacade['signOut']>;
  let update: MockOf<TrainersPort['update']>;
  let changePassword: MockOf<AuthPort['changePassword']>;

  const createPage = (
    trainer: Trainer | null = ENTRENADOR,
    cartera: Student[] = [alumno('std-001', 'active'), alumno('std-002', 'suspended')],
  ): TrainerProfilePage => {
    signOut = fn<SessionFacade['signOut']>().mockResolvedValue(undefined);
    update = fn<TrainersPort['update']>().mockImplementation(
      (_id: string, cambios: Partial<Trainer>) => of({ ...ENTRENADOR, ...cambios }),
    );
    changePassword = fn<AuthPort['changePassword']>().mockReturnValue(of(undefined));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // La pagina la declara en sus `providers`; aqui hay que darla a mano.
        TrainerProfileFacade,
        {
          provide: SessionFacade,
          useValue: {
            profileId: () => 'trn-001',
            user: () => ({ email: 'kelvin@neque.cl' }),
            signOut,
          },
        },
        {
          provide: TRAINERS_PORT,
          useValue: {
            getById: () => (trainer === null ? throwError(() => new Error('boom')) : of(trainer)),
            update,
          },
        },
        { provide: STUDENTS_PORT, useValue: { listByTrainer: () => of(cartera) } },
        { provide: ROUTINES_PORT, useValue: { listByTrainer: () => of([{ id: 'rtn-001' }]) } },
        {
          provide: WORKOUTS_PORT,
          // 2 de 3 resueltas completadas: 67%.
          useValue: {
            listByStudent: () =>
              of([
                sesion('completed'),
                sesion('completed'),
                sesion('skipped'),
                sesion('scheduled'),
              ]),
          },
        },
        { provide: AUTH_PORT, useValue: { changePassword } },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new TrainerProfilePage());
  };

  beforeEach(() => {
    page = createPage();
  });

  describe('privacidad', () => {
    it('abre la politica de privacidad y seguridad', () => {
      page.openPrivacy();

      expect(router.navigate).toHaveBeenCalledWith(['/privacidad']);
    });
  });

  describe('metricas y etiquetas', () => {
    it('cuenta las rutinas y promedia la adherencia de los alumnos activos', () => {
      expect(page.facade.routinesCount.data()).toBe(1);
      expect(page.adherenceLabel()).toBe('67%');
    });

    it('sin alumnos activos la adherencia es un guion', () => {
      page = createPage(ENTRENADOR, [alumno('std-002', 'suspended')]);

      expect(page.adherenceLabel()).toBe('—');
    });

    it('junta especialidad y certificaciones sin repetir', () => {
      page = createPage({ ...ENTRENADOR, certifications: ['NSCA-CPT', 'Fuerza', ' '] });

      expect(page.chips()).toEqual(['Fuerza', 'NSCA-CPT']);
    });
  });

  describe('editar mis datos', () => {
    it('precarga las certificaciones separadas por coma', () => {
      page.openEdit();

      expect(page.form.getRawValue()).toMatchObject({
        specialty: 'Fuerza',
        certifications: 'NSCA-CPT',
        bio: 'Diez años entrenando.',
      });
    });

    it('guarda separando las certificaciones y vaciando lo opcional', async () => {
      page.openEdit();
      page.form.patchValue({
        specialty: '  ',
        certifications: 'CrossFit L1, , Kinesiología ',
        bio: '',
      });

      await page.saveEdit();

      expect(update).toHaveBeenCalledWith('trn-001', {
        firstName: 'Kelvin',
        lastName: 'Moreno',
        phone: null,
        specialty: null,
        certifications: ['CrossFit L1', 'Kinesiología'],
        bio: null,
      });
      expect(page.editing()).toBe(false);
      expect(page.toast()).toBe('Datos guardados');
    });

    it('un apellido en blanco no se guarda', async () => {
      page.openEdit();
      page.form.patchValue({ lastName: ' ' });

      await page.saveEdit();

      expect(page.editError()).toBe('Escribe tu nombre y apellido.');
      expect(update).not.toHaveBeenCalled();
    });

    it('un telefono invalido no se guarda', async () => {
      page.openEdit();
      page.form.patchValue({ phone: 'abc' });

      await page.saveEdit();

      expect(page.editError()).toContain('teléfono');
    });
  });

  describe('foto y contraseña', () => {
    it('onPhoto() guarda la foto', async () => {
      await page.onPhoto('data:image/png;base64,AAA');

      expect(update).toHaveBeenCalledWith('trn-001', { avatarUrl: 'data:image/png;base64,AAA' });
      expect(page.facade.trainer.data()?.avatarUrl).toBe('data:image/png;base64,AAA');
    });

    it('onPhoto() avisa si falla', async () => {
      update.mockReturnValue(throwError(() => new Error('boom')));

      await page.onPhoto('data:image/png;base64,AAA');

      expect(page.photoError()).toContain('No pudimos guardar la foto');
    });

    it('savePassword() cambia la contraseña, cierra y avisa', async () => {
      page.openPassword();

      await page.savePassword({ currentPassword: 'Entrenador1!', newPassword: 'Nueva5678!' });

      expect(changePassword).toHaveBeenCalledWith('kelvin@neque.cl', 'Entrenador1!', 'Nueva5678!');
      expect(page.changingPassword()).toBe(false);
      expect(page.toast()).toBe('Contraseña cambiada');
    });

    it('closePassword() cierra la hoja', () => {
      page.openPassword();

      page.closePassword();

      expect(page.changingPassword()).toBe(false);
    });
  });

  describe('carga inicial', () => {
    it('trae el perfil del entrenador de la sesion', () => {
      expect(page.facade.viewState()).toBe('success');
      expect(page.facade.displayName()).toBe('Kelvin Moreno');
      expect(page.facade.avatarInitials()).toBe('KM');
    });

    // El conteo se deriva de la cartera: guardarlo aparte lo condena a
    // quedar desactualizado.
    it('cuenta solo los alumnos activos', () => {
      expect(page.facade.activeCount()).toBe(1);
    });

    it('un error del puerto deja la pantalla en error', () => {
      page = createPage(null);

      expect(page.facade.viewState()).toBe('error');
    });
  });

  describe('desde()', () => {
    it('formatea mes y ano en espanol', () => {
      expect(page.desde('2025-11-02T00:00:00.000Z')).toContain('noviembre');
    });
  });

  describe('cerrar sesion', () => {
    it('el sheet nace cerrado', () => {
      expect(page.confirmingSignOut()).toBe(false);
    });

    it('pide confirmacion', () => {
      page.askSignOut();

      expect(page.confirmingSignOut()).toBe(true);
      expect(signOut).not.toHaveBeenCalled();
    });

    it('cancelar no cierra la sesion', () => {
      page.askSignOut();

      page.cancelSignOut();

      expect(page.confirmingSignOut()).toBe(false);
      expect(signOut).not.toHaveBeenCalled();
    });

    it('confirmar cierra la sesion y vuelve al inicio', async () => {
      page.askSignOut();

      await page.confirmSignOut();

      expect(signOut).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/']);
      expect(page.confirmingSignOut()).toBe(false);
    });

    // Sin el guard, un doble toque dispara dos cierres.
    it('un doble toque cierra una sola vez', async () => {
      page.askSignOut();

      await Promise.all([page.confirmSignOut(), page.confirmSignOut()]);

      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('reload', () => {
    it('es un campo arrow para poder pasarlo a [retry]', () => {
      expect(() => page.reload()).not.toThrow();
    });
  });
});
