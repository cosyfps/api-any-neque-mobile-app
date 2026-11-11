import { escapeHtml, formatExpiry, invitationEmail } from './invitation-email';

const INPUT = {
  studentName: 'Alejandra Acosta',
  trainerName: 'Benjamín Soto',
  link: 'https://neque-ten.vercel.app/i/Xk9fQ2',
  // 21:30 UTC = 18:30 en Chile (verano, UTC-3).
  expiresAt: '2026-11-12T21:30:00.000Z',
  privacyUrl: 'https://neque-ten.vercel.app/privacidad',
};

describe('invitationEmail', () => {
  it('arma el asunto con el nombre del entrenador', () => {
    expect(invitationEmail(INPUT).subject).toBe('Benjamín Soto te invitó a entrenar en Ñeque');
  });

  it('saluda por el primer nombre e incluye boton, respaldo y pie legal', () => {
    const { html } = invitationEmail(INPUT);

    expect(html).toContain('Hola, Alejandra');
    expect(html).toContain('Crear mi acceso');
    expect(html.match(/href="https:\/\/neque-ten\.vercel\.app\/i\/Xk9fQ2"/g)).toHaveLength(2);
    expect(html).toContain('href="https://neque-ten.vercel.app/privacidad"');
    expect(html).toContain('Ley 21.719 · Ley 21.663 · ISO/IEC 27001');
    expect(html).toContain('Agrega Ñeque a tu inicio');
  });

  it('mantiene los colores de marca en el modo oscuro del celular', () => {
    const { html } = invitationEmail(INPUT);

    expect(html).toContain('<meta name="color-scheme" content="light only" />');
    expect(html).toContain('<body class="body"');
    // Gmail invierte background-color pero no la imagen de fondo.
    expect(html).toContain('background-image:linear-gradient(#0f766e,#0f766e)');
    // Texto blanco del banner y del boton protegido por las capas de mezcla.
    expect(html.match(/class="gmail-screen"><div class="gmail-difference">/g)).toHaveLength(2);
    expect(html).toContain('u + .body .gmail-difference');
  });

  it('muestra el vencimiento en hora de Chile y 24 h', () => {
    const { html, text } = invitationEmail(INPUT);

    expect(html).toContain('jueves 12 de noviembre a las 18:30');
    expect(text).toContain('Vence el jueves 12 de noviembre a las 18:30');
  });

  it('escapa los nombres que escribe el entrenador', () => {
    const { html } = invitationEmail({
      ...INPUT,
      studentName: '<script>x</script>',
      trainerName: 'Ana "La" O\'Neil & Cía',
    });

    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('Ana &quot;La&quot; O&#39;Neil &amp; Cía');
  });

  it('trae una version en texto plano con el enlace', () => {
    const { text } = invitationEmail(INPUT);

    expect(text).toContain('Hola, Alejandra:');
    expect(text).toContain('Crea tu acceso aquí: https://neque-ten.vercel.app/i/Xk9fQ2');
    expect(text).toContain('3. Agrega Ñeque a tu inicio.');
    expect(text).not.toContain('<');
  });
});

describe('utilidades del correo', () => {
  it('escapeHtml neutraliza los caracteres especiales', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('formatExpiry respeta el horario de invierno de Chile', () => {
    // 22:00 UTC = 18:00 en Chile (invierno, UTC-4).
    expect(formatExpiry('2026-07-01T22:00:00.000Z')).toBe('miércoles 1 de julio a las 18:00');
  });
});
