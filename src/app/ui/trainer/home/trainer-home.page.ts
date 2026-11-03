import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideBell,
  LucideCheck,
  LucideCircleCheck,
  LucideDumbbell,
  LucideSkipForward,
  LucideTrendingDown,
  LucideTriangleAlert,
  LucideUserPlus,
} from '@lucide/angular';

import { NotificationsFacade } from '@app/application/notifications/notifications.facade';
import {
  PendingKind,
  PendingStudent,
  TrainerHomeFacade,
} from '@app/application/trainers/trainer-home.facade';

import { PageStateComponent } from '@shared/components/page-state.component';
import { SheetTrapDirective } from '@shared/directives/sheet-trap.directive';

/** Texto del boton que resuelve cada pendiente. */
const ACCION: Record<PendingKind, string> = {
  no_routine: 'Asignar',
  no_anamnesis: 'Registrar',
  no_assessment: 'Evaluar',
};

@Component({
  selector: 'app-trainer-home',
  standalone: true,
  imports: [
    PageStateComponent,
    SheetTrapDirective,
    LucideBell,
    LucideCheck,
    LucideCircleCheck,
    LucideDumbbell,
    LucideSkipForward,
    LucideTrendingDown,
    LucideTriangleAlert,
    LucideUserPlus,
  ],
  providers: [TrainerHomeFacade],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <span class="greeting">{{ facade.greeting() }},</span>
          <h1 class="name">{{ facade.trainerFirstName() }}</h1>
        </div>
        <button
          class="bell"
          type="button"
          [attr.aria-label]="bellLabel()"
          (click)="goToNotifications()"
        >
          <svg lucideBell [size]="20" [strokeWidth]="1.8"></svg>
          @if (notifications.hasUnread()) {
            <span class="bell-badge">{{ notifications.unreadCount() }}</span>
          }
        </button>
      </header>

      @switch (facade.viewState()) {
        @case ('loading') {
          <nq-page-state type="loading" loadingLabel="Cargando tu día" />
        }
        @case ('error') {
          <nq-page-state type="error" message="No pudimos cargar tu día." [retry]="reload" />
        }
        @default {
          <div class="kpis nq-ani">
            <button class="kpi kpi-1" type="button" (click)="goToStudents()">
              <span class="kpi-value">{{ facade.activeCount() }}</span>
              <span class="kpi-label">{{
                facade.activeCount() === 1 ? 'alumno activo' : 'alumnos activos'
              }}</span>
            </button>
            <div class="kpi kpi-2">
              <span class="kpi-value">{{ adherenceLabel() }}</span>
              <span class="kpi-label">adherencia promedio</span>
            </div>
            <div class="kpi kpi-3">
              <span class="kpi-value"
                >{{ facade.week().completed }}/{{ facade.week().planned }}</span
              >
              <span class="kpi-label">sesiones esta semana</span>
            </div>
            <button
              class="kpi kpi-4"
              type="button"
              [class.alerta]="facade.attentionCount() > 0"
              [disabled]="facade.attentionCount() === 0"
              (click)="scrollToAttention()"
            >
              <span class="kpi-value">{{ facade.attentionCount() }}</span>
              <span class="kpi-label">por atender</span>
            </button>
          </div>

          @if (facade.risks().length > 0 || facade.pending().length > 0) {
            <section class="nq-section nq-ani nq-d1" id="atencion">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Por atender</h2>
              </div>
              <ul class="alerts" role="list">
                @for (item of facade.risks(); track item.id) {
                  <li>
                    <button class="alert risk" type="button" (click)="openStudent(item.id)">
                      <svg lucideTrendingDown [size]="18" [strokeWidth]="2"></svg>
                      <span class="alert-body">
                        <span class="alert-title">{{ item.name }} en riesgo</span>
                        <span class="alert-sub">{{ item.reason }}</span>
                      </span>
                      <span class="alert-action">Ver ficha</span>
                    </button>
                  </li>
                }
                @for (item of facade.pending(); track item.id) {
                  <li>
                    <button class="alert pending" type="button" (click)="resolve(item)">
                      <svg lucideTriangleAlert [size]="18" [strokeWidth]="2"></svg>
                      <span class="alert-body">
                        <span class="alert-title">{{ item.name }}</span>
                        <span class="alert-sub">{{ item.reason }}</span>
                      </span>
                      <span class="alert-action">{{ accion(item.kind) }}</span>
                    </button>
                  </li>
                }
              </ul>
            </section>
          }

          <section class="nq-section nq-ani nq-d2">
            <div class="nq-section-header">
              <h2 class="nq-section-title">Hoy</h2>
              @if (facade.today().length > 0) {
                <span class="section-count">{{ sesionesHoy() }}</span>
              }
            </div>
            @if (facade.today().length > 0) {
              <ul class="timeline" role="list">
                @for (sesion of facade.today(); track sesion.id) {
                  <li>
                    <button class="slot" type="button" (click)="openStudent(sesion.studentId)">
                      <span class="slot-time">{{ hora(sesion.scheduledFor) }}</span>
                      <span class="avatar" aria-hidden="true">{{ sesion.initials }}</span>
                      <span class="slot-body">
                        <span class="slot-name">{{ sesion.studentName }}</span>
                        <span class="slot-sub"
                          >{{ sesion.title }} · {{ sesion.estimatedMinutes }} min</span
                        >
                      </span>
                    </button>
                  </li>
                }
              </ul>
            } @else {
              <p class="nq-empty-inline">Nadie entrena hoy. Buen momento para planificar.</p>
            }
          </section>

          <section class="nq-section nq-ani nq-d3">
            <div class="nq-section-header">
              <h2 class="nq-section-title">Actividad reciente</h2>
              <button class="see-all" type="button" (click)="goToNotifications()">Ver todo</button>
            </div>
            @if (facade.activity().length > 0) {
              <ul class="feed" role="list">
                @for (evento of facade.activity(); track evento.id) {
                  <li>
                    <button
                      class="event"
                      type="button"
                      [class.skipped]="evento.kind === 'skipped'"
                      (click)="openStudent(evento.studentId)"
                    >
                      <span class="event-dot">
                        @if (evento.kind === 'skipped') {
                          <svg lucideSkipForward [size]="12" [strokeWidth]="2.4"></svg>
                        } @else {
                          <svg lucideCheck [size]="12" [strokeWidth]="3"></svg>
                        }
                      </span>
                      <span class="event-body">
                        <span class="event-text">
                          <strong>{{ evento.studentName }}</strong>
                          {{ evento.kind === 'skipped' ? 'saltó' : 'completó' }}
                          <strong>{{ evento.subject }}</strong>
                        </span>
                        <span class="event-sub">{{ evento.detail }}</span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            } @else {
              <p class="nq-empty-inline">
                Aquí vas a ver las sesiones que completen tus alumnos y lo que salten.
              </p>
            }
          </section>

          <section class="nq-section nq-ani nq-d4">
            <div class="nq-section-header">
              <h2 class="nq-section-title">Atajos</h2>
            </div>
            <div class="shortcuts">
              <button class="shortcut strong" type="button" (click)="goToStudents()">
                <svg lucideUserPlus [size]="22" [strokeWidth]="1.8"></svg>
                Registrar alumno
              </button>
              <button class="shortcut" type="button" (click)="goToRoutines()">
                <svg lucideDumbbell [size]="22" [strokeWidth]="1.8"></svg>
                Crear rutina
              </button>
            </div>
          </section>
        }
      }
    </div>

    <!-- Asignar rutina sin salir del inicio: el pendiente se resuelve aqui. -->
    <div class="nq-overlay" [class.open]="assigning() !== null" (click)="closeAssign()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-assign-title"
        [nqSheetTrap]="assigning() !== null"
        (dismissed)="closeAssign()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="home-assign-title">
          Asignar rutina a {{ assigning()?.name }}
        </h2>

        @if (options().length > 0) {
          <ul class="options" role="radiogroup" aria-labelledby="home-assign-title">
            @for (opcion of options(); track opcion.routine.id) {
              <li>
                <button
                  class="option"
                  type="button"
                  role="radio"
                  [attr.aria-checked]="selected() === opcion.routine.id"
                  [class.selected]="selected() === opcion.routine.id"
                  (click)="selected.set(opcion.routine.id)"
                >
                  <span class="option-body">
                    <span class="option-name">{{ opcion.routine.name }}</span>
                    <span class="option-sub">{{ opcion.routine.goal }}</span>
                  </span>
                  @if (opcion.suggested) {
                    <span class="nq-badge nq-badge-primary">Sugerida</span>
                  }
                  <span class="option-check">
                    @if (selected() === opcion.routine.id) {
                      <svg lucideCircleCheck [size]="20" [strokeWidth]="2"></svg>
                    }
                  </span>
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="nq-empty-inline">Aún no tienes rutinas. Crea una y vuelve a asignarla.</p>
        }

        @if (facade.actionError(); as error) {
          <p class="nq-field-error" role="alert">{{ error.message }}</p>
        }

        <div class="sheet-actions">
          <button class="nq-btn nq-btn-secondary" type="button" (click)="closeAssign()">
            Cancelar
          </button>
          @if (options().length > 0) {
            <button
              class="nq-btn nq-btn-primary"
              type="button"
              [disabled]="selected() === null || facade.busy()"
              (click)="confirmAssign()"
            >
              {{ facade.busy() ? 'Asignando…' : 'Asignar' }}
            </button>
          } @else {
            <button class="nq-btn nq-btn-primary" type="button" (click)="goToRoutines()">
              Crear rutina
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './trainer-home.page.scss',
})
export class TrainerHomePage {
  readonly facade = inject(TrainerHomeFacade);
  readonly notifications = inject(NotificationsFacade);

  /** Nombre de la campana con el conteo: sin el, el badge es solo color. */
  readonly bellLabel = computed(() => {
    const total = this.notifications.unreadCount();
    if (total === 0) {
      return 'Notificaciones';
    }
    return total === 1 ? 'Notificaciones, 1 sin leer' : `Notificaciones, ${total} sin leer`;
  });

  readonly reload = (): void => this.facade.reload();

  /** Alumno al que se le esta asignando rutina; null con la hoja cerrada. */
  readonly assigning = signal<PendingStudent | null>(null);
  readonly selected = signal<string | null>(null);

  readonly options = computed(() => {
    const alumno = this.assigning();
    return alumno === null ? [] : this.facade.routineOptions(alumno.id);
  });

  /** "94%", o un guion si nadie tiene sesiones resueltas. */
  readonly adherenceLabel = computed(() => {
    const valor = this.facade.adherence();
    return valor === null ? '—' : `${valor}%`;
  });

  readonly sesionesHoy = computed(() => {
    const total = this.facade.today().length;
    return total === 1 ? '1 sesión' : `${total} sesiones`;
  });

  private readonly router = inject(Router);

  constructor() {
    this.facade.load();
    this.notifications.load();
  }

  goToNotifications(): void {
    void this.router.navigate(['/trainer/notifications']);
  }

  hora(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  }

  accion(kind: PendingKind): string {
    return ACCION[kind];
  }

  openStudent(studentId: string): void {
    void this.router.navigate(['/trainer/students', studentId]);
  }

  /** Cada pendiente abre directo lo que lo resuelve. */
  resolve(item: PendingStudent): void {
    if (item.kind === 'no_routine') {
      this.facade.clearActionError();
      this.selected.set(this.facade.routineOptions(item.id)[0]?.routine.id ?? null);
      this.assigning.set(item);
      return;
    }
    const accion = item.kind === 'no_anamnesis' ? 'anamnesis' : 'evaluacion';
    void this.router.navigate(['/trainer/students', item.id], { queryParams: { accion } });
  }

  closeAssign(): void {
    this.assigning.set(null);
  }

  async confirmAssign(): Promise<void> {
    const alumno = this.assigning();
    const rutina = this.selected();
    if (alumno === null || rutina === null) {
      return;
    }
    if (await this.facade.assignRoutine(alumno.id, rutina)) {
      this.assigning.set(null);
    }
  }

  scrollToAttention(): void {
    document.getElementById('atencion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  goToStudents(): void {
    void this.router.navigate(['/trainer/students']);
  }

  goToRoutines(): void {
    this.assigning.set(null);
    void this.router.navigate(['/trainer/routines']);
  }
}
