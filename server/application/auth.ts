import { createHash, randomBytes } from 'node:crypto';

import { AuthSession, PasswordResetTicket } from '@app/domain/auth/model/auth-user.model';

import { ApiError, fail } from '../domain/api-error';
import { sessionIdOf } from '../domain/session-rules';
import { Actor, resolveActor } from '../http/context';
import { signedUrl } from '../infrastructure/storage';
import { adminClient, maybe, must, publicClient } from '../infrastructure/supabase';

/** Sesion del contrato mas el refresh token, que el adapter guarda aparte. */
export type SessionResponse = AuthSession & { readonly refreshToken: string };

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const RESET_TICKET_MINUTES = 15;

const normalize = (email: string): string => email.trim().toLowerCase();
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

interface SupabaseSession {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_at?: number;
  readonly user: { readonly id: string };
}

/**
 * Arma la respuesta de sesion. Con `enforce` (refresh) exige que sea la
 * sesion activa de la cuenta: una reemplazada no se puede renovar.
 */
async function toSession(session: SupabaseSession, enforce = false): Promise<SessionResponse> {
  const actor = await resolveActor(
    session.user.id,
    enforce
      ? { sessionId: sessionIdOf(session.access_token), raw: session.access_token }
      : undefined,
  );
  const expiresAt =
    session.expires_at === undefined
      ? new Date(Date.now() + 3_600_000).toISOString()
      : new Date(session.expires_at * 1000).toISOString();
  return {
    user: {
      id: actor.userId,
      email: actor.email,
      role: actor.role,
      displayName: actor.displayName,
      avatarUrl: await signedUrl('avatars', actor.avatarPath),
      profileId: actor.profileId,
    },
    token: session.access_token,
    expiresAt,
    refreshToken: session.refresh_token,
  };
}

/**
 * Abre la sesion como la UNICA activa de la cuenta. Cualquier otro
 * dispositivo queda fuera en su proxima peticion o refresh
 * (`session_replaced`).
 */
async function openSession(session: SupabaseSession): Promise<SessionResponse> {
  await must(
    adminClient()
      .from('profiles')
      .update({ active_session_id: sessionIdOf(session.access_token) })
      .eq('id', session.user.id)
      .select('id')
      .single(),
  );
  return toSession(session);
}

// ── Intentos fallidos ──────────────────────────────────────────────────────
async function assertNotLocked(key: string): Promise<void> {
  const row = await maybe<{ locked_until: string | null }>(
    adminClient().from('login_attempts').select('locked_until').eq('key', key).maybeSingle(),
  );
  if (row?.locked_until !== null && row?.locked_until !== undefined) {
    if (new Date(row.locked_until).getTime() > Date.now()) {
      fail('too_many_attempts');
    }
    await maybe(adminClient().from('login_attempts').delete().eq('key', key));
  }
}

async function registerFailure(key: string): Promise<never> {
  const row = await maybe<{ count: number }>(
    adminClient().from('login_attempts').select('count').eq('key', key).maybeSingle(),
  );
  const count = (row?.count ?? 0) + 1;
  const lockedUntil =
    count >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
  await maybe(
    adminClient()
      .from('login_attempts')
      .upsert({ key, count, locked_until: lockedUntil, updated_at: new Date().toISOString() }),
  );
  return fail(lockedUntil === null ? 'invalid_credentials' : 'too_many_attempts');
}

async function signIn(email: string, password: string): Promise<SupabaseSession> {
  const { data, error } = await publicClient().auth.signInWithPassword({ email, password });
  if (error !== null || data.session === null) {
    throw new ApiError('invalid_credentials');
  }
  return data.session;
}

// ── Casos de uso ───────────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<SessionResponse> {
  const key = normalize(email);
  await assertNotLocked(key);
  let session: SupabaseSession;
  try {
    session = await signIn(key, password);
  } catch {
    return registerFailure(key);
  }
  await maybe(adminClient().from('login_attempts').delete().eq('key', key));
  return openSession(session);
}

