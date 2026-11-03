import { Injectable, computed, signal } from '@angular/core';

/** Un paso del tutorial de primer ingreso. */
export interface TourStep {
  readonly title: string;
  readonly text: string;
  /** Pantalla en la que se muestra; sin ruta, se queda en la actual. */
  readonly route?: string;
  /**
   * Valor de `data-tour` del elemento a resaltar. Sin target, o si el
   * elemento no aparece (pantalla vacia o cargando), la tarjeta sale
   * centrada sin resaltado: el recorrido nunca se traba.
   */
  readonly target?: string;
}

/** Clave de `localStorage` con los recorridos ya vistos en este dispositivo. */
export const TOUR_DONE_PREFIX = 'neque.tour-done.';

/**
 * Tutorial de primer ingreso, uno por rol.
 *
 * El "ya visto" se guarda en el dispositivo y por usuario: vuelve a salir al
 * reinstalar la app o al ingresar en otro telefono (decision de producto).
 * Desde Perfil se puede lanzar de nuevo con `start()`.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly _steps = signal<readonly TourStep[]>([]);
  private readonly _index = signal(0);
  private key: string | null = null;

  readonly steps = this._steps.asReadonly();
  readonly index = this._index.asReadonly();
  readonly active = computed(() => this._steps().length > 0);
  readonly step = computed(() => this._steps()[this._index()] ?? null);
  readonly isLast = computed(() => this._index() === this._steps().length - 1);

  /** Lanza el recorrido si este usuario aun no lo vio en este dispositivo. */
  startIfFirstTime(key: string, steps: readonly TourStep[]): void {
    if (!this.wasSeen(key)) {
      this.start(key, steps);
    }
  }

  start(key: string, steps: readonly TourStep[]): void {
    this.key = key;
    this._index.set(0);
    this._steps.set(steps);
  }

  next(): void {
    if (this.isLast()) {
      this.finish();
      return;
    }
    this._index.update(i => i + 1);
  }

  /** Omitir y terminar valen lo mismo: no vuelve a salir solo. */
  finish(): void {
    if (this.key !== null) {
      this.remember(this.key);
    }
    this._steps.set([]);
    this._index.set(0);
  }

  private wasSeen(key: string): boolean {
    try {
      return localStorage.getItem(TOUR_DONE_PREFIX + key) !== null;
    } catch {
      // Sin almacenamiento no se puede recordar: mejor no insistir cada vez.
      return true;
    }
  }

  private remember(key: string): void {
    try {
      localStorage.setItem(TOUR_DONE_PREFIX + key, '1');
    } catch {
      // Sin almacenamiento el recorrido volveria a salir; no es grave.
    }
  }
}
