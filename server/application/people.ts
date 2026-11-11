import { randomBytes } from 'node:crypto';

import type { InvitationDetails } from '@app/domain/auth/port/invitation.port';
import { Anamnesis, AnamnesisInput } from '@app/domain/students/model/anamnesis.model';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student, StudentStatus } from '@app/domain/students/model/student.model';
import type {
  StudentEditableFields,
  StudentInput,
  StudentSelfEditableFields,
} from '@app/domain/students/port/students.port';
import { Trainer } from '@app/domain/trainers/model/trainer.model';
import type { TrainerEditableFields } from '@app/domain/trainers/port/trainers.port';

import { env } from '../config/env';
import { ApiError, fail } from '../domain/api-error';
import { invitationEmail } from '../domain/invitation-email';
import { Actor } from '../http/context';
import { MailResult, sendMail } from '../infrastructure/mailer';
import {
  AnamnesisRow,
  AssessmentRow,
  INVITATION_SELECT,
  InvitationRow,
  STUDENT_SELECT,
  StudentRow,
  TRAINER_SELECT,
  TrainerRow,
  dateIn,
  fullName,
  toAnamnesis,
  toAssessment,
  toInvitation,
  toStudent,
  toTrainer,
} from '../infrastructure/mappers';
import { signedUrl, signedUrls } from '../infrastructure/storage';
import { adminClient, maybe, must } from '../infrastructure/supabase';

import { assertCanSeeStudent, assertIsTrainer, assertTrainerOf } from './access';
import { notify } from './notifications';

// Igual que `INVITATION_TTL_HOURS` del dominio; se repite porque ese archivo
// importa Angular y no debe entrar al bundle del servidor.
const INVITATION_TTL_HOURS = 48;

const db = () => adminClient();

// ── Alumnos ────────────────────────────────────────────────────────────────
async function withAvatars(rows: StudentRow[]): Promise<Student[]> {
  const urls = await signedUrls(
    'avatars',
    rows.map(row => row.profile.avatar_path),
  );
  return rows.map(row =>
    toStudent(
      row,
      row.profile.avatar_path === null ? null : (urls.get(row.profile.avatar_path) ?? null),
    ),
  );
}

export async function getStudent(actor: Actor, studentId: string): Promise<Student> {
  await assertCanSeeStudent(actor, studentId);
  return loadStudent(studentId);
}

async function loadStudent(studentId: string): Promise<Student> {
  const row = await must<StudentRow>(
    db().from('students').select(STUDENT_SELECT).eq('id', studentId).maybeSingle(),
  );
  const [student] = await withAvatars([row]);
  return student ?? fail('not_found');
}

export async function listStudents(actor: Actor, trainerId: string): Promise<Student[]> {
  assertIsTrainer(actor, trainerId);
  const rows = await must<StudentRow[]>(
    db().from('students').select(STUDENT_SELECT).eq('trainer_id', trainerId).order('first_name'),
  );
  return withAvatars(rows);
}

/** Cambios del propio alumno. El avatar llega ya subido, como clave del bucket. */
export async function updateSelf(
  actor: Actor,
  studentId: string,
  changes: Partial<StudentSelfEditableFields> & { avatarPath?: string },
): Promise<Student> {
  if (actor.role !== 'student' || actor.profileId !== studentId) {
    return fail('not_found');
  }
  const patch: Record<string, unknown> = {};
  if (changes.firstName !== undefined) patch['first_name'] = changes.firstName;
  if (changes.lastName !== undefined) patch['last_name'] = changes.lastName;
  if (changes.phone !== undefined) patch['phone'] = changes.phone;
  if (Object.keys(patch).length > 0) {
    await maybe(db().from('students').update(patch).eq('id', studentId));
  }
  await updateProfile(actor, changes.avatarPath, changes.firstName, changes.lastName);
  return loadStudent(studentId);
}

