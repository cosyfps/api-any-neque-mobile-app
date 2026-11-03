import { BrowserInfo, isMobileBrowser, webAccessEnabled } from './web-access';

const IPHONE: BrowserInfo = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  maxTouchPoints: 5,
};
const ANDROID: BrowserInfo = {
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0 Mobile Safari/537.36',
  platform: 'Linux armv8l',
  maxTouchPoints: 5,
};
const IPAD: BrowserInfo = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
};
const MAC: BrowserInfo = { ...IPAD, maxTouchPoints: 0 };
const WINDOWS: BrowserInfo = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36',
  platform: 'Win32',
  maxTouchPoints: 0,
};

describe('isMobileBrowser', () => {
  it.each([
    ['iPhone', IPHONE],
    ['Android', ANDROID],
    ['iPad', IPAD],
  ])('reconoce %s como movil', (_nombre, browser) => {
    expect(isMobileBrowser(browser)).toBe(true);
  });

  it.each([
    ['Mac', MAC],
    ['Windows', WINDOWS],
  ])('trata %s como escritorio', (_nombre, browser) => {
    expect(isMobileBrowser(browser)).toBe(false);
  });
});

describe('webAccessEnabled', () => {
  it('apagado por defecto: sin meta nadie usa la web', () => {
    expect(webAccessEnabled(null, IPHONE)).toBe(false);
  });

  it('con "off" sigue apagado', () => {
    expect(webAccessEnabled('off', IPHONE)).toBe(false);
  });

  it('con "mobile" abre la app a los navegadores moviles', () => {
    expect(webAccessEnabled('mobile', IPHONE)).toBe(true);
    expect(webAccessEnabled(' MOBILE ', ANDROID)).toBe(true);
  });

  it('con "mobile" el escritorio sigue bloqueado', () => {
    expect(webAccessEnabled('mobile', WINDOWS)).toBe(false);
    expect(webAccessEnabled('mobile', MAC)).toBe(false);
  });
});
