/**
 * Con que carga se hace un ejercicio.
 *
 * - `weight`: con peso externo (barra, mancuernas, maquina). Lleva kg.
 * - `bodyweight`: solo el cuerpo (lagartijas, dominadas). Sin kg.
 * - `weighted_bodyweight`: el cuerpo mas un peso extra (dominadas con 10 kg).
 *   Los kg son solo los del peso extra, no el total.
 */
export type ExerciseLoad = 'weight' | 'bodyweight' | 'weighted_bodyweight';

/** Como se mide cada serie: contando repeticiones o por tiempo. */
export type ExerciseMeasure = 'reps' | 'time';

export const EXERCISE_LOAD_LABEL: Record<ExerciseLoad, string> = {
  weight: 'Con peso',
  bodyweight: 'Peso corporal',
  weighted_bodyweight: 'Peso corporal + peso extra',
};

export const EXERCISE_MEASURE_LABEL: Record<ExerciseMeasure, string> = {
  reps: 'Repeticiones',
  time: 'Tiempo',
};

/**
 * Lo minimo de una prescripcion para saber como mostrarla.
 *
 * `load` y `measure` son opcionales porque llegaron despues: una rutina
 * guardada antes no los trae, y se deducen de lo que si tiene.
 */
export interface Prescription {
  readonly weightKg: number | null;
  readonly load?: ExerciseLoad;
  readonly measure?: ExerciseMeasure;
  /** Duracion de cada serie, en segundos, cuando se mide por tiempo. */
  readonly durationSeconds?: number | null;
}

/** Sin `load` guardado, un ejercicio sin kg es de peso corporal. */
export function loadOf(prescription: Prescription): ExerciseLoad {
  return prescription.load ?? (prescription.weightKg === null ? 'bodyweight' : 'weight');
}

export function measureOf(prescription: Prescription): ExerciseMeasure {
  return prescription.measure ?? 'reps';
}

/** True cuando la serie lleva un campo de kg: con peso o con peso extra. */
export function usesKg(prescription: Prescription): boolean {
  return loadOf(prescription) !== 'bodyweight';
}

/** "45 s", "15 min", "1 min 30 s": la forma en que se dice en el gimnasio. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) {
    return `${rest} s`;
  }
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}
