import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { NotificationsFacade } from '@app/application/notifications/notifications.facade';
import { StudentProfileFacade } from '@app/application/students/student-profile.facade';
import { AUTH_PORT, AuthPort } from '@app/domain/auth/port/auth.port';
import {
  NOTIFICATIONS_PORT,
  NotificationsPort,
} from '@app/domain/notifications/port/notifications.port';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student } from '@app/domain/students/model/student.model';
import { ASSESSMENTS_PORT, AssessmentsPort } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT, StudentsPort } from '@app/domain/students/port/students.port';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { StudentProfilePage } from './student-profile.page';

const NOW = new Date('2026-09-17T10:00:00.000Z');

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
  id: 'asm-001',
  studentId: 'std-001',
  takenAt: '2026-09-07T10:00:00.000Z',
  weightKg: 58.9,
  heightCm: 165,
  bodyFatPct: null,
  muscleMassKg: null,
  measurements: { chestCm: null, waistCm: null, hipCm: null, armCm: null, thighCm: null },
  notes: null,
};

describe('StudentProfilePage', () => {
  let page: StudentProfilePage;
  let router: Router;
  let signOut: MockOf<SessionFacade['signOut']>;
  let update: MockOf<StudentsPort['update']>;
  let changePassword: MockOf<AuthPort['changePassword']>;

  const createPage = (): StudentProfilePage => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        StudentProfileFacade,
        NotificationsFacade,
        { provide: CLOCK, useValue: { now: () => NOW } },
        {
          provide: SessionFacade,
          useValue: {
            profileId: () => 'std-001',
            user: () => ({ id: 'usr-1', email: 'alejandra@neque.cl' }),
            signOut,
          },
        },
        {
          provide: STUDENTS_PORT,
          useValue: {
            getById: () => of(STUDENT),
            listByTrainer: fn<StudentsPort['listByTrainer']>(),
            update,
          },
        },
        {
          provide: ASSESSMENTS_PORT,
          useValue: {
            latestByStudent: () => of(ASSESSMENT),
            listByStudent: () => of([ASSESSMENT]),
            create: fn<AssessmentsPort['create']>(),
          },
        },
        { provide: WORKOUTS_PORT, useValue: { listByStudent: () => of([]) } },
        { provide: AUTH_PORT, useValue: { changePassword } },
        {
          provide: NOTIFICATIONS_PORT,
          useValue: {
            listByUser: () => of([]),
            markRead: fn<NotificationsPort['markRead']>(),
            markAllRead: fn<NotificationsPort['markAllRead']>(),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new StudentProfilePage());
  };

  beforeEach(() => {
    jest.useFakeTimers();
    signOut = fn<SessionFacade['signOut']>().mockResolvedValue(undefined);
    update = fn<StudentsPort['update']>().mockImplementation(
      (_id: string, cambios: Partial<Student>) => of({ ...STUDENT, ...cambios }),
    );
    changePassword = fn<AuthPort['changePassword']>().mockReturnValue(of(undefined));
    page = createPage();
  });

  afterEach(() => jest.useRealTimers());

  describe('estado inicial', () => {
    it('carga la ficha del alumno', () => {
      expect(page.facade.viewState()).toBe('success');
      expect(page.facade.displayName()).toBe('Alejandra Acosta');
    });

    it('muestra las medidas con coma decimal', () => {
      expect(page.decimal(page.facade.weightKg())).toBe('58,9');
      expect(page.decimal(page.facade.bmi()?.value ?? null)).toBe('21,6');
      expect(page.decimal(null)).toBe('—');
    });

    it('sin racha invita a empezarla', () => {
      expect(page.streakTitle()).toBe('Empieza tu racha');
      expect(page.streakDesc()).toContain('primera');
    });

    it('arranca sin confirmacion de cierre', () => {
      expect(page.confirmingSignOut()).toBe(false);
      expect(page.signingOut()).toBe(false);
    });
  });

  describe('formatDate()', () => {
    it('formatea la fecha de ingreso', () => {
      expect(page.formatDate(STUDENT.joinedAt)).toContain('2026');
    });
  });

  describe('go()', () => {
    it('navega a la ruta indicada', () => {
      page.go('/student/schedule');

      expect(router.navigate).toHaveBeenCalledWith(['/student/schedule']);
    });
  });

  describe('editar mis datos', () => {
    it('openEdit() precarga los datos actuales', () => {
      page.openEdit();

      expect(page.editing()).toBe(true);
      expect(page.form.getRawValue()).toEqual({
        firstName: 'Alejandra',
        lastName: 'Acosta',
        phone: '',
      });
    });

    it('un nombre en blanco no se guarda', async () => {
      page.openEdit();
      page.form.patchValue({ firstName: '   ' });

      await page.saveEdit();

      expect(page.editError()).toBe('Escribe tu nombre y apellido.');
      expect(update).not.toHaveBeenCalled();
    });

    it('un telefono con letras no se guarda', async () => {
      page.openEdit();
      page.form.patchValue({ phone: '12ab' });

      await page.saveEdit();

      expect(page.editError()).toContain('teléfono');
      expect(update).not.toHaveBeenCalled();
    });

    it('guarda recortado, cierra y avisa', async () => {
      page.openEdit();
      page.form.patchValue({ lastName: ' Rivas ', phone: '+56 9 5555 1234' });

      await page.saveEdit();

      expect(update).toHaveBeenCalledWith('std-001', {
        firstName: 'Alejandra',
        lastName: 'Rivas',
        phone: '+56 9 5555 1234',
      });
      expect(page.editing()).toBe(false);
      expect(page.toast()).toBe('Datos guardados');

      jest.advanceTimersByTime(3000);
      expect(page.toast()).toBeNull();
    });

    it('un telefono vacio se guarda como null', async () => {
      page.openEdit();

      await page.saveEdit();

      expect(update).toHaveBeenCalledWith('std-001', expect.objectContaining({ phone: null }));
    });

    it('closeEdit() cierra sin guardar', () => {
      page.openEdit();

      page.closeEdit();

      expect(page.editing()).toBe(false);
    });
  });

  describe('foto de perfil', () => {
    it('onPhoto() guarda la foto', async () => {
      await page.onPhoto('data:image/png;base64,AAA');

      expect(update).toHaveBeenCalledWith('std-001', { avatarUrl: 'data:image/png;base64,AAA' });
      expect(page.savingPhoto()).toBe(false);
      expect(page.photoError()).toBeNull();
    });

    it('si falla lo avisa', async () => {
      update.mockReturnValue(throwError(() => new Error('boom')));

      await page.onPhoto('data:image/png;base64,AAA');

      expect(page.photoError()).toBe('No pudimos guardar la foto. Intenta de nuevo.');
    });
  });

  describe('cambiar contraseña', () => {
    it('abre y cierra la hoja', () => {
      page.openPassword();
      expect(page.changingPassword()).toBe(true);

      page.closePassword();
      expect(page.changingPassword()).toBe(false);
    });

    it('guarda, cierra y avisa', async () => {
      page.openPassword();

      await page.savePassword({ currentPassword: 'Alumno1234!', newPassword: 'Nueva5678!' });

      expect(changePassword).toHaveBeenCalledWith(
        'alejandra@neque.cl',
        'Alumno1234!',
        'Nueva5678!',
      );
      expect(page.changingPassword()).toBe(false);
      expect(page.toast()).toBe('Contraseña cambiada');
    });

    it('si la actual es incorrecta deja la hoja abierta', async () => {
      changePassword.mockReturnValue(throwError(() => new Error('boom')));
      page.openPassword();

      await page.savePassword({ currentPassword: 'Mala1234!', newPassword: 'Nueva5678!' });

      expect(page.changingPassword()).toBe(true);
    });
  });

  describe('cierre de sesion', () => {
    it('askSignOut() abre la confirmacion', () => {
      page.askSignOut();

      expect(page.confirmingSignOut()).toBe(true);
    });

    it('cancelSignOut() la cierra sin cerrar sesion', () => {
      page.askSignOut();

      page.cancelSignOut();

      expect(page.confirmingSignOut()).toBe(false);
      expect(signOut).not.toHaveBeenCalled();
    });

    it('confirmSignOut() cierra sesion y vuelve a la raiz', async () => {
      page.askSignOut();

      await page.confirmSignOut();

      expect(signOut).toHaveBeenCalledTimes(1);
      expect(page.confirmingSignOut()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('ignora un segundo intento mientras hay uno en curso', async () => {
      page.signingOut.set(true);

      await page.confirmSignOut();

      expect(signOut).not.toHaveBeenCalled();
    });
  });

  describe('reload', () => {
    it('es un campo arrow invocable', () => {
      expect(() => page.reload()).not.toThrow();
    });
  });
});
