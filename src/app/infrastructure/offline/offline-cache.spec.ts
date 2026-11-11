import { firstValueFrom, of, throwError } from 'rxjs';

import { domainError } from '@app/domain/shared/model/app-error';

import { clearCache, isNetworkError, readCache, withCache, writeCache } from './offline-cache';

describe('offline-cache', () => {
  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('guarda y lee por clave', () => {
    writeCache('routine.s1', { id: 'r1' });
    expect(readCache('routine.s1')).toEqual({ id: 'r1' });
    expect(readCache('otra')).toBeNull();
  });

  it('clearCache borra solo la cache', () => {
    writeCache('a', 1);
    localStorage.setItem('neque.session', 'x');
    clearCache();
    expect(readCache('a')).toBeNull();
    expect(localStorage.getItem('neque.session')).toBe('x');
  });

  it('un almacenamiento que lanza se trata como cache vacia', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    jest.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => writeCache('a', 1)).not.toThrow();
    expect(readCache('a')).toBeNull();
    expect(() => clearCache()).not.toThrow();
  });

  it('isNetworkError reconoce solo el error de red', () => {
    expect(isNetworkError(domainError('network'))).toBe(true);
    expect(isNetworkError(domainError('not_found'))).toBe(false);
    expect(isNetworkError(new Error('x'))).toBe(false);
  });

  describe('withCache', () => {
    it('guarda la respuesta y la entrega sin red', async () => {
      await firstValueFrom(withCache('k', of({ v: 1 })));
      const sinRed = withCache(
        'k',
        throwError(() => domainError('network')),
      );
      await expect(firstValueFrom(sinRed)).resolves.toEqual({ v: 1 });
    });

    it('sin cache, o con otro error, propaga', async () => {
      await expect(
        firstValueFrom(
          withCache(
            'vacia',
            throwError(() => domainError('network')),
          ),
        ),
      ).rejects.toMatchObject({ code: 'network' });

      writeCache('k', 1);
      await expect(
        firstValueFrom(
          withCache(
            'k',
            throwError(() => domainError('forbidden')),
          ),
        ),
      ).rejects.toMatchObject({ code: 'forbidden' });
    });
  });
});
