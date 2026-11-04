import { Id, IsoDateString } from '@app/domain/shared/model/ids';

import { WorkoutSession } from './workout-session.model';

/** La carga maxima de un ejercicio en una sesion. */
export interface LoadPoint {
  readonly sessionId: Id;
  readonly date: IsoDateString;
  readonly maxKg: number;
  /** Reps de la serie con mas carga (las prescritas si no se corrigieron). */
  readonly reps: number;
}

/** Evolucion de carga de un ejercicio, de la sesion mas antigua a la mas reciente. */
export interface ExerciseLoadHistory {
  readonly exerciseId: Id;
  readonly name: string;
  readonly points: readonly LoadPoint[];
}

/**
 * Historial de cargas por ejercicio (A-2), a partir de las series que el
 * alumno registro con peso. Lo saltado o sin kg no cuenta. Los ejercicios van
 * del entrenado mas recientemente al mas antiguo.
 */
export function loadHistory(sessions: readonly WorkoutSession[]): ExerciseLoadHistory[] {
  const porEjercicio = new Map<Id, { name: string; points: LoadPoint[] }>();

  for (const sesion of sessions) {
    const fecha = sesion.completedAt ?? sesion.startedAt ?? sesion.scheduledFor;
    for (const ejercicio of sesion.exercises) {
      const conPeso = ejercicio.sets.filter(
        serie => serie.skipped !== true && serie.weightKg !== null,
      );
      if (conPeso.length === 0) {
        continue;
      }
      const mejor = conPeso.reduce((a, b) => ((b.weightKg ?? 0) > (a.weightKg ?? 0) ? b : a));
      const entrada = porEjercicio.get(ejercicio.exerciseId) ?? {
        name: ejercicio.name,
        points: [],
      };
      entrada.points.push({
        sessionId: sesion.id,
        date: fecha,
        maxKg: mejor.weightKg ?? 0,
        reps: mejor.reps ?? ejercicio.targetReps,
      });
      porEjercicio.set(ejercicio.exerciseId, entrada);
    }
  }

  return [...porEjercicio.entries()]
    .map(([exerciseId, { name, points }]) => ({
      exerciseId,
      name,
      points: [...points].sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => ultima(b).localeCompare(ultima(a)));
}

/** Diferencia entre la ultima carga y la primera, en kg. Null con un solo punto. */
export function loadDelta(history: ExerciseLoadHistory): number | null {
  const primera = history.points[0];
  const ultimaCarga = history.points[history.points.length - 1];
  if (primera === undefined || ultimaCarga === undefined || history.points.length < 2) {
    return null;
  }
  return Math.round((ultimaCarga.maxKg - primera.maxKg) * 10) / 10;
}

function ultima(history: ExerciseLoadHistory): string {
  return history.points[history.points.length - 1]?.date ?? '';
}
