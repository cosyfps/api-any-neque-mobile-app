import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { MonthCell, buildMonthGrid } from '@app/domain/schedule/model/month-grid';
import {
  SCHEDULE_STATUS_LABEL,
  SESSION_KIND_LABEL,
  ScheduledSession,
} from '@app/domain/schedule/model/scheduled-session.model';
import { SCHEDULE_PORT } from '@app/domain/schedule/port/schedule.port';
import {
  addMonths,
  isSameDay,
  monthRange,
  parseIsoDate,
  startOfDay,
} from '@app/domain/shared/model/date';
import { DateRange } from '@app/domain/shared/model/date-range';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Student, fullName } from '@app/domain/students/model/student.model';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

const MONTH_LABEL = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' });

/** Lo que el entrenador tiene en un dia: una cita o un entrenamiento de rutina. */
export interface AgendaItem {
  readonly id: string;
  readonly type: 'appointment' | 'training';
  readonly studentId: string;
  readonly studentName: string;
  readonly title: string;
  /** ISO del inicio; ordena el dia. */
  readonly startsAt: string;
  /** False en entrenamientos de un dia de rutina sin hora: `startsAt` solo fija el dia. */
  readonly hasTime: boolean;
  /** Tipo de cita o "Rutina"; va bajo el titulo. */
  readonly detail: string;
  /** Estado legible ("Por confirmar", "Completada"...). */
  readonly status: string;
  readonly tone: 'success' | 'warning' | 'danger' | 'neutral';
}

/** Mes de la agenda: citas de todos los alumnos y sus entrenamientos. */
interface AgendaData {
  readonly students: readonly Student[];
  readonly appointments: readonly ScheduledSession[];
  readonly workouts: readonly WorkoutSession[];
  /** Ids de dias de rutina que tienen hora de inicio. */
  readonly timedDays: ReadonlySet<string>;
}

const WORKOUT_STATUS: Record<
  WorkoutSession['status'],
  { label: string; tone: AgendaItem['tone'] }
> = {
  scheduled: { label: 'Planificado', tone: 'neutral' },
  in_progress: { label: 'En curso', tone: 'warning' },
  completed: { label: 'Completado', tone: 'success' },
  skipped: { label: 'Omitido', tone: 'danger' },
};

/**
 * Agenda global del entrenador (T-1).
 *
 * Junta en un calendario las citas de toda la cartera y los entrenamientos
 * de rutina de cada alumno activo, para ver el dia completo sin entrar
 * ficha por ficha.
 */