/** Alta de un alumno: usuario de Auth sin contrasena, perfil y ficha. */
export async function createStudent(actor: Actor, input: StudentInput): Promise<Student> {
  if (actor.role !== 'trainer') {
    return fail('forbidden');
  }
  const email = input.email.trim().toLowerCase();
  const existe = await maybe<{ id: string }>(
    db().from('profiles').select('id').eq('email', email).maybeSingle(),
  );
  if (existe !== null) {
    return fail('conflict', 'Ya existe un alumno con ese correo.');
  }

  const { data, error } = await db().auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { role: 'student' },
  });
  if (error !== null || data.user === null) {
    return fail(error?.status === 422 ? 'conflict' : 'unknown');
  }
  const userId = data.user.id;

  try {
    await must(
      db()
        .from('profiles')
        .insert({
          id: userId,
          role: 'student',
          email,
          display_name: fullName(input.firstName, input.lastName),
        })
        .select('id')
        .single(),
    );
    const student = await must<{ id: string }>(
      db()
        .from('students')
        .insert({
          user_id: userId,
          trainer_id: actor.profileId,
          first_name: input.firstName,
          last_name: input.lastName,
          phone: input.phone,
          birth_date: dateIn(input.birthDate),
          height_cm: input.heightCm,
          goal: input.goal,
        })
        .select('id')
        .single(),
    );
    return loadStudent(student.id);
  } catch (cause) {
    // Auth y la base no comparten transaccion: se deshace a mano.
    await db().auth.admin.deleteUser(userId);
    throw cause;
  }
}

export async function editStudent(
  actor: Actor,
  studentId: string,
  changes: Partial<StudentEditableFields>,
): Promise<Student> {
  await assertTrainerOf(actor, studentId);
  const patch: Record<string, unknown> = {};
  if (changes.firstName !== undefined) patch['first_name'] = changes.firstName;
  if (changes.lastName !== undefined) patch['last_name'] = changes.lastName;
  if (changes.phone !== undefined) patch['phone'] = changes.phone;
  if (changes.birthDate !== undefined) patch['birth_date'] = dateIn(changes.birthDate);
  if (changes.heightCm !== undefined) patch['height_cm'] = changes.heightCm;
  if (changes.goal !== undefined) patch['goal'] = changes.goal;
  if (Object.keys(patch).length > 0) {
    await maybe(db().from('students').update(patch).eq('id', studentId));
  }
  if (changes.firstName !== undefined || changes.lastName !== undefined) {
    const student = await loadStudent(studentId);
    const row = await must<{ user_id: string }>(
      db().from('students').select('user_id').eq('id', studentId).single(),
    );
    await maybe(
      db()
        .from('profiles')
        .update({ display_name: fullName(student.firstName, student.lastName) })
        .eq('id', row.user_id),
    );
  }
  return loadStudent(studentId);
}

export async function setStudentStatus(
  actor: Actor,
  studentId: string,
  status: StudentStatus,
): Promise<Student> {
  await assertTrainerOf(actor, studentId);
  await maybe(db().from('students').update({ status }).eq('id', studentId));
  return loadStudent(studentId);
}

// ── Perfil compartido (avatar y nombre visible) ────────────────────────────
async function updateProfile(
  actor: Actor,
  avatarPath: string | undefined,
  firstName: string | undefined,
  lastName: string | undefined,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (avatarPath !== undefined) {
    if (!avatarPath.startsWith(`${actor.userId}/`)) {
      fail('validation');
    }
    patch['avatar_path'] = avatarPath;
  }
  if (firstName !== undefined || lastName !== undefined) {
    const partes = actor.displayName.split(' ');
    patch['display_name'] = fullName(
      firstName ?? partes[0] ?? '',
      lastName ?? partes.slice(1).join(' '),
    );
  }
  if (Object.keys(patch).length > 0) {
    await maybe(db().from('profiles').update(patch).eq('id', actor.userId));
  }
}

// ── Entrenadores ───────────────────────────────────────────────────────────
export async function getTrainer(actor: Actor, trainerId: string): Promise<Trainer> {
  if (actor.role === 'student') {
    const propio = await must<{ trainer_id: string }>(
      db().from('students').select('trainer_id').eq('id', actor.profileId).single(),
    );
    if (propio.trainer_id !== trainerId) {
      return fail('not_found');
    }
  } else {
    assertIsTrainer(actor, trainerId);
  }
  return loadTrainer(trainerId);
}

async function loadTrainer(trainerId: string): Promise<Trainer> {
  const row = await must<TrainerRow>(
    db().from('trainers').select(TRAINER_SELECT).eq('id', trainerId).maybeSingle(),
  );
  return toTrainer(row, await signedUrl('avatars', row.profile.avatar_path));
}

