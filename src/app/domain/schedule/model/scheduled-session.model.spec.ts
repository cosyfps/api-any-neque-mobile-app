import { appointmentError } from './scheduled-session.model';

const AHORA = new Date(2026, 8, 20, 10, 0);
const enMinutos = (base: Date, minutos: number): Date =>
  new Date(base.getTime() + minutos * 60_000);

describe('appointmentError()', () => {
  const manana = new Date(2026, 8, 21, 9, 0);

  it('acepta una cita futura de una hora', () => {
    expect(appointmentError(manana, enMinutos(manana, 60), AHORA)).toBeNull();
  });

  it('rechaza fechas invalidas', () => {
    expect(appointmentError(new Date('x'), manana, AHORA)).toBe(
      'Revisa la fecha y la hora de la cita.',
    );
  });

  it('rechaza una hora pasada o la misma de ahora', () => {
    expect(appointmentError(AHORA, enMinutos(AHORA, 60), AHORA)).toBe(
      'Elige una fecha y hora futuras.',
    );
  });

  it('rechaza mas de un año hacia adelante', () => {
    const lejos = new Date(2027, 8, 25, 9, 0);

    expect(appointmentError(lejos, enMinutos(lejos, 60), AHORA)).toBe(
      'Puedes agendar con hasta un año de anticipación.',
    );
  });

  it.each([10, 300])('rechaza una duracion de %i minutos', minutos => {
    expect(appointmentError(manana, enMinutos(manana, minutos), AHORA)).toBe(
      'La cita debe durar entre 15 minutos y 4 horas.',
    );
  });

  it.each([15, 240])('acepta el limite de %i minutos', minutos => {
    expect(appointmentError(manana, enMinutos(manana, minutos), AHORA)).toBeNull();
  });
});
