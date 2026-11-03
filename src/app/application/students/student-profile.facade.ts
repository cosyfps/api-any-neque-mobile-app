import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { AUTH_PORT } from '@app/domain/auth/port/auth.port';
import { DomainError, toDomainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { BmiResult, calculateBmi } from '@app/domain/students/model/bmi';
import { Student, fullName, initials } from '@app/domain/students/model/student.model';
import { ASSESSMENTS_PORT } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT, StudentSelfEditableFields } from '@app/domain/students/port/students.port';
import { weekStreak } from '@app/domain/workouts/model/streak';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/**
 * Ficha del alumno autenticado.
 *
 * El IMC sale de la ultima evaluacion registrada por el entrenador: es la
 * unica metrica del home que el backlog puede alimentar hoy.
 */
// Scoped a la ruta /student: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class StudentProfileFacade {
  private readonly students = inject(STUDENTS_PORT);
  private readonly assessments = inject(ASSESSMENTS_PORT);
  private readonly workouts = inject(WORKOUTS_PORT);
  private readonly auth = inject(AUTH_PORT);
  private readonly clock = inject(CLOCK);
  private readonly session = inject(SessionFacade);

  private readonly _busy = signal(false);
  private readonly _actionError = signal<DomainError | null>(null);

  readonly student: AsyncState<Student> = asyncState<Student>();
  readonly latestAssessment: AsyncState<Assessment | null> = asyncState<Assessment | null>({
    // Un alumno sin evaluaciones no es un error: es un estado valido.
    isEmpty: () => false,
  });
  readonly sessions: AsyncState<WorkoutSession[]> = asyncState<WorkoutSession[]>({
    // Sin sesiones la racha es cero, no un vacio.
    isEmpty: () => false,
  });

  /** Una operacion del perfil en curso: guardar datos, foto o contrasena. */
  readonly busy: Signal<boolean> = this._busy.asReadonly();
  readonly actionError: Signal<DomainError | null> = this._actionError.asReadonly();

  readonly displayName: Signal<string> = computed(() => {
    const value = this.student.data();
    return value === null ? '' : fullName(value);
  });

  readonly firstName: Signal<string> = computed(() => this.student.data()?.firstName ?? '');

  readonly avatarInitials: Signal<string> = computed(() => {
    const value = this.student.data();
    return value === null ? '' : initials(value);
  });

  readonly bmi: Signal<BmiResult | null> = computed(() => {
    const assessment = this.latestAssessment.data();
    if (assessment === null || assessment === undefined) {
      return null;
    }
    return calculateBmi(assessment.weightKg, assessment.heightCm);
  });

  readonly weightKg: Signal<number | null> = computed(
    () => this.latestAssessment.data()?.weightKg ?? null,
  );

  readonly heightCm: Signal<number | null> = computed(
    () => this.latestAssessment.data()?.heightCm ?? this.student.data()?.heightCm ?? null,
  );

  /** Semanas seguidas cumpliendo la agenda. */
  readonly streakWeeks: Signal<number> = computed(() =>
    weekStreak(this.sessions.data() ?? [], this.clock.now()),
  );

  readonly viewState: Signal<ViewState> = this.student.viewState;

  /** Carga la ficha del alumno de la sesion activa. */
  load(): void {
    const studentId = this.session.profileId();
    if (studentId === null) {
      return;
    }
    this.student.load(() => this.students.getById(studentId));
    this.latestAssessment.load(() => this.assessments.latestByStudent(studentId));
    this.sessions.load(() => this.workouts.listByStudent(studentId));
  }

  reload(): void {
    this.student.reload();
    this.latestAssessment.reload();
    this.sessions.reload();
  }

  clearActionError(): void {
    this._actionError.set(null);
  }

  /** Guarda nombre, apellido o telefono. */
  saveProfile(changes: Partial<StudentSelfEditableFields>): Promise<boolean> {
    return this.actualizar(changes);
  }

  /** Reemplaza la foto de perfil por una ya leida como data-URL. */
  setAvatar(dataUrl: string): Promise<boolean> {
    return this.actualizar({ avatarUrl: dataUrl });
  }

  changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    const email = this.session.user()?.email;
    if (email === undefined) {
      return Promise.resolve(false);
    }
    return this.run(() => this.auth.changePassword(email, currentPassword, newPassword)).then(
      result => result !== null,
    );
  }

  private actualizar(changes: Partial<StudentSelfEditableFields>): Promise<boolean> {
    const studentId = this.session.profileId();
    if (studentId === null) {
      return Promise.resolve(false);
    }
    return this.run(() => this.students.update(studentId, changes)).then(result => {
      if (result === null) {
        return false;
      }
      this.student.set(result.value);
      return true;
    });
  }

  /**
   * Una sola operacion a la vez: un doble toque no guarda dos veces. Recibe
   * una fabrica y no el observable, para no llamar al puerto si esta ocupada.
   * Resuelve null si fallo; si no, envuelve el valor, que puede ser `void`.
   */
  private run<T>(source: () => Observable<T>): Promise<{ value: T } | null> {
    if (this._busy()) {
      return Promise.resolve(null);
    }
    this._busy.set(true);
    this._actionError.set(null);

    return new Promise(resolve => {
      source().subscribe({
        next: value => {
          this._busy.set(false);
          resolve({ value });
        },
        error: (cause: unknown) => {
          this._actionError.set(toDomainError(cause));
          this._busy.set(false);
          resolve(null);
        },
      });
    });
  }
}