export async function updateTrainer(
  actor: Actor,
  trainerId: string,
  changes: Partial<TrainerEditableFields> & { avatarPath?: string },
): Promise<Trainer> {
  assertIsTrainer(actor, trainerId);
  const patch: Record<string, unknown> = {};
  if (changes.firstName !== undefined) patch['first_name'] = changes.firstName;
  if (changes.lastName !== undefined) patch['last_name'] = changes.lastName;
  if (changes.phone !== undefined) patch['phone'] = changes.phone;
  if (changes.specialty !== undefined) patch['specialty'] = changes.specialty;
  if (changes.bio !== undefined) patch['bio'] = changes.bio;
  if (changes.certifications !== undefined) patch['certifications'] = changes.certifications;
  if (Object.keys(patch).length > 0) {
    await maybe(db().from('trainers').update(patch).eq('id', trainerId));
  }
  await updateProfile(actor, changes.avatarPath, changes.firstName, changes.lastName);
  return loadTrainer(trainerId);
}

// ── Anamnesis y evaluaciones ───────────────────────────────────────────────
export async function getAnamnesis(actor: Actor, studentId: string): Promise<Anamnesis | null> {
  await assertTrainerOf(actor, studentId);
  const row = await maybe<AnamnesisRow>(
    db().from('anamnesis').select('*').eq('student_id', studentId).maybeSingle(),
  );
  return row === null ? null : toAnamnesis(row);
}

export async function saveAnamnesis(
  actor: Actor,
  studentId: string,
  input: AnamnesisInput,
): Promise<Anamnesis> {
  await assertTrainerOf(actor, studentId);
  const row = await must<AnamnesisRow>(
    db()
      .from('anamnesis')
      .upsert(
        {
          student_id: studentId,
          medical_history: input.medicalHistory,
          previous_injuries: input.previousInjuries,
          surgeries: input.surgeries,
          medications: input.medications,
          allergies: input.allergies,
          previous_activity: input.previousActivity,
          declared_goal: input.declaredGoal,
          weekly_availability: input.weeklyAvailability,
          emergency_contact_name: input.emergencyContact?.name ?? null,
          emergency_contact_phone: input.emergencyContact?.phone ?? null,
          emergency_contact_relation: input.emergencyContact?.relation ?? null,
        },
        { onConflict: 'student_id' },
      )
      .select('*')
      .single(),
  );
  return toAnamnesis(row);
}

export async function listAssessments(actor: Actor, studentId: string): Promise<Assessment[]> {
  await assertCanSeeStudent(actor, studentId);
  const rows = await must<AssessmentRow[]>(
    db().from('assessments').select('*').eq('student_id', studentId).order('taken_at'),
  );
  return rows.map(toAssessment);
}

