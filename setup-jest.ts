import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();

// jsdom no trae `fetch` y `provideHttpClient(withFetch())` lo exige al
// configurarse. Ningun test hace red real: las peticiones van por
// HttpTestingController.
if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = (() =>
    Promise.reject(new Error('fetch no disponible en tests'))) as typeof fetch;
}
