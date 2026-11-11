/** Cuanto puede adelantarse el reloj del telefono sin que se desconfie. */
const MAX_AHEAD_MS = 5 * 60_000;
/** Lo mas viejo que acepta una operacion que llega tarde desde la cola. */
const MAX_AGE_MS = 7 * 24 * 3_600_000;

/**
 * Hora con que se registra una operacion del runner.
 *
 * Lo entrenado sin conexion llega con la hora en que ocurrio (`at`) y se
 * guarda asi: la sesion es un hecho historico (PRD §7.1). Una hora ausente,
 * invalida, futura o demasiado vieja cae a la del servidor en vez de
 * rechazarse, porque rechazarla perderia lo que el alumno ya entreno.
 */
export function eventTime(at: string | undefined, now: Date): string {
  const instant = at === undefined ? Number.NaN : Date.parse(at);
  const ahora = now.getTime();
  if (Number.isNaN(instant) || instant > ahora + MAX_AHEAD_MS || instant < ahora - MAX_AGE_MS) {
    return now.toISOString();
  }
  return new Date(instant).toISOString();
}
