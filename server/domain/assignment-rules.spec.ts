import { mondayOf, staleSessionWindow } from './assignment-rules';

describe('mondayOf', () => {
  it.each([
    ['2026-11-03', '2026-11-02'],
    ['2026-11-02', '2026-11-02'],
    ['2026-11-08', '2026-11-02'],
    ['2026-11-01', '2026-10-26'],
  ])('el lunes de la semana de %s es %s', (hoy, lunes) => {
    expect(mondayOf(hoy)).toBe(lunes);
  });
});

describe('staleSessionWindow', () => {
  // Caso real: martes 3, la rutina se movio del 31/10 al 9/11.
  it('al mover el inicio a la semana siguiente limpia la semana en curso', () => {
    expect(staleSessionWindow('2026-11-03', '2026-11-09')).toEqual({
      from: '2026-11-02',
      to: '2026-11-09',
    });
  });

  it('un inicio a mitad de semana limpia solo los dias anteriores a el', () => {
    expect(staleSessionWindow('2026-11-03', '2026-11-05')).toEqual({
      from: '2026-11-02',
      to: '2026-11-05',
    });
  });

  it('un inicio que ya paso no limpia nada', () => {
    expect(staleSessionWindow('2026-11-03', '2026-10-31')).toBeNull();
    expect(staleSessionWindow('2026-11-03', '2026-11-02')).toBeNull();
  });

  it('sin fecha de inicio no limpia nada', () => {
    expect(staleSessionWindow('2026-11-03', null)).toBeNull();
  });
});
