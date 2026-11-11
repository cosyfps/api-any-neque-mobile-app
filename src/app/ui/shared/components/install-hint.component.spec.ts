import { TestBed } from '@angular/core/testing';

import { fn } from '@testing/typed-mock';

import { InstallHintComponent, installPlatform } from './install-hint.component';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120';

describe('installPlatform', () => {
  it('distingue iPhone de Android', () => {
    expect(installPlatform({ userAgent: IPHONE }, false, false)).toBe('ios');
    expect(installPlatform({ userAgent: ANDROID }, false, false)).toBe('android');
  });

  it('ya instalada (standalone o nativa) no ofrece instalar', () => {
    expect(installPlatform({ userAgent: ANDROID }, true, false)).toBe('installed');
    expect(installPlatform({ userAgent: IPHONE, standalone: true }, false, false)).toBe(
      'installed',
    );
    expect(installPlatform({ userAgent: IPHONE }, false, true)).toBe('installed');
  });
});

describe('InstallHintComponent', () => {
  const render = () => {
    const fixture = TestBed.createComponent(InstallHintComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [InstallHintComponent] });
  });

  afterEach(() => localStorage.clear());

  it('en el navegador muestra como instalar', () => {
    const text = (render().nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Agrega Ñeque a tu inicio');
  });

  it('con el evento de Chrome ofrece el boton que abre su dialogo', async () => {
    const fixture = render();
    const prompt = fn<() => Promise<void>>().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
    });
    window.dispatchEvent(event);
    fixture.detectChanges();

    expect(event.defaultPrevented).toBe(true);
    const button = (fixture.nativeElement as HTMLElement).querySelector('.hint-install');
    expect(button?.textContent).toContain('Instalar Ñeque');

    await fixture.componentInstance.install();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.prompt()).toBeNull();
    // Sin evento guardado, instalar no hace nada.
    await fixture.componentInstance.install();
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('ocultarlo lo recuerda en este dispositivo', () => {
    const fixture = render();
    fixture.componentInstance.dismiss();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.hint')).toBeNull();
    expect(render().componentInstance.visible()).toBe(false);
  });
});
