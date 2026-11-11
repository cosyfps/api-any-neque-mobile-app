/**
 * @jest-environment node
 */
import { Env } from '../config/env';

import { sendMail } from './mailer';

let currentEnv: Partial<Env> = {};

jest.mock('../config/env', () => ({ env: () => currentEnv }));

const MESSAGE = {
  to: 'alumno@correo.cl',
  toName: 'Alejandra Acosta',
  subject: 'Asunto',
  html: '<p>Hola</p>',
  text: 'Hola',
};

describe('sendMail', () => {
  let fetchMock: jest.SpyInstance<ReturnType<typeof fetch>, Parameters<typeof fetch>>;

  beforeEach(() => {
    currentEnv = { MAIL_FROM_NAME: 'Ñeque' };
    fetchMock = jest.spyOn(globalThis, 'fetch');
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('sin clave o sin remitente no llama a Brevo', async () => {
    await expect(sendMail(MESSAGE)).resolves.toBe('disabled');
    currentEnv = { ...currentEnv, BREVO_API_KEY: 'k' };
    await expect(sendMail(MESSAGE)).resolves.toBe('disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia con la clave en la cabecera y el remitente configurado', async () => {
    currentEnv = { ...currentEnv, BREVO_API_KEY: 'brevo-key', MAIL_FROM: 'neque@gmail.com' };
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));

    await expect(sendMail(MESSAGE)).resolves.toBe('sent');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init?.headers as Record<string, string>)['api-key']).toBe('brevo-key');
    expect(JSON.parse(String(init?.body))).toEqual({
      sender: { email: 'neque@gmail.com', name: 'Ñeque' },
      to: [{ email: 'alumno@correo.cl', name: 'Alejandra Acosta' }],
      subject: 'Asunto',
      htmlContent: '<p>Hola</p>',
      textContent: 'Hola',
    });
  });

  it('un rechazo o un corte de red no lanza: informa que fallo', async () => {
    currentEnv = { ...currentEnv, BREVO_API_KEY: 'k', MAIL_FROM: 'neque@gmail.com' };

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await expect(sendMail(MESSAGE)).resolves.toBe('failed');

    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    await expect(sendMail(MESSAGE)).resolves.toBe('failed');
  });
});
