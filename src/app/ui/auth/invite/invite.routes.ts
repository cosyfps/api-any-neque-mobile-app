import { Routes } from '@angular/router';

import { provideInvitationAdapters } from '@app/infrastructure/auth/invitation-providers';

/**
 * Ruta de la invitacion.
 *
 * Existe como archivo aparte y no como `providers` dentro de `app.routes.ts`
 * a proposito: ahi la llamada a `provideInvitationAdapters()` se evalua al
 * arrancar la app, y arrastraba el adapter de invitaciones al bundle
 * inicial. Con `loadChildren` viajan en su propio chunk.
 */
export const INVITE_ROUTES: Routes = [
  {
    path: '',
    providers: [provideInvitationAdapters()],
    loadComponent: () => import('./invite.page').then(m => m.InvitePage),
  },
];
