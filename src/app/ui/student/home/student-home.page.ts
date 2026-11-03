import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideBell, LucideCalendarDays, LucideFlame } from '@lucide/angular';

import { NotificationsFacade } from '@app/application/notifications/notifications.facade';
import { StudentProfileFacade } from '@app/application/students/student-profile.facade';
import { WorkoutFacade } from '@app/application/workouts/workout.facade';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { BMI_CATEGORY_LABEL } from '@app/domain/students/model/bmi';
import { WorkoutSession, sessionProgress } from '@app/domain/workouts/model/workout-session.model';

import { BarChartComponent } from '@shared/components/chart/bar-chart.component';
import { BarInput } from '@shared/components/chart/chart-math';
import { PageStateComponent } from '@shared/components/page-state.component';
import { WorkoutCardComponent } from '@shared/components/workout-card.component';

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const DATE_FORMAT = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const TIME_FORMAT = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });

@Component({
  selector: 'app-student-home',
  standalone: true,
  imports: [
    PageStateComponent,
    WorkoutCardComponent,
    BarChartComponent,
    LucideBell,
    LucideCalendarDays,
    LucideFlame,
  ],
  template: `
    <div class="page">
      <header class="head">
        <div>
          <!-- El titulo de la pantalla va oculto: visualmente manda el saludo,
               pero un lector de pantalla necesita saber donde esta, y el nombre
               del alumno no es el titulo de la pagina. -->
          <h1 class="nq-visually-hidden">Inicio</h1>
          <span class="greeting">{{ greeting() }},</span>
          <!-- Esqueleto en vez del respaldo "Alumno": mostrar un nombre falso
               y cambiarlo de golpe al resolver es peor que no mostrar nada. -->
          @if (profile.firstName(); as firstName) {
            <p class="name">{{ firstName }}</p>
          } @else {
            <p class="name name-skeleton" aria-hidden="true"></p>
          }
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

      @switch (profile.viewState()) {
        @case ('loading') {
          <nq-page-state type="loading" />
        }
        @case ('error') {
          <nq-page-state type="error" [retry]="reload" />
        }
        @case ('empty') {
          <nq-page-state
            type="empty"
            title="Tu ficha aún no está lista"
            message="Tu entrenador está terminando de configurarla."
          />
        }
        @case ('success') {
          <!-- IMC: la unica metrica corporal que el backlog puede alimentar hoy -->
          <section class="bmi nq-ani">
            @if (profile.bmi(); as bmi) {
              <div class="bmi-text">
                <span class="bmi-label">Índice de masa corporal</span>
                <span class="bmi-category">{{ categoryLabel(bmi.category) }}</span>
                <span class="bmi-note">
                  {{ profile.weightKg() }} kg · {{ profile.heightCm() }} cm
                </span>
              </div>
              <div class="bmi-value">
                <span class="bmi-number">{{ bmi.value }}</span>
              </div>
            } @else {
              <div class="bmi-text">
                <span class="bmi-label">Índice de masa corporal</span>
                <span class="bmi-note">
                  Aún no tienes evaluaciones. Tu entrenador registrará la primera.
                </span>
              </div>
            }
          </section>

          <!-- Sesion de hoy -->
          <section class="today nq-ani nq-d1">
            @if (todaySession(); as session) {
              <div class="today-body">
                <span class="today-label">Hoy te toca</span>
                <span class="today-title">{{ session.title }}</span>
                <span class="today-meta">
                  {{ timeOf(session) }} · {{ session.estimatedMinutes }} min ·
                  {{ session.exercises.length }} ejercicios
                </span>
              </div>
              <button class="nq-btn nq-btn-primary today-cta" type="button" (click)="goToRoutine()">
                {{ session.status === 'completed' ? 'Ver sesión' : 'Comenzar' }}
              </button>
            } @else {
              <div class="today-body">
                <span class="today-label">Hoy</span>
                <span class="today-title">Día de descanso</span>
                <span class="today-meta">Aprovecha de recuperarte para la próxima sesión.</span>
              </div>
            }
          </section>

          <!-- Progreso semanal -->
          <section class="nq-section nq-ani nq-d2">
            <div class="nq-section-header">
              <h2 class="nq-section-title">Progreso semanal</h2>
              <span class="week-summary">
                <svg lucideFlame [size]="14" [strokeWidth]="2"></svg>
                {{ workouts.weekly().completed }}/{{ workouts.weekly().planned }}
              </span>
            </div>

            <div class="nq-card chart-card">
              <nq-bar-chart [data]="weeklyBars()" [ariaLabel]="weeklyAria()" />
            </div>
          </section>

          <!-- Ultimo entrenamiento -->
          <section class="nq-section nq-ani nq-d3">
            <div class="nq-section-header">
              <h2 class="nq-section-title">Último entrenamiento</h2>
            </div>

            @if (workouts.latestCompleted(); as latest) {
              <nq-workout-card
                [title]="latest.title"
                [metadata]="completedMeta(latest)"
                [progress]="1"
                (action)="goToRoutine()"
              />
            } @else {
              <p class="nq-empty-inline">Todavía no completas tu primera sesión.</p>
            }
          </section>

          <!-- Proximos entrenamientos -->
          <section class="nq-section nq-ani nq-d4">
            <div class="nq-section-header">
              <h2 class="nq-section-title">Próximos entrenamientos</h2>
              <button class="nq-section-action" type="button" (click)="goToSchedule()">
                <svg lucideCalendarDays [size]="14" [strokeWidth]="2"></svg>
                Agenda
              </button>
            </div>

            @if (upcoming().length > 0) {
              <div class="upcoming-list">
                @for (session of upcoming(); track session.id) {
                  <nq-workout-card
                    [title]="session.title"
                    [metadata]="upcomingMeta(session)"
                    [progress]="progressOf(session)"
                    (action)="goToRoutine()"
                  />
                }
              </div>
            } @else {
              <p class="nq-empty-inline">No tienes sesiones agendadas por ahora.</p>
            }
          </section>
        }
      }
    </div>
  `,
  styleUrl: './student-home.page.scss',
})
export class StudentHomePage {
  readonly profile = inject(StudentProfileFacade);
  readonly workouts = inject(WorkoutFacade);
  readonly notifications = inject(NotificationsFacade);

