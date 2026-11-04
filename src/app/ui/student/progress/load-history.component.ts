import { Component, computed, inject } from '@angular/core';
import { LucideTrendingDown, LucideTrendingUp } from '@lucide/angular';

import { LoadHistoryFacade } from '@app/application/workouts/load-history.facade';
import { loadDelta } from '@app/domain/workouts/model/load-history';

import { SeriesPoint } from '@shared/components/chart/chart-math';
import { LineChartComponent } from '@shared/components/chart/line-chart.component';

const FECHA = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' });

/**
 * Seccion "Cargas por ejercicio" de Mediciones (A-2): elige un ejercicio y ve como
 * evoluciono el peso maximo que levanto en cada sesion.
 */
@Component({
  selector: 'nq-load-history',
  standalone: true,
  imports: [LineChartComponent, LucideTrendingDown, LucideTrendingUp],
  providers: [LoadHistoryFacade],
  template: `
    @switch (facade.viewState()) {
      @case ('loading') {
        <p class="nq-empty-inline" role="status">Cargando tus cargas…</p>
      }
      @case ('error') {
        <p class="nq-empty-inline" role="alert">
          No pudimos cargar tus cargas.
          <button class="retry-link" type="button" (click)="reload()">Reintentar</button>
        </p>
      }
      @case ('empty') {
        <p class="nq-empty-inline">
          Cuando registres series con peso en tus entrenamientos, verás aquí cómo progresas.
        </p>
      }
      @case ('success') {
        <div class="field">
          <label class="nq-field-label" for="cargas-ejercicio">Ejercicio</label>
          <div class="nq-field-input">
            <select id="cargas-ejercicio" (change)="elegir($event)">
              @for (item of facade.exercises(); track item.exerciseId) {
                <option
                  [value]="item.exerciseId"
                  [selected]="item.exerciseId === facade.selected()?.exerciseId"
                >
                  {{ item.name }}
                </option>
              }
            </select>
          </div>
        </div>

        @if (facade.selected(); as ejercicio) {
          <section class="summary nq-ani">
            <div class="summary-item">
              <span class="summary-value">{{ ultima()?.maxKg }} kg</span>
              <span class="summary-label">Última carga</span>
            </div>
            <div class="summary-item">
              <span class="summary-value">{{ maxima() }} kg</span>
              <span class="summary-label">Máxima</span>
            </div>
            <div class="summary-item">
              <span class="summary-value delta" [class.down]="(delta() ?? 0) < 0">
                @if (delta() !== null) {
                  @if ((delta() ?? 0) < 0) {
                    <svg lucideTrendingDown [size]="14" [strokeWidth]="2"></svg>
                  } @else {
                    <svg lucideTrendingUp [size]="14" [strokeWidth]="2"></svg>
                  }
                  {{ deltaLabel() }}
                } @else {
                  —
                }
              </span>
              <span class="summary-label">Desde el inicio</span>
            </div>
          </section>

          @if (serie().length > 1) {
            <div class="nq-card chart-card">
              <nq-line-chart [data]="serie()" [ariaLabel]="aria()" />
            </div>
          } @else {
            <p class="nq-empty-inline">
              Con tu próxima sesión de este ejercicio verás aquí cómo evolucionas.
            </p>
          }

          <ul class="points" role="list">
            @for (punto of recientes(); track punto.sessionId) {
              <li class="point">
                <span class="point-date">{{ fecha(punto.date) }}</span>
                <span class="point-value">{{ punto.reps }} × {{ punto.maxKg }} kg</span>
              </li>
            }
          </ul>
        }
      }
    }
  `,
  styleUrl: './load-history.component.scss',
})
export class LoadHistoryComponent {
  readonly facade = inject(LoadHistoryFacade);

  readonly reload = (): void => this.facade.reload();

  readonly ultima = computed(() => {
    const puntos = this.facade.selected()?.points ?? [];
    return puntos[puntos.length - 1] ?? null;
  });

  readonly maxima = computed(() =>
    Math.max(0, ...(this.facade.selected()?.points ?? []).map(punto => punto.maxKg)),
  );

  readonly delta = computed(() => {
    const ejercicio = this.facade.selected();
    return ejercicio === null ? null : loadDelta(ejercicio);
  });

  readonly deltaLabel = computed(() => {
    const valor = this.delta() ?? 0;
    return `${valor > 0 ? '+' : ''}${valor} kg`;
  });

  readonly serie = computed((): SeriesPoint[] =>
    (this.facade.selected()?.points ?? []).map(punto => ({
      value: punto.maxKg,
      label: FECHA.format(new Date(punto.date)),
    })),
  );

  /** Las cinco sesiones mas recientes, de la mas nueva a la mas vieja. */
  readonly recientes = computed(() =>
    [...(this.facade.selected()?.points ?? [])].reverse().slice(0, 5),
  );

  readonly aria = computed(
    () => `Evolución de la carga máxima en ${this.facade.selected()?.name ?? 'el ejercicio'}`,
  );

  constructor() {
    this.facade.load();
  }

  elegir(event: Event): void {
    this.facade.select((event.target as HTMLSelectElement).value);
  }

  fecha(iso: string): string {
    return FECHA.format(new Date(iso));
  }
}
