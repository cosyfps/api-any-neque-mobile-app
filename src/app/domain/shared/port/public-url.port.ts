import { InjectionToken } from '@angular/core';

/**
 * Direccion publica de la app, sin barra final. Base de todo enlace que sale
 * del telefono: la invitacion de un alumno, su QR.
 *
 * No es `window.location.origin`: dentro de la app nativa eso vale
 * `capacitor://localhost`, que nadie fuera del telefono puede abrir.
 */
export const PUBLIC_APP_URL = new InjectionToken<string>('PublicAppUrl');
