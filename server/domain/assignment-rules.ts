/** Rango de fechas `yyyy-MM-dd`, `from` incluido y `to` excluido. */
export interface DateWindow {
  readonly from: string;
  readonly to: string;
}

const DAY_MS = 86_400_000;

/** Lunes de la semana de `today` (`yyyy-MM-dd`, calendario UTC). */
export function mondayOf(today: string): string {
  const date = new Date(`${today}T00:00:00.000Z`);
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return new Date(date.getTime() - (weekday - 1) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Sesiones que sobran al (re)asignar una rutina: las de la semana en curso
 * que quedan ANTES del nuevo inicio. Null si no hay nada que limpiar.
 *
 * Caso real: se asigno desde el 31/10, eso genero la sesion del lunes 2, y
 * luego se movio el inicio al 9. La funcion SQL solo borraba desde hoy en
 * adelante, asi que la del lunes 2 (ya pasada) quedaba viva en la semana
 * actual y el alumno podia completarla.
 *
 * Semanas anteriores no se tocan: son historial y alimentan la adherencia.
 * Lo completado tampoco (eso lo filtra quien borra).
 */
export function staleSessionWindow(today: string, newStart: string | null): DateWindow | null {
  if (newStart === null) {
    return null;
  }
  const from = mondayOf(today);
  return newStart > from ? { from, to: newStart } : null;
}