// Scoped a la ruta /trainer: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class TrainerAgendaFacade {
  private readonly session = inject(SessionFacade);
  private readonly students = inject(STUDENTS_PORT);
  private readonly schedule = inject(SCHEDULE_PORT);
  private readonly workouts = inject(WORKOUTS_PORT);
  private readonly routines = inject(ROUTINES_PORT);
  private readonly clock = inject(CLOCK);

  private readonly _month = signal(startOfDay(this.clock.now()));
  private readonly _selectedDay = signal<Date | null>(startOfDay(this.clock.now()));

  readonly data: AsyncState<AgendaData> = asyncState<AgendaData>({ isEmpty: () => false });

  readonly month: Signal<Date> = this._month.asReadonly();
  readonly selectedDay: Signal<Date | null> = this._selectedDay.asReadonly();
  readonly viewState: Signal<ViewState> = this.data.viewState;

  readonly monthLabel: Signal<string> = computed(() => {
    const label = MONTH_LABEL.format(this._month());
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  });

  readonly grid: Signal<MonthCell[][]> = computed(() => {
    const month = this._month();
    return buildMonthGrid(month.getFullYear(), month.getMonth(), this.clock.now());
  });

  /** Todo el mes como items de agenda, ordenados por hora. */
  readonly items: Signal<readonly AgendaItem[]> = computed(() => {
    const data = this.data.data();
    if (data === null) {
      return [];
    }
    const nombres = new Map(data.students.map(student => [student.id, fullName(student)]));
    const citas = data.appointments.map(
      (cita): AgendaItem => ({
        id: cita.id,
        type: 'appointment',
        studentId: cita.studentId,
        studentName: nombres.get(cita.studentId) ?? 'Alumno',
        title: cita.title,
        startsAt: cita.startsAt,
        hasTime: true,
        detail: SESSION_KIND_LABEL[cita.kind],
        status: SCHEDULE_STATUS_LABEL[cita.status],
        tone:
          cita.status === 'confirmed'
            ? 'success'
            : cita.status === 'cancelled'
              ? 'danger'
              : 'warning',
      }),
    );
    const entrenos = data.workouts.map(
      (sesion): AgendaItem => ({
        id: sesion.id,
        type: 'training',
        studentId: sesion.studentId,
        studentName: nombres.get(sesion.studentId) ?? 'Alumno',
        title: sesion.title,
        startsAt: sesion.scheduledFor,
        hasTime: data.timedDays.has(sesion.routineDayId),
        detail: `Rutina · ${sesion.estimatedMinutes} min`,
        status: WORKOUT_STATUS[sesion.status].label,
        tone: WORKOUT_STATUS[sesion.status].tone,
      }),
    );
    return [...citas, ...entrenos].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  });

  /** Items del dia seleccionado (o de hoy). */
  readonly dayItems: Signal<readonly AgendaItem[]> = computed(() => {
    const dia = this._selectedDay() ?? this.clock.now();
    return this.items().filter(item => this.mismoDia(item.startsAt, dia));
  });

  /** Para el punto del calendario: hay algo ese dia. */
  hasItems(date: Date): boolean {
    return this.items().some(item => this.mismoDia(item.startsAt, date));
  }

  load(): void {
    this._month.set(startOfDay(this.clock.now()));
    this._selectedDay.set(startOfDay(this.clock.now()));
    this.fetch();
  }

  reload(): void {
    this.data.reload();
  }

  nextMonth(): void {
    this._month.update(value => addMonths(value, 1));
    this._selectedDay.set(null);
    this.fetch();
  }

  prevMonth(): void {
    this._month.update(value => addMonths(value, -1));
    this._selectedDay.set(null);
    this.fetch();
  }

  selectDay(date: Date): void {
    this._selectedDay.set(startOfDay(date));
  }

  private fetch(): void {
    const trainerId = this.session.profileId();
    if (trainerId === null) {
      return;
    }
    const range = monthRange(this._month());
    this.data.load(() => this.cargar(trainerId, range));
  }

  /** Cartera activa, citas del mes y entrenamientos del mes de cada alumno. */
  private cargar(trainerId: string, range: DateRange): Observable<AgendaData> {
    return this.students.listByTrainer(trainerId).pipe(
      map(cartera => cartera.filter(student => student.status === 'active')),
      switchMap(activos =>
        forkJoin({
          students: of(activos),
          appointments: this.schedule.listByTrainer(trainerId, range),
          porAlumno:
            activos.length === 0
              ? of([])
              : forkJoin(
                  activos.map(student =>
                    forkJoin({
                      workouts: this.workouts.listByStudent(student.id, range),
                      routine: this.routines.getActiveForStudent(student.id),
                    }),
                  ),
                ),
        }),
      ),
      map(({ students, appointments, porAlumno }) => ({
        students,
        appointments,
        workouts: porAlumno.flatMap(item => item.workouts),
        timedDays: new Set(
          porAlumno.flatMap(item =>
            (item.routine?.days ?? []).filter(day => Boolean(day.startTime)).map(day => day.id),
          ),
        ),
      })),
    );
  }

  private mismoDia(iso: string, dia: Date): boolean {
    const fecha = parseIsoDate(iso);
    return fecha !== null && isSameDay(fecha, dia);
  }
}
