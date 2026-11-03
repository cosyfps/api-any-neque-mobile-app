import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { Exercise, ExerciseInput } from '@app/domain/routines/model/exercise.model';
import {
  Routine,
  RoutineAssignment,
  RoutineInput,
  assignmentFor,
  goalsMatch,
  isAssigned,
} from '@app/domain/routines/model/routine.model';
import { EXERCISE_CATALOG_PORT, ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { DomainError, toDomainError } from '@app/domain/shared/model/app-error';
import { Student, fullName } from '@app/domain/students/model/student.model';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/** Una rutina de la biblioteca, con los nombres de sus alumnos ya resueltos. */
export interface RoutineRow {
  readonly routine: Routine;
  readonly studentNames: readonly string[];
}

/** Pestanas de la biblioteca: las que alguien hace y las que esperan alumnos. */
export type RoutinesFilter = 'assigned' | 'unassigned';

/** Un alumno en la hoja de asignar, con lo que el entrenador necesita para decidir. */
export interface AssignmentOption {
  readonly student: Student;
  /** Su objetivo apunta a lo mismo que el de la rutina. */
  readonly sameGoal: boolean;
  /** Su asignacion en esta rutina, o null si todavia no la hace. */
  readonly assignment: RoutineAssignment | null;
  /** Nombre de la rutina que hace hoy, si es otra: asignarlo lo mueve. */
  readonly otherRoutine: string | null;
}

/**
 * Biblioteca de rutinas del entrenador.
 *
 * Resuelve el nombre del alumno aqui y no en la pantalla porque el BFF
 * devolvera la rutina con ese JOIN ya hecho: cuando llegue, esta facade
 * pierde el `forkJoin` y nada de `ui` cambia.
 */
// Scoped a la ruta /trainer: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class TrainerRoutinesFacade {
  private readonly routines = inject(ROUTINES_PORT);
  private readonly catalog = inject(EXERCISE_CATALOG_PORT);
  private readonly students = inject(STUDENTS_PORT);
  private readonly session = inject(SessionFacade);

  private readonly _filter = signal<RoutinesFilter>('assigned');
  private readonly _busy = signal(false);
  private readonly _actionError = signal<DomainError | null>(null);

  readonly rows: AsyncState<RoutineRow[]> = asyncState<RoutineRow[]>();
  readonly students$: AsyncState<Student[]> = asyncState<Student[]>({
    // Un entrenador sin alumnos todavia es un estado valido del selector.
    isEmpty: () => false,
  });
  readonly exercises: AsyncState<Exercise[]> = asyncState<Exercise[]>({
    isEmpty: () => false,
  });

  readonly filter: Signal<RoutinesFilter> = this._filter.asReadonly();
  readonly busy: Signal<boolean> = this._busy.asReadonly();
  readonly actionError: Signal<DomainError | null> = this._actionError.asReadonly();

  readonly assignedCount: Signal<number> = computed(() => this.contar('assigned'));
  readonly unassignedCount: Signal<number> = computed(() => this.contar('unassigned'));

  readonly visible: Signal<RoutineRow[]> = computed(() => {
    const estado = this._filter();
    return (this.rows.data() ?? [])
      .filter(row => this.estadoDe(row.routine) === estado)
      .sort((a, b) => a.routine.name.localeCompare(b.routine.name, 'es'));
  });

  /**
   * Estado de la lista ya filtrada.
   *
   * No es `rows.viewState()`: una biblioteca con rutinas pero sin ninguna
   * libre tiene que mostrar el vacio de esa pestana, no la lista entera.
   */
  readonly viewState: Signal<ViewState> = computed(() => {
    const estado = this.rows.viewState();
    return estado === 'success' && this.visible().length === 0 ? 'empty' : estado;
  });

  /** Catalogo publico primero, propios despues, cada grupo alfabetico. */
  readonly publicExercises: Signal<Exercise[]> = computed(() =>
    this.ordenar((this.exercises.data() ?? []).filter(item => item.ownerTrainerId === null)),
  );

  readonly ownExercises: Signal<Exercise[]> = computed(() =>
    this.ordenar((this.exercises.data() ?? []).filter(item => item.ownerTrainerId !== null)),
  );

  load(): void {
    const trainerId = this.session.profileId();
    if (trainerId === null) {
      return;
    }

    this.rows.load(() => this.cargarBiblioteca(trainerId));
    this.students$.load(() => this.students.listByTrainer(trainerId));
    this.exercises.load(() => this.catalog.listForTrainer(trainerId));
  }

  reload(): void {
    this.rows.reload();
    this.students$.reload();
    this.exercises.reload();
  }

  selectFilter(filter: RoutinesFilter): void {
    this._filter.set(filter);
  }

  clearActionError(): void {
    this._actionError.set(null);
  }

  /** Crea la rutina en borrador. Devuelve su id, o null si el puerto rechazo. */
  create(input: Omit<RoutineInput, 'trainerId'>): Promise<string | null> {
    const trainerId = this.session.profileId();
    if (trainerId === null) {
      return Promise.resolve(null);
    }
    return this.run(() => this.routines.create({ ...input, trainerId })).then(
      routine => routine?.id ?? null,
    );
  }

  update(routineId: string, input: Omit<RoutineInput, 'trainerId'>): Promise<string | null> {
    const trainerId = this.session.profileId();
    if (trainerId === null) {
      return Promise.resolve(null);
    }
    return this.run(() => this.routines.update(routineId, { ...input, trainerId })).then(
      routine => routine?.id ?? null,
    );
  }

  /**
   * Alumnos que se pueden asignar a la rutina, los de objetivo parecido primero.
   *
   * Incluye a los que ya la hacen aunque esten suspendidos: si no, al guardar
   * saldrian de la rutina sin que el entrenador los haya desmarcado.
   */
  assignmentOptions(routine: Routine): AssignmentOption[] {
    const rutinas = (this.rows.data() ?? []).map(row => row.routine);
    return (this.students$.data() ?? [])
      .filter(student => student.status === 'active' || assignmentFor(routine, student.id) !== null)
      .map(student => {
        const actual = rutinas.find(item => assignmentFor(item, student.id) !== null);
        return {
          student,
          sameGoal: goalsMatch(routine.goal, student.goal),
          assignment: assignmentFor(routine, student.id),
          otherRoutine: actual === undefined || actual.id === routine.id ? null : actual.name,
        };
      })
      .sort(
        (a, b) =>
          Number(b.sameGoal) - Number(a.sameGoal) ||
          fullName(a.student).localeCompare(fullName(b.student), 'es'),
      );
  }

  /**
   * Deja la rutina con esos alumnos.
   *
   * Es una sola operacion del puerto a proposito: el alumno que llega desde
   * otra rutina sale de aquella en el mismo paso.
   */
  saveAssignments(routineId: string, assignments: readonly RoutineAssignment[]): Promise<boolean> {
    return this.run(() => this.routines.setAssignments(routineId, assignments)).then(
      routine => routine !== null,
    );
  }

  /**
   * Elimina la rutina aunque tenga alumnos: quedan sin rutina hasta que se les
   * asigne otra. La pantalla confirma antes nombrando a quienes afecta.
   */
  remove(routineId: string): Promise<boolean> {
    const trainerId = this.session.profileId();
    if (trainerId === null || this._busy()) {
      return Promise.resolve(false);
    }

    this._busy.set(true);
    this._actionError.set(null);

    return new Promise(resolve => {
      this.routines
        .remove(routineId)
        .pipe(switchMap(() => this.cargarBiblioteca(trainerId)))
        .subscribe({
          next: rows => {
            this.rows.set(rows);
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

  /** Alta de un ejercicio propio. Queda privado del entrenador que lo crea. */
  createExercise(input: Omit<ExerciseInput, 'ownerTrainerId'>): Promise<Exercise | null> {
    const trainerId = this.session.profileId();
    if (trainerId === null || this._busy()) {
      return Promise.resolve(null);
    }

    this._busy.set(true);
    this._actionError.set(null);

    return new Promise(resolve => {
      this.catalog.create({ ...input, ownerTrainerId: trainerId }).subscribe({
        next: exercise => {
          this.exercises.set([...(this.exercises.data() ?? []), exercise]);
          this._busy.set(false);
          resolve(exercise);
        },
        error: (cause: unknown) => {
          this._actionError.set(toDomainError(cause));
          this._busy.set(false);
          resolve(null);
        },
      });
    });
  }

  private contar(estado: RoutinesFilter): number {
    return (this.rows.data() ?? []).filter(row => this.estadoDe(row.routine) === estado).length;
  }

  private estadoDe(routine: Routine): RoutinesFilter {
    return isAssigned(routine) ? 'assigned' : 'unassigned';
  }

  private ordenar(lista: Exercise[]): Exercise[] {
    return [...lista].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  /** Rutinas y nombres de sus alumnos, en una sola lectura. */
  private cargarBiblioteca(trainerId: string): Observable<RoutineRow[]> {
    return forkJoin({
      rutinas: this.routines.listByTrainer(trainerId),
      cartera: this.students.listByTrainer(trainerId),
    }).pipe(
      map(({ rutinas, cartera }) =>
        rutinas.map(routine => ({
          routine,
          studentNames: routine.assignments.map(item => this.nombreDe(cartera, item.studentId)),
        })),
      ),
    );
  }

  private nombreDe(cartera: Student[], studentId: string): string {
    const student = cartera.find(item => item.id === studentId);
    return student === undefined ? 'Alumno desconocido' : fullName(student);
  }

  private run(action: () => Observable<Routine>): Promise<Routine | null> {
    if (this._busy()) {
      return Promise.resolve(null);
    }
    this._busy.set(true);
    this._actionError.set(null);

    return new Promise(resolve => {
      action()
        .pipe(switchMap(routine => this.refrescar(routine)))
        .subscribe({
          next: routine => {
            this._busy.set(false);
            resolve(routine);
          },
          error: (cause: unknown) => {
            this._actionError.set(toDomainError(cause));
            this._busy.set(false);
            resolve(null);
          },
        });
    });
  }

  /**
   * Relee la biblioteca tras mutar.
   *
   * Asignar saca alumnos de otra rutina que no vuelve en la respuesta, asi que
   * parchear la lista en memoria la dejaria mintiendo.
   */
  private refrescar(routine: Routine): Observable<Routine> {
    const trainerId = this.session.profileId();
    if (trainerId === null) {
      return of(routine);
    }
    return this.cargarBiblioteca(trainerId).pipe(
      map(rows => {
        this.rows.set(rows);
        return routine;
      }),
    );
  }
}
