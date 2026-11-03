import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { fn } from '@testing/typed-mock';

import { TourComponent } from './tour.component';
import { TourService } from './tour.service';

describe('TourComponent', () => {
  let fixture: ComponentFixture<TourComponent>;
  let tour: TourService;
  let navigate: jest.SpyInstance;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [TourComponent], providers: [provideRouter([])] });
    navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    tour = TestBed.inject(TourService);
    fixture = TestBed.createComponent(TourComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('sin tutorial activo no pinta nada', () => {
    expect(el().querySelector('.card')).toBeNull();
  });

  it('muestra el paso con su contador y va a su pantalla', () => {
    tour.start('trainer.u1', [
      { title: 'Hola', text: 'Bienvenida', route: '/trainer/home' },
      { title: 'Chao', text: 'Fin' },
    ]);
    fixture.detectChanges();

    expect(el().querySelector('.title')?.textContent).toContain('Hola');
    expect(el().querySelector('.count')?.textContent).toContain('1 de 2');
    expect(navigate).toHaveBeenCalledWith(['/trainer/home']);
    // Sin elemento que resaltar, la pantalla entera se oscurece.
    expect(el().querySelector('.dim')).not.toBeNull();
  });

  it('el ultimo paso cambia Siguiente por Entendido y quita Omitir', () => {
    tour.start('trainer.u1', [{ title: 'Unico', text: 'x' }]);
    fixture.detectChanges();

    expect(el().querySelector('.next')?.textContent?.trim()).toBe('Entendido');
    expect(el().querySelector('.skip')).toBeNull();
  });

  it('Omitir cierra y recuerda que ya se vio', () => {
    tour.start('trainer.u1', [
      { title: 'A', text: 'a' },
      { title: 'B', text: 'b' },
    ]);
    fixture.detectChanges();

    (el().querySelector('.skip') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el().querySelector('.card')).toBeNull();
    expect(localStorage.getItem('neque.tour-done.trainer.u1')).toBe('1');
  });

  it('resalta el elemento del paso cuando existe', () => {
    const objetivo = document.createElement('button');
    objetivo.dataset['tour'] = 'bell';
    objetivo.scrollIntoView = fn<HTMLElement['scrollIntoView']>();
    jest.spyOn(objetivo, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    jest.spyOn(objetivo, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 20,
      width: 40,
      height: 40,
    } as DOMRect);
    document.body.appendChild(objetivo);

    tour.start('trainer.u1', [{ title: 'Campana', text: 'x', target: 'bell' }]);
    fixture.detectChanges();

    const hueco = el().querySelector<HTMLElement>('.hole');
    expect(hueco?.style.top).toBe('92px');
    expect(hueco?.style.height).toBe('56px');
  });
});
