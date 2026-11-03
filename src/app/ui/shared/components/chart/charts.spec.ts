import { ComponentRef, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BarChartComponent } from './bar-chart.component';
import { BarInput, SeriesPoint } from './chart-math';
import { LineChartComponent } from './line-chart.component';
import { RingProgressComponent } from './ring-progress.component';

/**
 * Los tres graficos renderizan en sus specs.
 *
 * Un `input()` señal solo se fija con `componentRef.setInput()`, que exige un
 * `TestBed.createComponent`. La matematica sigue probada aparte en
 * `chart-math.spec.ts`, sin renderizar nada.
 */
function montar<T>(tipo: Type<T>): { ref: ComponentRef<T>; cmp: T } {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(tipo);
  return { ref: fixture.componentRef, cmp: fixture.componentInstance };
}

describe('BarChartComponent', () => {
  let ref: ComponentRef<BarChartComponent>;
  let chart: BarChartComponent;

  beforeEach(() => {
    ({ ref, cmp: chart } = montar(BarChartComponent));
    ref.setInput('data', []);
  });

  it('arranca sin barras', () => {
    expect(chart.bars()).toEqual([]);
  });

  it('escala las barras recibidas', () => {
    const data: BarInput[] = [
      { label: 'L', value: 1, highlighted: false },
      { label: 'M', value: 2, highlighted: true },
    ];
    ref.setInput('data', data);

    expect(chart.bars()).toHaveLength(2);
    expect(chart.bars()[1]?.highlighted).toBe(true);
  });

  // Un dia cumplido se ve fuerte: motiva a completar la semana.
  it('pinta en verde fuerte los dias con algo cumplido', () => {
    ref.setInput('data', [
      { label: 'L', value: 1, highlighted: false },
      { label: 'M', value: 0, highlighted: true },
      { label: 'X', value: 0, highlighted: false },
    ] satisfies BarInput[]);
    const [cumplido, hoy, pendiente] = chart.bars();

    expect(cumplido && chart.fillOf(cumplido)).toBe('var(--nq-primary-strong)');
    expect(hoy && chart.fillOf(hoy)).toContain('--nq-primary-strong-rgb');
    expect(pendiente && chart.fillOf(pendiente)).toContain('--nq-primary-rgb');
  });

  it('expone un viewBox valido', () => {
    expect(chart.viewBox).toMatch(/^0 0 \d+ \d+$/);
  });
});

describe('LineChartComponent', () => {
  let ref: ComponentRef<LineChartComponent>;
  let chart: LineChartComponent;

  beforeEach(() => {
    ({ ref, cmp: chart } = montar(LineChartComponent));
    ref.setInput('data', []);
  });

  it('sin datos no dibuja linea', () => {
    expect(chart.polyline().dots).toEqual([]);
  });

  it('construye la linea con los puntos recibidos', () => {
    const data: SeriesPoint[] = [
      { value: 61, label: 'mar' },
      { value: 59, label: 'sep' },
    ];
    ref.setInput('data', data);

    expect(chart.polyline().dots).toHaveLength(2);
    expect(chart.polyline().line.startsWith('M')).toBe(true);
  });

  // Dos graficos con el mismo id de degradado se pisan entre si.
  it('cada instancia usa un id de degradado distinto', () => {
    const { cmp: otro } = montar(LineChartComponent);

    expect(chart.gradientId).not.toBe(otro.gradientId);
  });

  it('la referencia al degradado apunta a su propio id', () => {
    expect(chart.gradientRef).toBe(`url(#${chart.gradientId})`);
  });

  it('expone un viewBox valido', () => {
    expect(chart.viewBox).toMatch(/^0 0 \d+ \d+$/);
  });
});

describe('RingProgressComponent', () => {
  let ref: ComponentRef<RingProgressComponent>;
  let ring: RingProgressComponent;

  beforeEach(() => {
    ({ ref, cmp: ring } = montar(RingProgressComponent));
    ref.setInput('progress', 0);
  });

  it('sin progreso el offset es la circunferencia completa', () => {
    expect(ring.offset()).toBeCloseTo(ring.circumference);
  });

  it('con progreso completo el offset es cero', () => {
    ref.setInput('progress', 1);
    expect(ring.offset()).toBeCloseTo(0);
  });

  it('a la mitad el offset es la mitad', () => {
    ref.setInput('progress', 0.5);
    expect(ring.offset()).toBeCloseTo(ring.circumference / 2);
  });

  it('recorta valores fuera de rango', () => {
    ref.setInput('progress', 3);
    expect(ring.offset()).toBeCloseTo(0);
  });

  it('gira el anillo para que empiece arriba', () => {
    expect(ring.rotation).toContain('rotate(-90');
  });

  it('el centro es la mitad del viewBox', () => {
    expect(ring.viewBox).toBe(`0 0 ${ring.center * 2} ${ring.center * 2}`);
  });
});
