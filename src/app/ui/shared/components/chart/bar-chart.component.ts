import { Component, computed, input } from '@angular/core';

import { BarInput, ChartBox, ScaledBar, scaleBars } from './chart-math';

const BOX: ChartBox = { width: 280, height: 110, padding: 8 };

@Component({
  selector: 'nq-bar-chart',
  standalone: true,
  template: `
    <!-- Se rastrea por indice y no por etiqueta: las de la semana son
         L, M, M, J, V, S, D y martes y miercoles comparten la M. Angular
         exige claves unicas en el track. -->
    <svg
      class="chart"
      [attr.viewBox]="viewBox"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      @for (bar of bars(); track $index) {
        <rect
          [attr.x]="bar.x"
          [attr.y]="bar.y"
          [attr.width]="bar.width"
          [attr.height]="bar.height"
          rx="4"
          [attr.fill]="fillOf(bar)"
        />
      }
    </svg>

    <div class="labels">
      @for (bar of bars(); track $index) {
        <span class="label" [class.highlighted]="bar.highlighted">{{ bar.label }}</span>
      }
    </div>
  `,
  styleUrl: './bar-chart.component.scss',
})
export class BarChartComponent {
  readonly data = input.required<readonly BarInput[]>();

  /** Resumen en texto para lectores de pantalla. */
  readonly ariaLabel = input('Gráfico de barras');

  readonly viewBox = `0 0 ${BOX.width} ${BOX.height}`;

  readonly bars = computed(() => scaleBars(this.data(), BOX));

  /**
   * Un dia con algo cumplido va en el verde fuerte: se ve de un vistazo lo
   * que ya se entreno y motiva a completar la semana. Hoy sin cumplir queda
   * a medio tono, para marcar donde se esta; el resto, claro.
   */
  fillOf(bar: ScaledBar): string {
    if (bar.value > 0) {
      return 'var(--nq-primary-strong)';
    }
    return bar.highlighted
      ? 'rgba(var(--nq-primary-strong-rgb),0.45)'
      : 'rgba(var(--nq-primary-rgb),0.18)';
  }
}
