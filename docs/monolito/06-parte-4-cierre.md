# Parte 4 — Cierre de la app (2026-11-03)

**Punto de partida verificado:** producción en `https://neque-ten.vercel.app` desde
`develop`, conectada a Supabase (`uzonvxbfpiykytcrudif`, São Paulo). La prueba de punta
a punta contra producción pasó **68/68**: login, refresh, alta de alumno, invitación,
aislamiento entre entrenadores, anamnesis, evaluaciones, rutinas, sesiones generadas
desde la rutina, carga real, alertas, fotos con Storage, avatar, suspensión, bloqueo
por intentos y logout. CORS listo para iOS y Android.

**Qué no funciona todavía:** la recuperación de contraseña (falta SMTP, sección A) y la
agenda (nadie puede crear citas, sección B.1).

| Bloque                                            | Quién  | Tiempo    |
| ------------------------------------------------- | ------ | --------- |
| A. Correo con Resend (recuperación de contraseña) | Tú     | 30–60 min |
| B. Desarrollo pendiente                           | Yo     | 6–8 días  |
| C. Cierre y entrega                               | Juntos | 1–2 días  |

---

## A. Correo con Resend (para "Olvidé mi contraseña")

Supabase no deja editar las plantillas de correo sin un SMTP propio, y la plantilla por
defecto envía un **enlace**, mientras que la app pide un **código de 6 dígitos**. Con
Resend se resuelven las dos cosas.

### A.1 Crear la cuenta en Resend

1. Entra a **https://resend.com** → **Sign up** (con GitHub o correo).
2. Confirma tu correo.

### A.2 Elegir el remitente

| Opción          | Remitente               | A quién le llega                                          | Cuándo usarla                                     |
| --------------- | ----------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| **Sin dominio** | `onboarding@resend.dev` | **Solo** al correo con el que creaste la cuenta de Resend | Para probar hoy con tu propia cuenta              |
| **Con dominio** | `no-reply@tudominio.cl` | A cualquiera                                              | Antes de que entren entrenadores y alumnos reales |

Puedes empezar sin dominio y cambiar después; solo hay que repetir A.4 con el nuevo
remitente.

### A.3 (Solo con dominio) Verificar el dominio

1. En Resend: **Domains** → **Add Domain** → escribe tu dominio (por ejemplo `neque.cl`).
   - **Region:** `South America (São Paulo)` si aparece; si no, `US East`.
2. Resend te muestra 3–4 registros DNS (tipo **MX**, **TXT** para SPF y **TXT** para DKIM,
   a veces uno para DMARC).
3. En el panel donde compraste el dominio (NIC Chile, Cloudflare, GoDaddy…) → **DNS** →
   agrega cada registro **exactamente** como lo muestra Resend (nombre, tipo y valor).
4. Vuelve a Resend → **Verify DNS Records**. Puede tardar de minutos a unas horas; espera
   a que el dominio quede en **Verified**.

### A.4 Crear la API key

1. En Resend: **API Keys** → **Create API Key**.
2. **Name:** `supabase-neque` · **Permission:** **Sending access** · **Domain:** tu
   dominio (o _All domains_ si usas `onboarding@resend.dev`).
3. Copia la clave (`re_…`). **Solo se muestra una vez.** No la pegues en el chat.

### A.5 Conectar Resend en Supabase

1. Supabase → **Authentication** → **Emails** → botón **Set up SMTP** (o pestaña
   **SMTP Settings**) → activa **Enable Custom SMTP**.
2. Completa:

   | Campo                           | Valor                                             |
   | ------------------------------- | ------------------------------------------------- |
   | Sender email                    | `onboarding@resend.dev` o `no-reply@tudominio.cl` |
   | Sender name                     | `Ñeque`                                           |
   | Host                            | `smtp.resend.com`                                 |
   | Port                            | `465`                                             |
   | Username                        | `resend`                                          |
   | Password                        | la API key `re_…`                                 |
   | Minimum interval between emails | `60` segundos                                     |

3. **Save**.

### A.6 Plantilla del código

1. Supabase → **Authentication** → **Emails** → **Templates** → **Reset password**.
   Ahora sí deja editar.
2. **Subject:** `Tu código para recuperar la contraseña de Ñeque`
3. **Body** (pestaña **Source**):
   ```html
   <h2>Recupera tu contraseña</h2>
   <p>Ingresa este código en la app de Ñeque:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Vence en 10 minutos. Si no lo pediste, ignora este correo.</p>
   ```
4. **Save changes**.

### A.7 Vencimiento y límites

1. **Authentication** → **Sign In / Providers** → **Email** → **Email OTP Expiration**:
   `600` → **Save**.
2. **Authentication** → **Rate Limits** → **Rate limit for sending emails**: `30` por hora
   (con SMTP propio ya no aplica el tope de 2 del servidor por defecto) → **Save**.

### A.8 Probar

1. Abre `https://neque-ten.vercel.app` → **¿Olvidaste tu contraseña?**
2. Escribe tu correo (si usas `onboarding@resend.dev`, el mismo de tu cuenta de Resend).
3. Debe llegar un correo con un código de 6 dígitos (revisa spam la primera vez).
4. Ingresa el código, define una contraseña nueva y la app debe dejarte dentro.

