import { Component, computed, input, output } from '@angular/core';
import { LucideMinus, LucidePlus } from '@lucide/angular';

/** Como se muestra y se escribe el valor. */
export type StepperFormat = 'int' | 'decimal' | 'time';

/**
 * Numero con botones − y +, pensado para usarse entrenando.
 *
 * Los botones cambian el valor de a `step` sin abrir el teclado, que es lo
 * comun entre series. Tocar el numero deja escribirlo igual:
 *
 * - Se confirma al salir del campo, no en cada tecla: "1" camino a "12" no
 *   dispara nada.
 * - Vacio o ilegible vuelve al valor anterior en vez de quedar en blanco.
 * - Fuera de rango se ajusta al limite mas cercano.
 * - Acepta coma y punto: el teclado decimal de iOS en espanol trae coma, y un
 *   `type="number"` en Safari la descarta y deja el campo vacio.
 *
 * En formato `time` el valor son segundos y solo cambia con los botones.
 */
@Component({
  selector: 'nq-stepper',
  standalone: true,
  imports: [LucideMinus, LucidePlus],
  template: `
    <div class="stepper">
      <button
        class="step"
        type="button"
        [attr.aria-label]="'Menos ' + label()"
        [disabled]="value() <= min()"
        (click)="bump(-1)"
      >
        <svg lucideMinus [size]="18" [strokeWidth]="2.2"></svg>
      </button>

      <input
        class="value"
        type="text"
        enterkeyhint="done"
        autocomplete="off"
        [attr.inputmode]="format() === 'decimal' ? 'decimal' : 'numeric'"
        [attr.aria-label]="label()"
        [readOnly]="format() === 'time'"
        [value]="display()"
        (focus)="selectAll($event)"
        (blur)="commit($event)"
        (keydown.enter)="blurTarget($event)"
      />

      <button
        class="step"
        type="button"
        [attr.aria-label]="'Más ' + label()"
        [disabled]="value() >= max()"
        (click)="bump(1)"
      >
        <svg lucidePlus [size]="18" [strokeWidth]="2.2"></svg>
      </button>
    </div>
    <span class="caption">{{ label() }}</span>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: center;
        min-width: 0;
      }
      .stepper {
        display: flex;
        gap: 4px;
        align-items: center;
        justify-content: center;
        width: 100%;
      }
      .step {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        color: var(--nq-primary-strong);
        cursor: pointer;
        background: rgba(var(--nq-primary-rgb), 0.12);
        border: none;
        border-radius: var(--nq-radius-full);
        -webkit-tap-highlight-color: transparent;
        transition: transform var(--nq-transition);
      }
      .step:active:not(:disabled) {
        transform: scale(0.92);
      }
      .step:disabled {
        cursor: not-allowed;
        opacity: 0.35;
      }
      .step:focus-visible,
      .value:focus-visible {
        outline: 2px solid var(--nq-primary-strong);
        outline-offset: 2px;
      }
      .value {
        width: 100%;
        min-width: 0;
        padding: 4px 0;
        font-family: var(--nq-font-family);
        font-size: 24px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--nq-text);
        text-align: center;
        background: none;
        border: none;
        border-radius: var(--nq-radius-sm);
      }
      .caption {
        font-size: 13px;
        color: var(--nq-text-secondary);
      }
    `,
  ],
})
export class StepperComponent {
  readonly value = input.required<number>();
  readonly label = input.required<string>();
  readonly min = input(0);
  readonly max = input(999);
  readonly step = input(1);
  readonly format = input<StepperFormat>('int');

  readonly valueChange = output<number>();

  readonly display = computed(() => this.formatear(this.value()));

  bump(direction: 1 | -1): void {
    this.emitir(this.value() + direction * this.step());
  }

  selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  blurTarget(event: Event): void {
    (event.target as HTMLInputElement).blur();
  }

  commit(event: Event): void {
    const campo = event.target as HTMLInputElement;
    const leido = this.leer(campo.value);
    if (leido !== null) {
      this.emitir(leido);
    }
    // Siempre se reescribe: un valor invalido vuelve al anterior, y uno
    // ajustado muestra el limite en vez de lo que se tecleo.
    campo.value = this.formatear(leido === null ? this.value() : this.ajustar(leido));
  }

  private emitir(valor: number): void {
    const ajustado = this.ajustar(valor);
    if (ajustado !== this.value()) {
      this.valueChange.emit(ajustado);
    }
  }

  private ajustar(valor: number): number {
    const redondeado =
      this.format() === 'decimal' ? Math.round(valor * 10) / 10 : Math.round(valor);
    return Math.min(this.max(), Math.max(this.min(), redondeado));
  }

  private leer(texto: string): number | null {
    const limpio = texto.trim().replace(',', '.');
    if (limpio === '') {
      return null;
    }
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : null;
  }

  private formatear(valor: number): string {
    if (this.format() === 'time') {
      const minutos = Math.floor(valor / 60);
      const segundos = valor % 60;
      return `${minutos}:${String(segundos).padStart(2, '0')}`;
    }
    return this.format() === 'decimal' ? String(valor).replace('.', ',') : String(valor);
  }
}
