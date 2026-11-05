import { DOCUMENT } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KeepAwake } from '@capacitor-community/keep-awake';

import { fn } from '@testing/typed-mock';

import { useScreenAwake } from './screen-awake';

jest.mock('@capacitor-community/keep-awake', () => ({
  KeepAwake: {
    keepAwake: jest.fn<Promise<void>, []>(() => Promise.resolve()),
    allowSleep: jest.fn<Promise<void>, []>(() => Promise.resolve()),
  },
}));

const keepAwake = jest.mocked(KeepAwake.keepAwake);
const allowSleep = jest.mocked(KeepAwake.allowSleep);
const activa = signal(false);
const alVolver = fn<() => void>();

@Component({ standalone: true, template: '' })
class Host {
  constructor() {
    useScreenAwake(activa, () => alVolver());
  }
}

const visibilidad = (estado: DocumentVisibilityState): void => {
  const doc = TestBed.inject(DOCUMENT);
  Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => estado });
  doc.dispatchEvent(new Event('visibilitychange'));
};

describe('useScreenAwake()', () => {
  beforeEach(() => {
    activa.set(false);
    keepAwake.mockClear();
    allowSleep.mockClear();
    alVolver.mockClear();
  });

  it('mantiene la pantalla encendida solo mientras esta activo', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(keepAwake).not.toHaveBeenCalled();

    activa.set(true);
    fixture.detectChanges();
    expect(keepAwake).toHaveBeenCalledTimes(1);

    activa.set(false);
    fixture.detectChanges();
    expect(allowSleep).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('al volver a primer plano avisa y vuelve a pedir la pantalla encendida', () => {
    activa.set(true);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    keepAwake.mockClear();

    visibilidad('hidden');
    expect(alVolver).not.toHaveBeenCalled();

    visibilidad('visible');
    expect(alVolver).toHaveBeenCalledTimes(1);
    expect(keepAwake).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('al destruirse deja que la pantalla se apague y deja de escuchar', () => {
    activa.set(true);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    fixture.destroy();
    expect(allowSleep).toHaveBeenCalledTimes(1);

    visibilidad('visible');
    expect(alVolver).not.toHaveBeenCalled();
  });

  it('ignora los errores del plugin', async () => {
    keepAwake.mockImplementationOnce(() => Promise.reject(new Error('sin soporte')));
    activa.set(true);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await Promise.resolve();
    expect(keepAwake).toHaveBeenCalled();
    fixture.destroy();
  });
});
