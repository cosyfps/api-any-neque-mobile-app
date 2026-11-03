// Build para Vercel con la Build Output API v3.
//
// Genera `.vercel/output/` con el front estatico y el BFF empaquetado como una
// sola funcion. Empaquetar con esbuild resuelve los alias `@app/*` que el BFF
// comparte con el front (los modelos del dominio).
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

import { build } from 'esbuild';

const OUT = '.vercel/output';
const FUNC = `${OUT}/functions/api.func`;

rmSync(OUT, { recursive: true, force: true });

execSync('npx ng build --configuration production', { stdio: 'inherit' });
cpSync('dist/neque/browser', `${OUT}/static`, { recursive: true });

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
};

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/(.*)', headers: securityHeaders, continue: true },
        { src: '^/api/(.*)$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
