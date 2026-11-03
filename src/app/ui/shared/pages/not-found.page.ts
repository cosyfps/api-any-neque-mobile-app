import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideCompass } from '@lucide/angular';

import { SessionFacade } from '@app/application/auth/session.facade';
import { homeRouteForRole } from '@app/domain/auth/model/auth-user.model';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [LucideCompass],
  template: `
    <div class="nq-screen">
      <div class="wrap">
        <div class="nq-state nq-ani">
          <div class="nq-state-icon">
            <svg lucideCompass [size]="24" [strokeWidth]="1.5"></svg>
          </div>
          <h1 class="nq-state-title">Esta página no existe</h1>
          <span class="nq-state-desc">
            El enlace que seguiste no lleva a ninguna parte dentro de Ñeque.
          </span>
          <button class="nq-btn nq-btn-primary back-btn" type="button" (click)="goHome()">
            {{ ctaLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
  // `.nq-screen` se estira contra el ancestro posicionado que aporta esta
  // clase; sin ella el contenedor no tiene contra que medir su alto.
  host: { class: 'nq-page-host' },
  styleUrl: './not-found.page.scss',
})
export class NotFoundPage {
  private readonly router = inject(Router);
  private readonly session = inject(SessionFacade);

  readonly ctaLabel = computed(() =>
    this.session.isAuthenticated() ? 'Volver al inicio' : 'Ir a ingresar',
  );

  constructor() {
    // La ruta comodin no tiene guard, asi que nadie mas rehidrata la sesion.
    this.session.restore();
  }

  goHome(): void {
    const role = this.session.role();
    this.router.navigate([role === null ? '/' : homeRouteForRole(role)]);
  }
}
