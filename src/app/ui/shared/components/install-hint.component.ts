import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LucideSmartphone, LucideX } from '@lucide/angular';

const DISMISSED_KEY = 'neque.install-hint.dismissed';

/** Evento no estandar de Chrome/Android para ofrecer instalar la PWA. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** Plataforma desde la que se ve el aviso; la app instalada no lo muestra. */
export type InstallPlatform = 'ios' | 'android' | 'installed';

/** Decide que aviso corresponde a este navegador. */
export function installPlatform(
  nav: Pick<Navigator, 'userAgent'> & { standalone?: boolean },
  standaloneMedia: boolean,
  native: boolean,
): InstallPlatform {
  if (native || standaloneMedia || nav.standalone === true) {
    return 'installed';
  }
  return /iphone|ipad|ipod/i.test(nav.userAgent) ? 'ios' : 'android';
}

/**
 * Explica como agregar Ñeque a la pantalla de inicio.
 *
 * Ñeque no esta en las tiendas: se instala como PWA. En iPhone solo se puede
 * desde Safari con Compartir → Agregar a inicio; en Android, Chrome ofrece
 * instalarla y aqui se dispara ese dialogo. Ya instalada, el aviso no se ve.
 */
@Component({
  selector: 'nq-install-hint',
  standalone: true,
  imports: [LucideSmartphone, LucideX],
  template: `
    @if (visible()) {
      <aside class="hint" aria-labelledby="install-hint-title">
        <div class="hint-icon" aria-hidden="true">
          <svg lucideSmartphone [size]="20" [strokeWidth]="1.8"></svg>
        </div>
        <div class="hint-body">
          <h2 class="hint-title" id="install-hint-title">Agrega Ñeque a tu inicio</h2>
          @if (platform === 'ios') {
            <p class="hint-text">
              En Safari toca <strong>Compartir</strong> y luego <strong>Agregar a inicio</strong>.
              Después ábrela desde tu pantalla de inicio e ingresa con tu correo y contraseña.
            </p>
          } @else if (prompt() !== null) {
            <p class="hint-text">Así la abres como una app, incluso sin conexión.</p>
            <button class="nq-btn nq-btn-primary hint-install" type="button" (click)="install()">
              Instalar Ñeque
            </button>
          } @else {
            <p class="hint-text">
              En Chrome abre el menú <strong>⋮</strong> y elige <strong>Instalar app</strong> o
              <strong>Agregar a pantalla principal</strong>.
            </p>
          }
        </div>
        <button class="hint-close" type="button" aria-label="Ocultar aviso" (click)="dismiss()">
          <svg lucideX [size]="18" [strokeWidth]="2"></svg>
        </button>
      </aside>
    }
  `,
  styleUrl: './install-hint.component.scss',
})
export class InstallHintComponent {
  readonly platform = installPlatform(
    navigator,
    window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    Capacitor.isNativePlatform(),
  );

  readonly prompt = signal<InstallPromptEvent | null>(null);
  private readonly dismissed = signal(readDismissed());

  readonly visible = computed(() => this.platform !== 'installed' && !this.dismissed());

  constructor() {
    const capture = (event: Event): void => {
      // Sin preventDefault Chrome muestra su propia barra y el evento se pierde.
      event.preventDefault();
      this.prompt.set(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', capture);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeinstallprompt', capture));
  }

  async install(): Promise<void> {
    const event = this.prompt();
    if (event === null) {
      return;
    }
    // El dialogo del navegador solo puede abrirse una vez por evento.
    this.prompt.set(null);
    await event.prompt();
  }

  dismiss(): void {
    this.dismissed.set(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Sin almacenamiento el aviso vuelve a aparecer la proxima vez.
    }
  }
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}
