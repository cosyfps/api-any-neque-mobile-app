import { TestBed } from '@angular/core/testing';

import { ThemePickerComponent } from './theme-picker.component';

describe('ThemePickerComponent', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  let detect: () => void;

  const render = (): HTMLElement => {
    TestBed.configureTestingModule({ imports: [ThemePickerComponent] });
    const fixture = TestBed.createComponent(ThemePickerComponent);
    fixture.detectChanges();
    detect = () => fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const radios = (el: HTMLElement): HTMLButtonElement[] =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));

  it('ofrece Automatico, Claro y Oscuro, con Automatico marcado', () => {
    const el = render();

    expect(radios(el).map(r => r.textContent?.trim())).toEqual(['Automático', 'Claro', 'Oscuro']);
    expect(radios(el)[0]?.getAttribute('aria-checked')).toBe('true');
  });

  it('elegir Oscuro lo aplica y lo marca', () => {
    const el = render();

    radios(el)[2]?.click();
    detect();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(radios(el)[2]?.getAttribute('aria-checked')).toBe('true');
    expect(el.querySelector('.hint')?.textContent).toContain('modo oscuro');
  });
});
