import { DOCUMENT } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { fn } from '@testing/typed-mock';

import { KEYBOARD_OPEN_CLASS, useKeyboardInset } from './keyboard-inset';

/** visualViewport falso: jsdom no lo implementa. */
class FakeViewport extends EventTarget {
  height = 800;
}

const cambios = fn<(px: number) => void>();

@Component({ standalone: true, template: '' })
class HostConTeclado {
  constructor() {
    useKeyboardInset(px => cambios(px));
  }
}

describe('useKeyboardInset()', () => {
  let viewport: FakeViewport;
  let scrollTo: jest.SpyInstance;
  let root: HTMLElement;

  beforeEach(() => {
    cambios.mockClear();
    viewport = new FakeViewport();
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    root = TestBed.inject(DOCUMENT).documentElement;
  });

  afterEach(() => {
    scrollTo.mockRestore();
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  });

  it('sin teclado no marca nada', () => {
    TestBed.createComponent(HostConTeclado);

    expect(root.classList.contains(KEYBOARD_OPEN_CLASS)).toBe(false);
    expect(root.style.getPropertyValue('--nq-kb')).toBe('0px');
    expect(cambios).toHaveBeenCalledWith(0);
  });

  it('con el teclado abierto publica su alto, marca la clase y fija la ventana arriba', () => {
    TestBed.createComponent(HostConTeclado);
    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });

    viewport.height = 450;
    viewport.dispatchEvent(new Event('resize'));

    expect(root.style.getPropertyValue('--nq-kb')).toBe('350px');
    expect(root.classList.contains(KEYBOARD_OPEN_CLASS)).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(cambios).toHaveBeenLastCalledWith(350);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  it('una diferencia chica (barras del navegador) no cuenta como teclado', () => {
    TestBed.createComponent(HostConTeclado);

    viewport.height = 760;
    viewport.dispatchEvent(new Event('scroll'));

    expect(root.classList.contains(KEYBOARD_OPEN_CLASS)).toBe(false);
  });

  it('avisa solo cuando el alto cambia', () => {
    TestBed.createComponent(HostConTeclado);
    viewport.height = 450;
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));

    expect(cambios).toHaveBeenCalledTimes(2);
  });

  it('al salir de la pantalla limpia la clase y la variable', () => {
    const fixture = TestBed.createComponent(HostConTeclado);
    viewport.height = 450;
    viewport.dispatchEvent(new Event('resize'));

    fixture.destroy();

    expect(root.classList.contains(KEYBOARD_OPEN_CLASS)).toBe(false);
    expect(root.style.getPropertyValue('--nq-kb')).toBe('');
  });

  it('sin visualViewport no hace nada', () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });

    TestBed.createComponent(HostConTeclado);

    expect(cambios).not.toHaveBeenCalled();
  });
});
