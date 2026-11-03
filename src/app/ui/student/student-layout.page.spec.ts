import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { fn } from '@testing/typed-mock';

import { StudentLayoutPage } from './student-layout.page';

describe('StudentLayoutPage', () => {
  let page: StudentLayoutPage;
  let router: Router;
  let events: Subject<NavigationEnd>;

  const navigateTo = (url: string): void => {
    events.next(new NavigationEnd(1, url, url));
  };

  const createPage = (initialUrl = '/student/home'): StudentLayoutPage => {
    events = new Subject<NavigationEnd>();
    const routerStub = {
      events: events.asObservable(),
      url: initialUrl,
      navigate: fn<Router['navigate']>().mockResolvedValue(true),
    } as unknown as Router;

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Router, useValue: routerStub }],
    });
    router = TestBed.inject(Router);
    return TestBed.runInInjectionContext(() => new StudentLayoutPage());
  };

  beforeEach(() => {
    page = createPage();
  });

  describe('tabs', () => {
    it('declara las cuatro pestanas del alumno', () => {
      expect(page.tabs.map(tab => tab.path)).toEqual([
        '/student/home',
        '/student/routine',
        '/student/progress',
        '/student/profile',
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
      expect(page.isActive('/student/home')).toBe(true);
      expect(page.isActive('/student/routine')).toBe(false);
    });

    it('sigue la navegacion', () => {
      navigateTo('/student/progress');

      expect(page.isActive('/student/progress')).toBe(true);
      expect(page.isActive('/student/home')).toBe(false);
    });

    it('ignora los query params', () => {
      navigateTo('/student/routine?day=4');

      expect(page.isActive('/student/routine')).toBe(true);
    });

    it('una ruta hija mantiene encendida su pestana', () => {
      navigateTo('/student/routine/detalle');

      expect(page.isActive('/student/routine')).toBe(true);
    });
  });

  describe('navigate()', () => {
    it('delega en el router', () => {
      page.navigate('/student/profile');

      expect(router.navigate).toHaveBeenCalledWith(['/student/profile']);
    });
  });
});
