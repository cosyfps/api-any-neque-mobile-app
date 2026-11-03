import { deepLinkPath } from './deep-link';

const HOST = 'neque-ten.vercel.app';

describe('deepLinkPath', () => {
  it('traduce el esquema propio de una invitacion', () => {
    expect(deepLinkPath('neque://i/abc123', 'neque', HOST)).toBe('/i/abc123');
  });

  it('acepta el enlace https del dominio publico', () => {
    expect(deepLinkPath(`https://${HOST}/i/abc123`, 'neque', HOST)).toBe('/i/abc123');
  });

  it('conserva la query', () => {
    expect(deepLinkPath('neque://trainer/home?x=1', 'neque', HOST)).toBe('/trainer/home?x=1');
  });

  it('el esquema sin ruta lleva al inicio', () => {
    expect(deepLinkPath('neque://', 'neque', HOST)).toBe('/');
  });

  it.each([
    'https://otro.com/i/abc',
    'http://neque-ten.vercel.app/i/abc',
    'otro://i/abc',
    'no-es-url',
  ])('ignora %p', url => {
    expect(deepLinkPath(url, 'neque', HOST)).toBeNull();
  });
});
