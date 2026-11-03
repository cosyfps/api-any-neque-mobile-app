import { formatDuration, loadOf, measureOf, usesKg } from './prescription';

describe('prescription', () => {
  describe('loadOf()', () => {
    it('respeta la carga guardada', () => {
      expect(loadOf({ weightKg: 10, load: 'weighted_bodyweight' })).toBe('weighted_bodyweight');
    });

    // Rutinas guardadas antes de existir el campo.
    it('sin carga guardada, deduce peso corporal cuando no hay kg', () => {
      expect(loadOf({ weightKg: null })).toBe('bodyweight');
    });

    it('sin carga guardada, deduce con peso cuando hay kg', () => {
      expect(loadOf({ weightKg: 40 })).toBe('weight');
    });
  });

  describe('measureOf()', () => {
    it('por defecto se mide en repeticiones', () => {
      expect(measureOf({ weightKg: null })).toBe('reps');
    });

    it('respeta la medida guardada', () => {
      expect(measureOf({ weightKg: null, measure: 'time' })).toBe('time');
    });
  });

  describe('usesKg()', () => {
    it.each([
      ['weight', true],
      ['weighted_bodyweight', true],
      ['bodyweight', false],
    ] as const)('%s → %s', (load, esperado) => {
      expect(usesKg({ weightKg: null, load })).toBe(esperado);
    });
  });

  describe('formatDuration()', () => {
    it.each([
      [45, '45 s'],
      [60, '1 min'],
      [90, '1 min 30 s'],
      [900, '15 min'],
      [0, '0 s'],
      [-5, '0 s'],
    ])('%s segundos → %s', (segundos, texto) => {
      expect(formatDuration(segundos)).toBe(texto);
    });
  });
});
