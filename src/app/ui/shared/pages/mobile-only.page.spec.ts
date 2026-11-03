import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { MobileOnlyPage, appLinkFor } from './mobile-only.page';

describe('MobileOnlyPage', () => {
  const render = (token: string | null): HTMLElement => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MobileOnlyPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap(token === null ? {} : { token }) },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MobileOnlyPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('fuera de una invitacion solo informa, sin acciones', () => {
    const el = render(null);

    expect(el.querySelector('h1')?.textContent).toContain('solo en la app');
    expect(el.querySelectorAll('a, button, input, form')).toHaveLength(0);
  });

  it('con una invitacion ofrece abrirla en la app', () => {
    const el = render('tok-123');

    expect(el.querySelector('a')?.getAttribute('href')).toBe('neque://i/tok-123');
  });

  it('se libera del aviso de rotar: en escritorio se ve en horizontal', () => {
    render(null);

    expect(document.body.classList.contains('nq-any-orientation')).toBe(true);
  });

  it('codifica el token en el enlace', () => {
    expect(appLinkFor('a b/c')).toBe('neque://i/a%20b%2Fc');
    expect(appLinkFor('')).toBeNull();
  });
});
