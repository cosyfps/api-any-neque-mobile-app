import { Component, inject } from '@angular/core';
import { LucideMoon, LucideSmartphone, LucideSun } from '@lucide/angular';

import { THEME_LABEL, ThemePreference, ThemeService } from '@shared/theme/theme.service';

interface Option {
  readonly value: ThemePreference;
  readonly label: string;
}

const OPTIONS: readonly Option[] = [
  { value: 'system', label: THEME_LABEL.system },
  { value: 'light', label: THEME_LABEL.light },
  { value: 'dark', label: THEME_LABEL.dark },
];

/**
 * Apariencia de la app, en Perfil: segun el dispositivo, clara u oscura.
 * Control segmentado con semantica de radio: una sola opcion activa.
 */
@Component({
  selector: 'nq-theme-picker',
  standalone: true,
  imports: [LucideSmartphone, LucideSun, LucideMoon],
  template: `
    <div class="picker" role="radiogroup" aria-label="Apariencia">
      @for (option of options; track option.value) {
        <button
          class="option"
          type="button"
          role="radio"
          [class.active]="theme.preference() === option.value"
          [attr.aria-checked]="theme.preference() === option.value"
          (click)="theme.set(option.value)"
        >
          @switch (option.value) {
            @case ('system') {
              <svg lucideSmartphone [size]="18" [strokeWidth]="1.8"></svg>
            }
            @case ('light') {
              <svg lucideSun [size]="18" [strokeWidth]="1.8"></svg>
            }
            @case ('dark') {
              <svg lucideMoon [size]="18" [strokeWidth]="1.8"></svg>
            }
          }
          {{ option.label }}
        </button>
      }
    </div>
    <p class="hint">
      @if (theme.preference() === 'system') {
        Sigue la configuración de tu teléfono.
      } @else {
        Siempre en modo {{ theme.preference() === 'dark' ? 'oscuro' : 'claro' }}.
      }
    </p>
  `,
  styles: [
    `
      .picker {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        padding: 4px;
        background: var(--nq-surface-2);
        border-radius: var(--nq-radius-md);
      }
      .option {
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: center;
        justify-content: center;
        min-height: 56px;
        font-family: var(--nq-font-family);
        font-size: 13px;
        font-weight: 600;
        color: var(--nq-text-secondary);
        cursor: pointer;
        background: none;
        border: none;
        border-radius: var(--nq-radius-sm);
        -webkit-tap-highlight-color: transparent;
      }
      .option.active {
        color: var(--nq-primary-strong);
        background: var(--nq-bg);
        box-shadow: var(--nq-shadow-sm);
      }
      .option:focus-visible {
        outline: 2px solid var(--nq-primary-strong);
        outline-offset: 2px;
      }
      .hint {
        margin: 8px 0 0;
        font-size: 13px;
        color: var(--nq-text-secondary);
      }
    `,
  ],
})
export class ThemePickerComponent {
  readonly theme = inject(ThemeService);
  readonly options = OPTIONS;
}