/** Abre sesion tras fijar la contrasena (invitacion o recuperacion). */
export async function sessionFor(email: string, password: string): Promise<SessionResponse> {
  return openSession(await signIn(normalize(email), password));
}

export async function refresh(refreshToken: string): Promise<SessionResponse> {
  const { data, error } = await publicClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error !== null || data.session === null) {
    throw new ApiError('unauthorized');
  }
  return toSession(data.session, true);
}

export async function logout(accessToken: string): Promise<void> {
  // Revoca los refresh tokens; si falla, el cliente igual limpia su sesion.
  await adminClient().auth.admin.signOut(accessToken);
}

/**
 * Envia el codigo de recuperacion. Responde igual exista o no la cuenta,
 * para no revelar que correos estan registrados.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const key = normalize(email);
  const existe = await maybe<{ id: string }>(
    adminClient().from('profiles').select('id').eq('email', key).maybeSingle(),
  );
  if (existe !== null) {
    await publicClient().auth.resetPasswordForEmail(key);
  }
}

/** Verificar el codigo NO abre sesion: entrega un ticket de un solo uso. */
export async function verifyOtp(email: string, code: string): Promise<PasswordResetTicket> {
  const key = normalize(email);
  const client = publicClient();
  const { data, error } = await client.auth.verifyOtp({
    email: key,
    token: code,
    type: 'recovery',
  });
  if (error !== null || data.user === null) {
    throw new ApiError('invalid_credentials', 'El código no es válido.');
  }
  // La sesion que abre Supabase se descarta: el cambio va por el ticket.
  // 'local' cierra solo esa sesion; el scope global por defecto revocaba
  // tambien la del telefono del usuario.
  if (data.session !== null) {
    await adminClient().auth.admin.signOut(data.session.access_token, 'local');
  }
  const token = randomBytes(32).toString('base64url');
  await must(
    adminClient()
      .from('password_reset_tickets')
      .insert({
        token_hash: sha256(token),
        user_id: data.user.id,
        expires_at: new Date(Date.now() + RESET_TICKET_MINUTES * 60_000).toISOString(),
      })
      .select('token_hash')
      .single(),
  );
  return { email: key, token };
}

export async function resetPassword(
  ticket: PasswordResetTicket,
  newPassword: string,
): Promise<SessionResponse> {
  const row = await maybe<{ user_id: string; expires_at: string; used_at: string | null }>(
    adminClient()
      .from('password_reset_tickets')
      .select('user_id, expires_at, used_at')
      .eq('token_hash', sha256(ticket.token))
      .maybeSingle(),
  );
  if (row === null || row.used_at !== null || new Date(row.expires_at).getTime() <= Date.now()) {
    return fail('unauthorized', 'El enlace de recuperación ya no es válido. Pide uno nuevo.');
  }
  const { error } = await adminClient().auth.admin.updateUserById(row.user_id, {
    password: newPassword,
  });
  if (error !== null) {
    return fail('validation', 'La contraseña no cumple los requisitos.');
  }
  await maybe(
    adminClient()
      .from('password_reset_tickets')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', sha256(ticket.token)),
  );
  return sessionFor(ticket.email, newPassword);
}

export async function changePassword(
  actor: Actor,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  try {
    // Solo comprueba la contrasena: la sesion que abre Supabase se cierra en
    // seguida y no reemplaza a la activa.
    const check = await signIn(actor.email, currentPassword);
    await adminClient().auth.admin.signOut(check.access_token, 'local');
  } catch {
    fail('invalid_credentials', 'La contraseña actual no es correcta.');
  }
  const { error } = await adminClient().auth.admin.updateUserById(actor.userId, {
    password: newPassword,
  });
  if (error !== null) {
    fail('validation', 'La contraseña no cumple los requisitos.');
  }
}
