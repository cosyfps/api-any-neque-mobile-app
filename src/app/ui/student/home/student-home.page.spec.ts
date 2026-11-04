import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { NotificationsFacade } from '@app/application/notifications/notifications.facade';
import { StudentProfileFacade } from '@app/application/students/student-profile.facade';
import { WorkoutFacade } from '@app/application/workouts/workout.facade';
import { AUTH_PORT, AuthPort } from '@app/domain/auth/port/auth.port';
import { AppNotification } from '@app/domain/notifications/model/notification.model';
import {
  NOTIFICATIONS_PORT,
  NotificationsPort,
} from '@app/domain/notifications/port/notifications.port';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { toIsoDate } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student } from '@app/domain/students/model/student.model';
import { ASSESSMENTS_PORT, AssessmentsPort } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT, StudentsPort } from '@app/domain/students/port/students.port';
import { Trainer } from '@app/domain/trainers/model/trainer.model';
import { TRAINERS_PORT, TrainersPort } from '@app/domain/trainers/port/trainers.port';
import { WorkoutSession, WorkoutStatus } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn } from '@testing/typed-mock';

import { StudentHomePage } from './student-home.page';

const NOW = new Date(2026, 8, 17, 10, 0, 0);

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
  goal: null,
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

const session = (id: string, date: Date, status: WorkoutStatus): WorkoutSession => ({
  id,
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-001',
  title: 'Tracción',
  scheduledFor: toIsoDate(date),
  startedAt: null,
  completedAt: null,
  status,
  durationMinutes: status === 'completed' ? 48 : null,
  estimatedMinutes: 50,
  exercises: [],
});

const SESSIONS: WorkoutSession[] = [
  session('s1', new Date(2026, 8, 14, 18), 'completed'),
  session('s2', new Date(2026, 8, 17, 18), 'scheduled'),
  session('s3', new Date(2026, 8, 18, 18), 'scheduled'),
  session('s4', new Date(2026, 8, 21, 18), 'scheduled'),
  session('s5', new Date(2026, 8, 22, 18), 'scheduled'),
];

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

