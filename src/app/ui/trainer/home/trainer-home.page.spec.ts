import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { NotificationsFacade } from '@app/application/notifications/notifications.facade';
import { PendingStudent, TrainerHomeFacade } from '@app/application/trainers/trainer-home.facade';
import { AppNotification } from '@app/domain/notifications/model/notification.model';
import {
  NOTIFICATIONS_PORT,
  NotificationsPort,
} from '@app/domain/notifications/port/notifications.port';
import { Routine } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT, RoutinesPort } from '@app/domain/routines/port/routines.port';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Anamnesis } from '@app/domain/students/model/anamnesis.model';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student } from '@app/domain/students/model/student.model';
import { ANAMNESIS_PORT } from '@app/domain/students/port/anamnesis.port';
import { ASSESSMENTS_PORT } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { TrainerHomePage } from './trainer-home.page';

const AHORA = new Date(2026, 8, 20, 9, 0, 0);

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

const sesion = (
  id: string,
  studentId: string,
  cuando: Date,
  status = 'scheduled',
): WorkoutSession =>
  ({
    id,
    studentId,
    routineId: 'rtn-001',
    routineDayId: 'day-001',
    title: 'Tren inferior',
    scheduledFor: cuando.toISOString(),
    startedAt: null,
    completedAt: null,
    status,
    durationMinutes: null,
    estimatedMinutes: 50,
    exercises: [],
  }) as WorkoutSession;

const RUTINA = { id: 'rtn-001', name: 'Hipertrofia', days: [] } as unknown as Routine;
const EVALUACION = { id: 'asm-001' } as Assessment;
const ANAMNESIS = { id: 'anm-001' } as Anamnesis;

const plantilla = (id: string, name: string, goal: string, alumnos: string[] = []): Routine => ({
  id,
  trainerId: 'trn-001',
  name,
  goal,
  days: [],
  assignments: alumnos.map(studentId => ({
    studentId,
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: null,
  })),
});

