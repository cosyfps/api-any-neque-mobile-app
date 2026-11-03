import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { Routine, RoutineAssignment, goalsMatch } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { DomainError, toDomainError } from '@app/domain/shared/model/app-error';
import {
  addDays,
  isSameDay,
  parseIsoDate,
  startOfDay,
  startOfWeek,
  toIsoDate,
} from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Anamnesis } from '@app/domain/students/model/anamnesis.model';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student, fullName, initials } from '@app/domain/students/model/student.model';
import { ANAMNESIS_PORT } from '@app/domain/students/port/anamnesis.port';
import { ASSESSMENTS_PORT } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { adherencePercent, averagePercent } from '@app/domain/workouts/model/adherence';
import { StudentRisk, riskLabel, studentRisk } from '@app/domain/workouts/model/risk';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { SKIP_REASON_LABEL } from '@app/domain/workouts/model/workout-set.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/** Una sesion de hoy, ya resuelta con el nombre de su alumno. */
export interface TodaySession {
  readonly id: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly initials: string;
  readonly title: string;
  readonly scheduledFor: string;
  readonly estimatedMinutes: number;
}

/** Que le falta a un alumno para entrenar, en orden de urgencia. */
export type PendingKind = 'no_routine' | 'no_anamnesis' | 'no_assessment';

/** Alumno al que le falta algo que solo el entrenador resuelve. */
export interface PendingStudent {
  readonly id: string;
  readonly name: string;
  readonly kind: PendingKind;
  readonly reason: string;
}

/** Alumno en riesgo de abandonar. */
export interface RiskStudent {
  readonly id: string;
  readonly name: string;
  readonly risk: StudentRisk;
  readonly reason: string;
}

/** Algo que hizo un alumno: completar una sesion o saltar un ejercicio. */
export interface ActivityEvent {
  readonly id: string;
  readonly studentId: string;
  readonly kind: 'completed' | 'skipped';
  readonly studentName: string;
  readonly subject: string;
  readonly detail: string;
  readonly at: string;
}

/** Sesiones de la semana de todo el equipo. */
export interface TeamWeek {
  readonly completed: number;
  readonly planned: number;
}

/** Todo lo que el inicio necesita de un alumno activo, leido de una vez. */
interface StudentBoard {
  readonly student: Student;
  readonly sessions: readonly WorkoutSession[];
  readonly routine: Routine | null;
  readonly anamnesis: Anamnesis | null;
  readonly assessment: Assessment | null;
}

/** Actividad que se muestra: las ultimas 5 de las ultimas dos semanas. */
const ACTIVIDAD_MAXIMA = 5;
const ACTIVIDAD_DIAS = 14;

const PENDIENTE: Record<PendingKind, string> = {
  no_routine: 'Sin rutina asignada',
  no_anamnesis: 'Sin anamnesis',
  no_assessment: 'Sin evaluación',
};

const DIA = new Intl.DateTimeFormat('es-CL', { weekday: 'long' });

/**
 * Inicio del entrenador.
 *
 * Lee todo lo de cada alumno activo en una sola pasada y de ahi deriva cada
 * bloque: la pantalla no puede mostrar conteos que se contradigan entre si
 * porque cada uno llego en su propio momento.
 */
