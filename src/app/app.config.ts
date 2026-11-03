import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Capacitor } from '@capacitor/core';

import { authInterceptor } from '@app/infrastructure/http/auth.interceptor';
import { provideInfrastructure } from '@app/infrastructure/shared/infrastructure-providers';
import { WEB_ACCESS_META, webAccessEnabled } from '@app/ui/shared/navigation/web-access';

import { environment } from '@env/environment';

import { routesFor } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routesFor(
        environment.production,
        Capacitor.isNativePlatform(),
        webAccessEnabled(
          document.querySelector(`meta[name="${WEB_ACCESS_META}"]`)?.getAttribute('content') ??
            null,
          navigator,
        ),
      ),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideInfrastructure(environment.publicAppUrl),
  ],
};
