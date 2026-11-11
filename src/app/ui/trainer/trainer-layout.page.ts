import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import {
  LucideDumbbell,
  LucideHouse,
  LucideMessageCircle,
  LucidePlus,
  LucideUser,
  LucideUsers,
} from '@lucide/angular';
import { filter, map, scan } from 'rxjs/operators';

import { SessionFacade } from '@app/application/auth/session.facade';

import { FabRegistry } from '@shared/navigation/fab';
import { TRAINER_TOUR } from '@shared/tour/tour-steps';
import { TourComponent } from '@shared/tour/tour.component';
import { TourService } from '@shared/tour/tour.service';

interface TrainerTab {
  readonly path: string;
  readonly label: string;
  readonly icon: 'home' | 'students' | 'routines' | 'profile';
}

const TABS: readonly TrainerTab[] = [
  { path: '/trainer/home', label: 'Inicio', icon: 'home' },
  { path: '/trainer/students', label: 'Alumnos', icon: 'students' },
  { path: '/trainer/routines', label: 'Rutinas', icon: 'routines' },
  { path: '/trainer/profile', label: 'Perfil', icon: 'profile' },
];

/** Pestana que corresponde a una URL; Inicio para lo que no es pestana. */
function tabFor(url: string): string {
  const path = url.split('?')[0] ?? '';
  return TABS.find(tab => path.startsWith(tab.path))?.path ?? '/trainer/home';
}

@Component({
  selector: 'app-trainer-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    LucideHouse,
    LucideUsers,
    LucideDumbbell,
    LucideUser,
    LucideMessageCircle,
    LucidePlus,
    TourComponent,
  ],
  template: `
    <div class="layout">
      <div class="layout-content" [attr.inert]="tour.active() ? '' : null">
        <router-outlet />
      </div>

      <!-- Fuera de .layout-content: dentro del scroll, iOS lo desplazaba
           con la lista. Lo aporta la pantalla activa via useFab(). -->
      @if (fab.action(); as action) {
        <button
          class="nq-fab"
          data-tour="fab"
          [attr.inert]="tour.active() ? '' : null"
          type="button"
          [attr.aria-label]="action.label()"
          (click)="action.run()"
        >
          @if (action.icon === 'message') {
            <!-- Solo el globo: a quien le escribe lo dice su aria-label. -->
            <svg lucideMessageCircle [size]="24" [strokeWidth]="2"></svg>
          } @else {
            <svg lucidePlus [size]="24" [strokeWidth]="2"></svg>
          }
        </button>
      }

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
              @case ('students') {
                <svg lucideUsers [size]="22" [strokeWidth]="1.8"></svg>
              }
              @case ('routines') {
                <svg lucideDumbbell [size]="22" [strokeWidth]="1.8"></svg>
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
  styleUrl: './trainer-layout.page.scss',
})
export class TrainerLayoutPage {
  readonly tabs = TABS;
  readonly fab = inject(FabRegistry);
  readonly tour = inject(TourService);

  private readonly router = inject(Router);

  constructor() {
    // Primer ingreso de este entrenador en este dispositivo: guia por las pestanas.
    const userId = inject(SessionFacade).user()?.id;
    if (userId !== undefined) {
      this.tour.startIfFirstTime(`trainer.${userId}`, TRAINER_TOUR);
    }
  }

  /**
   * Ultima pestana visitada.
   *
   * Mismo `scan` que el shell del alumno: la ficha de un alumno y el
   * constructor de rutinas viven dentro del shell sin ser pestanas, y sin
   * recordar la anterior las cuatro quedarian apagadas.
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
