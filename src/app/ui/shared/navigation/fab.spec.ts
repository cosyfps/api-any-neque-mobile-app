import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { fn } from '@testing/typed-mock';

import { FabRegistry, useFab } from './fab';

@Component({ standalone: true, template: '' })
class HostWithFab {
  readonly run = fn<() => void>();

  constructor() {
    useFab(
      () => 'Agregar',
      () => this.run(),
    );
  }
}

describe('FabRegistry', () => {
  let registry: FabRegistry;

  beforeEach(() => {
    registry = TestBed.inject(FabRegistry);
  });

  it('arranca sin accion', () => {
    expect(registry.action()).toBeNull();
  });

  it('clear() no borra la accion de otra pantalla', () => {
    const vieja = { label: () => 'Vieja', run: fn<() => void>() };
    const nueva = { label: () => 'Nueva', run: fn<() => void>() };
    registry.set(vieja);
    registry.set(nueva);

    registry.clear(vieja);

    expect(registry.action()).toBe(nueva);
  });

  describe('useFab()', () => {
    it('registra la accion mientras la pantalla vive y la quita al destruirla', () => {
      const fixture = TestBed.createComponent(HostWithFab);

      const action = registry.action();
      expect(action?.label()).toBe('Agregar');
      action?.run();
      expect(fixture.componentInstance.run).toHaveBeenCalled();

      fixture.destroy();

      expect(registry.action()).toBeNull();
    });
  });
});