// Scoped a la ruta /trainer: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class TrainerHomeFacade {
  private readonly students = inject(STUDENTS_PORT);
  private readonly workouts = inject(WORKOUTS_PORT);
  private readonly routines = inject(ROUTINES_PORT);
  private readonly assessments = inject(ASSESSMENTS_PORT);
  private readonly anamnesisPort = inject(ANAMNESIS_PORT);
  private readonly session = inject(SessionFacade);
  private readonly clock = inject(CLOCK);

  private readonly _busy = signal(false);
  private readonly _actionError = signal<DomainError | null>(null);

  readonly board: AsyncState<StudentBoard[]> = asyncState<StudentBoard[]>({
    // Un entrenador sin alumnos todavia es un estado valido del inicio.
    isEmpty: () => false,
  });
  /** Biblioteca del entrenador, para asignar una rutina desde el inicio. */
  readonly library: AsyncState<Routine[]> = asyncState<Routine[]>({ isEmpty: () => false });

  readonly busy: Signal<boolean> = this._busy.asReadonly();
  readonly actionError: Signal<DomainError | null> = this._actionError.asReadonly();

  readonly viewState: Signal<ViewState> = this.board.viewState;

  readonly trainerFirstName: Signal<string> = computed(
    () => this.session.displayName().split(' ')[0] ?? '',
  );

  /** Saludo segun la hora del reloj inyectado. */
  readonly greeting: Signal<string> = computed(() => {
    const hora = this.clock.now().getHours();
    if (hora < 12) {
      return 'Buenos días';
    }
    return hora < 20 ? 'Buenas tardes' : 'Buenas noches';
  });

  readonly activeCount: Signal<number> = computed(() => (this.board.data() ?? []).length);

  /** Adherencia promedio por alumno; null si nadie tiene sesiones resueltas. */
  readonly adherence: Signal<number | null> = computed(() =>
    averagePercent((this.board.data() ?? []).map(item => adherencePercent(item.sessions))),
  );

  readonly week: Signal<TeamWeek> = computed(() => {
    const inicio = startOfWeek(this.clock.now());
    const fin = addDays(inicio, 7);
    const sesiones = (this.board.data() ?? [])
      .flatMap(item => item.sessions)
      .filter(sesion => {
        const fecha = parseIsoDate(sesion.scheduledFor);
        return fecha !== null && fecha >= inicio && fecha < fin;
      });
    return {
      completed: sesiones.filter(sesion => sesion.status === 'completed').length,
      planned: sesiones.length,
    };
  });

  readonly today: Signal<TodaySession[]> = computed(() => {
    const hoy = this.clock.now();
    return (this.board.data() ?? [])
      .flatMap(({ student, sessions }) =>
        sessions
          .filter(sesion => sesion.status !== 'completed' && this.esHoy(sesion.scheduledFor, hoy))
          .map(sesion => ({
            id: sesion.id,
            studentId: student.id,
            studentName: fullName(student),
            initials: initials(student),
            title: sesion.title,
            scheduledFor: sesion.scheduledFor,
            estimatedMinutes: sesion.estimatedMinutes,
          })),
      )
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  });

  /**
   * A quien le falta algo, una razon por alumno y la mas urgente: sin rutina
   * no tiene que hacer; sin anamnesis no se le puede planificar; sin
   * evaluacion su inicio no le muestra un IMC.
   */
  readonly pending: Signal<PendingStudent[]> = computed(() =>
    (this.board.data() ?? []).flatMap(({ student, routine, anamnesis, assessment }) => {
      const kind: PendingKind | null =
        routine === null
          ? 'no_routine'
          : anamnesis === null
            ? 'no_anamnesis'
            : assessment === null
              ? 'no_assessment'
              : null;
      return kind === null
        ? []
        : [{ id: student.id, name: fullName(student), kind, reason: PENDIENTE[kind] }];
    }),
  );

  readonly risks: Signal<RiskStudent[]> = computed(() => {
    const ahora = this.clock.now();
    return (this.board.data() ?? []).flatMap(({ student, sessions }) => {
      const risk = studentRisk(sessions, ahora);
      if (risk === null) {
        return [];
      }
      return [{ id: student.id, name: fullName(student), risk, reason: riskLabel(risk) }];
    });
  });

  /** Lo ultimo que hicieron los alumnos, de lo mas reciente a lo mas antiguo. */
  readonly activity: Signal<ActivityEvent[]> = computed(() => {
    const desde = addDays(startOfDay(this.clock.now()), -ACTIVIDAD_DIAS);
    return (this.board.data() ?? [])
      .flatMap(({ student, sessions }) => sessions.flatMap(sesion => this.eventos(student, sesion)))
      .filter(evento => {
        const fecha = parseIsoDate(evento.at);
        return fecha !== null && fecha >= desde;
      })
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, ACTIVIDAD_MAXIMA);
  });

  /** Lo que el entrenador tiene que atender: riesgos mas pendientes. */
  readonly attentionCount: Signal<number> = computed(
    () => new Set([...this.risks(), ...this.pending()].map(item => item.id)).size,
  );

  load(): void {
    const trainerId = this.session.profileId();
    if (trainerId === null) {
      return;
    }
    this.board.load(() => this.cargarTablero(trainerId));
    this.library.load(() => this.routines.listByTrainer(trainerId));
  }

  reload(): void {
    this.board.reload();
    this.library.reload();
  }

  clearActionError(): void {
    this._actionError.set(null);
  }

  /**
   * Suma el alumno a una rutina, desde hoy y sin fecha de termino.
   *
   * Se agrega a los alumnos que la rutina ya tiene: `setAssignments`
   * reemplaza la lista completa, y mandar solo el nuevo sacaria al resto.
   */
  assignRoutine(studentId: string, routineId: string): Promise<boolean> {
    const rutina = (this.library.data() ?? []).find(item => item.id === routineId);
    if (rutina === undefined || this._busy()) {
      return Promise.resolve(false);
    }
    const nueva: RoutineAssignment = {
      studentId,
      startDate: toIsoDate(startOfDay(this.clock.now())),
      endDate: null,
    };
    const lista = [...rutina.assignments.filter(item => item.studentId !== studentId), nueva];

    this._busy.set(true);
    this._actionError.set(null);
    return new Promise(resolve => {
      this.routines.setAssignments(routineId, lista).subscribe({
        next: () => {
          this._busy.set(false);
          this.reload();
          resolve(true);
        },
        error: (cause: unknown) => {
          this._actionError.set(toDomainError(cause));
          this._busy.set(false);
          resolve(false);
        },
      });
    });
  }

  /** Rutinas para asignar a un alumno: las de objetivo parecido primero. */
  routineOptions(studentId: string): { routine: Routine; suggested: boolean }[] {
    const alumno = (this.board.data() ?? []).find(item => item.student.id === studentId)?.student;
    return (this.library.data() ?? [])
      .map(routine => ({ routine, suggested: goalsMatch(routine.goal, alumno?.goal ?? null) }))
      .sort(
        (a, b) =>
          Number(b.suggested) - Number(a.suggested) ||
          a.routine.name.localeCompare(b.routine.name, 'es'),
      );
  }

  private cargarTablero(trainerId: string): Observable<StudentBoard[]> {
    return this.students.listByTrainer(trainerId).pipe(
      map(cartera => cartera.filter(student => student.status === 'active')),
      switchMap(activos =>
        activos.length === 0
          ? of<StudentBoard[]>([])
          : forkJoin(
              activos.map(student =>
                forkJoin({
                  sessions: this.workouts.listByStudent(student.id),
                  routine: this.routines.getActiveForStudent(student.id),
                  anamnesis: this.anamnesisPort.getByStudent(student.id),
                  assessment: this.assessments.latestByStudent(student.id),
                }).pipe(map(datos => ({ student, ...datos }))),
              ),
            ),
      ),
    );
  }

  private esHoy(iso: string, hoy: Date): boolean {
    const fecha = parseIsoDate(iso);
    return fecha !== null && isSameDay(fecha, hoy);
  }

  /** Una sesion completada es un evento; cada ejercicio saltado entero, otro. */
  private eventos(student: Student, sesion: WorkoutSession): ActivityEvent[] {
    const nombre = student.firstName;
    const cuando = sesion.completedAt ?? sesion.scheduledFor;
    const dia = this.dia(cuando);
    const eventos: ActivityEvent[] = [];

    if (sesion.status === 'completed') {
      const minutos = sesion.durationMinutes ?? sesion.estimatedMinutes;
      eventos.push({
        id: `${sesion.id}-done`,
        studentId: student.id,
        kind: 'completed',
        studentName: nombre,
        subject: sesion.title,
        detail: `${dia} · ${minutos} min`,
        at: cuando,
      });
    }
    for (const ejercicio of sesion.exercises) {
      if (ejercicio.skipped === true) {
        const motivo = ejercicio.skipReason
          ? SKIP_REASON_LABEL[ejercicio.skipReason]
          : 'Sin motivo';
        eventos.push({
          id: `${sesion.id}-${ejercicio.routineExerciseId}-skip`,
          studentId: student.id,
          kind: 'skipped',
          studentName: nombre,
          subject: ejercicio.name,
          detail: `${motivo} · ${dia}`,
          at: cuando,
        });
      }
    }
    return eventos;
  }

  /** "Viernes": el dia de la semana, con mayuscula inicial. */
  private dia(iso: string): string {
    const fecha = parseIsoDate(iso);
    if (fecha === null) {
      return '';
    }
    const texto = DIA.format(fecha);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
}
