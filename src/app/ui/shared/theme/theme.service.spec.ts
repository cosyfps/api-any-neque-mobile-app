import { TestBed } from '@angular/core/testing';

import { THEME_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;

  const crear = (): ThemeService => {
    TestBed.resetTestingModule();
    return TestBed.inject(ThemeService);
  };

  afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
  });

  it('por defecto sigue al dispositivo: sin data-theme', () => {
    const theme = crear();

    expect(theme.preference()).toBe('system');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it.each(['light', 'dark'] as const)('forzar %s pone data-theme y lo guarda', valor => {
    const theme = crear();

    theme.set(valor);

    expect(root.getAttribute('data-theme')).toBe(valor);
    expect(localStorage.getItem(THEME_KEY)).toBe(valor);
  });

  it('volver a Automatico quita el atributo y lo guardado', () => {
    const theme = crear();
    theme.set('dark');

    theme.set('system');

    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('al arrancar aplica lo que se eligio antes', () => {
    localStorage.setItem(THEME_KEY, 'dark');

    const theme = crear();

    expect(theme.preference()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('un valor guardado desconocido vuelve a Automatico', () => {
    localStorage.setItem(THEME_KEY, 'sepia');

    expect(crear().preference()).toBe('system');
  });
});
