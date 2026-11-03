import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CLOCK } from '@app/domain/shared/port/clock.port';

import { AppComponent } from './app.component';
import { appConfig } from './app.config';

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
});
