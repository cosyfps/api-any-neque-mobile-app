import { Provider } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import { PUBLIC_APP_URL } from '@app/domain/shared/port/public-url.port';

/**
 * Elige la base de los enlaces publicos.
 *
 * En la app nativa, la configurada: el origen ahi es `capacitor://localhost`
 * (o `https://localhost` en Android) y no existe fuera del telefono. En web,
 * el origen actual: asi `ng serve` arma enlaces a `localhost` que se pueden
 * probar, y el deploy arma los suyos sin depender de la configuracion.
 */
export function resolvePublicAppUrl(configured: string, isNative: boolean, origin: string): string {
  const base = isNative && configured !== '' ? configured : origin;
  return base.replace(/\/+$/, '');
}

export function providePublicAppUrl(configured: string): Provider {
  return {
    provide: PUBLIC_APP_URL,
    useFactory: () =>
      resolvePublicAppUrl(configured, Capacitor.isNativePlatform(), window.location.origin),
  };
}
