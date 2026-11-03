import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

/** Apariencia elegida en Perfil. `system` sigue la configuracion del dispositivo. */
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Clave de `localStorage`. La lee tambien el script de `index.html`, que
 * aplica el tema antes de que arranque Angular para que no parpadee en claro.
 */
export const THEME_KEY = 'neque.theme';

const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/** Nombre visible de cada opcion, el mismo en Perfil y en el selector. */
export const THEME_LABEL: Readonly<Record<ThemePreference, string>> = {
  system: 'Automático',
  light: 'Claro',
  dark: 'Oscuro',
};

/**
 * Apariencia de la app: modo oscuro segun el dispositivo o elegido en Perfil.
 *
 * La paleta oscura vive en `_palette.scss`; aqui solo se pone o se quita
 * `data-theme` en `<html>`. Sin atributo manda `prefers-color-scheme`. La
 * eleccion se guarda en el dispositivo, no en la cuenta.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly _preference = signal<ThemePreference>(this.read());

  readonly preference = this._preference.asReadonly();

  constructor() {
    this.apply(this._preference());
  }

  set(preference: ThemePreference): void {
    this._preference.set(preference);
    this.apply(preference);
    try {
      if (preference === 'system') {
        localStorage.removeItem(THEME_KEY);
      } else {
        localStorage.setItem(THEME_KEY, preference);
      }
    } catch {
      // Sin almacenamiento la eleccion dura hasta cerrar la app.
    }
  }

  private apply(preference: ThemePreference): void {
    if (preference === 'system') {
      this.root.removeAttribute('data-theme');
    } else {
      this.root.setAttribute('data-theme', preference);
    }
  }

  private read(): ThemePreference {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return PREFERENCES.find(value => value === saved) ?? 'system';
    } catch {
      return 'system';
    }
  }
}
