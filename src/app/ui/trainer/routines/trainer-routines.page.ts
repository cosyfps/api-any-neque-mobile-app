import { Component, computed, inject, signal, viewChild } from '@angular/core';

import {
  RoutineRow,
  RoutinesFilter,
  TrainerRoutinesFacade,
} from '@app/application/trainers/trainer-routines.facade';
import { ExerciseInput, MUSCLE_GROUP_LABEL } from '@app/domain/routines/model/exercise.model';
import {
  Routine,
  RoutineAssignment,
  RoutineInput,
  isAssigned,
} from '@app/domain/routines/model/routine.model';
import { CLOCK } from '@app/domain/shared/port/clock.port';

import { PageStateComponent } from '@shared/components/page-state.component';
import { SheetTrapDirective } from '@shared/directives/sheet-trap.directive';
import { useFab } from '@shared/navigation/fab';

import { ExerciseFormComponent } from './exercise-form.component';
import { RoutineAssignComponent } from './routine-assign.component';
import { RoutineBuilderComponent } from './routine-builder.component';

/** Las dos vistas de la pantalla. Cada una tiene su propio boton de alta. */
type Seccion = 'routines' | 'exercises';

@Component({
  selector: 'app-trainer-routines',
  standalone: true,
  imports: [
    PageStateComponent,
    SheetTrapDirective,
    RoutineBuilderComponent,
    RoutineAssignComponent,
    ExerciseFormComponent,
  ],
  providers: [TrainerRoutinesFacade],
  template: `
    <div class="page">
      <header class="head">
        <h1 class="nq-h2">Rutinas</h1>
      </header>

      <div class="nq-tabs" role="tablist" aria-label="Secciones">
        @for (tab of secciones; track tab.value) {
          <button
            class="nq-tab"
            type="button"
            role="tab"
            [class.active]="seccion() === tab.value"
            [attr.aria-selected]="seccion() === tab.value"
            (click)="selectSeccion(tab.value)"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      @if (seccion() === 'routines') {
        <div class="nq-tabs" role="tablist" aria-label="Estado de las rutinas">
          @for (tab of estados; track tab.value) {
            <button
              class="nq-tab"
              type="button"
              role="tab"
              [class.active]="facade.filter() === tab.value"
              [attr.aria-selected]="facade.filter() === tab.value"
              (click)="facade.selectFilter(tab.value)"
            >
              {{ tab.label }} ({{
                tab.value === 'assigned' ? facade.assignedCount() : facade.unassignedCount()
              }})
            </button>
          }
        </div>

        @switch (facade.viewState()) {
          @case ('loading') {
            <nq-page-state type="loading" loadingLabel="Cargando tus rutinas" />
          }
          @case ('error') {
            <nq-page-state type="error" message="No pudimos cargar tus rutinas." [retry]="reload" />
          }
          @case ('empty') {
            <nq-page-state
              type="empty"
              [title]="emptyTitle()"
              [message]="emptyMessage()"
              [showRetry]="false"
            />
          }
          @default {
            <ul class="list" role="list">
              @for (row of facade.visible(); track row.routine.id) {
                <li class="card">
                  <div class="card-head">
                    <span class="card-name">{{ row.routine.name }}</span>
                    <span class="nq-badge alumnos-badge" [class.vacia]="!asignada(row.routine)">
                      {{ alumnos(row.studentNames.length) }}
                    </span>
                  </div>
                  <p class="card-sub">
                    {{ row.routine.goal }} · {{ dias(row.routine.days.length) }}
                  </p>
                  @if (row.studentNames.length > 0) {
                    <p class="card-students">{{ row.studentNames.join(', ') }}</p>
                  }

                  <div class="card-actions">
                    <button class="text-btn" type="button" (click)="openEdit(row.routine)">
                      Editar
                    </button>
                    <button
                      class="text-btn"
                      type="button"
                      [disabled]="facade.busy()"
                      (click)="openAssign(row.routine)"
                    >
                      Asignar alumnos
                    </button>
                    <button
                      class="text-btn danger"
                      type="button"
                      [attr.aria-label]="'Eliminar ' + row.routine.name"
                      [disabled]="facade.busy()"
                      (click)="askRemove(row)"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        }
      } @else {
        <section class="nq-section">
          <div class="nq-section-header">
            <h2 class="nq-section-title">Mis ejercicios</h2>
          </div>
          @if (facade.ownExercises().length > 0) {
            <ul class="list" role="list">
              @for (item of facade.ownExercises(); track item.id) {
                <li class="exercise-row">
                  <span class="exercise-name">{{ item.name }}</span>
                  <span class="exercise-group">{{ grupo(item.muscleGroup) }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="nq-empty-inline">
              Todavía no tienes ejercicios propios. Los que crees solo los verás tú.
            </p>
          }
        </section>

        <section class="nq-section">
          <div class="nq-section-header">
            <h2 class="nq-section-title">Catálogo</h2>
          </div>
          <ul class="list" role="list">
            @for (item of facade.publicExercises(); track item.id) {
              <li class="exercise-row">
                <span class="exercise-name">{{ item.name }}</span>
                <span class="exercise-group">{{ grupo(item.muscleGroup) }}</span>
              </li>
            }
          </ul>
        </section>
      }
    </div>

    <!-- Los overlays viven siempre en el DOM y solo conmutan la clase open:
         es como el design system los anima, y cerrados no dejan nada
         tabulable. -->
    <div class="nq-overlay" [class.open]="building()" (click)="closeBuilder()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rutina-title"
        [nqSheetTrap]="building()"
        (dismissed)="closeBuilder()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="rutina-title">{{ builderTitle() }}</h2>

        <nq-routine-builder
          #builder
          [routine]="editing()"
          [publicExercises]="facade.publicExercises()"
          [ownExercises]="facade.ownExercises()"
          [busy]="facade.busy()"
          [errorMessage]="facade.actionError()?.message ?? null"
          [submitLabel]="editing() === null ? 'Crear rutina' : 'Guardar cambios'"
          (submitted)="saveRoutine($event)"
          (cancelled)="closeBuilder()"
        />
      </div>
    </div>

    <div class="nq-overlay" [class.open]="assigning() !== null" (click)="closeAssign()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asignar-title"
        [nqSheetTrap]="assigning() !== null"
        (dismissed)="closeAssign()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="asignar-title">Asignar «{{ assigning()?.name }}»</h2>

        <nq-routine-assign
          #assignForm
          [options]="assignOptions()"
          [today]="today"
          [busy]="facade.busy()"
          [errorMessage]="facade.actionError()?.message ?? null"
          (submitted)="saveAssignments($event)"
          (cancelled)="closeAssign()"
        />
      </div>
    </div>

    <!-- Eliminar no tiene vuelta atras y puede dejar alumnos sin rutina: se
         confirma nombrando a quienes afecta. -->
    <div class="nq-overlay" [class.open]="removing() !== null" (click)="cancelRemove()">
      <div
        class="nq-sheet confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eliminar-title"
        aria-describedby="eliminar-desc"
        [nqSheetTrap]="removing() !== null"
        (dismissed)="cancelRemove()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="eliminar-title">
          ¿Eliminar «{{ removing()?.routine?.name }}»?
        </h2>
        <p class="confirm-desc" id="eliminar-desc">{{ removeWarning() }}</p>

        @if (facade.actionError(); as error) {
          <p class="nq-field-error" role="alert">{{ error.message }}</p>
        }

        <div class="confirm-actions">
          <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelRemove()">
            Cancelar
          </button>
          <button
            class="nq-btn danger-confirm"
            type="button"
            [disabled]="facade.busy()"
            (click)="confirmRemove()"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>

    <div class="nq-overlay" [class.open]="creatingExercise()" (click)="closeExercise()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ejercicio-title"
        [nqSheetTrap]="creatingExercise()"
        (dismissed)="closeExercise()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="ejercicio-title">Nuevo ejercicio</h2>

        <nq-exercise-form
          #exerciseForm
          [busy]="facade.busy()"
          [errorMessage]="facade.actionError()?.message ?? null"
          (submitted)="saveExercise($event)"
          (cancelled)="closeExercise()"
        />
      </div>
    </div>
  `,
  styleUrl: './trainer-routines.page.scss',
})
export class TrainerRoutinesPage {
  readonly facade = inject(TrainerRoutinesFacade);

