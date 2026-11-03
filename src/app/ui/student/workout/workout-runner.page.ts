import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideArrowLeft,
  LucideChevronLeft,
  LucideChevronRight,
  LucideCheck,
  LucidePause,
  LucidePlay,
  LucidePlus,
  LucideSkipForward,
} from '@lucide/angular';

import { WorkoutRunnerFacade } from '@app/application/workouts/workout-runner.facade';
import { formatDuration, loadOf, measureOf, usesKg } from '@app/domain/routines/model/prescription';
import { SKIP_REASON_LABEL, SkipReason } from '@app/domain/workouts/model/workout-set.model';

import { RingProgressComponent } from '@shared/components/chart/ring-progress.component';
import { PageStateComponent } from '@shared/components/page-state.component';
import { StepperComponent } from '@shared/components/stepper.component';
import { SheetTrapDirective } from '@shared/directives/sheet-trap.directive';

/** Que se esta por saltar; null con la hoja cerrada. */
type SkipTarget = 'set' | 'exercise';

@Component({
  selector: 'app-workout-runner',
  standalone: true,
  imports: [
    PageStateComponent,
    RingProgressComponent,
    SheetTrapDirective,
    StepperComponent,
    LucideArrowLeft,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCheck,
    LucidePause,
    LucidePlay,
    LucidePlus,
    LucideSkipForward,
  ],
  providers: [WorkoutRunnerFacade],
  template: `
    <div class="nq-screen">
      <div class="runner">
        <header class="head">
          <button class="nav-back" type="button" aria-label="Salir" (click)="exit()">
            <svg lucideArrowLeft [size]="22" [strokeWidth]="1.8"></svg>
          </button>
          <span class="head-title">{{ facade.session.data()?.title ?? 'Entrenamiento' }}</span>
          <span class="elapsed">{{ elapsedLabel() }}</span>
        </header>

        @switch (facade.viewState()) {
          @case ('loading') {
            <nq-page-state type="loading" />
          }
          @case ('error') {
            <nq-page-state type="error" [retry]="reload" />
          }
          @case ('empty') {
            <nq-page-state type="error" title="No encontramos la sesión" [showRetry]="false" />
          }
          @case ('success') {
            <div
              class="progress-track"
              role="progressbar"
              aria-label="Avance de la sesion"
              aria-valuemin="0"
              aria-valuemax="100"
              [attr.aria-valuenow]="totalPercent()"
              [attr.aria-valuetext]="totalPercent() + '%'"
            >
              <div class="progress-fill" [style.width.%]="totalPercent()"></div>
            </div>

            <!-- Una sola region viva para las cuatro fases: el lector anuncia
                 el paso de ejercicio a descanso y a resumen sin interrumpir. -->
            <div class="phases" role="status" aria-live="polite">
              @switch (facade.phase()) {
                @case ('idle') {
                  <div class="stage nq-ani">
                    <span class="stage-label">Listo para empezar</span>
                    <h1 class="stage-title">{{ facade.exercises().length }} ejercicios</h1>
                    <p class="stage-desc">
                      Te guiaremos serie por serie, con el descanso incluido entre cada una.
                    </p>
                    <button
                      class="nq-btn nq-btn-primary stage-cta"
                      type="button"
                      (click)="facade.start()"
                    >
                      <svg lucidePlay [size]="18" [strokeWidth]="2"></svg>
                      Comenzar
                    </button>
                  </div>
                }

                @case ('exercise') {
                  @if (facade.currentExercise(); as exercise) {
                    <div class="stage nq-ani">
                      <span class="stage-label">
                        Ejercicio {{ facade.exerciseIndex() + 1 }} de
                        {{ facade.exercises().length }}
                      </span>
                      <h1 class="stage-title">{{ exercise.name }}</h1>

                      <div class="set-badge">
                        Serie {{ facade.currentSet() }} de {{ facade.totalSets() }}
                      </div>

                      <!-- Serie por tiempo: cuenta regresiva grande, la que se
                           mira de reojo mientras se hace la plancha. -->
                      @if (porTiempo()) {
                        <div class="work" [class.running]="facade.workRunning()">
                          <span class="work-time">{{ workLabel() }}</span>
                          <button
                            class="nq-btn nq-btn-secondary work-btn"
                            type="button"
                            (click)="toggleWork()"
                          >
                            @if (facade.workRunning()) {
                              <svg lucidePause [size]="18" [strokeWidth]="2"></svg>
                              Pausar
                            } @else {
                              <svg lucidePlay [size]="18" [strokeWidth]="2"></svg>
                              {{ facade.workRemaining() === null ? 'Iniciar' : 'Seguir' }}
                            }
                          </button>
                        </div>
                      }

                      <div class="targets" [class.single]="!conKg()">
                        @if (porTiempo()) {
                          <nq-stepper
                            label="duración"
                            format="time"
                            [value]="durationValue()"
                            [min]="5"
                            [max]="7200"
                            [step]="durationStep()"
                            (valueChange)="durationOverride.set($event)"
                          />
                        } @else {
                          <nq-stepper
                            label="repeticiones"
                            [value]="repsValue()"
                            [min]="1"
                            [max]="99"
                            (valueChange)="repsOverride.set($event)"
                          />
                        }
                        @if (conKg()) {
                          <nq-stepper
                            format="decimal"
                            [label]="kgLabel()"
                            [value]="weightValue()"
                            [min]="0"
                            [max]="500"
                            [step]="2.5"
                            (valueChange)="weightOverride.set($event)"
                          />
                        }
                      </div>

                      @if (metaLine(); as meta) {
                        <p class="targets-meta">{{ meta }}</p>
                      }
                      <p class="targets-hint">
                        Viene con lo que te toca. Ajústalo solo si hiciste algo distinto.
                      </p>

                      <button
                        class="nq-btn nq-btn-primary stage-cta"
                        type="button"
                        (click)="completeSet()"
                      >
                        <svg lucideCheck [size]="18" [strokeWidth]="2.5"></svg>
                        Serie completada
                      </button>

                      <div class="skip-row">
                        <button class="skip-btn" type="button" (click)="askSkip('set')">
                          <svg lucideSkipForward [size]="16" [strokeWidth]="2"></svg>
                          Saltar serie
                        </button>
                        <button class="skip-btn" type="button" (click)="askSkip('exercise')">
                          Saltar ejercicio
                        </button>
                      </div>

                      <div class="nav-row">
                        <button
                          class="nav-btn"
                          type="button"
                          aria-label="Ejercicio anterior"
                          [disabled]="facade.exerciseIndex() === 0"
                          (click)="previous()"
                        >
                          <svg lucideChevronLeft [size]="20" [strokeWidth]="2"></svg>
                        </button>
                        <button
                          class="nav-btn"
                          type="button"
                          aria-label="Siguiente ejercicio"
                          (click)="next()"
                        >
                          <svg lucideChevronRight [size]="20" [strokeWidth]="2"></svg>
                        </button>
                      </div>
                    </div>
                  }
                }

                @case ('rest') {
                  <div class="stage rest-stage nq-ani">
                    <span class="stage-label">Descanso</span>

                    <nq-ring-progress
                      class="rest-ring"
                      [progress]="restProgress()"
                      [ariaLabel]="'Quedan ' + facade.restRemaining() + ' segundos de descanso'"
                    >
                      <span class="rest-seconds">{{ facade.restRemaining() }}</span>
                      <span class="rest-unit">seg</span>
                    </nq-ring-progress>

                    <p class="stage-desc">
                      Siguiente: {{ facade.currentExercise()?.name ?? 'fin de la sesión' }}
                    </p>

                    <div class="rest-actions">
                      <button
                        class="nq-btn nq-btn-secondary"
                        type="button"
                        (click)="facade.addRest()"
                      >
                        <svg lucidePlus [size]="16" [strokeWidth]="2"></svg>
                        15 seg
                      </button>
                      <button
                        class="nq-btn nq-btn-primary"
                        type="button"
                        (click)="facade.skipRest()"
                      >
                        Saltar descanso
                      </button>
                    </div>
                  </div>
                }

                @case ('summary') {
                  <div class="stage nq-ani">
                    <div class="summary-check">
                      <svg lucideCheck [size]="30" [strokeWidth]="3"></svg>
                    </div>
                    <h1 class="stage-title">¡Sesión terminada!</h1>

                    <div class="summary-grid">
                      <div class="summary-item">
                        <span class="summary-value">{{ elapsedLabel() }}</span>
                        <span class="summary-label">duración</span>
                      </div>
                      <div class="summary-item">
                        <span class="summary-value">{{ completedExercises() }}</span>
                        <span class="summary-label">ejercicios</span>
                      </div>
                      <div class="summary-item">
                        <span class="summary-value">{{ completedSets() }}</span>
                        <span class="summary-label">series</span>
                      </div>
                    </div>

                    @if (skippedCount() > 0) {
                      <p class="stage-desc">
                        {{ skippedLabel() }}. Tu entrenador lo verá para ajustar tu rutina.
                      </p>
                    }

                    <button
                      class="nq-btn nq-btn-primary stage-cta"
                      type="button"
                      [disabled]="saving()"
                      (click)="finish()"
                    >
                      Guardar y volver
                    </button>
                  </div>
                }
              }
            </div>
          }
        }
      </div>
    </div>

    <!-- Saltar: el motivo es opcional y se elige con un toque. Tocar un motivo
         ya confirma; "Saltar sin motivo" no obliga a elegir. -->
    <div class="nq-overlay" [class.open]="skipping() !== null" (click)="cancelSkip()">
      <div
        class="nq-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="skip-title"
        aria-describedby="skip-desc"
        [nqSheetTrap]="skipping() !== null"
        (dismissed)="cancelSkip()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="skip-title">{{ skipTitle() }}</h2>
        <p class="confirm-desc skip-desc" id="skip-desc">
          ¿Por qué? Es opcional: tu entrenador lo verá para ajustar tu rutina.
        </p>

        <div class="reasons" role="group" aria-label="Motivo">
          @for (reason of reasons; track reason.value) {
            <button class="reason" type="button" (click)="confirmSkip(reason.value)">
              {{ reason.label }}
            </button>
          }
        </div>

        <div class="confirm-actions">
          <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelSkip()">
            Cancelar
          </button>
          <button class="nq-btn nq-btn-primary" type="button" (click)="confirmSkip(null)">
            Saltar sin motivo
          </button>
        </div>
      </div>
    </div>

    <!-- Salir a mitad de la sesion pierde el cronometro y la fase en curso:
         se confirma antes. -->
    <div class="nq-overlay" [class.open]="confirmingExit()" (click)="cancelExit()">
      <div
        class="nq-sheet confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-title"
        [nqSheetTrap]="confirmingExit()"
        (dismissed)="cancelExit()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="exit-title">¿Salir del entrenamiento?</h2>
        <p class="confirm-desc">
          Las series que ya marcaste quedan guardadas, pero se pierde el cronómetro y tendrás que
          empezar la sesión de nuevo.
        </p>

        <div class="confirm-actions">
          <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelExit()">
            Seguir entrenando
          </button>
          <button class="nq-btn nq-btn-primary" type="button" (click)="leave()">Salir</button>
        </div>
      </div>
    </div>
  `,
  // `.nq-screen` se estira contra el ancestro posicionado que aporta esta
  // clase; sin ella el contenedor no tiene contra que medir su alto.
  host: { class: 'nq-page-host' },
  styleUrl: './workout-runner.page.scss',
})
export class WorkoutRunnerPage {
  readonly facade = inject(WorkoutRunnerFacade);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Bloquea "Guardar y volver": sin esto un doble toque guarda dos veces. */
  readonly saving = signal(false);
  readonly confirmingExit = signal(false);

