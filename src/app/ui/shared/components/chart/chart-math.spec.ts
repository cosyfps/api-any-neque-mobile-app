import {
  BarInput,
  ChartBox,
  SeriesPoint,
  buildPolyline,
  clampPercent,
  ringCircumference,
  ringOffset,
  scaleBars,
} from './chart-math';

const BOX: ChartBox = { width: 280, height: 120, padding: 10 };

describe('chart-math', () => {
  describe('scaleBars()', () => {
    const inputs: BarInput[] = [
      { label: 'L', value: 1, highlighted: false },
      { label: 'M', value: 2, highlighted: true },
      { label: 'X', value: 0, highlighted: false },
    ];

    it('devuelve una barra por entrada', () => {
      expect(scaleBars(inputs, BOX)).toHaveLength(3);
    });

    it('devuelve vacio sin entradas', () => {
      expect(scaleBars([], BOX)).toEqual([]);
    });

    it('la barra del maximo ocupa el alto util completo', () => {
      const bars = scaleBars(inputs, BOX);
      expect(bars[1]?.height).toBeCloseTo(BOX.height - BOX.padding * 2);
    });

    // El home le pasa el porcentaje cumplido de cada dia (0 a 1): un dia
    // completo llena la barra aunque otro tenga mas sesiones.
    it('con porcentajes, un dia completo siempre llena la barra', () => {
      const bars = scaleBars(
        [
          { label: 'L', value: 1, highlighted: false },
          { label: 'M', value: 1, highlighted: true },
          { label: 'X', value: 0.5, highlighted: false },
        ],
        BOX,
      );
      const lleno = BOX.height - BOX.padding * 2;

      expect(bars[0]?.height).toBeCloseTo(lleno);
      expect(bars[1]?.height).toBeCloseTo(lleno);
      expect(bars[2]?.height).toBeCloseTo(lleno / 2);
    });

    it('escala proporcionalmente contra el maximo', () => {
      const bars = scaleBars(inputs, BOX);
      expect(bars[0]?.height).toBeCloseTo((BOX.height - BOX.padding * 2) / 2);
    });

    it('da altura minima visible a un valor cero', () => {
      const bars = scaleBars(inputs, BOX);
      expect(bars[2]?.height).toBe(2);
    });

    it('conserva la marca de resaltado', () => {
      const bars = scaleBars(inputs, BOX);
      expect(bars[1]?.highlighted).toBe(true);
      expect(bars[0]?.highlighted).toBe(false);
    });

    it('mantiene las barras dentro del viewBox', () => {
      for (const bar of scaleBars(inputs, BOX)) {
        expect(bar.x).toBeGreaterThanOrEqual(BOX.padding);
        expect(bar.x + bar.width).toBeLessThanOrEqual(BOX.width - BOX.padding);
        expect(bar.y).toBeGreaterThanOrEqual(BOX.padding);
      }
    });

    it('no divide por cero cuando todo vale cero', () => {
      const bars = scaleBars(
        [
          { label: 'a', value: 0, highlighted: false },
          { label: 'b', value: 0, highlighted: false },
        ],
        BOX,
      );
      expect(bars.every(bar => Number.isFinite(bar.height))).toBe(true);
    });
  });

  describe('buildPolyline()', () => {
    const points: SeriesPoint[] = [
      { value: 61.4, label: 'mar' },
      { value: 60.2, label: 'may' },
      { value: 58.9, label: 'sep' },
    ];

    it('devuelve paths vacios sin puntos', () => {
      const result = buildPolyline([], BOX);
      expect(result.line).toBe('');
      expect(result.area).toBe('');
      expect(result.dots).toEqual([]);
    });

    it('genera un punto por valor', () => {
      expect(buildPolyline(points, BOX).dots).toHaveLength(3);
    });

    it('la linea empieza con M y sigue con L', () => {
      const { line } = buildPolyline(points, BOX);
      expect(line.startsWith('M')).toBe(true);
      expect(line).toContain('L');
    });

    it('el area cierra el path con Z', () => {
      expect(buildPolyline(points, BOX).area.endsWith('Z')).toBe(true);
    });

    it('expone el minimo y el maximo reales de la serie', () => {
      const result = buildPolyline(points, BOX);
      expect(result.min).toBe(58.9);
      expect(result.max).toBe(61.4);
    });

    it('el valor mas alto queda mas arriba que el mas bajo', () => {
      const { dots } = buildPolyline(points, BOX);
      expect(dots[0]?.y).toBeLessThan(dots[2]?.y ?? 0);
    });

    it('centra un unico punto', () => {
      const { dots } = buildPolyline([{ value: 60, label: 'sep' }], BOX);
      expect(dots[0]?.x).toBe(BOX.width / 2);
    });

    it('no produce NaN cuando todos los valores son iguales', () => {
      const { dots } = buildPolyline(
        [
          { value: 60, label: 'a' },
          { value: 60, label: 'b' },
        ],
        BOX,
      );
      expect(dots.every(dot => Number.isFinite(dot.y))).toBe(true);
    });

    it('mantiene los puntos dentro del viewBox', () => {
      for (const dot of buildPolyline(points, BOX).dots) {
        expect(dot.y).toBeGreaterThanOrEqual(0);
        expect(dot.y).toBeLessThanOrEqual(BOX.height);
      }
    });
  });

  describe('clampPercent()', () => {
    it.each([
      [-20, 0],
      [0, 0],
      [55, 55],
      [100, 100],
      [140, 100],
    ])('recorta %i a %i', (input, expected) => {
      expect(clampPercent(input)).toBe(expected);
    });

    it('devuelve cero ante un valor no finito', () => {
      expect(clampPercent(Number.NaN)).toBe(0);
    });
  });

  describe('anillo de progreso', () => {
    it('calcula la circunferencia', () => {
      expect(ringCircumference(10)).toBeCloseTo(62.83, 2);
    });

    it('sin progreso el offset es la circunferencia completa', () => {
      expect(ringOffset(10, 0)).toBeCloseTo(ringCircumference(10));
    });

    it('con progreso completo el offset es cero', () => {
      expect(ringOffset(10, 1)).toBeCloseTo(0);
    });

    it('a la mitad el offset es la mitad', () => {
      expect(ringOffset(10, 0.5)).toBeCloseTo(ringCircumference(10) / 2);
    });

    it('recorta valores fuera de rango', () => {
      expect(ringOffset(10, 2)).toBeCloseTo(0);
      expect(ringOffset(10, -1)).toBeCloseTo(ringCircumference(10));
    });
  });
});