describe('TrainerHomePage', () => {
  let page: TrainerHomePage;
  let router: Router;
  let setAssignments: MockOf<RoutinesPort['setAssignments']>;

  const createPage = (
    opciones: {
      cartera?: Student[];
      sesiones?: WorkoutSession[];
      rutina?: Routine | null;
      evaluacion?: Assessment | null;
      anamnesis?: Anamnesis | null;
      biblioteca?: Routine[];
      avisos?: AppNotification[];
      falla?: boolean;
      ahora?: Date;
    } = {},
  ): TrainerHomePage => {
    const {
      cartera = [alumno('std-001', 'Alejandra')],
      sesiones = [],
      rutina = RUTINA,
      evaluacion = EVALUACION,
      anamnesis = ANAMNESIS,
      biblioteca = [],
      avisos = [],
      falla = false,
      ahora = AHORA,
    } = opciones;

    setAssignments = fn<RoutinesPort['setAssignments']>().mockReturnValue(of(RUTINA));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // La pagina la declara en sus `providers`; aqui hay que darla a mano.
        TrainerHomeFacade,
        NotificationsFacade,
        {
          provide: SessionFacade,
          useValue: {
            profileId: () => 'trn-001',
            displayName: () => 'Kelvin Moreno',
            user: () => ({ id: 'usr-trainer-001' }),
          },
        },
        {
          provide: NOTIFICATIONS_PORT,
          useValue: {
            listByUser: () => of(avisos),
            markRead: fn<NotificationsPort['markRead']>(),
            markAllRead: fn<NotificationsPort['markAllRead']>(),
          },
        },
        { provide: CLOCK, useValue: { now: () => ahora } },
        {
          provide: STUDENTS_PORT,
          useValue: {
            listByTrainer: () => (falla ? throwError(() => new Error('boom')) : of(cartera)),
          },
        },
        { provide: WORKOUTS_PORT, useValue: { listByStudent: () => of(sesiones) } },
        {
          provide: ROUTINES_PORT,
          useValue: {
            getActiveForStudent: () => of(rutina),
            listByTrainer: () => of(biblioteca),
            setAssignments,
          },
        },
        { provide: ASSESSMENTS_PORT, useValue: { latestByStudent: () => of(evaluacion) } },
        { provide: ANAMNESIS_PORT, useValue: { getByStudent: () => of(anamnesis) } },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new TrainerHomePage());
  };

  beforeEach(() => {
    page = createPage();
  });

  /** `noUncheckedIndexedAccess` obliga a comprobar que haya pendiente. */
  const primerPendiente = (): PendingStudent => {
    const item = page.facade.pending()[0];
    if (item === undefined) {
      throw new Error('sin pendientes');
    }
    return item;
  };

  describe('saludo', () => {
    it('usa el primer nombre del entrenador', () => {
      expect(page.facade.trainerFirstName()).toBe('Kelvin');
    });

    it.each([
      [new Date(2026, 8, 20, 9, 0), 'Buenos días'],
      [new Date(2026, 8, 20, 15, 0), 'Buenas tardes'],
      [new Date(2026, 8, 20, 21, 0), 'Buenas noches'],
    ])('saluda segun la hora del reloj inyectado', (ahora, esperado) => {
      page = createPage({ ahora });

      expect(page.facade.greeting()).toBe(esperado);
    });
  });

  describe('metricas', () => {
    it('cuenta solo los alumnos activos', () => {
      page = createPage({
        cartera: [alumno('std-001', 'Alejandra'), alumno('std-002', 'Diego', 'suspended')],
      });

      expect(page.facade.activeCount()).toBe(1);
    });

    it('es cero con la cartera vacia', () => {
      page = createPage({ cartera: [] });

      expect(page.facade.activeCount()).toBe(0);
      expect(page.facade.today()).toEqual([]);
      expect(page.adherenceLabel()).toBe('—');
    });

    it('promedia la adherencia por alumno', () => {
      page = createPage({
        sesiones: [
          sesion('wks-1', 'std-001', new Date(2026, 8, 14, 18), 'completed'),
          sesion('wks-2', 'std-001', new Date(2026, 8, 15, 18), 'skipped'),
        ],
      });

      expect(page.adherenceLabel()).toBe('50%');
    });

    // La semana del 14 al 20 de septiembre de 2026.
    it('cuenta las sesiones de la semana del equipo', () => {
      page = createPage({
        sesiones: [
          sesion('wks-1', 'std-001', new Date(2026, 8, 14, 18), 'completed'),
          sesion('wks-2', 'std-001', new Date(2026, 8, 16, 18), 'scheduled'),
          sesion('wks-3', 'std-001', new Date(2026, 8, 7, 18), 'completed'),
        ],
      });

      expect(page.facade.week()).toEqual({ completed: 1, planned: 2 });
    });
  });

  describe('sesiones de hoy', () => {
    it('resuelve el nombre del alumno de cada sesion', () => {
      page = createPage({ sesiones: [sesion('wks-001', 'std-001', AHORA)] });

      expect(page.facade.today()[0]).toMatchObject({
        studentName: 'Alejandra Acosta',
        initials: 'AA',
        title: 'Tren inferior',
        estimatedMinutes: 50,
      });
      expect(page.sesionesHoy()).toBe('1 sesión');
    });

    // Sin hora en el dia de rutina, la pagina muestra "Sin hora" y no el 09:00 del BFF.
    it('marca si el dia de rutina tiene hora de inicio', () => {
      page = createPage({ sesiones: [sesion('wks-001', 'std-001', AHORA)] });
      expect(page.facade.today()[0]?.hasStartTime).toBe(false);

      page = createPage({
        sesiones: [sesion('wks-001', 'std-001', AHORA)],
        rutina: {
          ...RUTINA,
          days: [{ id: 'day-001', startTime: '18:30' }],
        } as unknown as Routine,
      });
      expect(page.facade.today()[0]?.hasStartTime).toBe(true);
    });

    it('deja fuera las de otro dia', () => {
      page = createPage({ sesiones: [sesion('wks-001', 'std-001', new Date(2026, 8, 25, 18, 0))] });

      expect(page.facade.today()).toEqual([]);
    });

    // Lo ya entrenado no es pendiente del dia.
    it('deja fuera las ya completadas', () => {
      page = createPage({ sesiones: [sesion('wks-001', 'std-001', AHORA, 'completed')] });

      expect(page.facade.today()).toEqual([]);
    });

    it('no consulta sesiones sin alumnos activos', () => {
      page = createPage({ cartera: [alumno('std-001', 'Alejandra', 'suspended')] });

      expect(page.facade.today()).toEqual([]);
    });
  });

  describe('por resolver', () => {
    it('esta vacio cuando a nadie le falta nada', () => {
      expect(page.facade.pending()).toEqual([]);
      expect(page.facade.attentionCount()).toBe(0);
    });

    it('senala a quien no tiene rutina', () => {
      page = createPage({ rutina: null });

      expect(page.facade.pending()[0]).toMatchObject({
        name: 'Alejandra Acosta',
        kind: 'no_routine',
        reason: 'Sin rutina asignada',
      });
      expect(page.accion('no_routine')).toBe('Asignar');
    });

    it('senala a quien no tiene anamnesis', () => {
      page = createPage({ anamnesis: null });

      expect(page.facade.pending()[0]?.reason).toBe('Sin anamnesis');
      expect(page.accion('no_anamnesis')).toBe('Registrar');
    });

    // Sin evaluacion su Inicio no puede mostrarle un IMC.
    it('senala a quien no tiene evaluacion', () => {
      page = createPage({ evaluacion: null });

      expect(page.facade.pending()[0]?.reason).toBe('Sin evaluación');
      expect(page.accion('no_assessment')).toBe('Evaluar');
    });

    it('una razon por alumno: la rutina pesa mas que lo demas', () => {
      page = createPage({ rutina: null, anamnesis: null, evaluacion: null });

      expect(page.facade.pending()).toHaveLength(1);
      expect(page.facade.pending()[0]?.kind).toBe('no_routine');
    });
  });

  describe('en riesgo', () => {
    it('senala al alumno que no completo nada de lo agendado en la semana', () => {
      page = createPage({
        sesiones: [
          sesion('wks-1', 'std-001', new Date(2026, 8, 17, 18), 'skipped'),
          sesion('wks-2', 'std-001', new Date(2026, 8, 5, 18), 'completed'),
        ],
      });

      expect(page.facade.risks()[0]).toMatchObject({
        name: 'Alejandra Acosta',
        reason: '15 días sin entrenar',
      });
    });

    it('senala adherencia baja', () => {
      page = createPage({
        sesiones: [
          sesion('wks-1', 'std-001', new Date(2026, 8, 19, 18), 'completed'),
          sesion('wks-2', 'std-001', new Date(2026, 8, 9, 18), 'skipped'),
          sesion('wks-3', 'std-001', new Date(2026, 8, 8, 18), 'skipped'),
        ],
      });

      expect(page.facade.risks()[0]?.reason).toBe('33% de adherencia');
    });

    // Riesgo y pendiente del mismo alumno cuentan una vez en "por atender".
    it('cuenta a cada alumno una sola vez', () => {
      page = createPage({
        rutina: null,
        sesiones: [sesion('wks-1', 'std-001', new Date(2026, 8, 17, 18), 'skipped')],
      });

      expect(page.facade.risks()).toHaveLength(1);
      expect(page.facade.pending()).toHaveLength(1);
      expect(page.facade.attentionCount()).toBe(1);
    });
  });

  describe('actividad reciente', () => {
    const completada = (id: string, dia: number): WorkoutSession => ({
      ...sesion(id, 'std-001', new Date(2026, 8, dia, 18), 'completed'),
      completedAt: new Date(2026, 8, dia, 19).toISOString(),
      durationMinutes: 46,
    });

    it('muestra sesiones completadas y ejercicios saltados, lo mas reciente primero', () => {
      const conSalto: WorkoutSession = {
        ...completada('wks-2', 18),
        exercises: [
          {
            routineExerciseId: 'rex-1',
            exerciseId: 'ex-1',
            name: 'Sentadilla',
            targetSets: 3,
            targetReps: 10,
            restSeconds: 60,
            weightKg: 40,
            completedSets: 0,
            done: false,
            sets: [],
            skipped: true,
            skipReason: 'pain',
          },
        ],
      };
      page = createPage({ sesiones: [completada('wks-1', 15), conSalto] });

      const eventos = page.facade.activity();

      expect(eventos.map(evento => evento.kind)).toEqual(['completed', 'skipped', 'completed']);
      expect(eventos[1]).toMatchObject({
        studentName: 'Alejandra',
        subject: 'Sentadilla',
        detail: 'Molestia o dolor · Viernes',
      });
      expect(eventos[0]?.detail).toBe('Viernes · 46 min');
    });

    it('solo las ultimas dos semanas', () => {
      page = createPage({ sesiones: [completada('wks-1', 1)] });

      expect(page.facade.activity()).toEqual([]);
    });

    it('como maximo cinco', () => {
      page = createPage({
        sesiones: [14, 15, 16, 17, 18, 19].map(dia => completada(`wks-${dia}`, dia)),
      });

      expect(page.facade.activity()).toHaveLength(5);
    });
  });

  describe('acciones directas', () => {
    it('sin anamnesis abre la ficha con la hoja de anamnesis', () => {
      page = createPage({ anamnesis: null });

      page.resolve(primerPendiente());

      expect(router.navigate).toHaveBeenCalledWith(['/trainer/students', 'std-001'], {
        queryParams: { accion: 'anamnesis' },
      });
    });

    it('sin evaluacion abre la ficha con la hoja de evaluacion', () => {
      page = createPage({ evaluacion: null });

      page.resolve(primerPendiente());

      expect(router.navigate).toHaveBeenCalledWith(['/trainer/students', 'std-001'], {
        queryParams: { accion: 'evaluacion' },
      });
    });

    describe('asignar rutina', () => {
      const biblioteca = [
        plantilla('rtn-002', 'Resistencia', 'Correr 10k'),
        plantilla('rtn-001', 'Hipertrofia', 'Ganar masa muscular', ['std-009']),
      ];

      beforeEach(() => {
        page = createPage({
          rutina: null,
          biblioteca,
          cartera: [{ ...alumno('std-001', 'Alejandra'), goal: 'Ganar masa' }],
        });
        page.resolve(primerPendiente());
      });

      it('abre la hoja con la sugerida primero y preseleccionada', () => {
        expect(page.assigning()?.id).toBe('std-001');
        expect(page.options().map(opcion => opcion.routine.id)).toEqual(['rtn-001', 'rtn-002']);
        expect(page.options()[0]?.suggested).toBe(true);
        expect(page.selected()).toBe('rtn-001');
      });

      // setAssignments reemplaza la lista: mandar solo el nuevo sacaria al resto.
      it('suma al alumno sin sacar a los que ya la hacen', async () => {
        await page.confirmAssign();

        expect(setAssignments).toHaveBeenCalledWith('rtn-001', [
          expect.objectContaining({ studentId: 'std-009' }),
          expect.objectContaining({ studentId: 'std-001', endDate: null }),
        ]);
        expect(page.assigning()).toBeNull();
      });

      it('si falla deja la hoja abierta con el error', async () => {
        setAssignments.mockReturnValue(throwError(() => new Error('boom')));

        await page.confirmAssign();

        expect(page.assigning()).not.toBeNull();
        expect(page.facade.actionError()).not.toBeNull();
      });

      it('closeAssign() cierra sin asignar', async () => {
        page.closeAssign();
        await page.confirmAssign();

        expect(setAssignments).not.toHaveBeenCalled();
      });
    });

    it('sin rutinas en la biblioteca no hay nada que preseleccionar', () => {
      page = createPage({ rutina: null });

      page.resolve(primerPendiente());

      expect(page.options()).toEqual([]);
      expect(page.selected()).toBeNull();
    });
  });

  describe('estado de la pantalla', () => {
    it('es success con la cartera cargada', () => {
      expect(page.facade.viewState()).toBe('success');
    });

    it('una cartera vacia no es un vacio que ocultar', () => {
      page = createPage({ cartera: [] });

      expect(page.facade.viewState()).toBe('success');
    });

    it('propaga el error del puerto', () => {
      page = createPage({ falla: true });

      expect(page.facade.viewState()).toBe('error');
    });
  });

  describe('navegacion', () => {
    it('abre la ficha del alumno', () => {
      page.openStudent('std-001');

      expect(router.navigate).toHaveBeenCalledWith(['/trainer/students', 'std-001']);
    });

    it('el atajo de alta lleva a la cartera', () => {
      page.goToStudents();

      expect(router.navigate).toHaveBeenCalledWith(['/trainer/students']);
    });

    it('el atajo de rutina lleva a rutinas', () => {
      page.goToRoutines();

      expect(router.navigate).toHaveBeenCalledWith(['/trainer/routines']);
    });
  });

  describe('goToAgenda()', () => {
    it('abre la agenda global', () => {
      page.goToAgenda();

      expect(router.navigate).toHaveBeenCalledWith(['/trainer/agenda']);
    });
  });

  describe('hora()', () => {
    it('formatea en hora local', () => {
      expect(page.hora(new Date(2026, 8, 20, 18, 30).toISOString())).toBe('18:30');
    });

    it('usa 24 horas, sin a.m. ni p.m.', () => {
      expect(page.hora(new Date(2026, 8, 20, 9, 0).toISOString())).toBe('09:00');
    });
  });

  describe('campana', () => {
    const aviso = (id: string, leido: boolean): AppNotification => ({
      id,
      userId: 'usr-trainer-001',
      kind: 'alert',
      title: 'Alejandra saltó un ejercicio',
      body: 'Sentadilla · Molestia o dolor',
      createdAt: AHORA.toISOString(),
      readAt: leido ? AHORA.toISOString() : null,
      targetType: 'student',
      targetId: 'std-001',
    });

    it('sin nada sin leer se llama solo Notificaciones', () => {
      expect(page.bellLabel()).toBe('Notificaciones');
    });

    it('nombra cuantas hay sin leer', () => {
      page = createPage({ avisos: [aviso('n1', false), aviso('n2', false), aviso('n3', true)] });

      expect(page.notifications.unreadCount()).toBe(2);
      expect(page.bellLabel()).toBe('Notificaciones, 2 sin leer');
    });

    it('en singular con una', () => {
      page = createPage({ avisos: [aviso('n1', false)] });

      expect(page.bellLabel()).toBe('Notificaciones, 1 sin leer');
    });

    it('la campana y Ver todo llevan a notificaciones', () => {
      page.goToNotifications();

      expect(router.navigate).toHaveBeenCalledWith(['/trainer/notifications']);
    });
  });

  describe('reload', () => {
    it('es un campo arrow para poder pasarlo a [retry]', () => {
      expect(() => page.reload()).not.toThrow();
    });
  });
});
