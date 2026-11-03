/**
 * Sesion unica por cuenta.
 *
 * Al abrir sesion (login, invitacion, recuperacion) el BFF guarda el
 * `session_id` del token en `profiles.active_session_id`. Cualquier otro
 * `session_id` de la misma cuenta es una sesion reemplazada: la de otro
 * dispositivo, que queda fuera en su proxima peticion o refresh.
 */

/**
 * Claim `session_id` de un access token; null si no lo trae o no se puede
 * leer. Solo decodifica: la firma ya la verifico `verifyAccessToken` (o el
 * token viene de Supabase en la misma peticion).
 */
export function sessionIdOf(token: string): string | null {
  const payload = token.split('.')[1];
  if (payload === undefined || payload === '') {
    return null;
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as {
      session_id?: unknown;
    };
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch {
    return null;
  }
}

/**
 * True si la sesion del token ya no es la activa de la cuenta. Sin sesion
 * registrada (`null`) la regla aun no aplica: la cuenta no ingreso desde que
 * existe la regla.
 */
export function isReplacedSession(
  activeSessionId: string | null,
  sessionId: string | null,
): boolean {
  return activeSessionId !== null && sessionId !== activeSessionId;
}
