import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideArrowLeft,
  LucideChevronLeft,
  LucideChevronRight,
  LucideMapPin,
} from '@lucide/angular';

import { ScheduleFacade } from '@app/application/schedule/schedule.facade';
import { MonthCell } from '@app/domain/schedule/model/month-grid';
import {
  SCHEDULE_STATUS_LABEL,
  SESSION_KIND_LABEL,
  ScheduleStatus,
  ScheduledSession,
  SessionKind,
} from '@app/domain/schedule/model/scheduled-session.model';

import { PageStateComponent } from '@shared/components/page-state.component';

const WEEKDAY_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const TIME_FORMAT = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });
const DAY_FORMAT = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

@Component({
  selector: 'app-student-schedule',
  standalone: true,
  imports: [
    PageStateComponent,
    LucideArrowLeft,
    LucideChevronLeft,
    LucideChevronRight,
    LucideMapPin,
  ],
  template: `
    <div class="page">
      <header class="head">
        <button class="nav-back" type="button" aria-label="Volver" (click)="goBack()">
          <svg lucideArrowLeft [size]="22" [strokeWidth]="1.8"></svg>
        </button>
        <h1 class="head-title">Mi agenda</h1>
      </header>

      <div class="month-nav">
        <button
          class="month-btn"
          type="button"
          aria-label="Mes anterior"
          (click)="facade.prevMonth()"
        >
          <svg lucideChevronLeft [size]="18" [strokeWidth]="2"></svg>
        </button>
        <span class="month-label">{{ monthLabel() }}</span>
        <button
          class="month-btn"
          type="button"
          aria-label="Mes siguiente"
          (click)="facade.nextMonth()"
        >
          <svg lucideChevronRight [size]="18" [strokeWidth]="2"></svg>
        </button>
      </div>

      <!-- Calendario en CSS grid: sin SVG ni libreria -->
      <div class="calendar nq-ani">
        <div class="weekdays">
          @for (label of weekdayHeaders; track $index) {
            <span class="weekday">{{ label }}</span>
          }
        </div>

        @for (week of facade.grid(); track $index) {
          <div class="week">
            @for (cell of week; track cell.date.getTime()) {
              <button
                class="day"
                type="button"
                [class.outside]="!cell.inMonth"
                [class.today]="cell.isToday"
                [class.selected]="isSelected(cell)"
                [attr.aria-label]="dayAria(cell)"
                [attr.aria-pressed]="isSelected(cell)"
                (click)="facade.selectDay(cell.date)"
              >
                {{ cell.date.getDate() }}
                @if (facade.hasSessions(cell.date)) {
                  <span class="day-dot"></span>
                }
              </button>
            }
          </div>
        }
      </div>

      <section class="day-detail">
        <span class="day-detail-label">{{ selectedLabel() }}</span>

        @switch (facade.viewState()) {
          @case ('loading') {
            <nq-page-state type="loading" />
          }
          @case ('error') {
            <nq-page-state type="error" [retry]="reload" />
          }
          @default {
            @if (facade.daySessions().length > 0) {
              <ul class="sessions">
                @for (session of facade.daySessions(); track session.id) {
                  <li class="session" [class.cancelled]="session.status === 'cancelled'">
                    <div class="session-time">
                      <span class="session-hour">{{ timeOf(session.startsAt) }}</span>
                      <span class="session-duration">{{ durationOf(session) }}</span>
                    </div>

                    <div class="session-body">
                      <span class="session-title">{{ session.title }}</span>
                      <span class="session-kind">{{ kindLabel(session.kind) }}</span>
                      @if (session.location !== null) {
                        <span class="session-location">
                          <svg lucideMapPin [size]="12" [strokeWidth]="1.8"></svg>
                          {{ session.location }}
                        </span>
                      }
                    </div>

                    <div class="session-side">
                      <span class="nq-badge" [class]="badgeClass(session.status)">
                        {{ statusLabel(session.status) }}
                      </span>
                      @if (session.status === 'pending') {
                        <button
                          class="confirm-btn"
                          type="button"
                          [disabled]="confirming() !== null"
                          (click)="confirm(session.id)"
                        >
                          {{ confirming() === session.id ? 'Confirmando…' : 'Confirmar' }}
                        </button>
                      }
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <p class="nq-empty-inline">No tienes nada agendado este día.</p>
            }
          }
        }
      </section>
    </div>
  `,
  styleUrl: './student-schedule.page.scss',
})
export class StudentSchedulePage {
  readonly facade = inject(ScheduleFacade);

  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly weekdayHeaders = WEEKDAY_HEADERS;
  /** Id de la sesion que se esta confirmando, para bloquear el doble toque. */
  readonly confirming = signal<string | null>(null);

  readonly monthLabel = computed(() => {
    const label = this.facade.monthLabel();
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  });

  readonly selectedLabel = computed(() => {
    const day = this.facade.selectedDay();
    if (day === null) {
      return 'Selecciona un día';
    }
    const label = DAY_FORMAT.format(day);
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  });

  readonly reload = (): void => this.facade.reload();

  constructor() {
    this.facade.load();
  }

  isSelected(cell: MonthCell): boolean {
    const selected = this.facade.selectedDay();
    return selected !== null && selected.getTime() === cell.date.getTime();
  }

  /** Fecha completa y no solo el numero: "15" no ubica a nadie. */
  dayAria(cell: MonthCell): string {
    const label = DAY_FORMAT.format(cell.date);
    const sessions = this.facade.hasSessions(cell.date) ? ', con sesiones' : '';
    const today = cell.isToday ? ', hoy' : '';
    return `${label}${today}${sessions}`;
  }

  timeOf(iso: string): string {
    return TIME_FORMAT.format(new Date(iso));
  }

  durationOf(session: ScheduledSession): string {
    const minutes = Math.round(
      (new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime()) / 60_000,
    );
    return `${minutes} min`;
  }

  kindLabel(kind: SessionKind): string {
    return SESSION_KIND_LABEL[kind];
  }

  statusLabel(status: ScheduleStatus): string {
    return SCHEDULE_STATUS_LABEL[status];
  }

  badgeClass(status: ScheduleStatus): string {
    if (status === 'confirmed') return 'nq-badge-success';
    if (status === 'cancelled') return 'nq-badge-danger';
    return 'nq-badge-warning';
  }

  async confirm(sessionId: string): Promise<void> {
    if (this.confirming() !== null) {
      return;
    }
    this.confirming.set(sessionId);
    await this.facade.confirm(sessionId);
    this.confirming.set(null);
  }

  /** Se llega desde el Home y desde el Perfil: vuelve a donde estaba. */
  goBack(): void {
    if (this.location.getState() !== null && history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/student/home']);
  }
}
