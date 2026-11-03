import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

/** Accion del boton flotante de "agregar" de la pantalla activa. */
export interface FabAction {
  /** Etiqueta accesible; puede cambiar, por ejemplo segun la pestana. */
  readonly label: () => string;
  readonly run: () => void;
}

/**
 * Boton flotante que dibuja el shell y aporta cada pantalla.
 *
 * El boton vive en el shell y no en la pagina porque la pagina va dentro de
 * `.layout-content`, el contenedor con scroll: en iOS un `position: fixed`
 * ahi dentro puede desplazarse con la lista. Junto al tab bar queda fijo.
 */
@Injectable({ providedIn: 'root' })
export class FabRegistry {
  private readonly _action = signal<FabAction | null>(null);

  readonly action: Signal<FabAction | null> = this._action.asReadonly();

  set(action: FabAction | null): void {
    this._action.set(action);
  }

  /** Quita la accion solo si sigue siendo la de quien la registro. */
  clear(action: FabAction): void {
    if (this._action() === action) {
      this._action.set(null);
    }
  }
}

/**
 * Registra el boton flotante de la pantalla y lo retira al destruirla.
 * Se llama en contexto de inyeccion: un inicializador de campo o el constructor.
 */
export function useFab(label: () => string, run: () => void): void {
  const registry = inject(FabRegistry);
  const action: FabAction = { label, run };
  registry.set(action);
  inject(DestroyRef).onDestroy(() => registry.clear(action));
}
