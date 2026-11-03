import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { fn } from '@testing/typed-mock';

import { WorkoutCardComponent } from './workout-card.component';

/**
 * Este spec renderiza, a diferencia de los de pagina.
 *
 * Un `input()` señal no se puede asignar sobre una instancia suelta: la unica
 * API publica para fijarlo es `componentRef.setInput()`, que exige un
 * `TestBed.createComponent`. Es el precio de migrar los decoradores a signals,
 * y en un componente de presentacion sin dependencias el costo es minimo.
 */
describe('WorkoutCardComponent', () => {
  let ref: ComponentRef<WorkoutCardComponent>;
  let card: WorkoutCardComponent;

  const crear = (title = 'Full body'): void => {
    const fixture = TestBed.createComponent(WorkoutCardComponent);
    ref = fixture.componentRef;
    card = fixture.componentInstance;
    ref.setInput('title', title);
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    crear();
  });

  describe('valores por defecto', () => {
    it('arranca activo y sin avance', () => {
      expect(card.active()).toBe(true);
      expect(card.percent()).toBe(0);
    });
  });

  describe('percent()', () => {
    it.each([
      [0, 0],
      [0.5, 50],
      [1, 100],
    ])('convierte %f a %i por ciento', (progress, expected) => {
      ref.setInput('progress', progress);
      expect(card.percent()).toBe(expected);
    });

    it('recorta valores sobre uno', () => {
      ref.setInput('progress', 1.8);
      expect(card.percent()).toBe(100);
    });

    it('recorta valores negativos', () => {
      ref.setInput('progress', -0.4);
      expect(card.percent()).toBe(0);
    });

    it('redondea a entero', () => {
      ref.setInput('progress', 0.333);
      expect(card.percent()).toBe(33);
    });
  });

  describe('avatarInitials()', () => {
    it('toma la inicial de las dos primeras palabras', () => {
      ref.setInput('title', 'Full body');
      expect(card.avatarInitials()).toBe('FB');
    });

    it('con una sola palabra devuelve una letra', () => {
      ref.setInput('title', 'Cardio');
      expect(card.avatarInitials()).toBe('C');
    });

    it('con el titulo vacio devuelve vacio', () => {
      ref.setInput('title', '');
      expect(card.avatarInitials()).toBe('');
    });

    it('ignora los espacios sobrantes', () => {
      ref.setInput('title', '  tren  superior  ');
      expect(card.avatarInitials()).toBe('TS');
    });
  });

  describe('salidas', () => {
    it('action emite al tocar el chevron', () => {
      const spy = fn<() => void>();
      card.action.subscribe(spy);
      card.action.emit();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
