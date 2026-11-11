import { env } from '../config/env';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
/** La funcion de Vercel corta a los 15 s: el correo no puede comerse ese margen. */
const TIMEOUT_MS = 5_000;

export interface MailMessage {
  readonly to: string;
  readonly toName: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** `disabled`: sin `BREVO_API_KEY` o `MAIL_FROM`, el envio no esta configurado. */
export type MailResult = 'sent' | 'failed' | 'disabled';

/**
 * Envia un correo transaccional por la API HTTP de Brevo.
 *
 * Nunca lanza: un correo que no sale no debe tumbar la operacion que lo
 * origino. Tampoco loguea la clave ni el contenido, que lleva el enlace de
 * invitacion.
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const { BREVO_API_KEY, MAIL_FROM, MAIL_FROM_NAME } = env();
  if (BREVO_API_KEY === undefined || BREVO_API_KEY === '' || MAIL_FROM === undefined) {
    return 'disabled';
  }
  try {
    const response = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: MAIL_FROM, name: MAIL_FROM_NAME },
        to: [{ email: message.to, name: message.toName }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn('[mailer] Brevo rechazo el envio', response.status);
      return 'failed';
    }
    return 'sent';
  } catch {
    console.warn('[mailer] Brevo no respondio');
    return 'failed';
  }
}
