import { Id, IsoDateString } from '@app/domain/shared/model/ids';

/** Por que el alumno salto una serie o un ejercicio. Lo lee el entrenador. */
export type SkipReason = 'equipment_busy' | 'pain' | 'no_time' | 'other';

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  equipment_busy: 'Máquina ocupada',
  pain: 'Molestia o dolor',
  no_time: 'Sin tiempo',
  other: 'Otro motivo',
};

/**
 * Una serie tal como el alumno la ejecuto.
 *
 * Lo prescrito vive en la rutina; esto es lo que de verdad levanto. Sin este
 * registro la progresion de carga se pierde y el entrenador no puede ajustar.
 */
export interface WorkoutSet {
  readonly id: Id;
  readonly setNumber: number;
  /** Null cuando el alumno cerro la serie sin corregir lo prescrito. */
  readonly reps: number | null;
  readonly weightKg: number | null;
  readonly completedAt: IsoDateString;
  /** Segundos que duro, en un ejercicio que se mide por tiempo. */
  readonly durationSeconds?: number | null;
  /** La serie no se hizo: el alumno la salto. `reps` y `weightKg` van en null. */
  readonly skipped?: boolean;
  /** Motivo opcional del salto. */
  readonly skipReason?: SkipReason | null;
}

/** Lo que el runner envia al cerrar una serie. */
export interface WorkoutSetInput {
  readonly setNumber: number;
  readonly reps: number | null;
  readonly weightKg: number | null;
  readonly durationSeconds?: number | null;
  readonly skipped?: boolean;
  readonly skipReason?: SkipReason | null;
}

/** Volumen de una serie, en kg levantados. Null si falta un dato. */
export function setVolumeKg(set: WorkoutSet): number | null {
  if (set.skipped === true || set.reps === null || set.weightKg === null) {
    return null;
  }
  return set.reps * set.weightKg;
}

/** Suma del volumen de las series que tienen ambos datos. */
export function totalVolumeKg(sets: readonly WorkoutSet[]): number {
  return sets.reduce((sum, set) => sum + (setVolumeKg(set) ?? 0), 0);
}

/** La ultima serie registrada, para precargar la siguiente. */
export function lastSet(sets: readonly WorkoutSet[]): WorkoutSet | null {
  return sets.reduce<WorkoutSet | null>(
    (mayor, set) => (mayor === null || set.setNumber > mayor.setNumber ? set : mayor),
    null,
  );
}
