import { Provider } from '@angular/core';

import { InvitationFacade } from '@app/application/auth/invitation.facade';
import { INVITATION_PORT } from '@app/domain/auth/port/invitation.port';

import { InvitationHttpAdapter } from './auth.http-adapter';

/**
 * Invitacion. Solo la necesita `/invite/:token`, asi que se registra en esa
 * ruta y viaja en su chunk lazy.
 */
export function provideInvitationAdapters(): Provider[] {
  return [
    InvitationHttpAdapter,
    { provide: INVITATION_PORT, useExisting: InvitationHttpAdapter },
    InvitationFacade,
  ];
}
