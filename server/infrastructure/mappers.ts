import type { InvitationDetails, InvitationStatus } from '@app/domain/auth/port/invitation.port';
import {
  AppNotification,
  NotificationKind,
  NotificationTarget,
} from '@app/domain/notifications/model/notification.model';
import { PhotoAngle, ProgressPhoto } from '@app/domain/progress/model/progress-photo.model';
import { Exercise, MuscleGroup } from '@app/domain/routines/model/exercise.model';
import { ExerciseLoad, ExerciseMeasure } from '@app/domain/routines/model/prescription';
import { Routine, RoutineDay, RoutineExercise } from '@app/domain/routines/model/routine.model';
import {
  CancelReason,
  ScheduleStatus,
  ScheduledSession,
  SessionKind,
} from '@app/domain/schedule/model/scheduled-session.model';
import { Weekday } from '@app/domain/shared/model/date';
import { Anamnesis } from '@app/domain/students/model/anamnesis.model';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student, StudentStatus } from '@app/domain/students/model/student.model';
import { Trainer } from '@app/domain/trainers/model/trainer.model';
import {
  WorkoutExerciseLog,
  WorkoutSession,
  WorkoutStatus,
} from '@app/domain/workouts/model/workout-session.model';
import { SkipReason, WorkoutSet } from '@app/domain/workouts/model/workout-set.model';

/*
 * Mapeo snake_case (base) ↔ camelCase (contrato del front).
 *
 * Las columnas `date` salen a mediodia UTC: asi caen en el mismo dia
 * calendario en cualquier huso de America, y el front no las corre un dia
 * al formatearlas en hora local.
 */

export function dateOut(value: string | null): string | null {
  return value === null ? null : `${value}T12:00:00.000Z`;
}

export function dateIn(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : value.slice(0, 10);
}

export const fullName = (first: string, last: string): string => `${first} ${last}`.trim();

// ── Alumno ─────────────────────────────────────────────────────────────────
export interface StudentRow {
  id: string;
  user_id: string;
  trainer_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  status: StudentStatus;
  birth_date: string | null;
  height_cm: number | null;
  goal: string | null;
  joined_at: string;
  profile: { email: string; avatar_path: string | null };
  trainer: { first_name: string; last_name: string };
}

export const STUDENT_SELECT =
  '*, profile:profiles!students_user_id_fkey(email, avatar_path), trainer:trainers!students_trainer_id_fkey(first_name, last_name)';

export function toStudent(row: StudentRow, avatarUrl: string | null): Student {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    trainerName: fullName(row.trainer.first_name, row.trainer.last_name),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.profile.email,
    phone: row.phone,
    avatarUrl,
    status: row.status,
    birthDate: dateOut(row.birth_date),
    heightCm: row.height_cm,
    goal: row.goal,
    joinedAt: row.joined_at,
  };
}

// ── Entrenador ─────────────────────────────────────────────────────────────
export interface TrainerRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  specialty: string | null;
  bio: string | null;
  certifications: string[];
  joined_at: string;
  profile: { email: string; avatar_path: string | null };
}

export const TRAINER_SELECT = '*, profile:profiles!trainers_user_id_fkey(email, avatar_path)';

export function toTrainer(row: TrainerRow, avatarUrl: string | null): Trainer {
  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.profile.email,
    phone: row.phone,
    avatarUrl,
    specialty: row.specialty,
    certifications: row.certifications,
    bio: row.bio,
    joinedAt: row.joined_at,
  };
}

// ── Invitacion ─────────────────────────────────────────────────────────────
export interface InvitationRow {
  token: string;
  student_id: string;
  expires_at: string;
  status: InvitationStatus;
  student: StudentRow;
}

export const INVITATION_SELECT = `*, student:students!invitations_student_id_fkey(${STUDENT_SELECT})`;

export function toInvitation(row: InvitationRow): InvitationDetails {
  return {
    token: row.token,
    studentId: row.student_id,
    studentName: fullName(row.student.first_name, row.student.last_name),
    email: row.student.profile.email,
    trainerName: fullName(row.student.trainer.first_name, row.student.trainer.last_name),
    expiresAt: row.expires_at,
    status: row.status,
  };
}

