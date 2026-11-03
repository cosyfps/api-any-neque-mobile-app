import { Provider } from '@angular/core';

import { AUTH_PORT } from '@app/domain/auth/port/auth.port';
import { SESSION_STORAGE_PORT } from '@app/domain/auth/port/session-storage.port';

import { AuthHttpAdapter } from './auth.http-adapter';
import { LocalStorageSessionAdapter } from './local-storage-session.adapter';

/**
 * Providers de autenticacion. Van en el injector raiz porque el guard los
 * necesita antes de resolver cualquier ruta.
 */
export function provideAuthAdapters(): Provider[] {
  return [
    AuthHttpAdapter,
    LocalStorageSessionAdapter,
    { provide: AUTH_PORT, useExisting: AuthHttpAdapter },
    { provide: SESSION_STORAGE_PORT, useExisting: LocalStorageSessionAdapter },
  ];
}
