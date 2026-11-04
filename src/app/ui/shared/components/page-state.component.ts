import { Component, input } from '@angular/core';
import { LucideAlertCircle, LucideInbox, LucideWifi, LucideRefreshCw } from '@lucide/angular';

export type PageStateType = 'loading' | 'error' | 'empty' | 'offline';

@Component({
  selector: 'nq-page-state',
  standalone: true,
  imports: [LucideAlertCircle, LucideInbox, LucideWifi, LucideRefreshCw],
  template: `
    @switch (type()) {
      @case ('loading') {
        <!-- role=status para que el lector de pantalla anuncie la carga: sin
             el, el cambio de estado es completamente mudo. Los backticks no
             caben aqui, romperian el template literal de TypeScript. -->
        <div class="state" role="status" aria-live="polite" [attr.aria-label]="loadingLabel()">
          <div class="skeleton-group">
            <div class="skeleton-header">
              <div class="nq-skeleton-circle skeleton-avatar"></div>
              <div class="skeleton-lines">
                <div class="nq-skeleton-text lg"></div>
                <div class="nq-skeleton-text sm"></div>
              </div>
            </div>
            <div class="nq-skeleton-card"></div>
            <div class="skeleton-row">
              <div class="nq-skeleton-card skeleton-tile"></div>
              <div class="nq-skeleton-card skeleton-tile"></div>
            </div>
            <div class="nq-skeleton-card skeleton-strip"></div>
          </div>
        </div>
      }
      @case ('error') {
        <div class="nq-state" role="alert">
          <div class="nq-state-icon error">
            <svg lucideAlertCircle [size]="24" [strokeWidth]="1.5"></svg>
          </div>
          <span class="nq-state-title" role="heading" [attr.aria-level]="headingLevel()">{{
            title() || 'Algo salió mal'
          }}</span>
          <span class="nq-state-desc">{{
            message() || 'No pudimos cargar la información. Intenta de nuevo.'
          }}</span>
          @if (showRetry()) {
            <button class="retry-btn" type="button" (click)="onRetry()">
              <svg lucideRefreshCw [size]="16" [strokeWidth]="2"></svg>
              Reintentar
            </button>
          }
        </div>
      }
      @case ('empty') {
        <div class="nq-state" role="status">
          <div class="nq-state-icon">
            <svg lucideInbox [size]="24" [strokeWidth]="1.5"></svg>
          </div>
          <span class="nq-state-title" role="heading" [attr.aria-level]="headingLevel()">{{
            title() || 'Sin datos'
          }}</span>
          <span class="nq-state-desc">{{
            message() || 'Aún no hay información para mostrar.'
          }}</span>
        </div>
      }
      @case ('offline') {
        <div class="nq-state" role="alert">
          <div class="nq-state-icon warning">
            <svg lucideWifi [size]="24" [strokeWidth]="1.5"></svg>
          </div>
          <span class="nq-state-title" role="heading" [attr.aria-level]="headingLevel()"
            >Sin conexión</span
          >
          <span class="nq-state-desc">Revisa tu conexión a internet e intenta de nuevo.</span>
          @if (showRetry()) {
            <button class="retry-btn" type="button" (click)="onRetry()">
              <svg lucideRefreshCw [size]="16" [strokeWidth]="2"></svg>
              Reintentar
            </button>
          }
        </div>
      }
    }
  `,
  styles: [
    `
      .state {
        padding: 32px 24px;
      }
      .skeleton-group {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .skeleton-header {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .skeleton-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .skeleton-avatar {
        width: 44px;
        height: 44px;
      }
      .skeleton-lines {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 8px;
      }
      .skeleton-tile {
        height: 100px;
      }
      .skeleton-strip {
        height: 80px;
      }
      .error {
        background: rgba(var(--nq-danger-rgb), 0.06);
        color: var(--nq-danger);
      }
      .warning {
        background: rgba(var(--nq-warning-rgb), 0.06);
        color: var(--nq-warning);
      }
      .retry-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 12px 20px;
        border-radius: var(--nq-radius-sm);
        background: var(--nq-surface);
        border: 1px solid var(--nq-border-solid);
        color: var(--nq-text);
        font-family: var(--nq-font-family);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 8px;
        transition: background var(--nq-transition);
      }
      .retry-btn:active {
        background: var(--nq-surface-2);
      }
      .retry-btn:focus-visible {
        outline: 2px solid var(--nq-primary-strong);
        outline-offset: 2px;
      }
    `,
  ],
})
export class PageStateComponent {
  readonly type = input<PageStateType>('loading');
  readonly title = input('');
  readonly message = input('');
  /**
   * Nivel del titulo como encabezado (QA-30). Por defecto 2: el estado ocupa
   * el contenido bajo el h1 de la pagina. Dentro de una seccion con h2, 3.
   */
  readonly headingLevel = input<2 | 3 | 4>(2);
  readonly showRetry = input(true);
  /** Texto que anuncia el lector de pantalla mientras carga. */
  readonly loadingLabel = input('Cargando');
  readonly retry = input<(() => void) | undefined>(undefined);

  onRetry(): void {
    this.retry()?.();
  }
}
