import { WorkoutSession } from './workout-session.model';

/**
 * Reglas para que el alumno mueva un entrenamiento dentro de su semana (A-3).
 * Trabajan con dias `yyyy-MM-dd` en hora de Chile; las comparten el front
 * (para ofrecer los dias validos) y el BFF (para rechazar lo demas).
 */

const DAY_MS = 86_400_000;

/** Fecha local `yyyy-MM-dd` de un `Date`. */
export function localDay(date: Date): string {
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${dos(date.getMonth() + 1)}-${dos(date.getDate())}`;
}

function aUtc(day: string): number {
  const [anio = 0, mes = 1, dia = 1] = day.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

function deUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Lunes de la semana ISO del dia. */
export function mondayOfDay(day: string): string {
  const ms = aUtc(day);
  const semana = (new Date(ms).getUTCDay() + 6) % 7; // 0 = lunes
  return deUtc(ms - semana * DAY_MS);
}

/**
 * Dias a los que se puede mover: de hoy (o el lunes, si la semana aun no
 * empieza) al domingo de la semana original, sin el dia en que ya esta ni
 * los que ya tienen otro entrenamiento (`occupied`): dos el mismo dia se
 * pisaban y solo se veia uno.
 */
export function rescheduleOptions(
  originalDay: string,
  currentDay: string,
  today: string,
  occupied: readonly string[] = [],
): string[] {
  const lunes = aUtc(mondayOfDay(originalDay));
  const desde = Math.max(lunes, aUtc(today));
  const domingo = lunes + 6 * DAY_MS;
  const dias: string[] = [];
  for (let t = desde; t <= domingo; t += DAY_MS) {
    const dia = deUtc(t);
    if (dia !== currentDay && !occupied.includes(dia)) {
      dias.push(dia);
    }
  }
  return dias;
}

/** Mensaje para el usuario si no se puede mover, o null si se puede. */
export function rescheduleError(
  session: Pick<WorkoutSession, 'status' | 'startedAt'>,
  originalDay: string,
  currentDay: string,
  newDay: string,
  today: string,
  occupied: readonly string[] = [],
): string | null {
  if (session.status !== 'scheduled' || session.startedAt !== null) {
    return 'Solo puedes mover un entrenamiento que todavía no empiezas.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDay)) {
    return 'Elige un día válido.';
  }
  if (occupied.includes(newDay)) {
    return 'Ese día ya tiene un entrenamiento. Elige un día libre.';
  }
  if (!rescheduleOptions(originalDay, currentDay, today).includes(newDay)) {
    return 'Puedes moverlo a otro día de esta misma semana, desde hoy.';
  }
  return null;
}
