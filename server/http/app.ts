import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

import type { Weekday } from '@app/domain/shared/model/date';
import { isPasswordValid } from '@app/ui/shared/validators/password-rules';

import * as auth from '../application/auth';
import * as engagement from '../application/engagement';
import * as messages from '../application/messages';
import * as notifications from '../application/notifications';
import * as people from '../application/people';
import * as training from '../application/training';
import { env } from '../config/env';
import { ApiError } from '../domain/api-error';
import * as rules from '../domain/workout-rules';
import { adminClient } from '../infrastructure/supabase';

import { AppEnv, idParam, parseBody, requireAuth, requireRole } from './context';

// ── Esquemas de entrada ────────────────────────────────────────────────────
const text = (max = 2000) => z.string().trim().max(max);
const optionalText = (max = 2000) => text(max).nullable();
const email = z.string().trim().email().max(254);
// Contrasena nueva (invitacion, recuperacion, cambio): las mismas cuatro
// reglas que aplica el cliente, para que nadie las salte llamando a la API.
const password = z
  .string()
  .min(8)
  .max(128)
  .refine(isPasswordValid, 'La contraseña no cumple las reglas.');
const isoDate = z.string().datetime({ offset: true }).or(z.string().date());
const weekday = z
  .number()
  .int()
  .min(1)
  .max(7)
  .transform(value => value as Weekday);
const muscleGroup = z.enum([
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'cardio',
  'fullbody',
]);
const exerciseLoad = z.enum(['weight', 'bodyweight', 'weighted_bodyweight']);
const exerciseMeasure = z.enum(['reps', 'time']);
const skipReason = z.enum(['equipment_busy', 'pain', 'no_time', 'other']);
const imageType = z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

const studentInput = z.object({
  trainerId: z.string().optional(),
  firstName: text(80).min(1),
  lastName: text(80),
  email,
  phone: optionalText(30),
  birthDate: isoDate.nullable(),
  heightCm: z.number().min(50).max(260).nullable(),
  goal: optionalText(500),
});
const studentEdit = studentInput.omit({ trainerId: true, email: true }).partial();

const studentSelf = z
  .object({
    firstName: text(80).min(1),
    lastName: text(80),
    phone: optionalText(30),
    avatarPath: z.string().max(300),
  })
  .partial();
const trainerEdit = z
  .object({
    firstName: text(80).min(1),
    lastName: text(80),
    phone: optionalText(30),
    specialty: optionalText(120),
    certifications: z.array(text(120)).max(30),
    bio: optionalText(2000),
    avatarPath: z.string().max(300),
  })
  .partial();
const anamnesisInput = z.object({
  medicalHistory: optionalText(),
  previousInjuries: optionalText(),
  surgeries: optionalText(),
  medications: optionalText(),
  allergies: optionalText(),
  previousActivity: optionalText(),
  declaredGoal: text(500).min(1),
  weeklyAvailability: z.array(weekday).min(1).max(7),
  emergencyContact: z
    .object({ name: text(120), phone: text(30), relation: text(60) })

    .nullable(),
});
const optionalCm = z.number().min(0).max(400).nullable();
const assessmentInput = z.object({
  weightKg: z.number().min(20).max(400),
  heightCm: z.number().min(50).max(260),
  bodyFatPct: z.number().min(2).max(70).nullable(),
  muscleMassKg: z.number().min(0).max(300).nullable(),
  measurements: z.object({
    chestCm: optionalCm,
    waistCm: optionalCm,
    hipCm: optionalCm,
    armCm: optionalCm,
    thighCm: optionalCm,
  }),
  notes: optionalText(1000),
});
const exerciseInput = z.object({
  name: text(120).min(1),
  muscleGroup,
  equipment: optionalText(120),
  thumbnailUrl: z.string().max(500).nullable(),
  instructions: z.array(text(500)).max(20),
  ownerTrainerId: z.string().nullable().optional(),
  defaultLoad: exerciseLoad.optional(),
  defaultMeasure: exerciseMeasure.optional(),
});
/** Cita de la agenda: la misma forma al crearla y al reagendarla. */
const appointmentInput = z.object({
  title: text(120).min(1),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  location: optionalText(120),
  kind: z.enum(['training', 'assessment', 'checkin']),
});
const routineInput = z.object({
  name: text(120).min(1),
  goal: text(500),
  days: z
    .array(
      z.object({
        weekday,
        title: text(120).min(1),
        focus: muscleGroup,
        estimatedMinutes: z.number().int().min(1).max(600),
        startTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .nullable()
          .optional(),
        exercises: z
          .array(
            z.object({
              exerciseId: z.string().uuid(),
              name: text(120).min(1),
              order: z.number().int().min(0).max(100),
              sets: z.number().int().min(1).max(50),
              reps: z.number().int().min(0).max(500),
              restSeconds: z.number().int().min(0).max(3600),
              weightKg: z.number().min(0).max(1000).nullable(),
              notes: optionalText(500),
              load: exerciseLoad.optional(),
              measure: exerciseMeasure.optional(),
              durationSeconds: z.number().int().min(0).max(7200).nullable().optional(),
            }),
          )
          .max(30),
      }),
    )
    .max(7),
});
const assignmentsInput = z.object({
  assignments: z
    .array(
      z.object({ studentId: z.string().uuid(), startDate: isoDate, endDate: isoDate.nullable() }),
    )
    .max(200),
});
const setInput = z.object({
  setNumber: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(500).nullable(),
  weightKg: z.number().min(0).max(1000).nullable(),
  durationSeconds: z.number().int().min(0).max(7200).nullable().optional(),
  skipped: z.boolean().optional(),
  skipReason: skipReason.nullable().optional(),
});
const photoInput = z.object({
  path: z.string().max(300),
  angle: z.enum(['front', 'side', 'back']),
  takenAt: isoDate,
  weightKg: z.number().min(20).max(400).nullable(),
  note: optionalText(500),
});
const rangeQuery = (from: string | undefined, to: string | undefined) =>
  from !== undefined &&
  to !== undefined &&
  isoDate.safeParse(from).success &&
  isoDate.safeParse(to).success
    ? { from, to }
    : null;

