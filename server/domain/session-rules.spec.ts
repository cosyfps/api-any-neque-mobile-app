import { isReplacedSession, sessionIdOf } from './session-rules';

/** JWT sin firma con los claims dados: `sessionIdOf` solo lee, no verifica. */
const tokenWith = (claims: Record<string, unknown>): string => {
  const parte = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${parte({ alg: 'none' })}.${parte(claims)}.`;
};

describe('sessionIdOf', () => {
  it('lee el claim session_id', () => {
    expect(sessionIdOf(tokenWith({ sub: 'u1', session_id: 's1' }))).toBe('s1');
  });

  it('sin el claim o con un token ilegible devuelve null', () => {
    expect(sessionIdOf(tokenWith({ sub: 'u1' }))).toBeNull();
    expect(sessionIdOf('no-es-jwt')).toBeNull();
  });
});

// Una sola sesion activa por cuenta: la ultima que se abrio.
describe('isReplacedSession', () => {
  it('la sesion activa no esta reemplazada', () => {
    expect(isReplacedSession('s1', 's1')).toBe(false);
  });

  it('sin sesion registrada la regla aun no aplica', () => {
    expect(isReplacedSession(null, 's1')).toBe(false);
  });

  it('otra sesion de la misma cuenta esta reemplazada', () => {
    expect(isReplacedSession('s2', 's1')).toBe(true);
  });

  it('un token sin session_id no pasa si la cuenta ya tiene sesion activa', () => {
    expect(isReplacedSession('s2', null)).toBe(true);
  });
});
