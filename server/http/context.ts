import { Context, MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { ZodTypeAny, z } from 'zod';

import { UserRole } from '@app/domain/auth/model/auth-user.model';

import { env } from '../config/env';
import { ApiError, fail } from '../domain/api-error';
import { adminClient, maybe } from '../infrastructure/supabase';

/** Usuario autenticado, resuelto desde el JWT. Nada de esto lo manda el cliente. */
export interface Actor {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
  readonly displayName: string;
  readonly avatarPath: string | null;
  /** Id del Trainer o del Student segun el rol. */
  readonly profileId: string;
}

export interface AppEnv {
  Variables: { actor: Actor };
}

export type Ctx = Context<AppEnv>;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function keySet(): ReturnType<typeof createRemoteJWKSet> {
  if (jwks === null) {
    jwks = createRemoteJWKSet(new URL(`${env().SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

/**
 * Verifica el access token de Supabase y devuelve el id del usuario.
 *
 * Con claves de firma asimetricas se verifica local contra el JWKS. Si el
 * proyecto aun firma con el secreto HS256 heredado, el JWKS no tiene la
 * clave y se valida contra Auth.
 */
export async function verifyAccessToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, keySet(), {
      issuer: `${env().SUPABASE_URL}/auth/v1`,
    });
    if (typeof payload.sub === 'string') {
      return payload.sub;
    }
  } catch (cause) {
    if (cause instanceof errors.JWTExpired) {
      throw new ApiError('unauthorized');
    }
  }
  const { data, error } = await adminClient().auth.getUser(token);
  if (error !== null || data.user === null) {
    throw new ApiError('unauthorized');
  }
  return data.user.id;
}

interface ProfileRow {
  id: string;
  role: UserRole;
  email: string;
  display_name: string;
  avatar_path: string | null;
}

/** Arma el actor desde la base. Un alumno suspendido no entra. */
export async function resolveActor(userId: string): Promise<Actor> {
  const db = adminClient();
  const profile = await maybe<ProfileRow>(
    db
      .from('profiles')
      .select('id, role, email, display_name, avatar_path')
      .eq('id', userId)
      .maybeSingle(),
  );
  if (profile === null) {
    return fail('unauthorized');
  }

  let profileId: string;
  if (profile.role === 'trainer') {
    const trainer = await maybe<{ id: string }>(
      db.from('trainers').select('id').eq('user_id', userId).maybeSingle(),
    );
    profileId = trainer?.id ?? fail('unauthorized');
  } else {
    const student = await maybe<{ id: string; status: string }>(
      db.from('students').select('id, status').eq('user_id', userId).maybeSingle(),
    );
    if (student === null) {
      return fail('unauthorized');
    }
    if (student.status === 'suspended') {
      return fail('forbidden', 'Tu cuenta está suspendida. Habla con tu entrenador.');
    }
    profileId = student.id;
  }

  return {
    userId,
    email: profile.email,
    role: profile.role,
    displayName: profile.display_name,
    avatarPath: profile.avatar_path,
    profileId,
  };
}

/** Exige un access token valido y deja el actor en el contexto. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token === '') {
    throw new ApiError('unauthorized');
  }
  c.set('actor', await resolveActor(await verifyAccessToken(token)));
  await next();
};

export function requireRole(role: UserRole): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.get('actor').role !== role) {
      throw new ApiError('forbidden');
    }
    await next();
  };
}

/** Valida el cuerpo con zod. Campos desconocidos se rechazan. */
export async function parseBody<S extends ZodTypeAny>(
  c: Ctx | Context,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError('validation');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(
      'validation',
      issue === undefined || issue.path.length === 0
        ? undefined
        : `Dato inválido: ${issue.path.join('.')}`,
    );
  }
  return parsed.data as z.output<S>;
}

export const uuid = z.string().uuid();

/** Valida un id de la URL; uno mal formado es un recurso que no existe. */
export function idParam(c: Ctx, name: string): string {
  const value = c.req.param(name);
  return uuid.safeParse(value).success && value !== undefined ? value : fail('not_found');
}