  readonly totalPercent = computed(() => Math.round(this.facade.totalProgress() * 100));

  readonly restProgress = computed(() => {
    const total = this.facade.restTotal();
    return total === 0 ? 0 : this.facade.restRemaining() / total;
  });

  readonly completedExercises = computed(
    () => this.facade.exercises().filter(exercise => exercise.done).length,
  );

  readonly completedSets = computed(() =>
    this.facade.exercises().reduce((sum, exercise) => sum + exercise.completedSets, 0),
  );

  readonly elapsedLabel = computed(() => {
    const total = this.facade.elapsedSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  });

  /**
   * Lo que el alumno corrigio de la serie en curso.
   *
   * `null` significa "igual a lo prescrito": asi confirmar sin tocar nada
   * sigue costando un toque y no hay que sincronizar los campos en cada
   * cambio de ejercicio.
   */
  readonly repsOverride = signal<number | null>(null);
  readonly weightOverride = signal<number | null>(null);
  readonly durationOverride = signal<number | null>(null);

  readonly repsValue = computed(
    () => this.repsOverride() ?? this.facade.currentExercise()?.targetReps ?? 1,
  );

  readonly weightValue = computed(
    () => this.weightOverride() ?? this.facade.currentExercise()?.weightKg ?? 0,
  );