  readonly secciones: readonly { value: Seccion; label: string }[] = [
    { value: 'routines', label: 'Rutinas' },
    { value: 'exercises', label: 'Ejercicios' },
  ];

  /**
   * "Sin asignar" junta las plantillas recien creadas y las que se quedaron
   * sin alumnos: las dos estan listas para repartirse.
   */
  readonly estados: readonly { value: RoutinesFilter; label: string }[] = [
    { value: 'assigned', label: 'Asignadas' },
    { value: 'unassigned', label: 'Sin asignar' },
  ];

  readonly seccion = signal<Seccion>('routines');
  readonly building = signal(false);
  readonly creatingExercise = signal(false);
  readonly editing = signal<Routine | null>(null);
  readonly assigning = signal<Routine | null>(null);
  /** Rutina que se esta por eliminar; null con la confirmacion cerrada. */
  readonly removing = signal<RoutineRow | null>(null);

  /** Nombra a los alumnos que quedan sin rutina: es lo que el entrenador pierde. */
  readonly removeWarning = computed(() => {
    const nombres = this.removing()?.studentNames ?? [];
    if (nombres.length === 0) {
      return 'No se puede deshacer.';
    }
    const quedan = nombres.length === 1 ? 'quedará sin rutina' : 'quedarán sin rutina';
    return `${this.listar(nombres)} ${quedan}. No se puede deshacer.`;
  });

  /** Inicio que se propone al marcar un alumno, en `yyyy-MM-dd` local. */
  readonly today = this.fechaLocal(inject(CLOCK).now());

