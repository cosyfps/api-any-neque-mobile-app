// Build para Vercel con la Build Output API v3.
//
// Genera `.vercel/output/` con el front estatico y el BFF empaquetado como una
// sola funcion. Empaquetar con esbuild resuelve los alias `@app/*` que el BFF
// comparte con el front (los modelos del dominio).
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { build } from 'esbuild';

const OUT = '.vercel/output';
const FUNC = `${OUT}/functions/api.func`;

// Switch del acceso desde el navegador (ver src/app/ui/shared/navigation/web-access.ts).
// `off` por defecto; `mobile` abre la app a navegadores móviles, p. ej. para
// la presentación. Se cambia en las variables de Vercel y exige un redeploy.
// Se valida antes de compilar para fallar rápido y sin borrar la salida.
const webAccess = (process.env.NEQUE_WEB_ACCESS ?? 'off').trim().toLowerCase();
if (!['off', 'mobile'].includes(webAccess)) {
  throw new Error(`NEQUE_WEB_ACCESS inválido: "${webAccess}". Usa "off" o "mobile".`);
}

rmSync(OUT, { recursive: true, force: true });

execSync('npx ng build --configuration production', { stdio: 'inherit' });
cpSync('dist/neque/browser', `${OUT}/static`, { recursive: true });

const indexPath = `${OUT}/static/index.html`;
writeFileSync(
  indexPath,
  readFileSync(indexPath, 'utf8').replace(
    '</head>',
    `<meta name="neque-web-access" content="${webAccess}"></head>`,
  ),
);
console.warn(`Acceso web: ${webAccess}`);

mkdirSync(FUNC, { recursive: true });
await build({
  entryPoints: ['server/vercel.ts'],
  outfile: `${FUNC}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  tsconfig: 'tsconfig.server.json',
  // Algunas dependencias usan require(): se les da uno en ESM.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
writeFileSync(
  `${FUNC}/.vc-config.json`,
  JSON.stringify({
    runtime: 'nodejs22.x',
    handler: 'index.mjs',
    launcherType: 'Nodejs',
    shouldAddHelpers: false,
    maxDuration: 15,
  }),
);

const securityHeaders = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(self), geolocation=(), microphone=()',
  // La app es privada y solo móvil: ninguna respuesta del dominio (páginas,
  // archivos ni API) debe indexarse. A diferencia de robots.txt, esta cabecera
  // sí saca de los resultados las URLs que ya estaban indexadas.
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/(.*)', headers: securityHeaders, continue: true },
        // El service worker y su manifiesto deben revalidarse siempre: si
        // quedaran en cache, la PWA instalada nunca veria una version nueva.
        {
          src: '^/(ngsw-worker\\.js|ngsw\\.json|manifest\\.webmanifest)$',
          headers: { 'Cache-Control': 'no-cache' },
          continue: true,
        },
        { src: '^/api/(.*)$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
