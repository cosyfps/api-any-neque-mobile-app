/** Esquema propio con que la app instalada recibe los enlaces. */
export const APP_SCHEME = 'neque';

/**
 * Ruta interna de un enlace que abrio la app instalada.
 *
 * Acepta el esquema propio (`neque://i/<token>`, donde `i` llega como host)
 * y los enlaces https del dominio (`https://<dominio>/i/<token>`, para cuando
 * se configuren Universal Links / App Links). Devuelve null si la URL no se
 * puede leer o no es de Ñeque.
 *
 * La ruta resultante pasa por los guards de siempre: abrir un enlace no da
 * acceso a nada que la sesion no permita.
 */
export function deepLinkPath(url: string, scheme: string, publicHost: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol === `${scheme}:`) {
    const path = `/${parsed.host}${parsed.pathname}`.replace(/\/+$/, '');
    return path === '' ? '/' : `${path}${parsed.search}`;
  }
  if (parsed.protocol === 'https:' && parsed.host === publicHost) {
    return `${parsed.pathname}${parsed.search}`;
  }
  return null;
}
