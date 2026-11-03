import { SupabaseClient, createClient } from '@supabase/supabase-js';

import { env } from '../config/env';
import { ApiError, fromDbError } from '../domain/api-error';

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } } as const;

let admin: SupabaseClient | null = null;

/**
 * Cliente con la clave secreta: salta RLS. Solo vive en el servidor y se
 * reutiliza entre peticiones de la misma instancia.
 */
export function adminClient(): SupabaseClient {
  if (admin === null) {
    admin = createClient(env().SUPABASE_URL, env().SUPABASE_SECRET_KEY, NO_SESSION);
  }
  return admin;
}

/**
 * Cliente con la clave publica, nuevo por peticion: login y OTP dejan
 * estado de sesion en el cliente y no debe compartirse entre usuarios.
 */
export function publicClient(): SupabaseClient {
  return createClient(env().SUPABASE_URL, env().SUPABASE_PUBLISHABLE_KEY, NO_SESSION);
}

interface DbResult<T> {
  readonly data: T | null;
  readonly error: { code?: string; message?: string } | null;
}

/** Desenvuelve un resultado de PostgREST: error → ApiError, null → not_found. */
export async function must<T>(query: PromiseLike<DbResult<T>>): Promise<T> {
  const { data, error } = await query;
  if (error !== null) {
    throw logDbError(error);
  }
  if (data === null) {
    throw new ApiError('not_found');
  }
  return data;
}

/** Igual que `must`, pero un resultado vacio es valido. */
export async function maybe<T>(query: PromiseLike<DbResult<T>>): Promise<T | null> {
  const { data, error } = await query;
  if (error !== null) {
    throw logDbError(error);
  }
  return data;
}

function logDbError(error: { code?: string; message?: string }): ApiError {
  const mapped = fromDbError(error);
  if (mapped.code === 'unknown') {
    console.error(JSON.stringify({ level: 'error', db: error.code, message: error.message }));
  }
  return mapped;
}
