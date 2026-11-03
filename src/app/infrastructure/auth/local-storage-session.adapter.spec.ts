import { AuthSession } from '@app/domain/auth/model/auth-user.model';

import { LocalStorageSessionAdapter } from './local-storage-session.adapter';

const SESSION: AuthSession = {
  user: {
    id: 'usr-1',
    email: 'alejandra@neque.cl',
    role: 'student',
    displayName: 'Alejandra Acosta',
    avatarUrl: null,
    profileId: 'std-001',
  },
  token: 'token',
  expiresAt: '2026-09-24T10:00:00.000Z',
};

describe('LocalStorageSessionAdapter', () => {
  let adapter: LocalStorageSessionAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageSessionAdapter();
  });

  afterEach(() => jest.restoreAllMocks());

  it('hace round-trip de la sesion', () => {
    adapter.write(SESSION);
    expect(adapter.read()).toEqual(SESSION);
  });

  it('devuelve null cuando no hay nada guardado', () => {
    expect(adapter.read()).toBeNull();
  });

  it('clear() borra la sesion', () => {
    adapter.write(SESSION);
    adapter.clear();
    expect(adapter.read()).toBeNull();
  });

  it('devuelve null ante un JSON corrupto', () => {
    localStorage.setItem('neque.session', '{no-es-json');
    expect(adapter.read()).toBeNull();
  });

  it('devuelve null si leer lanza', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(adapter.read()).toBeNull();
  });

  it('no propaga el error si escribir lanza', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota excedida');
    });
    expect(() => adapter.write(SESSION)).not.toThrow();
  });

  it('no propaga el error si borrar lanza', () => {
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => adapter.clear()).not.toThrow();
  });
});