| Si pasa esto                            | Revisa                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| No llega nada                           | Resend → **Emails**: si el envío figura como _bounced_ o _failed_, el remitente o el dominio no están verificados |
| Llega un **enlace** en vez de un código | La plantilla de A.6 no se guardó                                                                                  |
| "El código no es válido"                | Que no hayan pasado 10 minutos y que sea el último código pedido                                                  |

---

## B. Desarrollo pendiente (yo)

Orden pensado para que cada día deje algo usable en la IPA.

### B.1 Agenda: el entrenador agenda y cancela citas — **día 1**

Hoy la agenda del alumno funciona, pero nadie puede crear citas.

- **Dominio:** `SchedulePort.create(input)` y `SchedulePort.listByTrainer(range)`.
- **BFF:** `POST /students/:id/schedule` (solo el entrenador del alumno) y
  `GET /trainers/me/schedule?from&to`. Al crear: notificación al alumno.
- **UI entrenador:** sección «Próximas citas» en la ficha del alumno, con «Agendar»
  (título, tipo, fecha, hora de inicio y fin, lugar) y «Cancelar» con la hoja de motivo
  que ya usa el alumno.
- **Hecho cuando:** el entrenador agenda una cita, el alumno la ve en su agenda, la
  confirma, y si el entrenador la cancela el alumno recibe la notificación.

### B.2 Inicio del entrenador en una sola petición — **día 2**

Hoy el Inicio hace ~4 peticiones por alumno activo: con 10 alumnos son ~40.

- **BFF:** `GET /trainers/me/dashboard` con alumnos activos, sesiones de las últimas
  semanas, rutina activa, anamnesis y última evaluación de cada uno.
- **Front:** puerto `TRAINER_DASHBOARD_PORT`; `TrainerHomeFacade` y
  `TrainerProfileFacade` lo usan.
- **Hecho cuando:** el Inicio y el Perfil cargan con 1 petición, sin cambios visibles.

### B.3 Progresión de carga en la ficha — **día 3**

Criterio CA4 del PRD: el entrenador ve lo que el alumno levantó.

- **Dominio:** `loadProgression(sessions, exerciseId)` (función pura).
- **UI:** sección «Progresión» en la ficha: selector de ejercicio, gráfico de carga
  máxima y las últimas 5 sesiones (series reales frente a las prescritas).
- **Hecho cuando:** el alumno registra 62,5 kg en lugar de 60 kg y la ficha lo muestra.

### B.4 Notas privadas y límite gratuito — **día 4**

- **Notas privadas:** migración `trainer_notes`, endpoints CRUD solo para el entrenador,
  sección «Notas privadas — solo tú las ves» en la ficha.
- **Límite de 3 alumnos activos** (plan `free`): el BFF lo valida al dar de alta y al
  reactivar. La cartera muestra «2 de 3 alumnos activos» y explica el límite.
- **Hecho cuando:** un entrenador con 3 activos no puede dar de alta ni reactivar, y al
  suspender uno vuelve a poder.

### B.5 Pruebas de API en el repo — **día 4**

La prueba 68/68 de hoy pasa a ser un script del repo (`npm run test:api`) que corre
contra una URL y limpia sus datos. Se ejecuta antes de cada IPA.

### B.6 Android — **día 5**

- `npx cap add android`, ícono y splash, permisos de cámara y notificaciones.
- Workflow de GitHub que genera el APK, igual que el de la IPA.
- **Hecho cuando:** el APK se instala en un Android y el login funciona contra producción.

### B.7 Cámara y notificaciones push — **días 6–7**

- **Cámara:** `@capacitor/camera` en nativo (cámara o galería); en web sigue el selector
  de archivos.
- **Push:** registro del token del dispositivo (`device_tokens` ya existe en la base),
  envío desde el BFF en los eventos que hoy generan notificaciones (rutina nueva, cita,
  sesión completada, alerta por dolor). Requiere proyecto de Firebase (Android) y clave
  APNs (iOS, necesita cuenta de Apple Developer).
- **Hecho cuando:** un push de prueba abre la pantalla correcta en el teléfono.

### B.8 Entrenar sin conexión — **solo si sobra tiempo**

La sesión del día se guarda en el teléfono y las series se sincronizan al volver la
señal. Es lo primero que se recorta si el plazo aprieta.

---

## C. Cierre y entrega

| #   | Tarea                                                                                                                                                                     | Quién   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| C.1 | Rotar la clave secreta de Supabase: **Project Settings** → **API Keys** → nueva secret key → actualizarla en `.env.local` y en Vercel → **Redeploy** → borrar la anterior | Tú      |
| C.2 | Cambiar tu contraseña de entrenador desde **Perfil** → **Cambiar contraseña**                                                                                             | Tú      |
| C.3 | Dominio propio para los enlaces de invitación y el QR (opcional; si se hace, actualizar `publicAppUrl` en `src/environments/`)                                            | Tú + yo |
| C.4 | QA completo en iPhone y Android con 1 entrenador y 2 alumnos reales                                                                                                       | Juntos  |
| C.5 | Alta de los 2 entrenadores del piloto con `npm run create:trainer`                                                                                                        | Tú      |
| C.6 | Release `v1.0.0`                                                                                                                                                          | Tú      |

### Cómo generar cada IPA/APK nueva

1. Haz commit y push a `develop`.
2. Espera a que Vercel quede en **Ready** y revisa `https://neque-ten.vercel.app/api/v1/health`.
3. GitHub → **Actions** → workflow de la IPA (o del APK) → **Run workflow** → `develop`.
