# Runbook — Correo con Brevo y PWA

Ñeque envía la invitación del alumno por correo y la app se instala como PWA
(«Agregar a inicio»): no está en App Store ni en Play Store. Este runbook deja
funcionando el envío y el acceso web. Son pasos manuales en Brevo, Vercel y
Supabase.

> Ninguna clave se pega en chats, tickets ni commits. Si aparece en un lugar
> así, se trata como comprometida y se rota.

## Por qué Brevo

- No hay dominio propio. Resend sin dominio verificado solo envía a la cuenta
  dueña, y el SMTP por defecto de Supabase solo entrega a los miembros del
  proyecto.
- Brevo acepta como remitente un Gmail verificado y entrega a **cualquier
  destinatario**. Plan gratuito: **300 correos al día**.
- Riesgo: un remitente `@gmail.com` enviado desde Brevo cae a spam más que uno
  con dominio propio. Al tener dominio, verificarlo en Brevo (SPF y DKIM) y
  cambiar `MAIL_FROM`.

## 1. Cuenta y remitente

1. Crear la cuenta en [brevo.com](https://www.brevo.com).
2. _Senders, Domains & Dedicated IPs_ → _Senders_ → **Add a sender** con el
   Gmail que firmará los correos. Confirmar el código que llega a ese Gmail.
3. _SMTP & API_ → _API Keys_ → **Generate a new API key** (nombre sugerido
   `neque-bff`). Copiarla; solo se muestra una vez.
4. En la misma pantalla, pestaña _SMTP_: anotar el **login** y generar una
   **clave SMTP** (sirven para el paso 3).

## 2. Variables del BFF

En Vercel → _Settings_ → _Environment Variables_, en **Production** y
**Preview** (marcadas como _Sensitive_):

| Variable           | Valor                                              |
| ------------------ | -------------------------------------------------- |
| `BREVO_API_KEY`    | La API key del paso 1.3                            |
| `MAIL_FROM`        | El Gmail verificado como remitente                 |
| `MAIL_FROM_NAME`   | `Ñeque` (opcional; es el valor por defecto)        |
| `PUBLIC_APP_URL`   | `https://neque-ten.vercel.app` (opcional, defecto) |
| `NEQUE_WEB_ACCESS` | `mobile`: los navegadores móviles usan la app      |

En local, las mismas en `.env.local`. Redesplegar después de cambiarlas.

Sin `BREVO_API_KEY` o sin `MAIL_FROM` la invitación se emite igual: el
entrenador no ve aviso de correo y comparte el enlace o el QR.

## 3. Recuperar contraseña con el mismo remitente

El código de recuperación lo envía Supabase Auth. Con su SMTP por defecto no
llega a los alumnos, así que se configura el SMTP de Brevo:

1. Supabase → _Authentication_ → _Emails_ → _SMTP Settings_ → **Enable custom
   SMTP**.
2. Host `smtp-relay.brevo.com`, puerto `587`, usuario = login SMTP de Brevo,
   contraseña = clave SMTP, remitente = el mismo `MAIL_FROM`, nombre `Ñeque`.
3. _Authentication_ → _Emails_ → _Templates_ → **Reset Password**: asunto
   «Tu código para recuperar la contraseña de Ñeque» y como cuerpo la
   plantilla de abajo.
4. Probar: «¿Olvidaste tu contraseña?» con un correo de alumno de prueba.

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table
        role="presentation"
        width="100%"
        cellpadding="0"
        cellspacing="0"
        style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dfe5e3;font-family:Inter,Arial,Helvetica,sans-serif;"
      >
        <tr>
          <td style="background:#0f766e;padding:22px 20px;color:#ffffff;">
            <div style="font-size:13px;font-weight:600;">Ñeque</div>
            <div style="font-size:20px;font-weight:600;padding-top:10px;">
              Recupera tu contraseña
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px;font-size:14px;line-height:1.6;color:#3e4a48;">
            <p style="margin:0 0 12px;">
              Ingresa este código en la app para crear una contraseña nueva:
            </p>
            <p
              style="margin:0 0 16px;font-size:28px;font-weight:700;letter-spacing:6px;color:#0f766e;"
            >
              {{ .Token }}
            </p>
            <p style="margin:0;font-size:12px;color:#6b7674;">
              Si no lo pediste, ignora este correo: tu contraseña no cambia.
            </p>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e6ebea;padding:12px 20px;font-size:11px;color:#6b7674;">
            Ñeque · App por invitación · Ley 21.719 · Ley 21.663 · ISO/IEC 27001
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

## 4. Instalar la PWA (lo que hace el alumno)

1. Abre el correo en el teléfono y toca **Crear mi acceso**.
2. Crea su contraseña y entra.
3. **iPhone (Safari):** Compartir → Agregar a inicio. Abre Ñeque desde el
   ícono e ingresa con su correo y contraseña (la app instalada no comparte
   sesión con Safari).
   **Android (Chrome):** el aviso del Inicio ofrece **Instalar Ñeque**, o
   menú ⋮ → Instalar app.

La app instalada funciona sin conexión para ver la rutina y entrenar; lo
registrado se envía solo al volver la red.

## Comprobar

- Crear un alumno de prueba con un correo propio: el panel dice «Le enviamos
  la invitación a …» y el correo llega con el botón **Crear mi acceso**.
- Reemitir: llega un correo nuevo y el enlace anterior deja de servir.
- En Brevo → _Transactional_ → _Logs_ se ve cada envío y si rebotó.