// ── Anamnesis y evaluaciones ───────────────────────────────────────────────
export interface AnamnesisRow {
  id: string;
  student_id: string;
  medical_history: string | null;
  previous_injuries: string | null;
  surgeries: string | null;
  medications: string | null;
  allergies: string | null;
  previous_activity: string | null;
  declared_goal: string;
  weekly_availability: Weekday[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  updated_at: string;
}

export function toAnamnesis(row: AnamnesisRow): Anamnesis {
  const contacto =
    row.emergency_contact_name !== null && row.emergency_contact_phone !== null
      ? {
          name: row.emergency_contact_name,
          phone: row.emergency_contact_phone,
          relation: row.emergency_contact_relation ?? '',
        }
      : null;
  return {
    id: row.id,
    studentId: row.student_id,
    medicalHistory: row.medical_history,
    previousInjuries: row.previous_injuries,
    surgeries: row.surgeries,
    medications: row.medications,
    allergies: row.allergies,
    previousActivity: row.previous_activity,
    declaredGoal: row.declared_goal,
    weeklyAvailability: row.weekly_availability,
    emergencyContact: contacto,
    updatedAt: row.updated_at,
  };
}

export interface AssessmentRow {
  id: string;
  student_id: string;
  taken_at: string;
  weight_kg: number;
  height_cm: number;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
}

export function toAssessment(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    studentId: row.student_id,
    takenAt: row.taken_at,
    weightKg: row.weight_kg,
    heightCm: row.height_cm,
    bodyFatPct: row.body_fat_pct,
    muscleMassKg: row.muscle_mass_kg,
    measurements: {
      chestCm: row.chest_cm,
      waistCm: row.waist_cm,
      hipCm: row.hip_cm,
      armCm: row.arm_cm,
      thighCm: row.thigh_cm,
    },
    notes: row.notes,
  };
}

// ── Ejercicios y rutinas ───────────────────────────────────────────────────
export interface ExerciseRow {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: string | null;
  thumbnail_url: string | null;
  instructions: string[];
  owner_trainer_id: string | null;
  default_load: ExerciseLoad | null;
  default_measure: ExerciseMeasure | null;
}

export function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    thumbnailUrl: row.thumbnail_url,
    instructions: row.instructions,
    ownerTrainerId: row.owner_trainer_id,
    ...(row.default_load !== null ? { defaultLoad: row.default_load } : {}),
    ...(row.default_measure !== null ? { defaultMeasure: row.default_measure } : {}),
  };
}

export interface RoutineExerciseRow {
  id: string;
  exercise_id: string;
  name: string;
  position: number;
  sets: number;
  reps: number;
  rest_seconds: number;
  weight_kg: number | null;
  notes: string | null;
  load: ExerciseLoad | null;
  measure: ExerciseMeasure | null;
  duration_seconds: number | null;
  deleted_at: string | null;
}

export interface RoutineDayRow {
  id: string;
  weekday: Weekday;
  title: string;
  focus: MuscleGroup;
  estimated_minutes: number;
  /** `HH:MM:SS`; ausente mientras no se aplique la migracion de la hora. */
  start_time?: string | null;
  deleted_at: string | null;
  routine_exercises: RoutineExerciseRow[];
}

export interface AssignmentRow {
  student_id: string;
  start_date: string;
  end_date: string | null;
  ended_at: string | null;
}

export interface RoutineRow {
  id: string;
  trainer_id: string;
  name: string;
  goal: string;
  routine_days: RoutineDayRow[];
  routine_assignments: AssignmentRow[];
}

export const ROUTINE_SELECT =
  '*, routine_days(*, routine_exercises(*)), routine_assignments(student_id, start_date, end_date, ended_at)';

function toRoutineExercise(row: RoutineExerciseRow): RoutineExercise {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    name: row.name,
    order: row.position,
    sets: row.sets,
    reps: row.reps,
    restSeconds: row.rest_seconds,
    weightKg: row.weight_kg,
    notes: row.notes,
    ...(row.load !== null ? { load: row.load } : {}),
    ...(row.measure !== null ? { measure: row.measure } : {}),
    durationSeconds: row.duration_seconds,
  };
}

export function toRoutineDay(row: RoutineDayRow): RoutineDay {
  return {
    id: row.id,
    weekday: row.weekday,
    title: row.title,
    focus: row.focus,
    estimatedMinutes: row.estimated_minutes,
    startTime: row.start_time?.slice(0, 5) ?? null,
    exercises: row.routine_exercises
      .filter(item => item.deleted_at === null)
      .sort((a, b) => a.position - b.position)
      .map(toRoutineExercise),
  };
}

