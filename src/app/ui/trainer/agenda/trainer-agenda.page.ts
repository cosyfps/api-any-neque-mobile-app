import { Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideArrowLeft,
  LucideCalendarDays,
  LucideChevronLeft,
  LucideChevronRight,
  LucideDumbbell,
} from '@lucide/angular';

import { AgendaItem, TrainerAgendaFacade } from '@app/application/trainers/trainer-agenda.facade';
import { MonthCell } from '@app/domain/schedule/model/month-grid';

import { PageStateComponent } from '@shared/components/page-state.component';

const WEEKDAY_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const TIME_FORMAT = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const DAY_FORMAT = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * Agenda global del entrenador (T-1): citas y entrenamientos de toda la
 * cartera en un calendario. Cada item abre la ficha del alumno.
 */
@Component({
  selector: 'app-trainer-agenda',
  standalone: true,
  imports: [
    PageStateComponent,
    LucideArrowLeft,
    LucideCalendarDays,
    LucideChevronLeft,
    LucideChevronRight,
    LucideDumbbell,
  ],
  providers: [TrainerAgendaFacade],
  template: `
    <div class="page">
      <header class="head">
        <button class="nav-back" type="button" aria-label="Volver" (click)="goBack()">
          <svg lucideArrowLeft [size]="22" [strokeWidth]="1.8"></svg>
        </button>
        <h1 class="head-title">Agenda</h1>
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
        <span class="month-label">{{ facade.monthLabel() }}</span>
        <button
          class="month-btn"
          type="button"
          aria-label="Mes siguiente"
          (click)="facade.nextMonth()"
        >
          <svg lucideChevronRight [size]="18" [strokeWidth]="2"></svg>
        </button>
      </div>

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
                @if (facade.hasItems(cell.date)) {
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
            <nq-page-state type="loading" loadingLabel="Cargando la agenda" />
          }
          @case ('error') {
            <nq-page-state type="error" message="No pudimos cargar la agenda." [retry]="reload" />
          }
          @default {
            @if (facade.dayItems().length > 0) {
              <ul class="items" role="list">
                @for (item of facade.dayItems(); track item.type + item.id) {
                  <li>
                    <button class="item" type="button" (click)="openStudent(item)">
                      @if (item.hasTime) {
                        <span class="item-time">{{ hora(item.startsAt) }}</span>
                      } @else {
                        <span class="item-time no-time">Sin hora</span>
                      }
                      <span class="item-icon" aria-hidden="true">
                        @if (item.type === 'training') {
                          <svg lucideDumbbell [size]="18" [strokeWidth]="2"></svg>
                        } @else {
                          <svg lucideCalendarDays [size]="18" [strokeWidth]="2"></svg>
                        }
                      </span>
                      <span class="item-body">
                        <span class="item-title">{{ item.studentName }} · {{ item.title }}</span>
                        <span class="item-meta">{{ item.detail }}</span>
                      </span>
                      <span class="nq-badge" [class]="badgeClass(item)">{{ item.status }}</span>
                    </button>
                  </li>
                }
              </ul>
            } @else {
              <p class="nq-empty-inline">Nada agendado este día.</p>
            }
          }
        }
      </section>
    </div>
  `,
  styleUrl: './trainer-agenda.page.scss',
})
export class TrainerAgendaPage {
  readonly facade = inject(TrainerAgendaFacade);

  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly weekdayHeaders = WEEKDAY_HEADERS;

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

  dayAria(cell: MonthCell): string {
    const label = DAY_FORMAT.format(cell.date);
    const items = this.facade.hasItems(cell.date) ? ', con actividades' : '';
    const today = cell.isToday ? ', hoy' : '';
    return `${label}${today}${items}`;
  }

  hora(iso: string): string {
    return TIME_FORMAT.format(new Date(iso));
  }

  badgeClass(item: AgendaItem): string {
    if (item.tone === 'success') return 'nq-badge-success';
    if (item.tone === 'danger') return 'nq-badge-danger';
    if (item.tone === 'warning') return 'nq-badge-warning';
    return 'nq-badge-primary';
  }

  openStudent(item: AgendaItem): void {
    void this.router.navigate(['/trainer/students', item.studentId]);
  }

  goBack(): void {
    if (this.location.getState() !== null && history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/trainer/home']);
  }
}
