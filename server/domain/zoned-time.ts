/** Zona de los entrenadores y alumnos de Ñeque. */
export const APP_TIME_ZONE = 'America/Santiago';

/**
 * Instante de una sesion: la fecha (`yyyy-MM-dd`) a la hora local (`HH:mm`)
 * de la zona dada, en ISO UTC. Sin hora, mediodia UTC: el mismo dia
 * calendario en Chile, como se generaban antes de existir la hora por dia.
 *
 * El BFF corre en UTC y Chile cambia de horario dos veces al año, asi que el
 * desfase se calcula para esa fecha y no se fija en -3 o -4.
 */
export function sessionInstant(
  date: string,
  time: string | null | undefined,
  timeZone = APP_TIME_ZONE,
): string {
  if (time === null || time === undefined || time === '') {
    return `${date}T12:00:00.000Z`;
  }
  const [anio = 0, mes = 1, dia = 1] = date.split('-').map(Number);
  const [hora = 0, minuto = 0] = time.split(':').map(Number);
  const comoUtc = Date.UTC(anio, mes - 1, dia, hora, minuto);
  // Primer intento con el desfase de ese instante; si cae del otro lado de un
  // cambio de horario, el segundo calculo lo corrige.
  let utc = comoUtc - desfase(comoUtc, timeZone);
  const corregido = comoUtc - desfase(utc, timeZone);
  if (corregido !== utc) {
    utc = corregido;
  }
  return new Date(utc).toISOString();
}

/** Milisegundos que la hora local de la zona va adelante de UTC (negativo en Chile). */
function desfase(instante: number, timeZone: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instante));
  const valor = (tipo: Intl.DateTimeFormatPartTypes): number =>
    Number(partes.find(parte => parte.type === tipo)?.value ?? 0);
  const local = Date.UTC(
    valor('year'),
    valor('month') - 1,
    valor('day'),
    valor('hour'),
    valor('minute'),
    valor('second'),
  );
  return local - (instante - (instante % 1000));
}
