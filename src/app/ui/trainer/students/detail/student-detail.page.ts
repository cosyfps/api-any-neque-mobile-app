import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideArrowLeft, LucideCircleAlert, LucidePencil, LucidePlus } from '@lucide/angular';

import { TrainerInvitationFacade } from '@app/application/trainers/trainer-invitation.facade';
import { TrainerStudentDetailFacade } from '@app/application/trainers/trainer-student-detail.facade';
import {
  AnamnesisInput,
  hasClinicalFlags,
  isAnamnesisUsable,
} from '@app/domain/students/model/anamnesis.model';
import { Assessment } from '@app/domain/students/model/assessment.model';

import { LineChartComponent } from '@shared/components/chart/line-chart.component';
import { PageStateComponent } from '@shared/components/page-state.component';
import { SheetTrapDirective } from '@shared/directives/sheet-trap.directive';

import { AnamnesisFormComponent } from '../../shared/anamnesis-form.component';
import { AssessmentFormComponent } from '../../shared/assessment-form.component';
import { InvitationPanelComponent } from '../../shared/invitation-panel.component';
import { StudentFormComponent, StudentFormValue } from '../../shared/student-form.component';

/** Dias ISO en la etiqueta corta que ya usa el resto de la app. */
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

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
    LucideArrowLeft,
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
              <span class="nq-avatar lg" aria-hidden="true">{{ facade.avatarInitials() }}</span>
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
                <p class="latest">
                  Última el {{ fecha(latest.takenAt) }}: {{ latest.weightKg }} kg,
                  {{ latest.heightCm }} cm.
                </p>

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
                <p class="latest">{{ routine.name }}</p>
                <p class="empty-text">{{ dias(routine.days.length) }} · {{ routine.goal }}</p>
              } @else {
                <p class="nq-empty-inline">{{ sinRutina() }}</p>
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
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