  private readonly router = inject(Router);
  private readonly clock = inject(CLOCK);

  readonly todaySession = computed(() => this.workouts.todaySession());

  /** Las tres proximas sesiones, sin contar la de hoy. */
  readonly upcoming = computed(() =>
    this.workouts
      .upcoming()
      .filter(session => session.id !== this.todaySession()?.id)
      .slice(0, 3),
  );

  readonly weeklyBars = computed((): BarInput[] =>
    this.workouts.weekly().byDay.map((day, index) => ({
      label: WEEKDAY_LABELS[index] ?? '',
      value: day.completed,
      highlighted: day.isToday,
    })),
  );

  /** El contador de no leidas solo existia como color: ahora tambien se dice. */
  readonly bellLabel = computed(() => {
    const unread = this.notifications.unreadCount();
    return unread === 0 ? 'Notificaciones' : `Notificaciones, ${unread} sin leer`;
  });

  readonly weeklyAria = computed(() => {
    const weekly = this.workouts.weekly();
    return `${weekly.completed} de ${weekly.planned} entrenamientos completados esta semana`;
  });

  readonly greeting = computed(() => {
    const hour = this.clock.now().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  });

  /** Campo arrow: `[retry]` espera `() => void`, no un metodo desbindado. */
  readonly reload = (): void => {
    this.profile.reload();
    this.workouts.reload();
  };

  constructor() {
    this.profile.load();
    this.workouts.load();
    this.notifications.load();
  }

  categoryLabel(category: keyof typeof BMI_CATEGORY_LABEL): string {
    return BMI_CATEGORY_LABEL[category];
  }

  progressOf(session: WorkoutSession): number {
    return sessionProgress(session);
  }

  timeOf(session: WorkoutSession): string {
    return TIME_FORMAT.format(new Date(session.scheduledFor));
  }

  completedMeta(session: WorkoutSession): string {
    const minutes = session.durationMinutes ?? session.estimatedMinutes;
    return `${minutes} min · ${session.exercises.length} ejercicios`;
  }

  upcomingMeta(session: WorkoutSession): string {
    const date = new Date(session.scheduledFor);
    const label = DATE_FORMAT.format(date);
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} · ${TIME_FORMAT.format(date)}`;
  }

  goToRoutine(): void {
    this.router.navigate(['/student/routine']);
  }

  goToNotifications(): void {
    this.router.navigate(['/student/notifications']);
  }

  goToSchedule(): void {
    this.router.navigate(['/student/schedule']);
  }
}
