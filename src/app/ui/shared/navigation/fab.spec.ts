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

@Component({ standalone: true, template: '' })
class HostWithMessageFab {
  constructor() {
    useFab(
      () => 'Mensaje',
      () => undefined,
      'message',
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
    const vieja = { label: () => 'Vieja', run: fn<() => void>(), icon: 'plus' as const };
    const nueva = { label: () => 'Nueva', run: fn<() => void>(), icon: 'plus' as const };
    registry.set(vieja);
    registry.set(nueva);

    registry.clear(vieja);

    expect(registry.action()).toBe(nueva);
  });

  describe('useFab()', () => {
    it('acepta el icono de mensajes', () => {
      TestBed.createComponent(HostWithMessageFab);

      expect(registry.action()?.icon).toBe('message');
    });

    it('registra la accion mientras la pantalla vive y la quita al destruirla', () => {
      const fixture = TestBed.createComponent(HostWithFab);

      const action = registry.action();
      expect(action?.label()).toBe('Agregar');
      expect(action?.icon).toBe('plus');
      action?.run();
      expect(fixture.componentInstance.run).toHaveBeenCalled();

      fixture.destroy();

      expect(registry.action()).toBeNull();
    });
  });
});
