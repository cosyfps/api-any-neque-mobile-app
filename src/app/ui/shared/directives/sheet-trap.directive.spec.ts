import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { fn } from '@testing/typed-mock';

import { SheetTrapDirective } from './sheet-trap.directive';

/** Sheet minimo con tres botones, como el de cerrar sesion. */
function createSheet(): HTMLElement {
  const sheet = document.createElement('div');
  sheet.innerHTML = `
    <div class="nq-sheet-handle"></div>
    <h2 class="nq-sheet-title">Titulo</h2>
    <p id="cuerpo">Cuerpo</p>
    <select id="lista" disabled><option>A</option></select>
    <button id="uno" type="button">Uno</button>
    <button id="dos" type="button">Dos</button>
    <button id="tres" type="button">Tres</button>
  `;
  document.body.appendChild(sheet);
  return sheet;
}

function createDirective(host: HTMLElement): SheetTrapDirective {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: ElementRef, useValue: new ElementRef(host) }],
  });
  return TestBed.runInInjectionContext(() => new SheetTrapDirective());
}

function keydown(key: string, shiftKey = false): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, shiftKey, cancelable: true });
}

/** `TouchEvent` no existe en jsdom: basta con lo que la directiva lee. */
function toque(y: number, target: EventTarget | null = null): TouchEvent {
  return { touches: [{ clientY: y }], target } as unknown as TouchEvent;
}