  readonly durationValue = computed(
    () => this.durationOverride() ?? this.facade.currentExercise()?.durationSeconds ?? 60,
  );

  /** Pasos finos en series cortas, de a minuto en las largas. */
  readonly durationStep = computed(() => (this.durationValue() >= 300 ? 60 : 15));

  readonly porTiempo = computed(() => {
    const exercise = this.facade.currentExercise();
    return exercise !== null && measureOf(exercise) === 'time';
  });

  readonly conKg = computed(() => {
    const exercise = this.facade.currentExercise();
    return exercise !== null && usesKg(exercise);
  });

  /** Con peso extra los kg son solo los del extra, no el total: se dice. */
  readonly kgLabel = computed(() => {
    const exercise = this.facade.currentExercise();
    return exercise !== null && loadOf(exercise) === 'weighted_bodyweight'
      ? 'peso extra · kg'
      : 'kg';
  });

  /** "Peso corporal · Descanso 90 s". Sin descanso no se muestra un "0 s". */
  readonly metaLine = computed(() => {
    const exercise = this.facade.currentExercise();
    if (exercise === null) {
      return '';
    }
    const partes: string[] = [];
    if (loadOf(exercise) === 'bodyweight') {
      partes.push('Peso corporal');
    }
    if (exercise.restSeconds > 0) {
      partes.push(`Descanso ${formatDuration(exercise.restSeconds)}`);
    }
    return partes.join(' · ');
  });

