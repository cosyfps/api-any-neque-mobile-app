import { Id, IsoDateString } from '@app/domain/shared/model/ids';

export type SessionKind = 'training' | 'assessment' | 'checkin';
export type ScheduleStatus = 'confirmed' | 'pending' | 'cancelled';

/** Motivo por el que se cancela una cita. */
export type CancelReason = 'illness' | 'travel' | 'injury' | 'rescheduled' | 'other';

export const CANCEL_REASON_LABEL: Record<CancelReason, string> = {
  illness: 'Enfermedad',
  travel: 'Viaje',
  injury: 'Lesión',
  rescheduled: 'Reagendada',
  other: 'Otro motivo',
};

export const SESSION_KIND_LABEL: Record<SessionKind, string> = {
  training: 'Entrenamiento',
  assessment: 'Evaluación',
  checkin: 'Control',
};

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  confirmed: 'Confirmada',
  pending: 'Por confirmar',
  cancelled: 'Cancelada',
};

/** Cita agendada entre entrenador y alumno. */
export interface ScheduledSession {
  readonly id: Id;
  readonly studentId: Id;
  readonly trainerId: Id;
  readonly title: string;
  readonly startsAt: IsoDateString;
  readonly endsAt: IsoDateString;
  readonly location: string | null;
  readonly kind: SessionKind;
  readonly status: ScheduleStatus;
  /** Sesion de entrenamiento asociada, si la cita es de tipo training. */
  readonly workoutSessionId: Id | null;
  /**
   * Cancelacion. El motivo es de una lista cerrada para poder contarlo; la
   * nota libre existe porque "otro motivo" sin explicacion no le sirve a nadie.
   */
  readonly cancellationReason: CancelReason | null;
  readonly cancellationNote: string | null;
  readonly cancelledAt: IsoDateString | null;
}

/** Lo que el entrenador envia al agendar una cita. Nace pendiente. */
export interface ScheduledSessionInput {
  readonly studentId: Id;
  readonly title: string;
  readonly startsAt: IsoDateString;
  readonly endsAt: IsoDateString;
  readonly location: string | null;
  readonly kind: SessionKind;
}

/** Duracion permitida de una cita, en minutos. */
export const APPOINTMENT_MIN_MINUTES = 15;
export const APPOINTMENT_MAX_MINUTES = 240;
/** Hasta cuantos dias hacia adelante se puede agendar. */
export const APPOINTMENT_MAX_DAYS_AHEAD = 365;

/**
 * Valida las fechas de una cita nueva. Devuelve el mensaje para el usuario,
 * o null si es valida. La usan el formulario y el BFF: las mismas reglas en
 * los dos lados.
 */
export function appointmentError(startsAt: Date, endsAt: Date, now: Date): string | null {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return 'Revisa la fecha y la hora de la cita.';
  }
  if (startsAt.getTime() <= now.getTime()) {
    return 'Elige una fecha y hora futuras.';
  }
  if (startsAt.getTime() - now.getTime() > APPOINTMENT_MAX_DAYS_AHEAD * 86_400_000) {
    return 'Puedes agendar con hasta un año de anticipación.';
  }
  const minutos = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  if (minutos < APPOINTMENT_MIN_MINUTES || minutos > APPOINTMENT_MAX_MINUTES) {
    return 'La cita debe durar entre 15 minutos y 4 horas.';
  }
  return null;
}
