import { getRequestListener } from '@hono/node-server';

import { createApp } from './http/app';

/**
 * Funcion de Vercel. La app se crea una vez por instancia y atiende todas
 * las rutas `/api/*`, que el build reescribe hacia aqui.
 */
export default getRequestListener(createApp().fetch);
