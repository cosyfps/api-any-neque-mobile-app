import { addDays, differenceInDays, parseIsoDate, startOfDay } from '@app/domain/shared/model/date';

import { adherencePercent } from './adherence';
import { WorkoutSession } from './workout-session.model';

/** Bajo esta adherencia el alumno necesita atencion. */
export const RISK_ADHERENCE = 60;

/** Dias sin completar nada, con sesiones agendadas, para dar la alarma. */
export const RISK_INACTIVE_DAYS = 7;

/** Por que un alumno esta en riesgo. */
export type StudentRisk =
  | { readonly kind: 'inactive'; readonly days: number }
  | { readonly kind: 'low_adherence'; readonly percent: number };

/**
 * Riesgo de abandono de un alumno, o null si va bien.
 *
 * Inactivo: tuvo sesiones agendadas en los ultimos 7 dias y no completo
 * ninguna. Se mira primero porque es lo mas urgente: la adherencia baja
 * tarda en notarse, dejar de venir no.
 *
 * Adherencia baja: menos de 60% de sus sesiones resueltas quedaron
 * completadas.
 */
export function studentRisk(sessions: readonly WorkoutSession[], now: Date): StudentRisk | null {
  const hoy = startOfDay(now);
  const desde = addDays(hoy, -RISK_INACTIVE_DAYS);
  const ventana = sessions.filter(session => {
    const fecha = parseIsoDate(session.scheduledFor);
    return fecha !== null && fecha >= desde && fecha < hoy;
  });

  if (ventana.length > 0 && ventana.every(session => session.status !== 'completed')) {
    return { kind: 'inactive', days: diasSinEntrenar(sessions, hoy) };
  }

  const adherencia = adherencePercent(sessions);
  if (adherencia !== null && adherencia < RISK_ADHERENCE) {
    return { kind: 'low_adherence', percent: adherencia };
  }
  return null;
}

/** "12 días sin entrenar" o "52% de adherencia": el motivo, listo para mostrar. */
export function riskLabel(risk: StudentRisk): string {
  return risk.kind === 'inactive'
    ? `${risk.days} días sin entrenar`
    : `${risk.percent}% de adherencia`;
}

/** Dias desde la ultima sesion completada; al menos el umbral si nunca entreno. */
function diasSinEntrenar(sessions: readonly WorkoutSession[], hoy: Date): number {
  const ultima = sessions
    .filter(session => session.status === 'completed')
    .map(session => parseIsoDate(session.completedAt ?? session.scheduledFor))
    .filter((fecha): fecha is Date => fecha !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (ultima === undefined) {
    return RISK_INACTIVE_DAYS;
  }
  return Math.max(RISK_INACTIVE_DAYS, differenceInDays(ultima, hoy));
}