export async function latestAssessment(
  actor: Actor,
  studentId: string,
): Promise<Assessment | null> {
  await assertCanSeeStudent(actor, studentId);
  const row = await maybe<AssessmentRow>(
    db()
      .from('assessments')
      .select('*')
      .eq('student_id', studentId)
      .order('taken_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  return row === null ? null : toAssessment(row);
}

export async function createAssessment(
  actor: Actor,
  studentId: string,
  input: Omit<Assessment, 'id' | 'takenAt' | 'studentId'>,
): Promise<Assessment> {
  await assertTrainerOf(actor, studentId);
  const row = await must<AssessmentRow>(
    db()
      .from('assessments')
      .insert({
        student_id: studentId,
        trainer_id: actor.profileId,
        weight_kg: input.weightKg,
        height_cm: input.heightCm,
        body_fat_pct: input.bodyFatPct,
        muscle_mass_kg: input.muscleMassKg,
        chest_cm: input.measurements.chestCm,
        waist_cm: input.measurements.waistCm,
        hip_cm: input.measurements.hipCm,
        arm_cm: input.measurements.armCm,
        thigh_cm: input.measurements.thighCm,
        notes: input.notes,
      })
      .select('*')
      .single(),
  );
  await notify(await userIdOfStudent(studentId), {
    kind: 'session',
    title: 'Nueva evaluación registrada',
    body: `${input.weightKg} kg · revisa tu progreso`,
    targetType: 'assessment',
    targetId: row.id,
  });
  return toAssessment(row);
}

export async function userIdOfStudent(studentId: string): Promise<string> {
  const row = await must<{ user_id: string }>(
    db().from('students').select('user_id').eq('id', studentId).single(),
  );
  return row.user_id;
}

// ── Invitaciones ───────────────────────────────────────────────────────────
const INVITATION_MESSAGES: Record<string, string> = {
  expired: 'Esta invitación expiró. Pídele a tu entrenador que te envíe una nueva.',
  accepted: 'Esta invitación ya fue utilizada. Ingresa con tu correo y contraseña.',
  revoked: 'Esta invitación ya no es válida. Pídele a tu entrenador que te envíe otra.',
};

/** Invitacion vigente por token. Una vencida se marca `expired` al leerla. */
export async function resolveInvitation(token: string): Promise<InvitationDetails> {
  const row = await maybe<InvitationRow>(
    db().from('invitations').select(INVITATION_SELECT).eq('token', token).maybeSingle(),
  );
  if (row === null) {
    return fail('invalid_invitation');
  }
  if (row.status === 'pending' && new Date(row.expires_at).getTime() <= Date.now()) {
    await maybe(db().from('invitations').update({ status: 'expired' }).eq('token', token));
    return fail('invalid_invitation', INVITATION_MESSAGES['expired']);
  }
  if (row.status !== 'pending') {
    return fail('invalid_invitation', INVITATION_MESSAGES[row.status]);
  }
  return toInvitation(row);
}

export async function invitationForStudent(
  actor: Actor,
  studentId: string,
): Promise<InvitationDetails | null> {
  await assertTrainerOf(actor, studentId);
  const row = await maybe<InvitationRow>(
    db()
      .from('invitations')
      .select(INVITATION_SELECT)
      .eq('student_id', studentId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle(),
  );
  return row === null ? null : toInvitation(row);
}

/** Emite una invitacion nueva e invalida la anterior del mismo alumno. */
export async function issueInvitation(actor: Actor, studentId: string): Promise<InvitationDetails> {
  await assertTrainerOf(actor, studentId);
  await maybe(
    db()
      .from('invitations')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('status', 'pending'),
  );
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 3_600_000).toISOString();
  const row = await must<InvitationRow>(
    db()
      .from('invitations')
      .insert({ token, student_id: studentId, expires_at: expiresAt })
      .select(INVITATION_SELECT)
      .single(),
  );
  const invitation = toInvitation(row);
  const mail = await sendInvitationEmail(invitation);
  return mail === 'disabled' ? invitation : { ...invitation, emailSent: mail === 'sent' };
}

/**
 * Envia el enlace al correo del alumno. Cada emision lo reenvia, asi que
 * reemitir tambien sirve para "volver a mandar el correo".
 */
function sendInvitationEmail(invitation: InvitationDetails): Promise<MailResult> {
  const base = env().PUBLIC_APP_URL.replace(/\/+$/, '');
  const content = invitationEmail({
    studentName: invitation.studentName,
    trainerName: invitation.trainerName,
    link: `${base}/i/${invitation.token}`,
    expiresAt: invitation.expiresAt,
    privacyUrl: `${base}/privacidad`,
  });
  return sendMail({ to: invitation.email, toName: invitation.studentName, ...content });
}

export async function revokeInvitation(actor: Actor, token: string): Promise<void> {
  const row = await maybe<{ student_id: string }>(
    db().from('invitations').select('student_id').eq('token', token).maybeSingle(),
  );
  if (row === null) {
    fail('not_found');
    return;
  }
  await assertTrainerOf(actor, row.student_id);
  await maybe(
    db()
      .from('invitations')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('token', token),
  );
}

/**
 * Marca la invitacion como aceptada y fija la contrasena del alumno.
 * Devuelve el correo para que el llamador abra la sesion.
 */
export async function acceptInvitation(token: string, password: string): Promise<string> {
  const invitation = await resolveInvitation(token);
  const userId = await userIdOfStudent(invitation.studentId);

  const { error } = await db().auth.admin.updateUserById(userId, { password });
  if (error !== null) {
    throw new ApiError('validation', 'La contraseña no cumple los requisitos.');
  }
  await maybe(
    db()
      .from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('token', token),
  );

  const student = await must<{ trainer: { user_id: string } }>(
    db()
      .from('students')
      .select('trainer:trainers!students_trainer_id_fkey(user_id)')
      .eq('id', invitation.studentId)
      .single(),
  );
  await notify(student.trainer.user_id, {
    kind: 'invitation',
    title: `${invitation.studentName.split(' ')[0]} aceptó tu invitación`,
    body: 'Ya creó su acceso a Ñeque.',
    targetType: 'student',
    targetId: invitation.studentId,
  });
  return invitation.email;
}
