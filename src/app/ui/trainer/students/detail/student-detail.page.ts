import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideArrowLeft,
  LucideCalendarClock,
  LucideCalendarX,
  LucideChevronRight,
  LucideCircleAlert,
  LucidePencil,
  LucidePlus,
} from '@lucide/angular';

import { TrainerInvitationFacade } from '@app/application/trainers/trainer-invitation.facade';
import { TrainerStudentDetailFacade } from '@app/application/trainers/trainer-student-detail.facade';
import {
  CANCEL_REASON_LABEL,
  CancelReason,
  SCHEDULE_STATUS_LABEL,
  ScheduledSession,
  SESSION_KIND_LABEL,
  ScheduleStatus,
  SessionKind,
} from '@app/domain/schedule/model/scheduled-session.model';
import {
  AnamnesisInput,
  hasClinicalFlags,
  isAnamnesisUsable,
} from '@app/domain/students/model/anamnesis.model';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { describeSet } from '@app/domain/workouts/model/set-summary';
import {
  WorkoutExerciseLog,
  WorkoutSession,
} from '@app/domain/workouts/model/workout-session.model';
import {
  SKIP_REASON_LABEL,
  SkipReason,
  WorkoutSet,
} from '@app/domain/workouts/model/workout-set.model';

import { LineChartComponent } from '@shared/components/chart/line-chart.component';
import { PageStateComponent } from '@shared/components/page-state.component';
import { SheetTrapDirective } from '@shared/directives/sheet-trap.directive';
import { useFab } from '@shared/navigation/fab';

import { AnamnesisFormComponent } from '../../shared/anamnesis-form.component';
import {
  AppointmentFormComponent,
  AppointmentFormValue,
} from '../../shared/appointment-form.component';
import { AssessmentFormComponent } from '../../shared/assessment-form.component';
import { InvitationPanelComponent } from '../../shared/invitation-panel.component';
import { StudentFormComponent, StudentFormValue } from '../../shared/student-form.component';

