import { sessionInstant } from './zoned-time';

describe('sessionInstant()', () => {
  it('sin hora usa mediodia UTC, el mismo dia en Chile', () => {
    expect(sessionInstant('2026-11-09', null)).toBe('2026-11-09T12:00:00.000Z');
    expect(sessionInstant('2026-11-09', undefined)).toBe('2026-11-09T12:00:00.000Z');
    expect(sessionInstant('2026-11-09', '')).toBe('2026-11-09T12:00:00.000Z');
  });

  // Noviembre: horario de verano, UTC-3.
  it('en verano convierte la hora de Chile restando 3 horas', () => {
    expect(sessionInstant('2026-11-09', '18:30')).toBe('2026-11-09T21:30:00.000Z');
  });

  // Julio: horario de invierno, UTC-4.
  it('en invierno convierte la hora de Chile restando 4 horas', () => {
    expect(sessionInstant('2026-07-06', '07:00')).toBe('2026-07-06T11:00:00.000Z');
  });

  it('una hora de la noche puede caer al dia siguiente en UTC', () => {
    expect(sessionInstant('2026-11-09', '22:15')).toBe('2026-11-10T01:15:00.000Z');
  });

  it('acepta otra zona horaria', () => {
    expect(sessionInstant('2026-11-09', '10:00', 'UTC')).toBe('2026-11-09T10:00:00.000Z');
  });
});
