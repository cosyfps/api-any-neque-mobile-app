import { eventTime } from './event-time';

const NOW = new Date('2026-11-10T15:00:00.000Z');

describe('eventTime', () => {
  it('usa la hora del servidor si no llega una', () => {
    expect(eventTime(undefined, NOW)).toBe(NOW.toISOString());
  });

  it('respeta la hora en que el alumno lo hizo sin conexion', () => {
    expect(eventTime('2026-11-10T11:30:00-03:00', NOW)).toBe('2026-11-10T14:30:00.000Z');
  });

  it('tolera unos minutos de adelanto del reloj del telefono', () => {
    expect(eventTime('2026-11-10T15:04:00.000Z', NOW)).toBe('2026-11-10T15:04:00.000Z');
  });

  it.each([
    ['futura', '2026-11-10T16:00:00.000Z'],
    ['de hace mas de una semana', '2026-11-01T15:00:00.000Z'],
    ['invalida', 'no-es-fecha'],
  ])('cae a la hora del servidor con una hora %s', (_caso, at) => {
    expect(eventTime(at, NOW)).toBe(NOW.toISOString());
  });
});
