import { PhotoAngle, ProgressPhoto } from '@app/domain/progress/model/progress-photo.model';
import { CancelReason, ScheduledSession } from '@app/domain/schedule/model/scheduled-session.model';
import { DateRange } from '@app/domain/shared/model/date-range';

import { fail } from '../domain/api-error';
import { Actor } from '../http/context';
import { PhotoRow, ScheduledRow, toPhoto, toScheduled } from '../infrastructure/mappers';
import { removeObject, signedUpload, signedUrls } from '../infrastructure/storage';
import { adminClient, maybe, must } from '../infrastructure/supabase';

import { assertCanSeeStudent, assertIsStudent } from './access';
import { notify } from './notifications';

const db = () => adminClient();

// ── Fotos de progreso ──────────────────────────────────────────────────────
export async function listPhotos(actor: Actor, studentId: string): Promise<ProgressPhoto[]> {
  await assertCanSeeStudent(actor, studentId);
  const rows = await must<PhotoRow[]>(
    db()
      .from('progress_photos')
      .select('*')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('taken_at'),
  );
  const urls = await signedUrls(
    'progress-photos',
    rows.map(row => row.storage_path),
  );
  return rows.map(row => toPhoto(row, urls.get(row.storage_path) ?? ''));
}

export async function photoUploadUrl(
  actor: Actor,
  studentId: string,
  contentType: string,
): Promise<{ path: string; uploadUrl: string }> {
  assertIsStudent(actor, studentId);
  return signedUpload('progress-photos', studentId, contentType);
}

export async function addPhoto(
  actor: Actor,
  studentId: string,
  input: {
    path: string;
    angle: PhotoAngle;
    takenAt: string;
    weightKg: number | null;
    note: string | null;
  },
): Promise<ProgressPhoto> {
  assertIsStudent(actor, studentId);
  if (!input.path.startsWith(`${studentId}/`)) {
    return fail('validation');
  }
  const row = await must<PhotoRow>(
    db()
      .from('progress_photos')
      .insert({
        student_id: studentId,
        storage_path: input.path,
        angle: input.angle,
        taken_at: input.takenAt,
        weight_kg: input.weightKg,
        note: input.note,
      })
      .select('*')
      .single(),
  );
  const urls = await signedUrls('progress-photos', [row.storage_path]);
  return toPhoto(row, urls.get(row.storage_path) ?? '');
}

export async function removePhoto(actor: Actor, photoId: string): Promise<void> {
  const row = await maybe<PhotoRow>(
    db().from('progress_photos').select('*').eq('id', photoId).is('deleted_at', null).maybeSingle(),
  );
  if (row === null || actor.role !== 'student' || row.student_id !== actor.profileId) {
    fail('not_found');
    return;
  }
  await maybe(
    db().from('progress_photos').update({ deleted_at: new Date().toISOString() }).eq('id', photoId),
  );
  await removeObject('progress-photos', row.storage_path);
}

export async function avatarUploadUrl(
  actor: Actor,
  contentType: string,
): Promise<{ path: string; uploadUrl: string }> {
  return signedUpload('avatars', actor.userId, contentType);
}

// ── Agenda ─────────────────────────────────────────────────────────────────
export async function listSchedule(
  actor: Actor,
  studentId: string,
  range: DateRange,
): Promise<ScheduledSession[]> {
  await assertCanSeeStudent(actor, studentId);
  const rows = await must<ScheduledRow[]>(
    db()
      .from('scheduled_sessions')
      .select('*')
      .eq('student_id', studentId)
      .gte('starts_at', range.from)
      .lte('starts_at', range.to)
      .order('starts_at'),
  );
  return rows.map(toScheduled);
}

async function ownedAppointment(actor: Actor, sessionId: string): Promise<ScheduledRow> {
  const row = await must<ScheduledRow>(
    db().from('scheduled_sessions').select('*').eq('id', sessionId).maybeSingle(),
  );
  const propia =
    actor.role === 'student'
      ? row.student_id === actor.profileId
      : row.trainer_id === actor.profileId;
  return propia ? row : fail('not_found');
}

export async function confirmAppointment(
  actor: Actor,
  sessionId: string,
): Promise<ScheduledSession> {
  const actual = await ownedAppointment(actor, sessionId);
  if (actual.status === 'cancelled') {
    return fail('conflict', 'La cita ya fue cancelada.');
  }
  const row = await must<ScheduledRow>(
    db()
      .from('scheduled_sessions')
      .update({ status: 'confirmed' })
      .eq('id', sessionId)
      .select('*')
      .single(),
  );
  return toScheduled(row);
}

export async function cancelAppointment(
  actor: Actor,
  sessionId: string,
  reason: CancelReason,
  note: string | null,
): Promise<ScheduledSession> {
  const actual = await ownedAppointment(actor, sessionId);
  if (reason === 'other' && (note ?? '').trim() === '') {
    return fail('validation', 'Cuéntanos el motivo de la cancelación.');
  }
  const row = await must<ScheduledRow>(
    db()
      .from('scheduled_sessions')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancellation_note: note,
        cancelled_at: new Date().toISOString(),
        cancelled_by: actor.userId,
      })
      .eq('id', sessionId)
      .select('*')
      .single(),
  );

  // Avisa a la otra parte.
  const otra =
    actor.role === 'student'
      ? await must<{ user_id: string }>(
          db().from('trainers').select('user_id').eq('id', actual.trainer_id).single(),
        )
      : await must<{ user_id: string }>(
          db().from('students').select('user_id').eq('id', actual.student_id).single(),
        );
  await notify(otra.user_id, {
    kind: 'session',
    title: 'Cita cancelada',
    body: `${actual.title} · ${actor.displayName}`,
    targetType: actor.role === 'student' ? 'student' : 'session',
    targetId: actor.role === 'student' ? actual.student_id : actual.id,
  });
  return toScheduled(row);
}
