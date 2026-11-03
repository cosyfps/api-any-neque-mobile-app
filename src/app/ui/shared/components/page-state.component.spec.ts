import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { fn } from '@testing/typed-mock';

import { PageStateComponent } from './page-state.component';

/** Renderiza por la misma razon que el spec de `nq-workout-card`: `input()`. */
describe('PageStateComponent', () => {
  let ref: ComponentRef<PageStateComponent>;
  let cmp: PageStateComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(PageStateComponent);
    ref = fixture.componentRef;
    cmp = fixture.componentInstance;
  });

  it('arranca en loading con retry habilitado', () => {
    expect(cmp.type()).toBe('loading');
    expect(cmp.title()).toBe('');
    expect(cmp.message()).toBe('');
    expect(cmp.showRetry()).toBe(true);
    expect(cmp.loadingLabel()).toBe('Cargando');
  });

  it('onRetry() invoca el callback cuando existe', () => {
    const retry = fn<() => void>();
    ref.setInput('retry', retry);

    cmp.onRetry();

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('onRetry() no falla cuando no hay callback', () => {
    expect(() => cmp.onRetry()).not.toThrow();
  });

  it('pinta el estado que se le pide', () => {
    const fixture = TestBed.createComponent(PageStateComponent);
    fixture.componentRef.setInput('type', 'empty');
    fixture.componentRef.setInput('title', 'Sin evaluaciones');
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Sin evaluaciones');
  });

  it('anuncia la carga como region viva', () => {
    const fixture = TestBed.createComponent(PageStateComponent);
    fixture.detectChanges();

    const estado = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(estado?.getAttribute('aria-live')).toBe('polite');
  });
});