  readonly assignOptions = computed(() => {
    const routine = this.assigning();
    return routine === null ? [] : this.facade.assignmentOptions(routine);
  });

  readonly addLabel = computed(() =>
    this.seccion() === 'routines' ? 'Crear una rutina' : 'Crear un ejercicio',
  );

  readonly builderTitle = computed(() =>
    this.editing() === null ? 'Nueva rutina' : 'Editar rutina',
  );

  readonly emptyTitle = computed(() =>
    this.facade.filter() === 'unassigned' ? 'Nada sin asignar' : 'Ninguna rutina asignada',
  );

  readonly emptyMessage = computed(() =>
    this.facade.filter() === 'unassigned'
      ? 'Aquí aparecen las rutinas nuevas y las que se quedan sin alumnos.'
      : 'Crea una rutina y asígnasela a los alumnos con ese objetivo.',
  );

  readonly reload = (): void => this.facade.reload();

  private readonly builder = viewChild<RoutineBuilderComponent>('builder');
  private readonly exerciseForm = viewChild<ExerciseFormComponent>('exerciseForm');
  private readonly assignForm = viewChild<RoutineAssignComponent>('assignForm');

  constructor() {
    this.facade.load();
    useFab(
      () => this.addLabel(),
      () => this.openCreate(),
    );
  }

  alumnos(total: number): string {
    if (total === 0) {
      return 'Sin alumnos';
    }
    return total === 1 ? '1 alumno' : `${total} alumnos`;
  }

  asignada(routine: Routine): boolean {
    return isAssigned(routine);
  }

  dias(total: number): string {
    return total === 1 ? '1 día' : `${total} días`;
  }

  grupo(value: keyof typeof MUSCLE_GROUP_LABEL): string {
    return MUSCLE_GROUP_LABEL[value];
  }

  selectSeccion(seccion: Seccion): void {
    this.seccion.set(seccion);
  }

  /** El boton de alta crea lo que corresponde a la seccion abierta. */
  openCreate(): void {
    this.facade.clearActionError();
    if (this.seccion() === 'routines') {
      this.editing.set(null);
      this.building.set(true);
      this.builder()?.reset(null);
      return;
    }
    this.creatingExercise.set(true);
    this.exerciseForm()?.reset();
  }

  openEdit(routine: Routine): void {
    this.facade.clearActionError();
    this.editing.set(routine);
    this.building.set(true);
    // Se le pasa la rutina: el input todavia no la recibe.
    this.builder()?.reset(routine);
  }

  closeBuilder(): void {
    this.building.set(false);
  }

  async saveRoutine(value: Omit<RoutineInput, 'trainerId'>): Promise<void> {
    const actual = this.editing();
    const id =
      actual === null
        ? await this.facade.create(value)
        : await this.facade.update(actual.id, value);

    if (id === null) {
      return;
    }

    this.building.set(false);
    if (actual !== null) {
      return;
    }
    // Una rutina nace sin alumnos: sin este salto el entrenador la guarda y
    // no la ve por ninguna parte. Y lo siguiente que hara es repartirla.
    this.facade.selectFilter('unassigned');
    const creada = this.facade.rows.data()?.find(row => row.routine.id === id)?.routine;
    if (creada !== undefined) {
      this.openAssign(creada);
    }
  }

  openAssign(routine: Routine): void {
    this.facade.clearActionError();
    this.assigning.set(routine);
    // Se le pasan las opciones: el input todavia no recibe las de esta rutina.
    this.assignForm()?.reset(this.facade.assignmentOptions(routine));
  }

  closeAssign(): void {
    this.assigning.set(null);
  }

  async saveAssignments(assignments: RoutineAssignment[]): Promise<void> {
    const routine = this.assigning();
    if (routine === null) {
      return;
    }
    if (await this.facade.saveAssignments(routine.id, assignments)) {
      this.assigning.set(null);
      this.facade.selectFilter(assignments.length > 0 ? 'assigned' : 'unassigned');
    }
  }

  askRemove(row: RoutineRow): void {
    this.facade.clearActionError();
    this.removing.set(row);
  }

  cancelRemove(): void {
    this.removing.set(null);
  }

  async confirmRemove(): Promise<void> {
    const row = this.removing();
    if (row === null) {
      return;
    }
    if (await this.facade.remove(row.routine.id)) {
      this.removing.set(null);
    }
  }

  closeExercise(): void {
    this.creatingExercise.set(false);
  }

  async saveExercise(value: Omit<ExerciseInput, 'ownerTrainerId'>): Promise<void> {
    if ((await this.facade.createExercise(value)) !== null) {
      this.creatingExercise.set(false);
    }
  }

  /** "Ana", "Ana y Luis", "Ana, Luis y Sofía". */
  private listar(nombres: readonly string[]): string {
    if (nombres.length === 1) {
      return nombres[0] ?? '';
    }
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  }

  private fechaLocal(date: Date): string {
    const dos = (n: number): string => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${dos(date.getMonth() + 1)}-${dos(date.getDate())}`;
  }
}
