/** Datos con que se arma el correo de invitacion. */
export interface InvitationEmailInput {
  /** Nombre completo del alumno; el saludo usa solo el primero. */
  readonly studentName: string;
  readonly trainerName: string;
  /** Enlace publico `/i/<token>`. */
  readonly link: string;
  readonly expiresAt: string;
  readonly privacyUrl: string;
}

export interface EmailContent {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const TIME_ZONE = 'America/Santiago';
const BRAND = '#0f766e';
const BRAND_TINT = '#e0f2ef';

const STEPS: readonly (readonly [string, string])[] = [
  ['Abre tu invitación', 'Con el botón de abajo, desde tu teléfono.'],
  ['Crea tu contraseña', 'Solo tú la conoces; tu entrenador no.'],
  ['Agrega Ñeque a tu inicio', 'iPhone: Compartir → Agregar a inicio. Android: Instalar app.'],
];

/** Escapa texto para insertarlo en HTML: los nombres los escribe el entrenador. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** «miércoles 12 de noviembre a las 18:30», en hora de Chile. */
export function formatExpiry(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('es-CL', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  const time = new Intl.DateTimeFormat('es-CL', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${day.replace(',', '')} a las ${time}`;
}

/**
 * Correo de invitacion del alumno, aprobado con el usuario: banner de marca,
 * tres pasos, boton "Crear mi acceso" y enlace de respaldo en texto.
 *
 * HTML con tablas y estilos en linea: es lo unico que respetan todos los
 * clientes de correo (Gmail, Outlook, Mail de iOS).
 */
export function invitationEmail(input: InvitationEmailInput): EmailContent {
  const firstName = input.studentName.trim().split(/\s+/)[0] ?? '';
  const trainer = input.trainerName.trim();
  const expiry = formatExpiry(input.expiresAt);
  const subject = `${trainer} te invitó a entrenar en Ñeque`;

  const name = escapeHtml(firstName);
  const coach = escapeHtml(trainer);
  const link = escapeHtml(input.link);
  const privacy = escapeHtml(input.privacyUrl);

  const steps = STEPS.map(
    ([title, detail], index) => `
          <tr>
            <td width="36" valign="top" style="padding:0 0 12px 0;">
              <div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:${BRAND_TINT};color:${BRAND};font-size:12px;font-weight:600;text-align:center;">${index + 1}</div>
            </td>
            <td valign="top" style="padding:0 0 12px 0;font-size:14px;line-height:1.45;color:#1f2a28;">
              <strong style="font-weight:600;">${title}</strong><br />
              <span style="font-size:12px;color:#5d6967;">${detail}</span>
            </td>
          </tr>`,
  ).join('');

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dfe5e3;font-family:Inter,Arial,Helvetica,sans-serif;">
        <tr><td style="background:${BRAND};padding:22px 20px 20px;color:#ffffff;">
          <div style="font-size:13px;font-weight:600;letter-spacing:.3px;">Ñeque</div>
          <div style="font-size:20px;font-weight:600;line-height:1.3;padding-top:10px;">Tu entrenador te espera</div>
          <div style="font-size:13px;padding-top:6px;">Invitación personal · vence en 48 horas</div>
        </td></tr>
        <tr><td style="padding:20px;">
          <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#1f2a28;">Hola, ${name}</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3e4a48;">${coach} te dio acceso a Ñeque. Ahí verás tu rutina de cada día, registrarás lo que levantas y seguirás tu progreso.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
            <tr><td align="center" style="background:${BRAND};border-radius:12px;">
              <a href="${link}" style="display:block;padding:14px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Crear mi acceso</a>
            </td></tr>
          </table>
          <p style="margin:16px 0 4px;font-size:12px;color:#5d6967;">¿El botón no funciona? Copia este enlace en tu navegador:</p>
          <p style="margin:0;font-size:12px;word-break:break-all;"><a href="${link}" style="color:${BRAND};">${link}</a></p>
          <p style="margin:16px 0 0;padding:10px 12px;background:#f4f6f5;border-radius:10px;font-size:12px;line-height:1.5;color:#3e4a48;">Vence el <strong style="font-weight:600;">${expiry}</strong>. Si vence, pídele a tu entrenador una nueva.</p>
          <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#6b7674;">Si no esperabas este correo, ignóralo: nadie podrá entrar sin crear la contraseña.</p>
        </td></tr>
        <tr><td style="border-top:1px solid #e6ebea;padding:12px 20px;font-size:11px;line-height:1.6;color:#6b7674;">
          Ñeque · App por invitación<br />
          <a href="${privacy}" style="color:${BRAND};">Privacidad y seguridad</a> · Ley 21.719 · Ley 21.663 · ISO/IEC 27001
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Hola, ${firstName}:`,
    '',
    `${trainer} te dio acceso a Ñeque. Ahí verás tu rutina de cada día, registrarás lo que levantas y seguirás tu progreso.`,
    '',
    ...STEPS.map(([title, detail], index) => `${index + 1}. ${title}. ${detail}`),
    '',
    `Crea tu acceso aquí: ${input.link}`,
    '',
    `Vence el ${expiry}. Si vence, pídele a tu entrenador una nueva.`,
    'Si no esperabas este correo, ignóralo: nadie podrá entrar sin crear la contraseña.',
    '',
    `Privacidad y seguridad: ${input.privacyUrl}`,
  ].join('\n');

  return { subject, html, text };
}