describe('SheetTrapDirective', () => {
  let sheet: HTMLElement;
  let directive: SheetTrapDirective;

  beforeEach(() => {
    jest.useFakeTimers();
    sheet = createSheet();
    directive = createDirective(sheet);
  });

  afterEach(() => {
    jest.useRealTimers();
    sheet.remove();
  });

  describe('foco al abrir', () => {
    it('lleva el foco al sheet y no a su primer control cuando se abre', () => {
      directive.nqSheetTrap = true;
      jest.runAllTimers();

      expect(document.activeElement).toBe(sheet);
    });

    it('deja el sheet fuera del orden de tabulacion', () => {
      expect(sheet.tabIndex).toBe(-1);
    });

    it('no mueve el foco si sigue cerrado', () => {
      directive.nqSheetTrap = false;
      jest.runAllTimers();

      expect(document.activeElement).not.toBe(sheet);
    });

    it('cancela el foco pendiente si se cierra antes de aplicarse', () => {
      directive.nqSheetTrap = true;
      directive.nqSheetTrap = false;
      jest.runAllTimers();

      expect(document.activeElement).not.toBe(sheet);
    });
  });

  describe('Escape', () => {
    it('avisa que el usuario pidio cerrar', () => {
      const dismissed = fn<() => void>();
      directive.dismissed.subscribe(dismissed);

      const event = keydown('Escape');
      directive.onKeydown(event);

      expect(dismissed).toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('arrastre para descartar', () => {
    const asa = (): Element | null => sheet.querySelector('.nq-sheet-handle');

    it('tambien arranca desde el titulo', () => {
      directive.alEmpezar(toque(100, sheet.querySelector('.nq-sheet-title')));
      directive.alMover(toque(150));

      expect(directive.arrastre()).toBe(50);
    });

    // El cuerpo desplaza el formulario: un arrastre desde ahi cerraba el
    // sheet al intentar volver arriba.
    it.each([
      ['el cuerpo', '#cuerpo'],
      ['un select', '#lista'],
    ])('no arranca desde %s', (_caso, selector) => {
      directive.alEmpezar(toque(0, sheet.querySelector(selector)));
      directive.alMover(toque(200));
      directive.alSoltar();

      expect(directive.arrastre()).toBe(0);
      expect(directive.arrastrando()).toBe(false);
    });

    it('no arranca si el sheet no esta arriba del todo', () => {
      const dismissed = fn<() => void>();
      directive.dismissed.subscribe(dismissed);
      Object.defineProperty(sheet, 'scrollTop', { value: 40, configurable: true });

      directive.alEmpezar(toque(0, asa()));
      directive.alMover(toque(200));
      directive.alSoltar();

      expect(dismissed).not.toHaveBeenCalled();
    });

    it('sigue al dedo hacia abajo', () => {
      directive.alEmpezar(toque(100, asa()));
      directive.alMover(toque(180));

      expect(directive.arrastre()).toBe(80);
      expect(directive.arrastrando()).toBe(true);
    });

    it('no se estira hacia arriba', () => {
      directive.alEmpezar(toque(100, asa()));
      directive.alMover(toque(40));

      expect(directive.arrastre()).toBe(0);
    });

    it('cierra al soltar pasado el umbral', () => {
      const dismissed = fn<() => void>();
      directive.dismissed.subscribe(dismissed);

      directive.alEmpezar(toque(0, asa()));
      directive.alMover(toque(140));
      directive.alSoltar();

      expect(dismissed).toHaveBeenCalled();
      expect(directive.arrastre()).toBe(0);
    });

    it('vuelve a su sitio si se queda corto', () => {
      const dismissed = fn<() => void>();
      directive.dismissed.subscribe(dismissed);

      directive.alEmpezar(toque(0, asa()));
      directive.alMover(toque(40));
      directive.alSoltar();

      expect(dismissed).not.toHaveBeenCalled();
      expect(directive.arrastre()).toBe(0);
    });

    // Desde un boton el dedo esta pulsando, no arrastrando el sheet.
    it('no arranca desde un control', () => {
      const boton = sheet.querySelector('#uno');

      directive.alEmpezar(toque(0, boton));
      directive.alMover(toque(200));

      expect(directive.arrastre()).toBe(0);
    });

    it('cancelar descarta el gesto sin cerrar', () => {
      const dismissed = fn<() => void>();
      directive.dismissed.subscribe(dismissed);

      directive.alEmpezar(toque(0, asa()));
      directive.alMover(toque(200));
      directive.cancelarArrastre();

      expect(dismissed).not.toHaveBeenCalled();
      expect(directive.arrastrando()).toBe(false);
    });
  });

  describe('trampa de Tab', () => {
    it('del ultimo control vuelve al primero', () => {
      sheet.querySelector<HTMLElement>('#tres')?.focus();

      const event = keydown('Tab');
      directive.onKeydown(event);

      expect(document.activeElement?.id).toBe('uno');
      expect(event.defaultPrevented).toBe(true);
    });

    it('del primero con Shift salta al ultimo', () => {
      sheet.querySelector<HTMLElement>('#uno')?.focus();

      const event = keydown('Tab', true);
      directive.onKeydown(event);

      expect(document.activeElement?.id).toBe('tres');
      expect(event.defaultPrevented).toBe(true);
    });

    it('desde el sheet recien abierto, Shift salta al ultimo', () => {
      sheet.focus();

      const event = keydown('Tab', true);
      directive.onKeydown(event);

      expect(document.activeElement?.id).toBe('tres');
      expect(event.defaultPrevented).toBe(true);
    });

    it('deja pasar el Tab en los controles intermedios', () => {
      sheet.querySelector<HTMLElement>('#dos')?.focus();

      const event = keydown('Tab');
      directive.onKeydown(event);

      expect(document.activeElement?.id).toBe('dos');
      expect(event.defaultPrevented).toBe(false);
    });

    it('ignora cualquier otra tecla', () => {
      const dismissed = fn<() => void>();
      directive.dismissed.subscribe(dismissed);

      const event = keydown('a');
      directive.onKeydown(event);

      expect(dismissed).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('no falla en un sheet sin controles enfocables', () => {
      const vacio = document.createElement('div');
      document.body.appendChild(vacio);
      const sinFoco = createDirective(vacio);

      expect(() => sinFoco.onKeydown(keydown('Tab'))).not.toThrow();

      vacio.remove();
    });
  });
});
