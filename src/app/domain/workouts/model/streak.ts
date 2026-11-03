import { addDays, parseIsoDate, startOfDay, startOfWeek } from '@app/domain/shared/model/date';

import { WorkoutSession } from './workout-session.model';

/** Cuantas semanas hacia atras se miran como maximo. */
const SEMANAS_MAXIMAS = 52;

/**
 * Semanas seguidas en que el alumno cumplio todo lo agendado.
 *
 * Una semana cuenta si tiene al menos una sesion completada y ninguna fallada.
 * Fallada es una sesion de un dia ya pasado que no quedo completada, incluidas
 * las saltadas: saltar corta la racha.
 *
 * La semana en curso es especial: lo que aun no llega no la hace fallar. Si
 * todavia no tiene nada completado ni fallado, no suma ni corta: la racha se
 * sigue contando desde la semana anterior.
 *
 * Una semana sin sesiones agendadas corta la racha: no hubo que cumplir.
 */
export function weekStreak(sessions: readonly WorkoutSession[], now: Date): number {
  const hoy = startOfDay(now);
  const semanaActual = startOfWeek(now);
  let racha = 0;

  for (let semana = 0; semana < SEMANAS_MAXIMAS; semana++) {
    const inicio = addDays(semanaActual, -7 * semana);
    const fin = addDays(inicio, 7);
    const deLaSemana = sessions.filter(session => {
      const fecha = parseIsoDate(session.scheduledFor);
      return fecha !== null && fecha >= inicio && fecha < fin;
    });

    const completadas = deLaSemana.filter(session => session.status === 'completed').length;
    const falladas = deLaSemana.filter(session => {
      const fecha = parseIsoDate(session.scheduledFor);
      return session.status !== 'completed' && fecha !== null && startOfDay(fecha) < hoy;
    }).length;

    if (falladas > 0) {
      return racha;
    }
    if (completadas > 0) {
      racha++;
      continue;
    }
    // Solo la semana en curso puede estar "aun sin empezar" sin cortar.
    if (semana !== 0) {
      return racha;
    }
  }

  return racha;
}
