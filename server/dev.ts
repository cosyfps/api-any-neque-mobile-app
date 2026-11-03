import { existsSync } from 'node:fs';

import { serve } from '@hono/node-server';

import { createApp } from './http/app';

// Variables locales (no versionadas). En Vercel vienen del proyecto.
if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const port = Number(process.env['PORT'] ?? 3000);
serve({ fetch: createApp().fetch, port }, info => {
  console.warn(`BFF en http://localhost:${info.port}/api/v1`);
});
