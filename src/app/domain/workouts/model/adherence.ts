import { WorkoutSession } from './workout-session.model';

/**
 * Porcentaje entero de sesiones completadas sobre las ya resueltas.
 *
 * Misma regla que la pantalla de progreso del alumno: cuenta todo lo que ya no
 * esta `scheduled`. Null si no hay nada resuelto, para no promediar un 0 que
 * no significa nada.
 */
export function adherencePercent(sessions: readonly WorkoutSession[]): number | null {
  const resueltas = sessions.filter(session => session.status !== 'scheduled');
  if (resueltas.length === 0) {
    return null;
  }
  const completadas = resueltas.filter(session => session.status === 'completed').length;
  return Math.round((completadas / resueltas.length) * 100);
}

/** Promedio entero de varios porcentajes, ignorando los que no tienen dato. */
export function averagePercent(values: readonly (number | null)[]): number | null {
  const conDato = values.filter((value): value is number => value !== null);
  if (conDato.length === 0) {
    return null;
  }
  return Math.round(conDato.reduce((sum, value) => sum + value, 0) / conDato.length);
}
