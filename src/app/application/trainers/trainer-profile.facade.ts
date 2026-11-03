import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { SessionFacade } from '@app/application/auth/session.facade';
import { AUTH_PORT } from '@app/domain/auth/port/auth.port';
import { ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { DomainError, toDomainError } from '@app/domain/shared/model/app-error';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import {
  Trainer,
  trainerFullName,
  trainerInitials,
} from '@app/domain/trainers/model/trainer.model';
import { TRAINERS_PORT, TrainerEditableFields } from '@app/domain/trainers/port/trainers.port';
import { adherencePercent, averagePercent } from '@app/domain/workouts/model/adherence';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/**
 * Perfil del entrenador autenticado.
 *
 * Los conteos salen de la cartera y la biblioteca, no de campos del perfil:
 * son datos derivados, y guardarlos aparte los condena a quedar desactualizados.
 */
// Scoped a la ruta /trainer: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class TrainerProfileFacade {
  private readonly trainers = inject(TRAINERS_PORT);
  private readonly students = inject(STUDENTS_PORT);
  private readonly routines = inject(ROUTINES_PORT);
  private readonly workouts = inject(WORKOUTS_PORT);
  private readonly auth = inject(AUTH_PORT);
  private readonly session = inject(SessionFacade);

  private readonly _busy = signal(false);
  private readonly _actionError = signal<DomainError | null>(null);

  readonly trainer: AsyncState<Trainer> = asyncState<Trainer>();
  readonly activeStudents: AsyncState<number> = asyncState<number>({
    // Cero alumnos es un numero valido, no un vacio que ocultar.
    isEmpty: () => false,
  });
  readonly routinesCount: AsyncState<number> = asyncState<number>({ isEmpty: () => false });
  /** Adherencia promedio de sus alumnos activos; null sin datos. */
  readonly adherence: AsyncState<number | null> = asyncState<number | null>({
    isEmpty: () => false,
  });

  readonly busy: Signal<boolean> = this._busy.asReadonly();
  readonly actionError: Signal<DomainError | null> = this._actionError.asReadonly();

  readonly viewState: Signal<ViewState> = this.trainer.viewState;

  readonly displayName: Signal<string> = computed(() => {
    const value = this.trainer.data();
    return value === null ? '' : trainerFullName(value);
  });

  readonly avatarInitials: Signal<string> = computed(() => {
    const value = this.trainer.data();
    return value === null ? '' : trainerInitials(value);
  });

  readonly activeCount: Signal<number> = computed(() => this.activeStudents.data() ?? 0);

  load(): void {
    const trainerId = this.session.profileId();
    if (trainerId === null) {
      return;
    }
    this.trainer.load(() => this.trainers.getById(trainerId));
    this.activeStudents.load(() =>
      this.students
        .listByTrainer(trainerId)
        .pipe(map(list => list.filter(student => student.status === 'active').length)),
    );
    this.routinesCount.load(() =>
      this.routines.listByTrainer(trainerId).pipe(map(list => list.length)),
    );
    this.adherence.load(() => this.adherenciaPromedio(trainerId));
  }

  reload(): void {
    this.trainer.reload();
    this.activeStudents.reload();
    this.routinesCount.reload();
    this.adherence.reload();
  }

  signOut(): Promise<void> {
    return this.session.signOut();
  }

  clearActionError(): void {
    this._actionError.set(null);
  }

  /** Guarda nombre, telefono, especialidad o bio. */
  saveProfile(changes: Partial<TrainerEditableFields>): Promise<boolean> {
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

  /**
   * Promedio de la adherencia de cada alumno activo.
   *
   * Promedia alumnos y no sesiones: un alumno que entrena mucho no debe tapar
   * a otro que se esta cayendo.
   */
  private adherenciaPromedio(trainerId: string): Observable<number | null> {
    return this.students.listByTrainer(trainerId).pipe(
      map(list => list.filter(student => student.status === 'active')),
      switchMap(activos =>
        activos.length === 0
          ? of([])
          : forkJoin(activos.map(student => this.workouts.listByStudent(student.id))),
      ),
      map(porAlumno => averagePercent(porAlumno.map(adherencePercent))),
    );
  }

  private actualizar(changes: Partial<TrainerEditableFields>): Promise<boolean> {
    const trainerId = this.session.profileId();
    if (trainerId === null) {
      return Promise.resolve(false);
    }
    return this.run(() => this.trainers.update(trainerId, changes)).then(result => {
      if (result === null) {
        return false;
      }
      this.trainer.set(result.value);
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