/** Dias ISO en la etiqueta corta que ya usa el resto de la app. */
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const FECHA_ENTRENO = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});
const DIA_CITA = new Intl.DateTimeFormat('es-CL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const HORA_CITA = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [
    PageStateComponent,
    SheetTrapDirective,
    LineChartComponent,
    InvitationPanelComponent,
    StudentFormComponent,
    AnamnesisFormComponent,
    AssessmentFormComponent,
    AppointmentFormComponent,
    LucideArrowLeft,
    LucideCalendarClock,
    LucideCalendarX,
    LucideChevronRight,
    LucideCircleAlert,
    LucidePencil,
    LucidePlus,
  ],
  providers: [TrainerStudentDetailFacade, TrainerInvitationFacade],
  template: `
    <div class="page">
      <header class="head">
        <button class="nav-back" type="button" aria-label="Volver a la cartera" (click)="goBack()">
          <svg lucideArrowLeft [size]="22" [strokeWidth]="1.8"></svg>
        </button>
      </header>

      @switch (facade.viewState()) {
        @case ('loading') {
          <nq-page-state type="loading" loadingLabel="Cargando la ficha" />
        }
        @case ('error') {
          <nq-page-state type="error" message="No pudimos cargar esta ficha." [retry]="reload" />
        }
        @default {
          @if (facade.student.data(); as student) {
            <section class="identity">
              <span class="nq-avatar lg" aria-hidden="true">
                @if (student.avatarUrl) {
                  <img [src]="student.avatarUrl" alt="" />
                } @else {
                  {{ facade.avatarInitials() }}
                }
              </span>
              <div class="identity-body">
                <h1 class="nq-h2">{{ facade.displayName() }}</h1>
                <p class="email">{{ student.email }}</p>
              </div>
              @if (facade.suspended()) {
                <span class="nq-badge nq-badge-warning">Suspendido</span>
              }
            </section>

            @if (clinicalFlags()) {
              <p class="flags" role="status">
                <svg lucideCircleAlert [size]="16" [strokeWidth]="2"></svg>
                Tiene antecedentes clínicos registrados. Revísalos antes de prescribir.
              </p>
            }

            <section class="nq-section">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Datos</h2>
                <button class="nq-section-action" type="button" (click)="openEdit()">
                  <svg lucidePencil [size]="16" [strokeWidth]="2"></svg>
                  Editar
                </button>
              </div>
              <dl class="data">
                <div class="data-row">
                  <dt>Teléfono</dt>
                  <dd>{{ student.phone ?? 'Sin registrar' }}</dd>
                </div>
                <div class="data-row">
                  <dt>Estatura</dt>
                  <dd>{{ height() }}</dd>
                </div>
                <div class="data-row">
                  <dt>Objetivo</dt>
                  <dd>{{ student.goal ?? 'Sin registrar' }}</dd>
                </div>
              </dl>
            </section>

            <section class="nq-section">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Anamnesis</h2>
                <button class="nq-section-action" type="button" (click)="openAnamnesis()">
                  <svg lucidePencil [size]="16" [strokeWidth]="2"></svg>
                  {{ facade.anamnesis.data() === null ? 'Registrar' : 'Editar' }}
                </button>
              </div>
              @if (facade.anamnesis.data(); as anamnesis) {
                <dl class="data">
                  <div class="data-row">
                    <dt>Objetivo declarado</dt>
                    <dd>{{ anamnesis.declaredGoal }}</dd>
                  </div>
                  <div class="data-row">
                    <dt>Disponibilidad</dt>
                    <dd>{{ availability() }}</dd>
                  </div>
                  <div class="data-row">
                    <dt>Contacto de urgencia</dt>
                    <dd>{{ emergency() }}</dd>
                  </div>
                </dl>
              } @else {
                <p class="nq-empty-inline">
                  Sin anamnesis registrada. Sin ella no se puede planificar una rutina.
                </p>
              }
            </section>

            <section class="nq-section">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Evaluaciones</h2>
                <button class="nq-section-action" type="button" (click)="openAssessment()">
                  <svg lucidePlus [size]="16" [strokeWidth]="2"></svg>
                  Registrar
                </button>
              </div>
              @if (facade.latestAssessment(); as latest) {
                <!-- Resumen corto: el dato primero y la fecha como contexto. -->
                <div class="latest-summary">
                  <span class="latest-label">Última evaluación · {{ fecha(latest.takenAt) }}</span>
                  <span class="latest-values">
                    {{ latest.weightKg }} kg · {{ latest.heightCm }} cm
                  </span>
                </div>

                @if (weightSeries().length > 1) {
                  <nq-line-chart
                    [data]="weightSeries()"
                    ariaLabel="Evolución del peso en las últimas evaluaciones"
                  />
                }

                <ul class="history" role="list">
                  @for (item of facade.assessmentHistory(); track item.id) {
                    <li class="history-row">
                      <span class="history-date">{{ fecha(item.takenAt) }}</span>
                      <span class="history-value">{{ item.weightKg }} kg</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="nq-empty-inline">Todavía no tiene evaluaciones.</p>
              }
            </section>

            <section class="nq-section">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Rutina activa</h2>
              </div>
              @if (facade.routine.data(); as routine) {
                <div class="routine-card">
                  <p class="latest">{{ routine.name }}</p>
                  <p class="empty-text">{{ dias(routine.days.length) }} · {{ routine.goal }}</p>
                </div>
              } @else {
                <p class="nq-empty-inline">{{ sinRutina() }}</p>
              }
            </section>

            <section class="nq-section">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Entrenamientos realizados</h2>
              </div>
              @if (historial().length > 0) {
                <ul class="trainings" role="list">
                  @for (sesion of historial(); track sesion.id) {
                    <li>
                      <button class="training-row" type="button" (click)="openTraining(sesion)">
                        <span class="training-body">
                          <span class="training-title">{{ sesion.title }}</span>
                          <span class="training-meta">{{ resumenEntreno(sesion) }}</span>
                        </span>
                        <span
                          class="nq-badge"
                          [class]="
                            sesion.status === 'completed' ? 'nq-badge-success' : 'nq-badge-warning'
                          "
                        >
                          {{ sesion.status === 'completed' ? 'Completado' : 'A medias' }}
                        </span>
                        <svg
                          class="training-chevron"
                          lucideChevronRight
                          [size]="18"
                          [strokeWidth]="2"
                        ></svg>
                      </button>
                    </li>
                  }
                </ul>
                @if (facade.trainingHistory().length > historial().length) {
                  <button class="more-btn" type="button" (click)="verTodos.set(true)">
                    Ver los {{ facade.trainingHistory().length }} entrenamientos
                  </button>
                }
              } @else {
                <p class="nq-empty-inline">Todavía no registra entrenamientos.</p>
              }
            </section>

            <section class="nq-section">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Próximas citas</h2>
                <button class="nq-section-action" type="button" (click)="openAppointment()">
                  <svg lucidePlus [size]="16" [strokeWidth]="2"></svg>
                  Agendar
                </button>
              </div>
              @if (facade.appointments.data()?.length) {
                <ul class="appointments" role="list">
                  @for (cita of facade.appointments.data(); track cita.id) {
                    <li
                      class="appointment"
                      [class.cancelled]="cita.status === 'cancelled'"
                      [class.actionable]="cita.status !== 'cancelled'"
                      [attr.role]="cita.status !== 'cancelled' ? 'button' : null"
                      [attr.tabindex]="cita.status !== 'cancelled' ? 0 : null"
                      [attr.aria-label]="
                        cita.status !== 'cancelled' ? 'Opciones de la cita ' + cita.title : null
                      "
                      (click)="openAppointmentOptions(cita)"
                      (keydown.enter)="openAppointmentOptions(cita)"
                      (keydown.space)="$event.preventDefault(); openAppointmentOptions(cita)"
                    >
                      <div class="appointment-when">
                        <span class="appointment-day">{{ diaCita(cita.startsAt) }}</span>
                        <span class="appointment-hour">{{ horaCita(cita.startsAt) }}</span>
                      </div>
                      <div class="appointment-body">
                        <span class="appointment-title">{{ cita.title }}</span>
                        <span class="appointment-meta">
                          {{ tipoCita(cita.kind) }}{{ cita.location ? ' · ' + cita.location : '' }}
                        </span>
                      </div>
                      <span class="nq-badge" [class]="estadoClase(cita.status)">
                        {{ estadoCita(cita.status) }}
                      </span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="nq-empty-inline">Sin citas agendadas.</p>
              }
            </section>

            <section class="nq-section">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Acceso</h2>
              </div>
              <nq-invitation-panel [studentId]="student.id" />
            </section>

            <section class="nq-section">
              <button
                class="nq-btn nq-btn-secondary danger-btn"
                type="button"
                (click)="askStatus()"
              >
                {{ facade.suspended() ? 'Reactivar cuenta' : 'Suspender cuenta' }}
              </button>
            </section>
          }
        }
      }
    </div>

    <!-- Los overlays viven siempre en el DOM y solo conmutan la clase open:
         es como el design system los anima, y cerrados no dejan nada
         tabulable. -->
    <div class="nq-overlay" [class.open]="editing()" (click)="closeEdit()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-title"
        [nqSheetTrap]="editing()"
        (dismissed)="closeEdit()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="editar-title">Editar datos</h2>

        <nq-student-form
          #formulario
          mode="edit"
          submitLabel="Guardar cambios"
          [student]="facade.student.data()"
          [busy]="facade.busy()"
          [errorMessage]="facade.actionError()?.message ?? null"
          (submitted)="saveEdit($event)"
          (cancelled)="closeEdit()"
        />
      </div>
    </div>

    <div class="nq-overlay" [class.open]="editingAnamnesis()" (click)="closeAnamnesis()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anamnesis-title"
        [nqSheetTrap]="editingAnamnesis()"
        (dismissed)="closeAnamnesis()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="anamnesis-title">Anamnesis</h2>

        <nq-anamnesis-form
          #anamnesisForm
          [anamnesis]="facade.anamnesis.data() ?? null"
          [busy]="facade.busy()"
          [errorMessage]="facade.actionError()?.message ?? null"
          (submitted)="saveAnamnesis($event)"
          (cancelled)="closeAnamnesis()"
        />
      </div>
    </div>

    <div class="nq-overlay" [class.open]="addingAssessment()" (click)="closeAssessment()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evaluacion-title"
        [nqSheetTrap]="addingAssessment()"
        (dismissed)="closeAssessment()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="evaluacion-title">Nueva evaluación</h2>

        <nq-assessment-form
          #assessmentForm
          [defaultHeightCm]="facade.student.data()?.heightCm ?? null"
          [busy]="facade.busy()"
          [errorMessage]="facade.actionError()?.message ?? null"
          (submitted)="saveAssessment($event)"
          (cancelled)="closeAssessment()"
        />
      </div>
    </div>

    <div class="nq-overlay" [class.open]="addingAppointment()" (click)="closeAppointment()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cita-title"
        [nqSheetTrap]="addingAppointment()"
        (dismissed)="closeAppointment()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="cita-title">
          {{ editingAppointment() === null ? 'Agendar cita' : 'Reagendar cita' }}
        </h2>

        <nq-appointment-form
          #appointmentForm
          [busy]="facade.busy()"
          [errorMessage]="facade.actionError()?.message ?? null"
          [submitLabel]="editingAppointment() === null ? 'Agendar cita' : 'Guardar cambios'"
          (submitted)="saveAppointment($event)"
          (cancelled)="closeAppointment()"
        />
      </div>
    </div>

    <!-- Opciones de una cita: misma lista con divisores que los ejercicios. -->
    <div
      class="nq-overlay"
      [class.open]="appointmentOptions() !== null"
      (click)="closeAppointmentOptions()"
    >
      <div
        class="nq-sheet confirm options-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="opciones-cita-title"
        [nqSheetTrap]="appointmentOptions() !== null"
        (dismissed)="closeAppointmentOptions()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="opciones-cita-title">{{ appointmentOptions()?.title }}</h2>
        @if (appointmentOptions(); as cita) {
          <p class="options-group">
            {{ diaCita(cita.startsAt) }} · {{ horaCita(cita.startsAt) }} ·
            {{ estadoCita(cita.status) }}
          </p>
          <div class="options-list">
            <button class="option" type="button" (click)="openReschedule(cita)">
              <svg class="option-icon" lucideCalendarClock [size]="20" [strokeWidth]="2"></svg>
              <span class="option-label">Reagendar</span>
              <svg class="option-chevron" lucideChevronRight [size]="18" [strokeWidth]="2"></svg>
            </button>
            <button class="option danger" type="button" (click)="askCancelAppointment(cita)">
              <svg class="option-icon" lucideCalendarX [size]="20" [strokeWidth]="2"></svg>
              <span class="option-label">Cancelar cita</span>
            </button>
          </div>
        }
        <button class="options-cancel" type="button" (click)="closeAppointmentOptions()">
          Cerrar
        </button>
      </div>
    </div>

    <div
      class="nq-overlay"
      [class.open]="cancellingAppointment() !== null"
      (click)="closeCancelAppointment()"
    >
      <div
        class="nq-sheet confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancelar-cita-title"
        [nqSheetTrap]="cancellingAppointment() !== null"
        (dismissed)="closeCancelAppointment()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="cancelar-cita-title">
          ¿Cancelar «{{ cancellingAppointment()?.title }}»?
        </h2>
        <p class="empty-text">El alumno recibe un aviso con la cancelación.</p>

        <div class="cancel-fields">
          <div class="field">
            <label class="nq-field-label" for="cancelar-motivo">Motivo *</label>
            <div class="nq-field-input">
              <select id="cancelar-motivo" (change)="setCancelReason($event)">
                @for (motivo of motivos; track motivo.value) {
                  <option [value]="motivo.value" [selected]="motivo.value === cancelReason()">
                    {{ motivo.label }}
                  </option>
                }
              </select>
            </div>
          </div>

          <div class="field">
            <label class="nq-field-label" for="cancelar-nota">
              Nota{{ cancelReason() === 'other' ? ' *' : '' }}
            </label>
            <div class="nq-field-input" [class.error]="cancelNoteError() !== null">
              <input
                id="cancelar-nota"
                maxlength="500"
                [value]="cancelNote()"
                [attr.aria-invalid]="cancelNoteError() !== null"
                [attr.aria-describedby]="cancelNoteError() ? 'cancelar-nota-error' : null"
                (input)="setCancelNote($event)"
              />
            </div>
            @if (cancelNoteError(); as error) {
              <span class="nq-field-error" id="cancelar-nota-error">{{ error }}</span>
            }
          </div>
        </div>

        @if (facade.actionError(); as error) {
          <p class="nq-field-error" role="alert">{{ error.message }}</p>
        }

        <div class="confirm-actions">
          <button class="nq-btn nq-btn-secondary" type="button" (click)="closeCancelAppointment()">
            Volver
          </button>
          <button
            class="nq-btn danger-confirm"
            type="button"
            [disabled]="facade.busy()"
            (click)="confirmCancelAppointment()"
          >
            Cancelar cita
          </button>
        </div>
      </div>
    </div>

    <!-- Detalle de un entrenamiento: lo que el alumno registro serie a serie. -->
    <div class="nq-overlay" [class.open]="training() !== null" (click)="closeTraining()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entreno-title"
        [nqSheetTrap]="training() !== null"
        (dismissed)="closeTraining()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        @if (training(); as sesion) {
          <h2 class="nq-sheet-title training-sheet-title" id="entreno-title">
            {{ sesion.title }}
          </h2>
          <p class="training-sheet-meta">{{ resumenEntreno(sesion) }}</p>

          <ul class="training-exercises" role="list">
            @for (ejercicio of sesion.exercises; track ejercicio.routineExerciseId) {
              <li class="training-exercise">
                <div class="training-exercise-head">
                  <span class="training-exercise-name">{{ ejercicio.name }}</span>
                  <span class="training-exercise-target">
                    {{ ejercicio.completedSets }}/{{ ejercicio.targetSets }} series
                  </span>
                </div>
                @if (ejercicio.skipped) {
                  <p class="training-skip">
                    Saltado{{
                      ejercicio.skipReason ? ' · ' + motivoSalto(ejercicio.skipReason) : ''
                    }}
                  </p>
                } @else if (ejercicio.sets.length > 0) {
                  <ol class="training-sets">
                    @for (serie of ejercicio.sets; track serie.id) {
                      <li [class.skipped]="serie.skipped">
                        <span class="set-number">{{ serie.setNumber }}</span>
                        {{ describeSerie(serie, ejercicio) }}
                      </li>
                    }
                  </ol>
                } @else {
                  <p class="training-skip">Sin series registradas.</p>
                }
              </li>
            }
          </ul>
        }
        <button
          class="nq-btn nq-btn-secondary close-training"
          type="button"
          (click)="closeTraining()"
        >
          Cerrar
        </button>
      </div>
    </div>

    <div class="nq-overlay" [class.open]="confirmingStatus()" (click)="cancelStatus()">
      <div
        class="nq-sheet confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="estado-title"
        [nqSheetTrap]="confirmingStatus()"
        (dismissed)="cancelStatus()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="estado-title">{{ statusTitle() }}</h2>
        <p class="empty-text">{{ statusDescription() }}</p>

        <div class="confirm-actions">
          <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelStatus()">
            Cancelar
          </button>
          <button
            class="nq-btn nq-btn-primary"
            type="button"
            [disabled]="facade.busy()"
            (click)="confirmStatus()"
          >
            {{ facade.suspended() ? 'Reactivar' : 'Suspender' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './student-detail.page.scss',
})
export class StudentDetailPage {
  readonly facade = inject(TrainerStudentDetailFacade);
  readonly invitation = inject(TrainerInvitationFacade);

  readonly confirmingStatus = signal(false);
  readonly editing = signal(false);
  readonly editingAnamnesis = signal(false);
  readonly addingAssessment = signal(false);
  readonly addingAppointment = signal(false);
  /** Entrenamiento abierto en detalle (T-3). */
  readonly training = signal<WorkoutSession | null>(null);
  /** El historial muestra 5; "Ver todos" los despliega. */
  readonly verTodos = signal(false);
  readonly historial = computed(() => {
    const todos = this.facade.trainingHistory();
    return this.verTodos() ? todos : todos.slice(0, 5);
  });
  /** Cita que se reagenda; null cuando el sheet agenda una nueva. */
  readonly editingAppointment = signal<ScheduledSession | null>(null);
  readonly appointmentOptions = signal<ScheduledSession | null>(null);
  readonly cancellingAppointment = signal<ScheduledSession | null>(null);
  readonly cancelReason = signal<CancelReason>('rescheduled');
  readonly cancelNote = signal('');
  private readonly cancelTried = signal(false);

  readonly motivos = Object.entries(CANCEL_REASON_LABEL).map(([value, label]) => ({
    value: value as CancelReason,
    label,
  }));

  /** Con «Otro motivo» la nota es obligatoria (la base lo exige). */
  readonly cancelNoteError = computed(() =>
    this.cancelTried() && this.cancelReason() === 'other' && this.cancelNote().trim() === ''
      ? 'Cuéntale al alumno el motivo.'
      : null,
  );

  readonly clinicalFlags = computed(() => {
    const value = this.facade.anamnesis.data();
    return value !== null && value !== undefined && hasClinicalFlags(value);
  });

  readonly planificable = computed(() => isAnamnesisUsable(this.facade.anamnesis.data() ?? null));

  readonly sinRutina = computed(() =>
    this.planificable()
      ? 'Sin rutina asignada. Ya puedes crearle una.'
      : 'Sin rutina asignada. Registra primero su anamnesis.',
  );

  readonly height = computed(() => {
    const cm = this.facade.student.data()?.heightCm;
    return cm === null || cm === undefined ? 'Sin registrar' : `${cm} cm`;
  });

  readonly availability = computed(() => {
    const value = this.facade.anamnesis.data();
    if (value === null || value === undefined || value.weeklyAvailability.length === 0) {
      return 'Sin registrar';
    }
    return value.weeklyAvailability.map(day => DIAS[day - 1] ?? '').join(', ');
  });

  readonly emergency = computed(() => {
    const contacto = this.facade.anamnesis.data()?.emergencyContact;
    if (contacto === null || contacto === undefined) {
      return 'Sin registrar';
    }
    return `${contacto.name} (${contacto.relation}) · ${contacto.phone}`;
  });

  readonly statusTitle = computed(() =>
    this.facade.suspended() ? '¿Reactivar la cuenta?' : '¿Suspender la cuenta?',
  );

  readonly statusDescription = computed(() =>
    this.facade.suspended()
      ? 'Volverá a poder ingresar con su correo y contraseña.'
      : 'No podrá ingresar, pero su ficha y todo su historial se conservan.',
  );

  readonly reload = (): void => this.facade.reload();

  /** Serie de peso para el grafico, de la mas antigua a la mas reciente. */
  readonly weightSeries = computed(() =>
    [...this.facade.assessmentHistory()].reverse().map(item => ({
      value: item.weightKg,
      label: new Date(item.takenAt).toLocaleDateString('es-CL', { month: 'short' }),
    })),
  );

  private readonly formulario = viewChild<StudentFormComponent>('formulario');
  private readonly anamnesisForm = viewChild<AnamnesisFormComponent>('anamnesisForm');
  private readonly assessmentForm = viewChild<AssessmentFormComponent>('assessmentForm');
  private readonly appointmentForm = viewChild<AppointmentFormComponent>('appointmentForm');
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    // Mensajes con el alumno: boton flotante abajo a la derecha, como el "+".
    useFab(
      () => `Enviar un mensaje a ${this.facade.displayName() || 'tu alumno'}`,
      () => this.openMessages(),
      'message',
    );
    const studentId = this.route.snapshot.paramMap.get('studentId') ?? '';
    this.facade.load(studentId);
    this.invitation.load(studentId);
    this.abrirAccionPedida();
  }

  /**
   * El inicio del entrenador llega con `?accion=anamnesis` o
   * `?accion=evaluacion` para resolver un pendiente de un toque: la hoja se
   * abre sola cuando la ficha termina de cargar, una sola vez.
   */
  private abrirAccionPedida(): void {
    const accion = this.route.snapshot.queryParamMap.get('accion');
    if (accion !== 'anamnesis' && accion !== 'evaluacion') {
      return;
    }
    const pendiente = effect(() => {
      if (this.facade.viewState() !== 'success') {
        return;
      }
      untracked(() => (accion === 'anamnesis' ? this.openAnamnesis() : this.openAssessment()));
      pendiente.destroy();
    });
  }

  dias(total: number): string {
    return total === 1 ? '1 día a la semana' : `${total} días a la semana`;
  }

  fecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  }

  goBack(): void {
    void this.router.navigate(['/trainer/students']);
  }

  openMessages(): void {
    void this.router.navigate(['/trainer/students', this.facade.studentId(), 'messages']);
  }

  openEdit(): void {
    this.editing.set(true);
    this.formulario()?.reset();
  }

  closeEdit(): void {
    this.editing.set(false);
  }

  /** El correo no viaja: cambiarlo rompe las invitaciones ya emitidas. */
  async saveEdit(value: StudentFormValue): Promise<void> {
    const guardado = await this.facade.edit({
      firstName: value.firstName,
      lastName: value.lastName,
      phone: value.phone,
      birthDate: value.birthDate,
      heightCm: value.heightCm,
      goal: value.goal,
    });

    if (guardado) {
      this.editing.set(false);
    }
  }

  openAnamnesis(): void {
    this.editingAnamnesis.set(true);
    this.anamnesisForm()?.reset();
  }

  closeAnamnesis(): void {
    this.editingAnamnesis.set(false);
  }

  async saveAnamnesis(value: Omit<AnamnesisInput, 'studentId'>): Promise<void> {
    if (await this.facade.saveAnamnesis(value)) {
      this.editingAnamnesis.set(false);
    }
  }

  openAssessment(): void {
    this.addingAssessment.set(true);
    this.assessmentForm()?.reset();
  }

  closeAssessment(): void {
    this.addingAssessment.set(false);
  }

  async saveAssessment(value: Omit<Assessment, 'id' | 'studentId' | 'takenAt'>): Promise<void> {
    if (await this.facade.addAssessment(value)) {
      this.addingAssessment.set(false);
    }
  }

  openTraining(sesion: WorkoutSession): void {
    this.training.set(sesion);
  }

  closeTraining(): void {
    this.training.set(null);
  }

  /** "Martes 3 de nov. · 6/6 ejercicios · 52 min" */
  resumenEntreno(sesion: WorkoutSession): string {
    const fecha = new Date(sesion.completedAt ?? sesion.startedAt ?? sesion.scheduledFor);
    const dia = FECHA_ENTRENO.format(fecha);
    const hechos = sesion.exercises.filter(ejercicio => ejercicio.done).length;
    const partes = [
      `${dia.charAt(0).toUpperCase()}${dia.slice(1)}`,
      `${hechos}/${sesion.exercises.length} ejercicios`,
    ];
    if (sesion.durationMinutes !== null) {
      partes.push(`${sesion.durationMinutes} min`);
    }
    return partes.join(' · ');
  }

  describeSerie(serie: WorkoutSet, ejercicio: WorkoutExerciseLog): string {
    return describeSet(serie, ejercicio);
  }

  motivoSalto(motivo: SkipReason): string {
    return SKIP_REASON_LABEL[motivo];
  }

  openAppointment(): void {
    this.facade.clearActionError();
    this.editingAppointment.set(null);
    this.addingAppointment.set(true);
    this.appointmentForm()?.reset();
  }

  /** Una cita cancelada ya no tiene opciones. */
  openAppointmentOptions(cita: ScheduledSession): void {
    if (cita.status === 'cancelled') {
      return;
    }
    this.appointmentOptions.set(cita);
  }

  closeAppointmentOptions(): void {
    this.appointmentOptions.set(null);
  }

  openReschedule(cita: ScheduledSession): void {
    this.facade.clearActionError();
    this.appointmentOptions.set(null);
    this.editingAppointment.set(cita);
    this.addingAppointment.set(true);
    this.appointmentForm()?.reset(cita);
  }

  askCancelAppointment(cita: ScheduledSession): void {
    this.facade.clearActionError();
    this.appointmentOptions.set(null);
    this.cancelReason.set('rescheduled');
    this.cancelNote.set('');
    this.cancelTried.set(false);
    this.cancellingAppointment.set(cita);
  }

  closeCancelAppointment(): void {
    this.cancellingAppointment.set(null);
  }

  setCancelReason(event: Event): void {
    this.cancelReason.set((event.target as HTMLSelectElement).value as CancelReason);
  }

  setCancelNote(event: Event): void {
    this.cancelNote.set((event.target as HTMLInputElement).value);
  }

  async confirmCancelAppointment(): Promise<void> {
    const cita = this.cancellingAppointment();
    this.cancelTried.set(true);
    if (cita === null || this.cancelNoteError() !== null) {
      return;
    }
    const nota = this.cancelNote().trim();
    if (
      await this.facade.cancelAppointment(cita.id, this.cancelReason(), nota === '' ? null : nota)
    ) {
      this.cancellingAppointment.set(null);
    }
  }

  closeAppointment(): void {
    this.addingAppointment.set(false);
  }

  async saveAppointment(value: AppointmentFormValue): Promise<void> {
    const actual = this.editingAppointment();
    const guardado =
      actual === null
        ? await this.facade.scheduleAppointment(value)
        : await this.facade.rescheduleAppointment(actual.id, value);
    if (guardado) {
      this.addingAppointment.set(false);
    }
  }

  diaCita(iso: string): string {
    return DIA_CITA.format(new Date(iso));
  }

  horaCita(iso: string): string {
    return HORA_CITA.format(new Date(iso));
  }

  tipoCita(kind: SessionKind): string {
    return SESSION_KIND_LABEL[kind];
  }

  estadoCita(status: ScheduleStatus): string {
    return SCHEDULE_STATUS_LABEL[status];
  }

  estadoClase(status: ScheduleStatus): string {
    if (status === 'confirmed') return 'nq-badge-success';
    if (status === 'cancelled') return 'nq-badge-danger';
    return 'nq-badge-warning';
  }

  askStatus(): void {
    this.confirmingStatus.set(true);
  }

  cancelStatus(): void {
    this.confirmingStatus.set(false);
  }

  async confirmStatus(): Promise<void> {
    await this.facade.toggleStatus();
    this.confirmingStatus.set(false);
  }
}