// ── Aplicacion ─────────────────────────────────────────────────────────────
const NATIVE_ORIGINS = ['capacitor://localhost', 'https://localhost', 'http://localhost'];

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>().basePath('/api/v1');

  app.use(
    '*',
    cors({
      origin: origin => {
        const extra = env()
          .ALLOWED_ORIGINS.split(',')
          .map(item => item.trim())
          .filter(item => item !== '');
        return [...NATIVE_ORIGINS, ...extra].includes(origin) ? origin : null;
      },
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      maxAge: 600,
    }),
  );

  app.use('*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  app.onError((error, c) => {
    const apiError = error instanceof ApiError ? error : new ApiError('unknown');
    if (!(error instanceof ApiError)) {
      console.error(JSON.stringify({ level: 'error', route: c.req.path, message: error.message }));
    }
    return c.json(
      { error: { code: apiError.code, message: apiError.message } },
      apiError.status as 400,
    );
  });

  app.notFound(c => c.json({ error: { code: 'not_found', message: 'Ruta inexistente.' } }, 404));

  // ── Publico ──
  app.get('/health', async c => {
    const { error } = await adminClient()
      .from('exercises')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    return c.json({ ok: error === null }, error === null ? 200 : 503);
  });

  app.post('/auth/login', async c => {
    const body = await parseBody(c, z.object({ email, password: z.string().min(1).max(128) }));
    return c.json(await auth.login(body.email, body.password));
  });

  app.post('/auth/refresh', async c => {
    const body = await parseBody(c, z.object({ refreshToken: z.string().min(1) }));
    return c.json(await auth.refresh(body.refreshToken));
  });

  app.post('/auth/password-reset', async c => {
    const body = await parseBody(c, z.object({ email }));
    await auth.requestPasswordReset(body.email);
    return c.body(null, 204);
  });

  app.post('/auth/password-reset/verify', async c => {
    const body = await parseBody(c, z.object({ email, code: z.string().regex(/^\d{6}$/) }));
    return c.json(await auth.verifyOtp(body.email, body.code));
  });

  app.post('/auth/password-reset/complete', async c => {
    const body = await parseBody(
      c,
      z.object({ ticket: z.object({ email, token: z.string().min(1) }), newPassword: password }),
    );
    return c.json(await auth.resetPassword(body.ticket, body.newPassword));
  });

  app.get('/invitations/:token', async c =>
    c.json(await people.resolveInvitation(c.req.param('token'))),
  );

  app.post('/invitations/:token/accept', async c => {
    const body = await parseBody(c, z.object({ password }));
    const correo = await people.acceptInvitation(c.req.param('token'), body.password);
    return c.json(await auth.sessionFor(correo, body.password));
  });

  // ── Autenticado ──
  app.use('/me/*', requireAuth);
  app.use('/auth/logout', requireAuth);
  app.use('/auth/password/*', requireAuth);
  for (const path of [
    '/students/*',
    '/students',
    '/trainers/*',
    '/exercises/*',
    '/exercises',
    '/routines/*',
    '/routines',
    '/workouts/*',
    '/photos/*',
    '/schedule/*',
    '/notifications/*',
    '/invitations/:token/revoke',
  ]) {
    app.use(path, requireAuth);
  }

  app.post('/auth/logout', async c => {
    await auth.logout((c.req.header('authorization') ?? '').slice(7));
    return c.body(null, 204);
  });

  app.post('/auth/password/change', async c => {
    const body = await parseBody(
      c,
      z.object({ currentPassword: z.string().min(1), newPassword: password }),
    );
    await auth.changePassword(c.get('actor'), body.currentPassword, body.newPassword);
    return c.body(null, 204);
  });

  app.post('/me/avatar/upload-url', async c => {
    const body = await parseBody(c, z.object({ contentType: imageType }));
    return c.json(await engagement.avatarUploadUrl(c.get('actor'), body.contentType));
  });

  // Alumnos
  app.post('/students', requireRole('trainer'), async c => {
    const body = await parseBody(c, studentInput);
    return c.json(
      await people.createStudent(c.get('actor'), { ...body, trainerId: c.get('actor').profileId }),
      201,
    );
  });
  app.get('/students/:id', async c =>
    c.json(await people.getStudent(c.get('actor'), idParam(c, 'id'))),
  );
  app.patch('/students/:id', requireRole('trainer'), async c => {
    const body = await parseBody(c, studentEdit);
    return c.json(await people.editStudent(c.get('actor'), idParam(c, 'id'), body));
  });
  app.patch('/students/:id/self', requireRole('student'), async c => {
    const body = await parseBody(c, studentSelf);
    return c.json(await people.updateSelf(c.get('actor'), idParam(c, 'id'), body));
  });
  app.put('/students/:id/status', requireRole('trainer'), async c => {
    const body = await parseBody(c, z.object({ status: z.enum(['active', 'suspended']) }));
    return c.json(await people.setStudentStatus(c.get('actor'), idParam(c, 'id'), body.status));
  });

  // Invitaciones del entrenador
  app.get('/students/:id/invitation', requireRole('trainer'), async c =>
    c.json(await people.invitationForStudent(c.get('actor'), idParam(c, 'id'))),
  );
  app.post('/students/:id/invitation', requireRole('trainer'), async c =>
    c.json(await people.issueInvitation(c.get('actor'), idParam(c, 'id')), 201),
  );
  app.post('/invitations/:token/revoke', requireRole('trainer'), async c => {
    await people.revokeInvitation(c.get('actor'), c.req.param('token'));
    return c.body(null, 204);
  });

  // Anamnesis y evaluaciones
  app.get('/students/:id/anamnesis', requireRole('trainer'), async c =>
    c.json(await people.getAnamnesis(c.get('actor'), idParam(c, 'id'))),
  );
  app.put('/students/:id/anamnesis', requireRole('trainer'), async c => {
    const body = await parseBody(c, anamnesisInput);
    const id = idParam(c, 'id');
    return c.json(await people.saveAnamnesis(c.get('actor'), id, { ...body, studentId: id }));
  });
  app.get('/students/:id/assessments', async c =>
    c.json(await people.listAssessments(c.get('actor'), idParam(c, 'id'))),
  );
  app.get('/students/:id/assessments/latest', async c =>
    c.json(await people.latestAssessment(c.get('actor'), idParam(c, 'id'))),
  );
  app.post('/students/:id/assessments', requireRole('trainer'), async c => {
    const body = await parseBody(c, assessmentInput);
    return c.json(await people.createAssessment(c.get('actor'), idParam(c, 'id'), body), 201);
  });

  // Entrenadores
  app.get('/trainers/:id', async c =>
    c.json(await people.getTrainer(c.get('actor'), idParam(c, 'id'))),
  );
  app.patch('/trainers/:id', requireRole('trainer'), async c => {
    const body = await parseBody(c, trainerEdit);
    return c.json(await people.updateTrainer(c.get('actor'), idParam(c, 'id'), body));
  });
  app.get('/trainers/:id/students', requireRole('trainer'), async c =>
    c.json(await people.listStudents(c.get('actor'), idParam(c, 'id'))),
  );
  app.get('/trainers/:id/exercises', requireRole('trainer'), async c =>
    c.json(await training.listExercisesForTrainer(c.get('actor'), idParam(c, 'id'))),
  );
  app.get('/trainers/:id/schedule', requireRole('trainer'), async c => {
    const range = rangeQuery(c.req.query('from'), c.req.query('to'));
    if (range === null) {
      throw new ApiError('validation', 'Falta el rango de fechas.');
    }
    return c.json(await engagement.listTrainerSchedule(c.get('actor'), idParam(c, 'id'), range));
  });
  app.get('/trainers/:id/routines', requireRole('trainer'), async c =>
    c.json(await training.listRoutines(c.get('actor'), idParam(c, 'id'))),
  );

  // Ejercicios
  app.get('/exercises', requireRole('trainer'), async c =>
    c.json(await training.listPublicExercises()),
  );
  app.get('/exercises/:id', async c =>
    c.json(await training.getExercise(c.get('actor'), idParam(c, 'id'))),
  );
  app.post('/exercises', requireRole('trainer'), async c => {
    const body = await parseBody(c, exerciseInput);
    return c.json(
      await training.createExercise(c.get('actor'), { ...body, ownerTrainerId: null }),
      201,
    );
  });
  app.put('/exercises/:id', requireRole('trainer'), async c => {
    const body = await parseBody(c, exerciseInput);
    return c.json(
      await training.updateExercise(c.get('actor'), idParam(c, 'id'), {
        ...body,
        ownerTrainerId: null,
      }),
    );
  });
  app.delete('/exercises/:id', requireRole('trainer'), async c => {
    await training.removeExercise(c.get('actor'), idParam(c, 'id'));
    return c.body(null, 204);
  });

  // Rutinas
  app.get('/students/:id/routine', async c =>
    c.json(await training.activeRoutineForStudent(c.get('actor'), idParam(c, 'id'))),
  );
  app.get('/routines/:id', async c =>
    c.json(await training.getRoutine(c.get('actor'), idParam(c, 'id'))),
  );
  app.post('/routines', requireRole('trainer'), async c => {
    const body = await parseBody(c, routineInput);
    return c.json(await training.saveRoutine(c.get('actor'), null, body), 201);
  });
  app.put('/routines/:id', requireRole('trainer'), async c => {
    const body = await parseBody(c, routineInput);
    return c.json(await training.saveRoutine(c.get('actor'), idParam(c, 'id'), body));
  });
  app.put('/routines/:id/assignments', requireRole('trainer'), async c => {
    const body = await parseBody(c, assignmentsInput);
    return c.json(
      await training.setAssignments(c.get('actor'), idParam(c, 'id'), body.assignments),
    );
  });
  app.delete('/routines/:id', requireRole('trainer'), async c => {
    await training.removeRoutine(c.get('actor'), idParam(c, 'id'));
    return c.body(null, 204);
  });

  // Sesiones de entrenamiento
  app.get('/students/:id/workouts', async c =>
    c.json(
      await training.listWorkouts(
        c.get('actor'),
        idParam(c, 'id'),
        rangeQuery(c.req.query('from'), c.req.query('to')),
      ),
    ),
  );
  app.get('/workouts/:id', async c =>
    c.json(await training.getWorkout(c.get('actor'), idParam(c, 'id'))),
  );
  app.put('/workouts/:id/date', requireRole('student'), async c => {
    const body = await parseBody(c, z.object({ date: z.string().date() }));
    return c.json(await training.rescheduleWorkout(c.get('actor'), idParam(c, 'id'), body.date));
  });
  app.post('/workouts/:id/start', requireRole('student'), async c =>
    c.json(await training.mutateWorkout(c.get('actor'), idParam(c, 'id'), rules.startSession)),
  );
  app.put('/workouts/:id/exercises/:exerciseId/done', requireRole('student'), async c => {
    const body = await parseBody(c, z.object({ done: z.boolean() }));
    const exerciseId = idParam(c, 'exerciseId');
    return c.json(
      await training.mutateWorkout(c.get('actor'), idParam(c, 'id'), (s, now) =>
        rules.markExercise(s, exerciseId, body.done, now),
      ),
    );
  });
  app.post('/workouts/:id/exercises/:exerciseId/sets', requireRole('student'), async c => {
    const body = await parseBody(c, setInput);
    const exerciseId = idParam(c, 'exerciseId');
    return c.json(
      await training.mutateWorkout(c.get('actor'), idParam(c, 'id'), (s, now) =>
        rules.logSet(s, exerciseId, body, now),
      ),
    );
  });
  app.post('/workouts/:id/exercises/:exerciseId/skip', requireRole('student'), async c => {
    const body = await parseBody(c, z.object({ reason: skipReason.nullable() }));
    const exerciseId = idParam(c, 'exerciseId');
    return c.json(
      await training.mutateWorkout(c.get('actor'), idParam(c, 'id'), (s, now) =>
        rules.skipExercise(s, exerciseId, body.reason, now),
      ),
    );
  });
  app.post('/workouts/:id/complete', requireRole('student'), async c => {
    const body = await parseBody(
      c,
      z.object({ durationMinutes: z.number().int().min(0).max(600), note: optionalText(1000) }),
    );
    return c.json(
      await training.mutateWorkout(
        c.get('actor'),
        idParam(c, 'id'),
        (s, now) => rules.completeSession(s, body, now),
        body.note,
      ),
    );
  });

  // Fotos
  // Mensajes (A-4)
  app.get('/students/:id/messages', async c =>
    c.json(await messages.listMessages(c.get('actor'), idParam(c, 'id'))),
  );
  app.post('/students/:id/messages', async c => {
    const body = await parseBody(c, z.object({ body: text(1000).min(1) }));
    return c.json(await messages.sendMessage(c.get('actor'), idParam(c, 'id'), body.body), 201);
  });

  app.get('/students/:id/photos', async c =>
    c.json(await engagement.listPhotos(c.get('actor'), idParam(c, 'id'))),
  );
  app.post('/students/:id/photos/upload-url', requireRole('student'), async c => {
    const body = await parseBody(c, z.object({ contentType: imageType }));
    return c.json(
      await engagement.photoUploadUrl(c.get('actor'), idParam(c, 'id'), body.contentType),
    );
  });
  app.post('/students/:id/photos', requireRole('student'), async c => {
    const body = await parseBody(c, photoInput);
    return c.json(await engagement.addPhoto(c.get('actor'), idParam(c, 'id'), body), 201);
  });
  app.delete('/photos/:id', requireRole('student'), async c => {
    await engagement.removePhoto(c.get('actor'), idParam(c, 'id'));
    return c.body(null, 204);
  });

  // Agenda
  app.get('/students/:id/schedule', async c => {
    const range = rangeQuery(c.req.query('from'), c.req.query('to'));
    if (range === null) {
      throw new ApiError('validation', 'Falta el rango de fechas.');
    }
    return c.json(await engagement.listSchedule(c.get('actor'), idParam(c, 'id'), range));
  });
  app.post('/students/:id/schedule', requireRole('trainer'), async c => {
    const body = await parseBody(c, appointmentInput);
    return c.json(
      await engagement.createAppointment(c.get('actor'), {
        ...body,
        studentId: idParam(c, 'id'),
      }),
      201,
    );
  });
  app.put('/schedule/:id', requireRole('trainer'), async c => {
    const body = await parseBody(c, appointmentInput);
    return c.json(await engagement.rescheduleAppointment(c.get('actor'), idParam(c, 'id'), body));
  });
  app.post('/schedule/:id/confirm', requireRole('student'), async c =>
    c.json(await engagement.confirmAppointment(c.get('actor'), idParam(c, 'id'))),
  );
  app.post('/schedule/:id/cancel', async c => {
    const body = await parseBody(
      c,
      z
        .object({
          reason: z.enum(['illness', 'travel', 'injury', 'rescheduled', 'other']),
          note: optionalText(500),
        })
        // La base exige nota con "otro" (check de scheduled_sessions): sin
        // esto la peticion llegaba a Postgres y volvia como error generico.
        .refine(body => body.reason !== 'other' || (body.note ?? '') !== '', {
          message: 'Con el motivo «Otro» hace falta una nota.',
          path: ['note'],
        }),
    );
    return c.json(
      await engagement.cancelAppointment(c.get('actor'), idParam(c, 'id'), body.reason, body.note),
    );
  });

  // Notificaciones
  app.get('/me/notifications', async c =>
    c.json(await notifications.listNotifications(c.get('actor'))),
  );
  app.post('/me/notifications/read-all', async c => {
    await notifications.markAllRead(c.get('actor'));
    return c.body(null, 204);
  });
  app.post('/notifications/:id/read', async c =>
    c.json(await notifications.markRead(c.get('actor'), idParam(c, 'id'))),
  );

  return app;
}
