import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { authInterceptor } from '@app/infrastructure/http/auth.interceptor';
import { provideInfrastructure } from '@app/infrastructure/shared/infrastructure-providers';

import { environment } from '@env/environment';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideInfrastructure(environment.publicAppUrl),
  ],
};
