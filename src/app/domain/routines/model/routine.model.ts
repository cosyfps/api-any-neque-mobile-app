import { Weekday } from '@app/domain/shared/model/date';
import { Id, IsoDateString } from '@app/domain/shared/model/ids';

import { MuscleGroup } from './exercise.model';
import { ExerciseLoad, ExerciseMeasure } from './prescription';

/** Un ejercicio dentro de un dia de rutina, con su prescripcion. */
export interface RoutineExercise {
  readonly id: Id;
  readonly exerciseId: Id;
  readonly name: string;
  readonly order: number;
  readonly sets: number;
  readonly reps: number;
  readonly restSeconds: number;
  /** Kg de la carga, o del peso extra con `weighted_bodyweight`. Null sin peso. */
  readonly weightKg: number | null;
  readonly notes: string | null;
  /** Sin dato se deduce de `weightKg`: ver `loadOf()`. */
  readonly load?: ExerciseLoad;
  /** Sin dato, repeticiones: ver `measureOf()`. */
  readonly measure?: ExerciseMeasure;
  /** Segundos por serie cuando `measure` es `time`; ahi `reps` no aplica. */
  readonly durationSeconds?: number | null;
}

/** Un dia de entrenamiento dentro de la rutina. */
export interface RoutineDay {
  readonly id: Id;
  readonly weekday: Weekday;
  readonly title: string;
  readonly focus: MuscleGroup;
  readonly estimatedMinutes: number;
  readonly exercises: readonly RoutineExercise[];
}

/**
 * Un alumno que hace la rutina, con sus propias fechas.
 *
 * Las fechas van aqui y no en la rutina: la misma plantilla se reutiliza con
 * alumnos que empiezan en meses distintos.
 */
export interface RoutineAssignment {
  readonly studentId: Id;
  readonly startDate: IsoDateString;
  readonly endDate: IsoDateString | null;
}

/**
 * Rutina del entrenador, pensada como plantilla por objetivo.
 *
 * La pueden hacer varios alumnos a la vez; cada alumno, en cambio, hace una
 * sola rutina. Sin asignaciones queda en la biblioteca, lista para usarse.
 */
export interface Routine {
  readonly id: Id;
  readonly trainerId: Id;
  readonly name: string;
  readonly goal: string;
  readonly days: readonly RoutineDay[];
  readonly assignments: readonly RoutineAssignment[];
}

/** Un ejercicio tal como lo envia el constructor, sin id todavia. */
export type RoutineExerciseInput = Omit<RoutineExercise, 'id'>;

/** Un dia tal como lo envia el constructor. */
export interface RoutineDayInput extends Omit<RoutineDay, 'id' | 'exercises'> {
  readonly exercises: readonly RoutineExerciseInput[];
}

/** Rutina completa tal como la envia el constructor, sin alumnos. */
export interface RoutineInput extends Omit<Routine, 'id' | 'days' | 'assignments'> {
  readonly days: readonly RoutineDayInput[];
}

/** Total de series prescritas en un dia. */
export function totalSets(day: RoutineDay): number {
  return day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
}

/** Busca el dia de la rutina que corresponde a un dia de la semana. */
export function dayForWeekday(routine: Routine, weekday: Weekday): RoutineDay | null {
  return routine.days.find(day => day.weekday === weekday) ?? null;
}

/** La asignacion de ese alumno dentro de la rutina, o null si no la hace. */
export function assignmentFor(routine: Routine, studentId: Id): RoutineAssignment | null {
  return routine.assignments.find(item => item.studentId === studentId) ?? null;
}

/** True cuando al menos un alumno esta haciendo la rutina. */
export function isAssigned(routine: Routine): boolean {
  return routine.assignments.length > 0;
}

/**
 * Verbos que casi todo objetivo trae y que no dicen hacia donde va: "ganar
 * masa" y "ganar resistencia" no se parecen aunque compartan "ganar".
 */
const PALABRAS_VACIAS = new Set([
  'ganar',
  'mejorar',
  'bajar',
  'perder',
  'aumentar',
  'subir',
  'reducir',
  'lograr',
  'para',
  'como',
]);

function palabrasClave(texto: string): Set<string> {
  const normalizado = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return new Set(
    normalizado
      .split(/[^a-z0-9]+/)
      .filter(palabra => palabra.length >= 4 && !PALABRAS_VACIAS.has(palabra)),
  );
}

/**
 * True cuando dos objetivos escritos a mano apuntan a lo mismo.
 *
 * Los objetivos son texto libre, asi que no se comparan enteros: basta con
 * que compartan una palabra con contenido ("masa", "grasa", "postura").
 */
export function goalsMatch(a: string | null, b: string | null): boolean {
  if (a === null || b === null) {
    return false;
  }
  const claveA = palabrasClave(a);
  return [...palabrasClave(b)].some(palabra => claveA.has(palabra));
}
