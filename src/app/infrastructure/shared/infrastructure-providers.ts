import { Provider } from '@angular/core';

import { CLOCK } from '@app/domain/shared/port/clock.port';

import { provideAuthAdapters } from '../auth/auth-providers';
import { provideApiBaseUrl } from '../http/api-client';

import { providePublicAppUrl } from './public-url';
import { SystemClock } from './system-clock';

/**
 * Providers de infraestructura del injector raiz: reloj, direcciones
 * publicas, cliente del BFF y autenticacion. Los puertos de cada rol se
 * registran en sus rutas para viajar en su chunk lazy.
 */
export function provideInfrastructure(publicAppUrl: string): Provider[] {
  return [
    { provide: CLOCK, useClass: SystemClock },
    providePublicAppUrl(publicAppUrl),
    provideApiBaseUrl(publicAppUrl),
    ...provideAuthAdapters(),
  ];
}
