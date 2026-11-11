import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { LucideChartLine, LucideClipboardList, LucideHouse, LucideUser } from '@lucide/angular';
import { filter, map, scan } from 'rxjs/operators';

import { SessionFacade } from '@app/application/auth/session.facade';
import { WorkoutSyncFacade } from '@app/application/workouts/workout-sync.facade';

import { STUDENT_TOUR } from '@shared/tour/tour-steps';
import { TourComponent } from '@shared/tour/tour.component';
import { TourService } from '@shared/tour/tour.service';

interface StudentTab {
  readonly path: string;
  readonly label: string;
  readonly icon: 'home' | 'routine' | 'progress' | 'profile';
}

const TABS: readonly StudentTab[] = [
  { path: '/student/home', label: 'Inicio', icon: 'home' },
  { path: '/student/routine', label: 'Mi rutina', icon: 'routine' },
  { path: '/student/progress', label: 'Progreso', icon: 'progress' },
  { path: '/student/profile', label: 'Perfil', icon: 'profile' },
];

/** Pestana que corresponde a una URL; Inicio para lo que no es pestana. */
function tabFor(url: string): string {
  const path = url.split('?')[0] ?? '';
  return TABS.find(tab => path.startsWith(tab.path))?.path ?? '/student/home';
}

@Component({
  selector: 'app-student-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    LucideHouse,
    LucideClipboardList,
    LucideChartLine,
    LucideUser,
    TourComponent,
  ],
  template: `
    <div class="layout">
      <div class="layout-content" [attr.inert]="tour.active() ? '' : null">
        <router-outlet />
      </div>

      <!-- Lo entrenado sin conexion espera aqui hasta volver la red. -->
      <p class="sync-banner" role="status" aria-live="polite">
        @if (sync.hasPending()) {
          Sin conexión · tu entrenamiento se guardó en el teléfono y se enviará solo.
        }
      </p>

      <nav
        class="tab-bar"
        aria-label="Navegación principal"
        [attr.inert]="tour.active() ? '' : null"
      >
        @for (tab of tabs; track tab.path) {
          <button
            class="tab"
            type="button"
            [class.active]="isActive(tab.path)"
            [attr.aria-label]="tab.label"
            [attr.aria-current]="isActive(tab.path) ? 'page' : null"
            [attr.data-tour]="'tab-' + tab.icon"
            (click)="navigate(tab.path)"
          >
            @switch (tab.icon) {
              @case ('home') {
                <svg lucideHouse [size]="22" [strokeWidth]="1.8"></svg>
              }
              @case ('routine') {
                <svg lucideClipboardList [size]="22" [strokeWidth]="1.8"></svg>
              }
              @case ('progress') {
                <svg lucideChartLine [size]="22" [strokeWidth]="1.8"></svg>
              }
              @case ('profile') {
                <svg lucideUser [size]="22" [strokeWidth]="1.8"></svg>
              }
            }
            <span class="tab-dot"></span>
          </button>
        }
      </nav>

      <!-- Tutorial de primer ingreso (y desde Perfil): encima de todo. -->
      <nq-tour />
    </div>
  `,
  styleUrl: './student-layout.page.scss',
})
export class StudentLayoutPage {
  readonly tabs = TABS;
  readonly tour = inject(TourService);
  readonly sync = inject(WorkoutSyncFacade);

  private readonly router = inject(Router);

  constructor() {
    // Primer ingreso de este alumno en este dispositivo: guia por las pestanas.
    const userId = inject(SessionFacade).user()?.id;
    if (userId !== undefined) {
      this.tour.startIfFirstTime(`student.${userId}`, STUDENT_TOUR);
    }
  }

  /**
   * Ultima pestana visitada.
   *
   * `scan` en vez de mapear la URL directa: Notificaciones y Agenda viven
   * dentro del shell pero no son pestanas, y sin recordar la anterior las
   * cuatro quedaban apagadas. Recordandola, el alumno que entra desde el
   * Perfil ve Perfil encendido, y el que entra desde la campanita ve Inicio.
   */
  readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects.split('?')[0] ?? ''),
      scan(
        (lastTab, url) => TABS.find(tab => url.startsWith(tab.path))?.path ?? lastTab,
        tabFor(this.router.url),
      ),
    ),
    { initialValue: tabFor(this.router.url) },
  );

  isActive(path: string): boolean {
    return this.activeTab() === path;
  }

  navigate(path: string): void {
    this.router.navigate([path]);
  }
}
