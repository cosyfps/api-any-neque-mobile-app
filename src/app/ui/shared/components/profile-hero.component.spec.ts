import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileHeroComponent } from './profile-hero.component';

describe('ProfileHeroComponent', () => {
  let fixture: ComponentFixture<ProfileHeroComponent>;
  let hero: ProfileHeroComponent;
  let fotos: string[];
  let errores: string[];

  const crear = (photoUrl: string | null = null, tag: string | null = 'Ganar masa'): void => {
    fixture = TestBed.createComponent(ProfileHeroComponent);
    fixture.componentRef.setInput('name', 'Alejandra Acosta');
    fixture.componentRef.setInput('initials', 'AA');
    fixture.componentRef.setInput('tag', tag);
    fixture.componentRef.setInput('photoUrl', photoUrl);
    hero = fixture.componentInstance;
    fotos = [];
    errores = [];
    hero.photo.subscribe(value => fotos.push(value));
    hero.photoError.subscribe(value => errores.push(value));
    fixture.detectChanges();
  };

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  /** `FileList` no se construye en jsdom: basta con lo que lee el componente. */
  const elegir = (archivo: File | undefined): void => {
    const campo = { files: archivo === undefined ? [] : [archivo], value: 'x' };
    hero.onFile({ target: campo } as unknown as Event);
  };

  beforeEach(() => crear());

  it('muestra nombre, etiqueta e iniciales sin foto', () => {
    expect(el().querySelector('h1')?.textContent?.trim()).toBe('Alejandra Acosta');
    expect(el().querySelector('.tag')?.textContent?.trim()).toBe('Ganar masa');
    expect(el().querySelector('.avatar')?.textContent?.trim()).toBe('AA');
  });

  it('con foto muestra la imagen en vez de las iniciales', () => {
    crear('data:image/png;base64,AAA');

    expect(el().querySelector('.avatar img')?.getAttribute('src')).toBe(
      'data:image/png;base64,AAA',
    );
  });

  it('sin etiqueta no pinta el chip vacio', () => {
    crear(null, null);

    expect(el().querySelector('.tag')).toBeNull();
  });

  it('el boton de camara tiene nombre accesible', () => {
    expect(el().querySelector('input[type="file"]')?.getAttribute('aria-label')).toBe(
      'Cambiar foto de perfil',
    );
  });

  it('entrega la foto leida como data-URL', async () => {
    elegir(new File(['hola'], 'yo.png', { type: 'image/png' }));
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(fotos).toHaveLength(1);
    expect(fotos[0]).toMatch(/^data:image\/png;base64,/);
  });

  it('rechaza un archivo que no es imagen', () => {
    elegir(new File(['hola'], 'doc.pdf', { type: 'application/pdf' }));

    expect(errores).toEqual(['Elige una imagen.']);
  });

  it('rechaza una foto de mas de 8 MB', () => {
    const grande = new File(['x'], 'grande.png', { type: 'image/png' });
    Object.defineProperty(grande, 'size', { value: 9 * 1024 * 1024 });

    elegir(grande);

    expect(errores[0]).toContain('8 MB');
  });

  it('sin archivo no hace nada', () => {
    elegir(undefined);

    expect(fotos).toEqual([]);
    expect(errores).toEqual([]);
  });
});