  /** Cuenta regresiva en mm:ss; antes de iniciar muestra la duracion completa. */
  readonly workLabel = computed(() => {
    const total = this.facade.workRemaining() ?? this.durationValue();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  readonly skipping = signal<SkipTarget | null>(null);

  readonly reasons = (Object.keys(SKIP_REASON_LABEL) as SkipReason[]).map(value => ({
    value,
    label: SKIP_REASON_LABEL[value],
  }));

  readonly skipTitle = computed(() =>
    this.skipping() === 'exercise'
      ? `Saltar ${this.facade.currentExercise()?.name ?? 'ejercicio'}`
      : 'Saltar esta serie',
  );

  readonly skippedCount = computed(
    () => this.facade.exercises().filter(exercise => exercise.skipped === true).length,
  );

  readonly skippedLabel = computed(() =>
    this.skippedCount() === 1
      ? 'Saltaste 1 ejercicio'
      : `Saltaste ${this.skippedCount()} ejercicios`,
  );

  readonly reload = (): void => this.facade.reload();

  constructor() {
    this.facade.open(this.route.snapshot.paramMap.get('sessionId') ?? '');
  }

  /** Cierra la serie con lo corregido y vuelve a lo prescrito para la siguiente. */
  completeSet(): void {
    this.facade.completeSet(this.repsOverride(), this.weightOverride(), this.durationOverride());
    this.resetOverrides();
  }

  toggleWork(): void {
    this.facade.toggleWork(this.durationValue());
  }

  askSkip(target: SkipTarget): void {
    this.skipping.set(target);
  }

  cancelSkip(): void {
    this.skipping.set(null);
  }

  confirmSkip(reason: SkipReason | null): void {
    const target = this.skipping();
    if (target === null) {
      return;
    }
    if (target === 'set') {
      this.facade.skipSet(reason);
    } else {
      this.facade.skipExercise(reason);
    }
    this.skipping.set(null);
    this.resetOverrides();
  }

  /** Cambiar de ejercicio descarta lo corregido: era del ejercicio anterior. */
  previous(): void {
    this.resetOverrides();
    this.facade.previous();
  }

  next(): void {
    this.resetOverrides();
    this.facade.next();
  }

  private resetOverrides(): void {
    this.repsOverride.set(null);
    this.weightOverride.set(null);
    this.durationOverride.set(null);
  }

  async finish(): Promise<void> {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    try {
      await this.facade.finish();
      await this.router.navigate(['/student/routine']);
    } finally {
      this.saving.set(false);
    }
  }

  /** Sin sesion empezada no hay nada que perder: sale directo. */
  exit(): void {
    const phase = this.facade.phase();
    if (phase === 'idle' || phase === 'summary') {
      void this.router.navigate(['/student/routine']);
      return;
    }
    this.confirmingExit.set(true);
  }

  cancelExit(): void {
    this.confirmingExit.set(false);
  }

  leave(): void {
    this.confirmingExit.set(false);
    void this.router.navigate(['/student/routine']);
  }
}
