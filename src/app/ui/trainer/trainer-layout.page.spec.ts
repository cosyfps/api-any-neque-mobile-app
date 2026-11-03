import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';

import { fn } from '@testing/typed-mock';

import { TrainerLayoutPage } from './trainer-layout.page';

describe('TrainerLayoutPage', () => {
  let page: TrainerLayoutPage;
  let router: Router;
  let events: Subject<NavigationEnd>;

  const navigateTo = (url: string): void => {
    events.next(new NavigationEnd(1, url, url));
  };

  const createPage = (initialUrl = '/trainer/home'): TrainerLayoutPage => {
    events = new Subject<NavigationEnd>();
    const routerStub = {
      events: events.asObservable(),
      url: initialUrl,
      navigate: fn<Router['navigate']>().mockResolvedValue(true),
    } as unknown as Router;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Router, useValue: routerStub },
        { provide: SessionFacade, useValue: { user: () => ({ id: 'u1' }) } },
      ],
    });
    router = TestBed.inject(Router);
    return TestBed.runInInjectionContext(() => new TrainerLayoutPage());
  };

  beforeEach(() => {
    page = createPage();
  });

  describe('tabs', () => {
    it('declara las cuatro pestanas del entrenador', () => {
      expect(page.tabs.map(tab => tab.path)).toEqual([
        '/trainer/home',
        '/trainer/students',
        '/trainer/routines',
        '/trainer/profile',
      ]);
    });

    it('cada pestana tiene etiqueta accesible', () => {
      for (const tab of page.tabs) {
        expect(tab.label.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isActive()', () => {
    it('marca la pestana de la url inicial', () => {
      expect(page.isActive('/trainer/home')).toBe(true);
      expect(page.isActive('/trainer/students')).toBe(false);
    });

    it('sigue la navegacion', () => {
      navigateTo('/trainer/routines');

      expect(page.isActive('/trainer/routines')).toBe(true);
      expect(page.isActive('/trainer/home')).toBe(false);
    });

    it('ignora los query params', () => {
      navigateTo('/trainer/students?q=alejandra');

      expect(page.isActive('/trainer/students')).toBe(true);
    });

    // La ficha de un alumno vive bajo la pestana, no es una pestana.
    it('una ruta hija mantiene encendida su pestana', () => {
      navigateTo('/trainer/students/std-001');

      expect(page.isActive('/trainer/students')).toBe(true);
    });

    // Sin recordar la anterior, una ruta fuera de las cuatro las apaga todas.
    it('recuerda la ultima pestana fuera de las cuatro', () => {
      navigateTo('/trainer/students');
      navigateTo('/trainer/notificaciones');

      expect(page.isActive('/trainer/students')).toBe(true);
    });

    it('cae en Inicio cuando la url inicial no es pestana', () => {
      page = createPage('/trainer');

      expect(page.isActive('/trainer/home')).toBe(true);
    });
  });

  describe('navigate()', () => {
    it('delega en el router', () => {
      page.navigate('/trainer/profile');

      expect(router.navigate).toHaveBeenCalledWith(['/trainer/profile']);
    });
  });
});
