import { Routine, RoutineDay } from '@app/domain/routines/model/routine.model';
import { isSameDay, isoWeekday, parseIsoDate, startOfDay } from '@app/domain/shared/model/date';
import { Id } from '@app/domain/shared/model/ids';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';

/** Como quedo un dia de entrenamiento de la rutina. */
export type TrainingStatus = 'done' | 'planned' | 'missed';

/** Etiquetas visibles de cada estado. */
export const TRAINING_STATUS_LABEL: Record<TrainingStatus, string> = {
  done: 'Completado',
  planned: 'Planificado',
  missed: 'No realizado',
};

/** Dia de la rutina que toca en una fecha, con su estado. */
export interface PlannedTraining {
  readonly day: RoutineDay;
  readonly status: TrainingStatus;
}

/**
 * Entrenamiento que la rutina vigente pone en una fecha.
 *
 * Sale de la rutina y no de las sesiones: el BFF solo genera sesiones dos
 * semanas hacia adelante, y la agenda muestra el mes completo. Las sesiones
 * solo aportan el estado (completada u omitida) de los dias ya entrenados.
 */
export function plannedTrainingOn(
  routine: Routine | null,
  studentId: Id,
  date: Date,
  sessions: readonly WorkoutSession[],
  today: Date,
): PlannedTraining | null {
  if (routine === null) {
    return null;
  }
  const assignment = routine.assignments.find(item => item.studentId === studentId);
  if (
    assignment === undefined ||
    !withinAssignment(date, assignment.startDate, assignment.endDate)
  ) {
    return null;
  }
  const day = routine.days.find(item => item.weekday === isoWeekday(date));
  if (day === undefined) {
    return null;
  }

  const session = sessions.find(item => {
    const scheduled = parseIsoDate(item.scheduledFor);
    return item.routineDayId === day.id && scheduled !== null && isSameDay(scheduled, date);
  });
  if (session?.status === 'completed') {
    return { day, status: 'done' };
  }
  if (session?.status === 'skipped' || startOfDay(date) < startOfDay(today)) {
    return { day, status: 'missed' };
  }
  return { day, status: 'planned' };
}

/** Compara solo la fecha: `startDate` llega como `yyyy-MM-dd` o ISO completo. */
function withinAssignment(date: Date, start: string, end: string | null): boolean {
  const dia = localDay(date);
  return dia >= start.slice(0, 10) && (end === null || dia <= end.slice(0, 10));
}

function localDay(date: Date): string {
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${dos(date.getMonth() + 1)}-${dos(date.getDate())}`;
}
