import { TestBed } from '@angular/core/testing';

import { PUBLIC_APP_URL } from '@app/domain/shared/port/public-url.port';

import { providePublicAppUrl, resolvePublicAppUrl } from './public-url';

describe('resolvePublicAppUrl()', () => {
  const VERCEL = 'https://neque.vercel.app';

  // Es el caso que motivo el token: la IPA armaba enlaces a capacitor://localhost.
  it('en la app nativa usa la direccion configurada', () => {
    expect(resolvePublicAppUrl(VERCEL, true, 'capacitor://localhost')).toBe(VERCEL);
  });

  it('en web usa el origen actual', () => {
    expect(resolvePublicAppUrl(VERCEL, false, 'http://localhost:4200')).toBe(
      'http://localhost:4200',
    );
  });

  it('en la app nativa sin configuracion cae al origen', () => {
    expect(resolvePublicAppUrl('', true, 'capacitor://localhost')).toBe('capacitor://localhost');
  });

  it('quita la barra final', () => {
    expect(resolvePublicAppUrl(`${VERCEL}/`, true, 'capacitor://localhost')).toBe(VERCEL);
  });
});

describe('providePublicAppUrl()', () => {
  it('en el navegador de las pruebas resuelve al origen actual', () => {
    TestBed.configureTestingModule({
      providers: [providePublicAppUrl('https://neque.vercel.app')],
    });

    expect(TestBed.inject(PUBLIC_APP_URL)).toBe(window.location.origin);
  });
});
