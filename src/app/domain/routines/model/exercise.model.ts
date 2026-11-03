import { Id } from '@app/domain/shared/model/ids';

import { ExerciseLoad, ExerciseMeasure } from './prescription';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'cardio'
  | 'fullbody';

/** Etiquetas en espanol de cada grupo muscular. */
export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  legs: 'Piernas',
  shoulders: 'Hombros',
  arms: 'Brazos',
  core: 'Core',
  cardio: 'Cardio',
  fullbody: 'Cuerpo completo',
};

/** Ejercicio del catalogo, independiente de cualquier rutina. */
export interface Exercise {
  readonly id: Id;
  readonly name: string;
  readonly muscleGroup: MuscleGroup;
  readonly equipment: string | null;
  readonly thumbnailUrl: string | null;
  /** Pasos de ejecucion, en orden. */
  readonly instructions: readonly string[];
  /**
   * Entrenador dueño del ejercicio, o `null` si es del catalogo publico.
   *
   * Los ejercicios propios son privados: un entrenador nunca ve los de otro.
   */
  readonly ownerTrainerId: Id | null;
  /** Carga que se sugiere al agregarlo a una rutina; el entrenador la cambia. */
  readonly defaultLoad?: ExerciseLoad;
  /** Medida que se sugiere al agregarlo a una rutina. */
  readonly defaultMeasure?: ExerciseMeasure;
}

/** Campos que el formulario envia al crear un ejercicio propio. */
export type ExerciseInput = Omit<Exercise, 'id'>;

/** True cuando el ejercicio es del catalogo compartido. */
export function isPublicExercise(exercise: Exercise): boolean {
  return exercise.ownerTrainerId === null;
}

/** True cuando el entrenador puede ver el ejercicio: publico o suyo. */
export function isVisibleToTrainer(exercise: Exercise, trainerId: Id): boolean {
  return exercise.ownerTrainerId === null || exercise.ownerTrainerId === trainerId;
}
