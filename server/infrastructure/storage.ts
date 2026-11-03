import { randomUUID } from 'node:crypto';

import { ApiError } from '../domain/api-error';

import { adminClient } from './supabase';

export type Bucket = 'progress-photos' | 'avatars';

/** Lo que dura una URL de lectura. Son fotos corporales: corto. */
const READ_TTL_SECONDS = 600;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/** URL a la que el cliente sube el archivo directo, sin pasar por la funcion. */
export async function signedUpload(
  bucket: Bucket,
  folder: string,
  contentType: string,
): Promise<{ path: string; uploadUrl: string }> {
  const ext = EXTENSIONS[contentType];
  if (ext === undefined) {
    throw new ApiError('validation', 'Formato de imagen no soportado.');
  }
  const path = `${folder}/${randomUUID()}.${ext}`;
  const { data, error } = await adminClient().storage.from(bucket).createSignedUploadUrl(path);
  if (error !== null || data === null) {
    throw new ApiError('unknown');
  }
  return { path, uploadUrl: data.signedUrl };
}

/** URLs firmadas de lectura para varias claves a la vez. */
export async function signedUrls(
  bucket: Bucket,
  paths: readonly (string | null)[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(paths.filter((path): path is string => path !== null))];
  const result = new Map<string, string>();
  if (unicos.length === 0) {
    return result;
  }
  const { data } = await adminClient()
    .storage.from(bucket)
    .createSignedUrls(unicos, READ_TTL_SECONDS);
  for (const item of data ?? []) {
    if (item.path !== null && item.signedUrl !== null && item.error === null) {
      result.set(item.path, item.signedUrl);
    }
  }
  return result;
}

export async function signedUrl(bucket: Bucket, path: string | null): Promise<string | null> {
  if (path === null) {
    return null;
  }
  return (await signedUrls(bucket, [path])).get(path) ?? null;
}

export async function removeObject(bucket: Bucket, path: string): Promise<void> {
  await adminClient().storage.from(bucket).remove([path]);
}
