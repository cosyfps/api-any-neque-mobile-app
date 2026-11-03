import { toIsoDate } from '@app/domain/shared/model/date';

import { weekStreak } from './streak';
import { WorkoutSession, WorkoutStatus } from './workout-session.model';

// Miercoles 23 de septiembre de 2026. La semana en curso empieza el lunes 21.
const HOY = new Date(2026, 8, 23, 12);

let secuencia = 0;
const sesion = (fecha: Date, status: WorkoutStatus): WorkoutSession => ({
  id: `wks-${++secuencia}`,
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-1',
  title: 'Sesion',
  scheduledFor: toIsoDate(fecha),
  startedAt: null,
  completedAt: null,
  status,
  durationMinutes: null,
  estimatedMinutes: 45,
  exercises: [],
});

/** Lunes de la semana `atras` semanas antes de la actual, a las 18:00. */
const lunes = (atras: number, desplazamiento = 0): Date =>
  new Date(2026, 8, 21 - 7 * atras + desplazamiento, 18);

describe('weekStreak()', () => {
  it('es cero sin sesiones', () => {
    expect(weekStreak([], HOY)).toBe(0);
  });

  it('cuenta semanas seguidas con todo completado', () => {
    const sesiones = [
      sesion(lunes(1), 'completed'),
      sesion(lunes(1, 3), 'completed'),
      sesion(lunes(2), 'completed'),
      sesion(lunes(3), 'completed'),
    ];

    expect(weekStreak(sesiones, HOY)).toBe(3);
  });

  it('suma la semana en curso si ya cumplio lo que va', () => {
    const sesiones = [sesion(lunes(0), 'completed'), sesion(lunes(1), 'completed')];

    expect(weekStreak(sesiones, HOY)).toBe(2);
  });

  // Lo que aun no llega no hace fallar la semana en curso.
  it('lo pendiente de la semana en curso no corta', () => {
    const sesiones = [
      sesion(lunes(0), 'completed'),
      sesion(lunes(0, 4), 'scheduled'),
      sesion(lunes(1), 'completed'),
    ];

    expect(weekStreak(sesiones, HOY)).toBe(2);
  });

  it('una semana en curso aun sin empezar no suma ni corta', () => {
    const sesiones = [sesion(lunes(0, 4), 'scheduled'), sesion(lunes(1), 'completed')];

    expect(weekStreak(sesiones, HOY)).toBe(1);
  });

  it('una sesion saltada corta la racha', () => {
    const sesiones = [
      sesion(lunes(1), 'completed'),
      sesion(lunes(2), 'completed'),
      sesion(lunes(2, 3), 'skipped'),
      sesion(lunes(3), 'completed'),
    ];

    expect(weekStreak(sesiones, HOY)).toBe(1);
  });

  it('una sesion pasada sin completar corta la racha', () => {
    const sesiones = [sesion(lunes(0), 'scheduled'), sesion(lunes(1), 'completed')];

    expect(weekStreak(sesiones, HOY)).toBe(0);
  });

  it('una semana sin sesiones agendadas corta la racha', () => {
    const sesiones = [sesion(lunes(1), 'completed'), sesion(lunes(3), 'completed')];

    expect(weekStreak(sesiones, HOY)).toBe(1);
  });
});
