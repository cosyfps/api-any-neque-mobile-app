import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { CLOCK } from '@app/domain/shared/port/clock.port';

import { AppComponent } from './app.component';
import { appConfig } from './app.config';
import { MOBILE_ONLY_ROUTES, routes, routesFor } from './app.routes';

describe('AppComponent', () => {
  it('monta el outlet de la app', () => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(AppComponent);

    expect(fixture.componentInstance).toBeInstanceOf(AppComponent);
    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).toBeTruthy();
  });

  it('appConfig registra el router y los adapters de datos', () => {
    expect(appConfig.providers.length).toBeGreaterThanOrEqual(2);
  });

  it('appConfig resuelve el puerto CLOCK', () => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });
    expect(TestBed.inject(CLOCK).now()).toBeInstanceOf(Date);
  });

  it('un enlace profundo de invitacion navega a su ruta', () => {
    TestBed.configureTestingModule({ imports: [AppComponent], providers: [provideRouter([])] });
    const app = TestBed.createComponent(AppComponent).componentInstance;
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    app.openDeepLink('neque://i/tok123');
    app.openDeepLink('https://otro.com/i/tok123');

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/i/tok123');
  });
});

// La app es solo movil: el navegador en produccion no monta ninguna ruta real.
describe('routesFor', () => {
  it('la web de produccion solo tiene la pantalla de solo app', () => {
    expect(routesFor(true, false)).toBe(MOBILE_ONLY_ROUTES);
  });

  it('con el switch de acceso web encendido, el navegador usa las rutas completas', () => {
    expect(routesFor(true, false, true)).toBe(routes);
  });

  it('la app nativa y el desarrollo usan las rutas completas', () => {
    expect(routesFor(true, true)).toBe(routes);
    expect(routesFor(false, false)).toBe(routes);
  });

  it('las rutas web conservan el token de invitacion y la politica de privacidad', () => {
    expect(MOBILE_ONLY_ROUTES.map(route => route.path)).toEqual([
      'privacidad',
      'i/:token',
      'invite/:token',
      '**',
    ]);
  });
});