export function toRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    name: row.name,
    goal: row.goal,
    days: row.routine_days
      .filter(day => day.deleted_at === null)
      .sort((a, b) => a.weekday - b.weekday)
      .map(toRoutineDay),
    assignments: row.routine_assignments
      .filter(item => item.ended_at === null)
      .map(item => ({
        studentId: item.student_id,
        startDate: dateOut(item.start_date) ?? item.start_date,
        endDate: dateOut(item.end_date),
      })),
  };
}

// ── Sesiones de entrenamiento ──────────────────────────────────────────────
export interface WorkoutSetRow {
  id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  skipped: boolean;
  skip_reason: SkipReason | null;
  completed_at: string;
}

export interface WorkoutLogRow {
  routine_exercise_id: string;
  exercise_id: string;
  position: number;
  name: string;
  target_sets: number;
  target_reps: number;
  rest_seconds: number;
  weight_kg: number | null;
  load: ExerciseLoad | null;
  measure: ExerciseMeasure | null;
  duration_seconds: number | null;
  completed_sets: number;
  done: boolean;
  skipped: boolean;
  skip_reason: SkipReason | null;
  workout_sets: WorkoutSetRow[];
}

export interface WorkoutSessionRow {
  id: string;
  student_id: string;
  routine_id: string;
  routine_day_id: string;
  title: string;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  status: WorkoutStatus;
  duration_minutes: number | null;
  estimated_minutes: number;
  workout_exercise_logs: WorkoutLogRow[];
}

export const WORKOUT_SELECT = '*, workout_exercise_logs(*, workout_sets(*))';

function toWorkoutSet(row: WorkoutSetRow): WorkoutSet {
  return {
    id: row.id,
    setNumber: row.set_number,
    reps: row.reps,
    weightKg: row.weight_kg,
    durationSeconds: row.duration_seconds,
    skipped: row.skipped,
    skipReason: row.skip_reason,
    completedAt: row.completed_at,
  };
}

function toWorkoutLog(row: WorkoutLogRow): WorkoutExerciseLog {
  return {
    routineExerciseId: row.routine_exercise_id,
    exerciseId: row.exercise_id,
    name: row.name,
    targetSets: row.target_sets,
    targetReps: row.target_reps,
    restSeconds: row.rest_seconds,
    weightKg: row.weight_kg,
    completedSets: row.completed_sets,
    done: row.done,
    sets: [...row.workout_sets].sort((a, b) => a.set_number - b.set_number).map(toWorkoutSet),
    ...(row.load !== null ? { load: row.load } : {}),
    ...(row.measure !== null ? { measure: row.measure } : {}),
    durationSeconds: row.duration_seconds,
    skipped: row.skipped,
    skipReason: row.skip_reason,
  };
}

export function toWorkoutSession(row: WorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    studentId: row.student_id,
    routineId: row.routine_id,
    routineDayId: row.routine_day_id,
    title: row.title,
    scheduledFor: row.scheduled_for,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    durationMinutes: row.duration_minutes,
    estimatedMinutes: row.estimated_minutes,
    exercises: [...row.workout_exercise_logs]
      .sort((a, b) => a.position - b.position)
      .map(toWorkoutLog),
  };
}

// ── Fotos, agenda, notificaciones ──────────────────────────────────────────
export interface PhotoRow {
  id: string;
  student_id: string;
  taken_at: string;
  storage_path: string;
  angle: PhotoAngle;
  weight_kg: number | null;
  note: string | null;
}

export function toPhoto(row: PhotoRow, url: string): ProgressPhoto {
  return {
    id: row.id,
    studentId: row.student_id,
    takenAt: row.taken_at,
    url,
    angle: row.angle,
    weightKg: row.weight_kg,
    note: row.note,
  };
}

export interface ScheduledRow {
  id: string;
  student_id: string;
  trainer_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  kind: SessionKind;
  status: ScheduleStatus;
  workout_session_id: string | null;
  cancellation_reason: CancelReason | null;
  cancellation_note: string | null;
  cancelled_at: string | null;
}

export function toScheduled(row: ScheduledRow): ScheduledSession {
  return {
    id: row.id,
    studentId: row.student_id,
    trainerId: row.trainer_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    kind: row.kind,
    status: row.status,
    workoutSessionId: row.workout_session_id,
    cancellationReason: row.cancellation_reason,
    cancellationNote: row.cancellation_note,
    cancelledAt: row.cancelled_at,
  };
}

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  target_type: NotificationTarget | null;
  target_id: string | null;
}

export function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
    targetType: row.target_type,
    targetId: row.target_id,
  };
}