describe('StudentHomePage', () => {
  let page: StudentHomePage;
  let router: Router;

  const createPage = (
    sessions: WorkoutSession[] = SESSIONS,
    notifications: AppNotification[] = [],
    now: Date = NOW,
  ): StudentHomePage => {
    // Permite reconfigurar dentro de un test que ya instancio el TestBed.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        StudentProfileFacade,
        WorkoutFacade,
        NotificationsFacade,
        { provide: CLOCK, useValue: { now: () => now } },
        // El perfil lo pide para cambiar la contrasena; el home no lo usa.
        { provide: AUTH_PORT, useValue: { changePassword: fn<AuthPort['changePassword']>() } },
        {
          provide: TRAINERS_PORT,
          useValue: { getById: getTrainer, update: fn<TrainersPort['update']>() },
        },
        {
          provide: SessionFacade,
          useValue: { profileId: () => 'std-001', user: () => ({ id: 'usr-1' }) },
        },
        {
          provide: STUDENTS_PORT,
          useValue: {
            getById: () => of(STUDENT),
            listByTrainer: fn<StudentsPort['listByTrainer']>(),
            update: fn<StudentsPort['update']>(),
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
        {
          provide: ROUTINES_PORT,
          useValue: { getActiveForStudent: () => of({ id: 'rtn-001', days: [] }) },
        },
        {
          provide: WORKOUTS_PORT,
          useValue: {
            listByStudent: () => of(sessions),
            getById: fn<WorkoutsPort['getById']>(),
            start: fn<WorkoutsPort['start']>(),
            markExercise: fn<WorkoutsPort['markExercise']>(),
            logSet: fn<WorkoutsPort['logSet']>(),
            complete: fn<WorkoutsPort['complete']>(),
          },
        },
        {
          provide: NOTIFICATIONS_PORT,
          useValue: {
            listByUser: () => of(notifications),
            markRead: fn<NotificationsPort['markRead']>(),
            markAllRead: fn<NotificationsPort['markAllRead']>(),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new StudentHomePage());
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    page = createPage();
  });

  afterEach(() => jest.useRealTimers());

  describe('carga inicial', () => {
    it('queda en success con la ficha del alumno', () => {
      expect(page.profile.viewState()).toBe('success');
      expect(page.profile.firstName()).toBe('Alejandra');
    });

    it('calcula el IMC desde la evaluacion', () => {
      expect(page.profile.bmi()?.value).toBe(21.6);
    });
  });

  describe('todaySession()', () => {
    it('encuentra la sesion de hoy', () => {
      expect(page.todaySession()?.id).toBe('s2');
    });

    it('es null en un dia de descanso', () => {
      page = createPage([SESSIONS[0] as WorkoutSession]);
      expect(page.todaySession()).toBeNull();
    });
  });

  describe('upcoming()', () => {
    it('excluye la sesion de hoy', () => {
      expect(page.upcoming().map(item => item.id)).not.toContain('s2');
    });

    it('muestra como maximo tres', () => {
      expect(page.upcoming().length).toBeLessThanOrEqual(3);
    });
  });

  describe('weeklyBars()', () => {
    it('devuelve siete barras', () => {
      expect(page.weeklyBars()).toHaveLength(7);
    });

    it('usa las iniciales de los dias', () => {
      expect(page.weeklyBars().map(bar => bar.label)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    });

    it('resalta el dia de hoy', () => {
      expect(page.weeklyBars().filter(bar => bar.highlighted)).toHaveLength(1);
    });

    it('describe el resumen en texto para lectores de pantalla', () => {
      expect(page.weeklyAria()).toContain('esta semana');
    });
  });

  describe('greeting()', () => {
    // La hora sale del puerto CLOCK, no del reloj del sistema: asi el saludo
    // es determinista y el mismo puerto sirve cuando llegue el BFF.
    it.each([
      [new Date(2026, 8, 17, 8), 'Buenos días'],
      [new Date(2026, 8, 17, 14), 'Buenas tardes'],
      [new Date(2026, 8, 17, 21), 'Buenas noches'],
    ])('a las %s saluda correctamente', (date, expected) => {
      expect(createPage(SESSIONS, [], date).greeting()).toBe(expected);
    });
  });

  describe('bellLabel()', () => {
    it('dice solo "Notificaciones" cuando no hay sin leer', () => {
      expect(page.bellLabel()).toBe('Notificaciones');
    });

    it('incluye el contador de no leidas', () => {
      const unread: AppNotification[] = [
        {
          id: 'n1',
          userId: 'usr-1',
          kind: 'message',
          title: 'Hola',
          body: 'Mensaje',
          createdAt: NOW.toISOString(),
          readAt: null,
          targetType: null,
          targetId: null,
        },
      ];
      const withUnread = createPage(SESSIONS, unread);

      expect(withUnread.bellLabel()).toBe('Notificaciones, 1 sin leer');
    });
  });

  describe('formato de metadatos', () => {
    it('describe una sesion completada con duracion y ejercicios', () => {
      expect(page.completedMeta(SESSIONS[0] as WorkoutSession)).toBe('48 min · 0 ejercicios');
    });

    it('describe una proxima sesion con fecha capitalizada', () => {
      const meta = page.upcomingMeta(SESSIONS[2] as WorkoutSession);
      expect(meta.charAt(0)).toBe(meta.charAt(0).toUpperCase());
    });

    // Sin hora en la rutina, la proxima sesion se anuncia solo con el dia.
    it('sin hora en la rutina, la proxima sesion muestra solo el dia', () => {
      const meta = page.upcomingMeta(SESSIONS[2] as WorkoutSession);
      expect(meta).not.toContain(':');
    });

    it('calcula el avance de una sesion', () => {
      expect(page.progressOf(SESSIONS[1] as WorkoutSession)).toBe(0);
    });

    it('traduce la categoria de IMC', () => {
      expect(page.categoryLabel('normal')).toBe('Peso normal');
    });
  });

  describe('navegacion', () => {
    it.each([
      ['goToRoutine', '/student/routine'],
      ['goToNotifications', '/student/notifications'],
      ['goToSchedule', '/student/schedule'],
    ])('%s navega a %s', (method, path) => {
      page[method as 'goToRoutine' | 'goToNotifications' | 'goToSchedule']();
      expect(router.navigate).toHaveBeenCalledWith([path]);
    });
  });

  describe('reload', () => {
    it('es un campo arrow para poder pasarlo a [retry]', () => {
      expect(typeof page.reload).toBe('function');
      expect(() => page.reload()).not.toThrow();
    });
  });
});
