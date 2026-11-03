import { Location } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideArrowLeft,
  LucideBell,
  LucideCalendarDays,
  LucideClipboardList,
  LucideMail,
  LucideMessageCircle,
  LucideTriangleAlert,
} from '@lucide/angular';

import { SessionFacade } from '@app/application/auth/session.facade';
import { NotificationsFacade } from '@app/application/notifications/notifications.facade';
import { homeRouteForRole } from '@app/domain/auth/model/auth-user.model';
import { AppNotification } from '@app/domain/notifications/model/notification.model';
import { CLOCK } from '@app/domain/shared/port/clock.port';

import { PageStateComponent } from '@shared/components/page-state.component';
import { notificationRoute } from '@shared/navigation/notification-target';

const RELATIVE = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' });

/**
 * Notificaciones, compartida por alumno y entrenador.
 *
 * Lo unico que cambia por rol es a donde lleva cada una, a donde vuelve y el
 * texto del vacio: el resto es la misma lista.
 */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    PageStateComponent,
    LucideArrowLeft,
    LucideBell,
    LucideCalendarDays,
    LucideClipboardList,
    LucideMail,
    LucideMessageCircle,
    LucideTriangleAlert,
  ],
  template: `
    <div class="page">
      <header class="head">
        <button class="nav-back" type="button" aria-label="Volver" (click)="goBack()">
          <svg lucideArrowLeft [size]="22" [strokeWidth]="1.8"></svg>
        </button>
        <h1 class="head-title">Notificaciones</h1>
        @if (facade.hasUnread()) {
          <button class="mark-all" type="button" (click)="markAll()">Marcar todas</button>
        }
      </header>

      @switch (facade.viewState()) {
        @case ('loading') {
          <nq-page-state type="loading" />
        }
        @case ('error') {
          <nq-page-state type="error" [retry]="reload" />
        }
        @case ('empty') {
          <nq-page-state type="empty" title="Sin notificaciones" [message]="emptyMessage()" />
        }
        @case ('success') {
          @for (group of facade.groups(); track group.label) {
            <section class="group nq-ani">
              <span class="group-label">{{ group.label }}</span>

              <ul class="list">
                @for (item of group.items; track item.id) {
                  <li>
                    <button
                      class="item"
                      type="button"
                      [class.unread]="item.readAt === null"
                      (click)="open(item)"
                    >
                      <span class="icon" [attr.data-kind]="item.kind">
                        @switch (item.kind) {
                          @case ('routine') {
                            <svg lucideClipboardList [size]="17" [strokeWidth]="1.8"></svg>
                          }
                          @case ('session') {
                            <svg lucideCalendarDays [size]="17" [strokeWidth]="1.8"></svg>
                          }
                          @case ('message') {
                            <svg lucideMessageCircle [size]="17" [strokeWidth]="1.8"></svg>
                          }
                          @case ('alert') {
                            <svg lucideTriangleAlert [size]="17" [strokeWidth]="1.8"></svg>
                          }
                          @case ('invitation') {
                            <svg lucideMail [size]="17" [strokeWidth]="1.8"></svg>
                          }
                          @default {
                            <svg lucideBell [size]="17" [strokeWidth]="1.8"></svg>
                          }
                        }
                      </span>

                      <span class="body">
                        <span class="title">{{ item.title }}</span>
                        <span class="text">{{ item.body }}</span>
                        <span class="time">{{ relativeTime(item.createdAt) }}</span>
                      </span>

                      @if (item.readAt === null) {
                        <!-- Con rol: en un span generico el aria-label se ignora
                             y el estado quedaba solo en el color. -->
                        <span class="dot" role="img" aria-label="No leída"></span>
                      }
                    </button>
                  </li>
                }
              </ul>
            </section>
          }
        }
      }
    </div>
  `,
  styleUrl: './notifications.page.scss',
})
export class NotificationsPage {
  readonly facade = inject(NotificationsFacade);

  /** Sin rol conocido se comporta como la app del alumno, la de siempre. */
  private readonly role = computed(() => this.session.role() ?? 'student');

  readonly emptyMessage = computed(() =>
    this.role() === 'trainer'
      ? 'Te avisaremos cuando tus alumnos entrenen o necesiten atención.'
      : 'Te avisaremos cuando tu entrenador publique algo nuevo.',
  );

  private readonly session = inject(SessionFacade);

  private readonly router = inject(Router);
  private readonly clock = inject(CLOCK);
  private readonly location = inject(Location);

  readonly reload = (): void => this.facade.reload();

  constructor() {
    this.facade.load();
  }

  /** "hace 3 horas", "ayer". Cae al mayor unidad que aplique. */
  relativeTime(iso: string): string {
    const diffMs = new Date(iso).getTime() - this.clock.now().getTime();
    const minutes = Math.round(diffMs / 60_000);

    if (Math.abs(minutes) < 60) {
      return RELATIVE.format(minutes, 'minute');
    }
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
      return RELATIVE.format(hours, 'hour');
    }
    return RELATIVE.format(Math.round(hours / 24), 'day');
  }

  async open(notification: AppNotification): Promise<void> {
    if (notification.readAt === null) {
      await this.facade.markRead(notification.id);
    }
    const ruta = notificationRoute(notification.targetType, notification.targetId, this.role());
    if (ruta !== null) {
      await this.router.navigate(ruta);
    }
  }

  markAll(): void {
    void this.facade.markAllRead();
  }

  /**
   * Vuelve a donde estaba, no siempre al inicio: esta pantalla se alcanza
   * desde la campana del inicio, el perfil y la actividad reciente.
   */
  goBack(): void {
    if (this.location.getState() !== null && history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigate([homeRouteForRole(this.role())]);
  }
}
