/**
 * Switch del acceso desde el navegador.
 *
 * Ñeque se usa desde la app instalada; para la presentacion se puede abrir
 * la web a navegadores moviles sin instalar la IPA. El valor sale de la
 * variable `NEQUE_WEB_ACCESS` de Vercel: `scripts/build-vercel.mjs` la deja
 * como `<meta name="neque-web-access">` en el `index.html` publicado.
 *
 * - `off` (o sin meta): la web solo muestra la pantalla "solo app".
 * - `mobile`: los navegadores moviles usan la app completa; el escritorio
 *   sigue viendo la pantalla "solo app".
 *
 * Es experiencia de uso, no seguridad: el User-Agent se puede falsificar y
 * los datos los protege el BFF igual que siempre.
 */
export const WEB_ACCESS_META = 'neque-web-access';

/** Lo minimo del navegador que hace falta para decidir. */
export interface BrowserInfo {
  readonly userAgent: string;
  readonly platform: string;
  readonly maxTouchPoints: number;
}

/** Telefono o tablet. El iPad moderno se anuncia como Mac con pantalla tactil. */
export function isMobileBrowser(browser: BrowserInfo): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(browser.userAgent)) {
    return true;
  }
  return browser.platform === 'MacIntel' && browser.maxTouchPoints > 1;
}

/** True si este navegador puede usar la app completa. */
export function webAccessEnabled(meta: string | null, browser: BrowserInfo): boolean {
  return meta?.trim().toLowerCase() === 'mobile' && isMobileBrowser(browser);
}
