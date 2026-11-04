import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '../config/env';
import { ApiError } from '../domain/api-error';

/**
 * Cifrado del texto de los mensajes (A-4).
 *
 * El texto se guarda cifrado con AES-256-GCM: en la base (y en el dashboard
 * de Supabase) solo hay `v1:` + base64(iv | tag | cifrado). La llave vive en
 * la variable `MESSAGES_KEY` del servidor (Vercel, `.env.local`) y nunca en
 * la base. No es cifrado de extremo a extremo: el BFF descifra para entregar
 * la conversacion a sus dos participantes.
 *
 * El id del alumno va como dato asociado (AAD): un texto copiado a la fila
 * de otra conversacion no se descifra.
 */
const VERSION = 'v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Texto que se muestra si una fila no se puede descifrar (llave equivocada, dato alterado). */
export const UNREADABLE_MESSAGE = 'No se pudo leer este mensaje.';

/** Llave de 32 bytes desde `MESSAGES_KEY` (base64). Sin ella no se lee ni se guarda nada. */
export function messageKey(): Buffer {
  const raw = env().MESSAGES_KEY;
  const key = raw === undefined ? null : Buffer.from(raw, 'base64');
  if (key === null || key.length !== 32) {
    // Falla cerrado: sin llave valida el mensaje no se guarda en claro.
    console.error(JSON.stringify({ level: 'error', messages: 'MESSAGES_KEY ausente o invalida' }));
    throw new ApiError('unknown', 'Los mensajes no están disponibles en este momento.');
  }
  return key;
}

export function encryptMessage(plain: string, studentId: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(studentId, 'utf8'));
  const cifrado = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return VERSION + Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString('base64');
}

export function decryptMessage(stored: string, studentId: string, key: Buffer): string {
  if (!stored.startsWith(VERSION)) {
    return UNREADABLE_MESSAGE;
  }
  try {
    const datos = Buffer.from(stored.slice(VERSION.length), 'base64');
    const iv = datos.subarray(0, IV_BYTES);
    const tag = datos.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(studentId, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(datos.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return UNREADABLE_MESSAGE;
  }
}
