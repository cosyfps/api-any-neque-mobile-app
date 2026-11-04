import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { Routine } from '@app/domain/routines/model/routine.model';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import {
  ScheduledSession,
  ScheduledSessionInput,
} from '@app/domain/schedule/model/scheduled-session.model';
import { SCHEDULE_PORT } from '@app/domain/schedule/port/schedule.port';
import { DomainError, toDomainError } from '@app/domain/shared/model/app-error';
import { addDays } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Anamnesis, AnamnesisInput } from '@app/domain/students/model/anamnesis.model';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student, fullName, initials } from '@app/domain/students/model/student.model';
import { ANAMNESIS_PORT } from '@app/domain/students/port/anamnesis.port';
import { ASSESSMENTS_PORT } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT, StudentEditableFields } from '@app/domain/students/port/students.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/**
 * Ficha completa de un alumno, desde la vista del entrenador.
 *
 * Cada bloque tiene su propio `AsyncState`: que falte la anamnesis no puede
 * dejar la ficha entera en vacio, y que fallen las evaluaciones no puede
 * ocultar los datos de contacto.
 */
// Scoped a la ruta /trainer: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class TrainerStudentDetailFacade {
  private readonly students = inject(STUDENTS_PORT);
  private readonly anamnesisPort = inject(ANAMNESIS_PORT);
  private readonly assessmentsPort = inject(ASSESSMENTS_PORT);
  private readonly routines = inject(ROUTINES_PORT);
  private readonly schedulePort = inject(SCHEDULE_PORT);
  private readonly clock = inject(CLOCK);

  private readonly _studentId = signal<string | null>(null);
  private readonly _busy = signal(false);
  private readonly _actionError = signal<DomainError | null>(null);

  readonly student: AsyncState<Student> = asyncState<Student>();
  readonly anamnesis: AsyncState<Anamnesis | null> = asyncState<Anamnesis | null>({
    // Un alumno sin anamnesis registrada es un estado valido, no un vacio.
    isEmpty: () => false,
  });
  readonly assessments: AsyncState<Assessment[]> = asyncState<Assessment[]>();
  readonly routine: AsyncState<Routine | null> = asyncState<Routine | null>({
    isEmpty: () => false,
  });
  /** Citas de hoy en adelante (90 dias), de la mas cercana a la mas lejana. */
  readonly appointments: AsyncState<ScheduledSession[]> = asyncState<ScheduledSession[]>({
    isEmpty: () => false,
  });

  readonly studentId: Signal<string | null> = this._studentId.asReadonly();
  readonly busy: Signal<boolean> = this._busy.asReadonly();
  readonly actionError: Signal<DomainError | null> = this._actionError.asReadonly();

  readonly viewState: Signal<ViewState> = this.student.viewState;

  readonly displayName: Signal<string> = computed(() => {
    const value = this.student.data();
    return value === null ? '' : fullName(value);
  });

  readonly avatarInitials: Signal<string> = computed(() => {
    const value = this.student.data();
    return value === null ? '' : initials(value);
  });

  readonly suspended: Signal<boolean> = computed(() => this.student.data()?.status === 'suspended');

  /** Evaluaciones de la mas reciente a la mas antigua. */
  readonly assessmentHistory: Signal<Assessment[]> = computed(() =>
    [...(this.assessments.data() ?? [])].sort((a, b) => b.takenAt.localeCompare(a.takenAt)),
  );

  readonly latestAssessment: Signal<Assessment | null> = computed(
    () => this.assessmentHistory()[0] ?? null,
  );

  load(studentId: string): void {
    this._studentId.set(studentId);
    this._actionError.set(null);
    this.student.load(() => this.students.getById(studentId));
    this.anamnesis.load(() => this.anamnesisPort.getByStudent(studentId));
    this.assessments.load(() => this.assessmentsPort.listByStudent(studentId));
    this.routine.load(() => this.routines.getActiveForStudent(studentId));
    this.appointments.load(() => this.schedulePort.listByStudent(studentId, this.proximos()));
  }

  reload(): void {
    this.student.reload();
    this.anamnesis.reload();
    this.assessments.reload();
    this.routine.reload();
    this.appointments.reload();
  }

  /** Corrige los datos de la ficha. Devuelve si el puerto acepto. */
  edit(changes: Partial<StudentEditableFields>): Promise<boolean> {
    const studentId = this._studentId();
    if (studentId === null) {
      return Promise.resolve(false);
    }
    return this.run(() => this.students.edit(studentId, changes));
  }

  /** Registra o actualiza la anamnesis. Es unica por alumno. */
  saveAnamnesis(input: Omit<AnamnesisInput, 'studentId'>): Promise<boolean> {
    const studentId = this._studentId();
    if (studentId === null || this._busy()) {
      return Promise.resolve(false);
    }

    this._busy.set(true);
    this._actionError.set(null);

    return new Promise(resolve => {
      this.anamnesisPort.save({ ...input, studentId }).subscribe({
        next: value => {
          this.anamnesis.set(value);
          this._busy.set(false);
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

  /** Registra una evaluacion fisica nueva. El historial no se edita. */
  addAssessment(input: Omit<Assessment, 'id' | 'studentId' | 'takenAt'>): Promise<boolean> {
    const studentId = this._studentId();
    if (studentId === null || this._busy()) {
      return Promise.resolve(false);
    }

    this._busy.set(true);
    this._actionError.set(null);

    return new Promise(resolve => {
      this.assessmentsPort.create({ ...input, studentId }).subscribe({
        next: value => {
          this.assessments.set([...(this.assessments.data() ?? []), value]);
          this._busy.set(false);
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

  /** Agenda una cita con el alumno. Queda pendiente hasta que el la confirme. */
  scheduleAppointment(input: Omit<ScheduledSessionInput, 'studentId'>): Promise<boolean> {
    const studentId = this._studentId();
    if (studentId === null || this._busy()) {
      return Promise.resolve(false);
    }

    this._busy.set(true);
    this._actionError.set(null);

    return new Promise(resolve => {
      this.schedulePort.create({ ...input, studentId }).subscribe({
        next: value => {
          const lista = [...(this.appointments.data() ?? []), value];
          this.appointments.set(lista.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
          this._busy.set(false);
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

  /**
   * Suspende o reactiva la cuenta.
   *
   * El alumno nunca se elimina: su ficha y su historial siguen ahi para
   * cuando vuelva.
   */
  toggleStatus(): Promise<boolean> {
    const studentId = this._studentId();
    const current = this.student.data();
    if (studentId === null || current === null) {
      return Promise.resolve(false);
    }
    const next = current.status === 'active' ? 'suspended' : 'active';
    return this.run(() => this.students.setStatus(studentId, next));
  }

  /** Desde ahora hasta 90 dias: lo que el entrenador tiene que ver venir. */
  private proximos(): { from: string; to: string } {
    const ahora = this.clock.now();
    return { from: ahora.toISOString(), to: addDays(ahora, 90).toISOString() };
  }

  private run(action: () => Observable<Student>): Promise<boolean> {
    if (this._busy()) {
      return Promise.resolve(false);
    }
    this._busy.set(true);
    this._actionError.set(null);

    return new Promise(resolve => {
      action().subscribe({
        next: student => {
          this.student.set(student);
          this._busy.set(false);
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
}
