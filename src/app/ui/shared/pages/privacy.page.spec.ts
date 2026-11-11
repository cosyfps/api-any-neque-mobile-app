import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { PrivacyPage } from './privacy.page';

describe('PrivacyPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PrivacyPage], providers: [provideRouter([])] });
  });

  afterEach(() => jest.restoreAllMocks());

  it('muestra las tres normas y los derechos del titular', () => {
    const fixture = TestBed.createComponent(PrivacyPage);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Ley 21.719');
    expect(text).toContain('Ley 21.663');
    expect(text).toContain('ISO/IEC 27001');
    expect(text).toContain('Portabilidad');
    // Nunca afirmar una certificacion que no existe.
    expect(text).toMatch(/no cuenta\s+con certificación/);
  });

  it('tiene un solo h1 y una seccion por tema', () => {
    const fixture = TestBed.createComponent(PrivacyPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelectorAll('section h2').length).toBeGreaterThanOrEqual(5);
  });

  it('volver usa el historial si existe', () => {
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
    jest.spyOn(window.history, 'length', 'get').mockReturnValue(3);
    const page = TestBed.runInInjectionContext(() => new PrivacyPage());

    page.back();

    expect(back).toHaveBeenCalled();
  });

  it('abierta directo, volver lleva al inicio', () => {
    jest.spyOn(window.history, 'length', 'get').mockReturnValue(1);
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const page = TestBed.runInInjectionContext(() => new PrivacyPage());

    page.back();

    expect(navigate).toHaveBeenCalledWith(['/']);
  });
});
