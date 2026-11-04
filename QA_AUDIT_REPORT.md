# QA_AUDIT_REPORT — Ñeque (rama `develop`)

Auditoría integral QA + UX/UI de la app (Angular 17 + Capacitor) y del BFF
(Hono + Supabase). Fecha: 2026-11-03.

## Alcance y método

- **Vistas auditadas:** inicio/login, recuperación de contraseña (3 pasos),
  invitación, 404, entrenador (inicio, alumnos, detalle de alumno, rutinas,
  constructor de rutina, asignación, ejercicios, perfil, notificaciones) y
  alumno (inicio, rutina, runner, progreso/fotos, agenda, perfil,
  notificaciones).
- **Formularios revisados (14):** login, recuperación (correo, OTP,
  contraseña nueva), invitación, cambio de contraseña, edición de perfil
  (alumno y entrenador), alta/edición de alumno, anamnesis, evaluación
  física, ejercicio, constructor de rutina (cabecera, días, prescripciones),
  asignación de rutina, stepper del runner, buscador de alumnos.
- **Método:** lectura de cada vista y formulario contra los esquemas zod del
  BFF (`server/http/app.ts`), revisión del interceptor HTTP y del mapeo de
  errores, sonda del BFF sin base de datos, pruebas en navegador de las
  vistas públicas (320×568, 375×812, 768×1024 y el ancho del panel) y la
  suite de tests.
- **Segunda pasada en vivo (2026-11-03):** con el BFF local conectado a
  Supabase y sesión de entrenador, se recorrieron a 375×812 inicio, alumnos,
  detalle de alumno, rutinas, perfil y notificaciones; se creó el alumno
  Benjamin Hidalgo con su invitación y se repitieron en vivo QA-01, QA-02,
  QA-03, QA-04, QA-05 y QA-09 (los formularios inválidos se cancelaron sin
  guardar).
- **Limitación:** las vistas del alumno siguen auditadas por código y tests:
  Benjamin aún no fija su contraseña desde la invitación.

## Estados

- **Validado:** corregido y comprobado con un test que reproduce el caso y,
  cuando la vista es pública, también en el navegador.
- **Corregido, pendiente de validación:** el cambio está hecho y probado en
  local, pero falta comprobarlo donde importa (producción desplegada o un
  dispositivo). No se declara resuelto hasta entonces.
- **Descartado:** al verificarlo resultó ser comportamiento intencional.
- **Pendiente:** no se corrigió; el motivo está en la fila.

## Hallazgos

| ID    | Vista                                                                                 | Categoría     | Descripción                                                                                                                                                                                                                                                                                                                              | Pasos para reproducir                                                              | Resultado actual (antes)                                                                                       | Resultado esperado                                           | Severidad | Prioridad | Solución aplicada                                                                                                                                                                                      | Estado                                                                       |
| ----- | ------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| QA-01 | Entrenador › Constructor de rutina                                                    | Validación    | Un día sin título se enviaba; el BFF exige `title` no vacío.                                                                                                                                                                                                                                                                             | Crear rutina › Agregar día › agregar ejercicio › Guardar sin título.               | 400 «Dato inválido: days.0.title»; la rutina no se guardaba. La UI mostraba «Sin título» como si fuera válido. | Error claro antes de enviar.                                 | Alta      | 1         | `validationError` exige título (sin solo espacios): «Cada día necesita un título.»                                                                                                                     | Validado (test)                                                              |
| QA-02 | Entrenador › Constructor de rutina                                                    | Validación    | Series, reps, descanso y kg aceptaban 0, decimales y valores enormes; los `min`/`max` del input no se aplicaban.                                                                                                                                                                                                                         | Escribir `0` o `2.6` series, `5000` reps o kg.                                     | 400 genérico del BFF o datos absurdos.                                                                         | Valor ajustado al rango del campo, entero donde corresponde. | Alta      | 2         | `setPrescription` acota y redondea (series 1–20, reps 1–100, descanso 0–600, kg 0–1000) y reescribe el input con el límite.                                                                            | Validado (test)                                                              |
| QA-03 | Entrenador › Constructor de rutina                                                    | Validación    | Minutos estimados aceptaban decimales y más de 600 (el input declara 10–180).                                                                                                                                                                                                                                                            | Escribir `1000` o `45.5`.                                                          | 400 del BFF.                                                                                                   | Entero entre 10 y 180.                                       | Alta      | 3         | `setMinutes` acota y redondea, y se aplica en `change` para no saltar a 10 mientras se escribe.                                                                                                        | Validado (test)                                                              |
| QA-04 | Entrenador › Alta de alumno                                                           | Funcional     | Un correo con espacio final (autocompletado iOS) dejaba «Crear» deshabilitado sin ningún mensaje: la normalización solo ocurría en `onSubmit`, que no podía dispararse.                                                                                                                                                                  | Escribir `ana@mail.cl ` (con espacio).                                             | Botón deshabilitado, sin error visible.                                                                        | Recortar y mostrar el error junto al campo.                  | Alta      | 4         | El correo se recorta y pasa a minúscula al salir del campo; el botón queda habilitado y los errores aparecen por campo (mismo patrón que login, anamnesis y evaluación).                               | Validado (test)                                                              |
| QA-05 | Entrenador › Alta/edición de alumno                                                   | Validación    | Nombre o apellido con solo espacios pasaban `required`; sin errores inline.                                                                                                                                                                                                                                                              | `"   "` en nombre y guardar.                                                       | 400 «Dato inválido: firstName».                                                                                | «Escribe el nombre.» junto al campo.                         | Alta      | 5         | Validador compartido `notBlank` y errores por campo con `aria-describedby`.                                                                                                                            | Validado (test)                                                              |
| QA-06 | Entrenador › Alta/edición de alumno                                                   | Validación    | Estatura sin validar (negativos, 0, 9999).                                                                                                                                                                                                                                                                                               | `-170` o `9999` y guardar.                                                         | 400 del BFF o dato inválido.                                                                                   | 100–250 cm con mensaje.                                      | Media     | 6         | `Validators.min/max` y error inline; se redondea a entero.                                                                                                                                             | Validado (test)                                                              |
| QA-07 | Entrenador › Alta/edición de alumno                                                   | Validación    | Nacimiento aceptaba fechas futuras o años absurdos.                                                                                                                                                                                                                                                                                      | Elegir 2030-01-01.                                                                 | Se guardaba una fecha imposible.                                                                               | No futura y desde 1900.                                      | Media     | 7         | Validador `dateBetween` con el reloj del dominio (`CLOCK`) y `min`/`max` en el input.                                                                                                                  | Validado (test)                                                              |
| QA-08 | Entrenador › Alta/edición de alumno, Anamnesis, Perfiles                              | Validación    | El teléfono del alumno y del contacto de urgencia aceptaba letras; el patrón del perfil estaba duplicado en dos páginas.                                                                                                                                                                                                                 | `abc` como teléfono.                                                               | Se guardaba texto arbitrario.                                                                                  | Patrón del perfil (`+`, dígitos, espacios, 8–16).            | Media     | 8         | `PHONE_PATTERN` en `@shared/validators/field-rules`, usado por los 4 formularios.                                                                                                                      | Validado (test)                                                              |
| QA-09 | Entrenador › Evaluación física                                                        | Validación    | Ningún número validaba rango; el único mensaje decía «Peso y estatura son obligatorios» aunque el problema fuera el rango.                                                                                                                                                                                                               | Peso `-5` y Registrar.                                                             | 400 «Dato inválido: weightKg» o mensaje equivocado.                                                            | Rango por campo con su mensaje.                              | Alta      | 9         | Rangos por campo («Entre 20 y 300 kg.») dentro de los del BFF; el aviso de obligatorios solo sale si falta peso o estatura.                                                                            | Validado (test)                                                              |
| QA-10 | Entrenador › Anamnesis                                                                | Validación    | Objetivo con solo espacios pasaba; sin `maxlength` (el BFF limita contacto a 120/30/60 y textos a 2000).                                                                                                                                                                                                                                 | Objetivo `"  "`, o contacto de 200 caracteres.                                     | 400 del BFF.                                                                                                   | Error inline; el input no deja pasar el máximo.              | Media     | 10        | `notBlank`, `maxlength` en todos los campos y patrón de teléfono en el contacto.                                                                                                                       | Validado (test)                                                              |
| QA-11 | Entrenador › Nuevo ejercicio                                                          | Validación    | Nombre con solo espacios pasaba; instrucciones sin límite (BFF: 20 pasos de 500 caracteres).                                                                                                                                                                                                                                             | Nombre `"  "`, o 21 líneas.                                                        | 400 del BFF.                                                                                                   | Error claro antes de enviar.                                 | Media     | 11        | `notBlank` y validación de pasos con mensaje.                                                                                                                                                          | Validado (test)                                                              |
| QA-12 | Entrenador › Constructor de rutina                                                    | Validación    | Nombre y objetivo de la rutina con solo espacios pasaban `required`.                                                                                                                                                                                                                                                                     | Nombre `"   "` y guardar.                                                          | 400 «Dato inválido: name».                                                                                     | «Completa nombre y objetivo.»                                | Media     | 12        | `notBlank` y `maxlength` en los inputs.                                                                                                                                                                | Validado (test)                                                              |
| QA-13 | BFF › `create:trainer` / Login                                                        | Funcional     | El script de alta de entrenador aceptaba cualquier contraseña, pero el login exige las 4 reglas: el entrenador quedaba creado y sin poder ingresar.                                                                                                                                                                                      | `TRAINER_PASSWORD=secreto123 npm run create:trainer -- …`                          | Login bloqueado por reglas del cliente.                                                                        | El script rechaza la contraseña antes de crear nada.         | Alta      | 13        | El script valida con `isPasswordValid` (la misma función del cliente).                                                                                                                                 | Validado (typecheck; sin Supabase no se ejecutó contra la base)              |
| QA-14 | Global › Sesión                                                                       | Funcional     | Si el refresh del token fallaba por red o 5xx, **o si fallaba el reintento** de la petición original, el interceptor borraba la sesión y recargaba.                                                                                                                                                                                      | Token vencido + modo avión + cualquier acción.                                     | Usuario deslogueado por un corte de conexión.                                                                  | Solo un refresh rechazado (400/401) cierra la sesión.        | Alta      | 14        | `refreshAndRetry` distingue el rechazo del resto de errores y ya no captura los errores del reintento.                                                                                                 | Validado (test)                                                              |
| QA-15 | Global › Errores HTTP                                                                 | UX            | Respuestas sin el sobre del BFF (proxy, CDN, función caída) se mostraban como «Algo salió mal»; 403/404/429 sin `code` también.                                                                                                                                                                                                          | `ng serve` sin `dev:api` y enviar el login.                                        | «Algo salió mal. Intenta de nuevo.»                                                                            | «El servicio no está disponible…» y mensajes por estado.     | Media     | 15        | `toDomainError`: sobre del BFF primero; sin sobre, 5xx → servicio no disponible y 400/401/403/404/409/429 → su código.                                                                                 | Validado (test + navegador)                                                  |
| QA-16 | Recuperar contraseña › Correo                                                         | Validación    | El patrón rechazaba el espacio final de iOS (el login lo tolera); el correo no se recortaba ni pasaba a minúscula.                                                                                                                                                                                                                       | `QA.Prueba@Ejemplo.com `                                                           | Botón deshabilitado / correo con mayúsculas.                                                                   | Igual que el login.                                          | Media     | 16        | Patrón tolerante, recorte en `blur`, minúscula al enviar, `maxlength`.                                                                                                                                 | Validado (test + navegador)                                                  |
| QA-17 | Recuperar contraseña › Paso 3                                                         | Funcional     | «Volver» desde el paso 3 regresaba a un código ya consumido con el contador de reenvío detenido: sin salida.                                                                                                                                                                                                                             | Verificar código › Volver.                                                         | Código usado en pantalla; «Reenviar» nunca aparecía.                                                           | Código limpio y reenvío disponible.                          | Media     | 17        | `backToOtp` limpia el código y el ticket y habilita el reenvío.                                                                                                                                        | Validado (test)                                                              |
| QA-18 | Recuperar contraseña                                                                  | Accesibilidad | Los pasos inactivos (fuera de pantalla) seguían en el orden de tabulación.                                                                                                                                                                                                                                                               | En el paso 1, tabular.                                                             | El foco llegaba a botones invisibles.                                                                          | Solo el paso activo es enfocable.                            | Media     | 18        | `inert` en los pasos inactivos, como el panel de login.                                                                                                                                                | Validado (navegador)                                                         |
| QA-19 | Recuperar contraseña › OTP                                                            | UX            | Las celdas no declaraban `autocomplete="one-time-code"`.                                                                                                                                                                                                                                                                                 | Recibir el código en iOS.                                                          | El teclado no sugería el código.                                                                               | Sugerencia del sistema.                                      | Baja      | 19        | Atributo en la primera celda (el pegado ya reparte los dígitos).                                                                                                                                       | Validado (inspección del DOM; la sugerencia requiere un iPhone)              |
| QA-20 | Recuperar contraseña › Correo                                                         | UX            | El error del backend quedaba visible tras corregir el correo.                                                                                                                                                                                                                                                                            | Provocar error › editar el correo.                                                 | Error obsoleto.                                                                                                | Se limpia al editar.                                         | Baja      | 20        | `requestError` se limpia en `valueChanges`.                                                                                                                                                            | Validado (test + navegador)                                                  |
| QA-21 | Entrenador › Asignar rutina                                                           | Funcional     | Las fechas viajaban como medianoche local pasada a UTC y el BFF recorta 10 caracteres: en husos UTC+ el inicio quedaba un día antes. El fin no tenía `min`.                                                                                                                                                                              | Navegador en UTC+1, asignar desde 2026-11-10.                                      | Se guardaba 2026-11-09.                                                                                        | Se guarda el día elegido.                                    | Media     | 21        | Se envía `yyyy-MM-dd` (el BFF ya lo acepta) y el fin lleva `[min]` = inicio.                                                                                                                           | Validado (test)                                                              |
| QA-22 | Alumno › Runner (stepper de tiempo)                                                   | UX            | Se reportó que el stepper de duración no aceptaba escribir `1:30`.                                                                                                                                                                                                                                                                       | —                                                                                  | —                                                                                                              | —                                                            | Baja      | 22        | Al verificarlo: el campo de tiempo es `readOnly` a propósito (lo fija un test) y se ajusta con los botones. Se revirtió el cambio.                                                                     | Descartado                                                                   |
| QA-23 | Perfil › Cambiar contraseña                                                           | Accesibilidad | Los errores de cada campo no estaban asociados con `aria-describedby`.                                                                                                                                                                                                                                                                   | Lector de pantalla en un campo con error.                                          | El error no se anunciaba con el campo.                                                                         | Error asociado al campo.                                     | Baja      | 23        | Ids por error y `aria-describedby` en los tres campos.                                                                                                                                                 | Validado (test de componente existente + lint)                               |
| QA-24 | BFF › `parseBody`                                                                     | QA            | El comentario decía que los campos desconocidos se rechazan; zod los descarta en silencio.                                                                                                                                                                                                                                               | Leer `server/http/context.ts`.                                                     | Documentación engañosa.                                                                                        | Comentario fiel.                                             | Baja      | 24        | Comentario corregido, sin cambiar el comportamiento.                                                                                                                                                   | Validado                                                                     |
| QA-25 | Entrenador › Editar alumno                                                            | Funcional     | El BFF entrega el nacimiento como ISO con hora y el input `type=date` solo muestra `yyyy-MM-dd`: al editar, la fecha aparecía vacía.                                                                                                                                                                                                     | Editar un alumno con nacimiento.                                                   | Campo «Nacimiento» vacío.                                                                                      | Fecha precargada.                                            | Media     | 25        | `reset()` recorta a `yyyy-MM-dd`.                                                                                                                                                                      | Validado (test)                                                              |
| QA-26 | Invitación                                                                            | UX            | Con la red o el servicio caídos, la pantalla decía «Invitación no válida» y no ofrecía reintentar: el alumno daba el enlace por perdido.                                                                                                                                                                                                 | Abrir `/i/<token>` sin conexión.                                                   | «Invitación no válida», sin reintento.                                                                         | «No pudimos cargar la invitación» + Reintentar.              | Media     | 26        | `InvitationFacade.linkRejected` separa el rechazo del enlace del fallo de carga; la página muestra título y reintento según el caso.                                                                   | Validado (test + navegador)                                                  |
| QA-27 | 404                                                                                   | Accesibilidad | La página 404 no tenía ningún encabezado.                                                                                                                                                                                                                                                                                                | Abrir una ruta inexistente con lector de pantalla.                                 | Sin `h1`.                                                                                                      | Título como `h1`.                                            | Baja      | 27        | El título es `h1` (sin cambio visual: `.nq-state-title` sin margen).                                                                                                                                   | Validado (navegador)                                                         |
| QA-28 | BFF › Contraseña nueva                                                                | Validación    | El BFF solo exigía 8 caracteres en invitación, recuperación y cambio de contraseña; las 4 reglas vivían solo en el cliente.                                                                                                                                                                                                              | `POST /auth/password-reset/complete` con `secreto123`.                             | Se aceptaba.                                                                                                   | 400.                                                         | Media     | 28        | El esquema `password` del BFF aplica `isPasswordValid`. El login no cambia (solo `min(1)`).                                                                                                            | Validado (sonda del BFF: 400 en reset e invitación)                          |
| QA-29 | Entrenador › Formularios (alumno, anamnesis, evaluación, ejercicio)                   | UX            | Los mensajes de error eran `computed` sobre el estado del formulario, que no es una señal: tras el primer intento quedaban fijos aunque el usuario corrigiera el campo.                                                                                                                                                                  | Guardar con error › corregir el campo.                                             | El error seguía visible hasta reintentar.                                                                      | El error desaparece al corregir.                             | Media     | 29        | Los valores del formulario se leen como señal (`toSignal(valueChanges)`), igual que el formulario de cambio de contraseña.                                                                             | Validado (test)                                                              |
| QA-30 | Estados de error compartidos (`nq-page-state`)                                        | Accesibilidad | El título de los estados de error/vacío es un `span`, no un encabezado.                                                                                                                                                                                                                                                                  | Lector de pantalla en un estado de error.                                          | Sin encabezado.                                                                                                | Encabezado con el nivel que corresponda a cada página.       | Baja      | 30        | El título usa role="heading" con aria-level configurable (headingLevel, 2 por defecto) en error, vacío y sin conexión.                                                                                 | Corregido                                                                    |
| QA-31 | Build                                                                                 | QA            | `qrcode` y `dijkstrajs` no son ESM y el build lo advierte.                                                                                                                                                                                                                                                                               | `npm run build:prod`.                                                              | 2 avisos.                                                                                                      | Sin avisos.                                                  | Baja      | 31        | allowedCommonJsDependencies con qrcode y dijkstrajs en angular.json: el build ya no avisa.                                                                                                             | Corregido                                                                    |
| QA-32 | Tests (`invitation-panel`, `profile-hero`)                                            | QA            | Dos tests ajenos a esta auditoría fallan de forma intermitente con la suite completa bajo carga (`--coverage`): la lectura de la foto espera un `FileReader` con un `setTimeout` fijo de 20 ms y el QR depende del tiempo de generación.                                                                                                 | `npx jest --coverage` varias veces.                                                | Fallan a veces; aislados pasan 3/3.                                                                            | Tests deterministas.                                         | Baja      | 32        | El panel mockea qrcode, profile-hero espera la emisión de la foto y progress espera hasta 2 s; 3 corridas completas con coverage sin fallos.                                                           | Corregido                                                                    |
| QA-33 | Entrenador › Constructor de rutina                                                    | Funcional     | Los selectores de día y foco usaban `[value]` en el `<select>`, que se aplica antes de crear las opciones: mostraban la primera opción («Lunes», «Pecho») y no la del día. Un día nuevo nace con foco «Cuerpo completo» pero se veía «Pecho»; al editar una rutina, cada día aparecía como Lunes/Pecho. Hallado en el recorrido en vivo. | Crear rutina › Agregar día; o editar una rutina con días en otro día de la semana. | Selector con un valor distinto del guardado.                                                                   | El selector muestra el valor real del día.                   | Media     | 33        | `[selected]` por opción, el mismo patrón que ya usaba el selector de Carga.                                                                                                                            | Validado (test + navegador)                                                  |
| QA-34 | Alta/edición de alumno, Editar mis datos (alumno y entrenador), Constructor de rutina | UX            | Campos obligatorios sin marca visual: Nombre, Apellido y Correo del alumno, Nombre y Apellido de los perfiles y el Título del día. Evaluación, rutina y ejercicio sí usaban `*`.                                                                                                                                                         | Abrir cada formulario.                                                             | Obligatorio sin indicarlo; el usuario lo descubre al guardar.                                                  | Obligatorios marcados con `*`, como en el resto de la app.   | Baja      | 34        | Etiquetas con ` *`.                                                                                                                                                                                    | Validado (navegador)                                                         |
| QA-35 | Alumno › Progreso (foto), Perfiles (avatar)                                           | Validación    | El selector de fotos aceptaba `image/*` y la foto de progreso no validaba ni tipo ni tamaño; el BFF solo admite JPEG, PNG, WebP y HEIC.                                                                                                                                                                                                  | Subir un GIF o una foto de 9 MB.                                                   | 400 «Dato inválido: contentType» o subida pesada.                                                              | Rechazo inmediato con mensaje.                               | Media     | 35        | `imageFileError` e `IMAGE_ACCEPT` compartidos en `field-rules`, usados por los dos selectores.                                                                                                         | Validado (test)                                                              |
| QA-36 | BFF › Cancelar cita                                                                   | Validación    | La base exige nota cuando el motivo es «Otro» (`check` de `scheduled_sessions`), pero el esquema zod la aceptaba vacía.                                                                                                                                                                                                                  | `POST /schedule/:id/cancel` con `{ reason: 'other', note: null }`.                 | El error llegaba a Postgres y volvía genérico.                                                                 | 400 de validación antes de tocar la base.                    | Baja      | 36        | `refine` en el esquema. Hoy la UI no expone cancelar citas.                                                                                                                                            | Validado (BFF local en vivo)                                                 |
| QA-37 | Global › Indexación                                                                   | Privacidad    | Producción no tenía `X-Robots-Tag`, meta `robots` ni `robots.txt`; `/robots.txt` y `/sitemap.xml` devolvían la app con 200. Cualquier buscador podía indexarla.                                                                                                                                                                          | `curl -I https://neque-ten.vercel.app/`.                                           | Indexable.                                                                                                     | `noindex` en todas las respuestas.                           | Alta      | 37        | Cabecera `X-Robots-Tag: noindex, nofollow, noarchive` en todo el dominio (incluida la API), meta `robots` en `index.html` y `robots.txt` que permite el rastreo para que el buscador vea el `noindex`. | Corregido, pendiente de validar en producción                                |
| QA-38 | Global › Acceso web                                                                   | Privacidad    | La app completa (login, formularios, operaciones) se usaba desde cualquier navegador.                                                                                                                                                                                                                                                    | Abrir el dominio en Chrome de escritorio.                                          | App funcional en el navegador.                                                                                 | Pantalla informativa sin interacción.                        | Alta      | 38        | En la build web de producción todas las rutas cargan `MobileOnlyPage`: ningún módulo, formulario ni llamada a la API. La app nativa y `ng serve` mantienen las rutas completas.                        | Corregido, validado en la build local de producción; pendiente en producción |
| QA-39 | Invitación › Enlace                                                                   | Funcional     | El enlace de invitación abría la app web en el navegador; la app instalada no sabía recibir enlaces.                                                                                                                                                                                                                                     | Abrir `/i/<token>` en el teléfono.                                                 | Formulario web.                                                                                                | Ofrecer abrir la app instalada.                              | Alta      | 39        | Botón «Abrir en la app» con `neque://i/<token>`, esquema registrado en la IPA y `@capacitor/app` escuchando `appUrlOpen` para navegar a la invitación.                                                 | Corregido, pendiente de validar en un iPhone con una IPA nueva               |
| QA-40 | Pantalla «solo app»                                                                   | UI            | En escritorio (horizontal) la regla solo-vertical tapaba el mensaje con «Rota tu dispositivo a vertical».                                                                                                                                                                                                                                | Abrir la web en escritorio.                                                        | Solo se veía el aviso de rotar.                                                                                | El mensaje informativo.                                      | Media     | 40        | La página marca el `body` y la regla solo-vertical la exceptúa.                                                                                                                                        | Validado (navegador)                                                         |

## Ambigüedades que requieren definición funcional

- **AMB-1 — Reglas de contraseña en el login.** NEQUE-11.2.5 las quitó (el
  backend decide si la credencial sirve) y NEQUE-13.4.1 las volvió a poner.
  Hoy un usuario con una contraseña anterior a las reglas no puede pulsar
  Ingresar. Se mantuvo el comportamiento vigente (13.4.1) y se cerraron las
  vías por las que podía nacer una contraseña así (QA-13, QA-28). Producto
  debe confirmar la regla.
- **AMB-2 — Rangos de estatura.** El BFF acepta 50–260 cm y la UI declaraba
  100–250. Se adoptó el de la UI (más estricto y ya visible). Confirmar si
  hay alumnos fuera de él: no podrían editar su ficha sin corregir la
  estatura.
- **AMB-3 — Mensajes de validación del BFF.** Los 400 devuelven
  «Dato inválido: days.0.title», técnico para un usuario final. Con las
  validaciones del cliente no deberían verse; si se quiere un mensaje de
  negocio por campo hay que definir el catálogo.
- **AMB-4 — Datos existentes fuera de las reglas nuevas.** Teléfonos o
  estaturas guardados antes de estas validaciones bloquearán la edición
  hasta corregirlos (con el mensaje del campo). Si hay muchos, conviene una
  limpieza de datos.
- **AMB-5 — ¿El apellido es obligatorio?** El front lo exige (alta de alumno
  y los dos perfiles), pero el BFF (`text(80)`) y la base (`not null`, admite
  `''`) lo aceptan vacío, y `create:trainer` crea entrenadores sin apellido.
  Ese entrenador no podrá guardar su perfil sin agregar uno. Se mantuvo la
  regla del front.
- **AMB-6 — ¿El objetivo de la rutina es obligatorio?** El front lo exige; el
  BFF lo acepta vacío. Igual con «al menos un día» y «al menos un ejercicio
  por día», que el BFF tampoco exige.
- **AMB-7 — Parentesco del contacto de urgencia.** Es opcional en el front,
  pero si queda vacío se guarda el texto literal «Sin especificar» en vez de
  `null`. Definir si se prefiere `null`.
- **AMB-8 — Perfil QA.** La base solo define los roles `trainer` y `student`
  (`user_role`); no existe un perfil QA. Se auditaron los formularios de los
  dos roles. Si QA es un rol previsto, hay que especificarlo.
- **AMB-9 — Instalación sin tienda.** La app no está publicada en App Store ni
  Google Play (la IPA se genera sin firmar y no hay proyecto Android). Con la
  web bloqueada, el único camino del alumno es la app instalada: hay que
  definir cómo se distribuye antes de desplegar el bloqueo (ver sección de
  privacidad).

## Validación final

| Verificación                                            | Resultado                                                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` (app + BFF)                         | Sin errores                                                                                                                                                      |
| `npm run lint` (`--max-warnings 0`)                     | Sin errores ni avisos                                                                                                                                            |
| `prettier --check`                                      | Todo formateado                                                                                                                                                  |
| `jest --coverage`                                       | 1411/1411 en verde (77 suites), cobertura 97,6 % de líneas. Una corrida con `--coverage` tuvo 2 fallos intermitentes ajenos (QA-32); la siguiente pasó completa. |
| `npm run build:prod`                                    | OK; solo los 2 avisos CJS preexistentes de `qrcode` (QA-31).                                                                                                     |
| Sonda del BFF sin base                                  | Contraseña débil → 400 en reset e invitación; JSON roto → 400; sin token → 401                                                                                   |
| Navegador (320×568, 375×812, 768×1024, ancho del panel) | Login, recuperación, invitación y 404 sin desbordes horizontales; consola sin excepciones (solo los 500 esperados del BFF ausente)                               |
| Navegador con Supabase (375×812, sesión de entrenador)  | 6 vistas del entrenador sin desbordes, encabezados `h1`/`h2` correctos y llamadas al BFF en 200; alta de alumno e invitación OK                                  |

## Resumen

1. **Issues detectados:** 40.
2. **Por estado:**
   - **Solucionados y validados:** 33.
   - **Corregidos, pendientes de validación:** 3. QA-37 y QA-38 hasta que se
     desplieguen; QA-39 hasta probar una IPA nueva en un iPhone.
   - **Pendientes de desarrollo:** el proyecto Android para App Links.
     QA-30, QA-31 y QA-32 se corrigieron el 3 de noviembre.
   - **Requieren configuración externa:** Search Console, Universal Links
     (Apple Developer), App Links (Play Console), publicación en tiendas y
     dominio propio (ver «Configuración externa pendiente»).
   - **Requieren definición de negocio:** AMB-1 a AMB-9.
   - **Descartados:** 1 (QA-22, comportamiento intencional).
3. **Por severidad:** Alta 11 (8 validados, 3 pendientes de validación) ·
   Media 18 (18 validados) · Baja 11 (7 validados, 1 descartado, 3
   pendientes). Ninguno crítico.
4. **Vistas auditadas:** 17 + la pantalla «solo app» (4 públicas y 6 del
   entrenador en vivo; 7 del alumno por código y tests).
5. **Formularios revisados:** 16 de los dos roles y públicos, con 79 campos
   en las matrices de obligatoriedad.
6. **Pruebas ejecutadas:** suite completa de Jest (con los casos nuevos que
   reproducen cada hallazgo), sondas HTTP del BFF local y de producción,
   recorrido en navegador con y sin Supabase y build web de producción
   servida en local.
7. **Requieren intervención externa:** desplegar y verificar las cabeceras en
   producción, Search Console, distribución de la app (AMB-9), recorrido en
   vivo de las vistas del alumno (Benjamin debe fijar su contraseña) y
   pruebas en iPhone (QA-19, QA-39).

## Auditoría de formularios y obligatoriedad de campos

**Fuentes contrastadas por campo:** validadores del front (`ui/**`), esquemas
zod del BFF (`server/http/app.ts`), columnas y `check` de la base
(`supabase/migrations/20261102000000_schema.sql`), modelos de dominio
(`domain/**/model`) y el comportamiento real en el navegador (vistas del
entrenador con Supabase; vistas del alumno por tests).

**Perfiles:** la base define solo `trainer` y `student`. No existe un perfil
QA (AMB-8), así que se auditaron los formularios de los dos roles y los
públicos.

**Convenciones de las matrices:** «Front» y «BFF» son los límites de cada
capa; el más estricto es el que manda en la práctica. «Vacío» y
«Incorrecto» describen la respuesta verificada. `*` = marcado como
obligatorio en la UI. Un campo opcional vacío viaja como `null`.

### Públicos

**Ingresar** (`StartPage`)

| Campo (técnico / visible) | Tipo        | Oblig. | Límites                      | Validación                                      | Vacío                               | Incorrecto                                                                     |
| ------------------------- | ----------- | ------ | ---------------------------- | ----------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `email` / Correo          | texto email | Sí     | ≤ 254                        | Patrón de correo; se recorta y pasa a minúscula | «El correo es obligatorio»          | «Ingresa un correo válido»                                                     |
| `password` / Contraseña   | contraseña  | Sí     | Front: 4 reglas · BFF: 1–128 | 8+, mayúscula, número, símbolo (AMB-1)          | Lista de requisitos y foco al campo | Requisitos sin cumplir; credenciales malas → «Correo o contraseña incorrectos» |

**Recuperar contraseña** (`ForgotPasswordPage`, 3 pasos)

| Campo                                  | Tipo       | Oblig. | Límites       | Validación                                                  | Vacío                                | Incorrecto                            |
| -------------------------------------- | ---------- | ------ | ------------- | ----------------------------------------------------------- | ------------------------------------ | ------------------------------------- |
| `email` / Correo (paso 1)              | email      | Sí     | ≤ 254         | Patrón, tolera espacio final; se recorta y pasa a minúscula | Botón deshabilitado + error al salir | «Ingresa un correo válido»            |
| Código (paso 2)                        | 6 dígitos  | Sí     | exactamente 6 | Solo dígitos; pegado reparte                                | «Verificar» deshabilitado            | El BFF rechaza → mensaje del servidor |
| `password` / Contraseña nueva (paso 3) | contraseña | Sí     | 8–128         | 4 reglas (front y BFF)                                      | Botón deshabilitado                  | Reglas sin cumplir; BFF 400           |
| `confirm` / Repite la contraseña       | contraseña | Sí     | 8–128         | Igual a la nueva                                            | Botón deshabilitado                  | «Las contraseñas no coinciden»        |

**Aceptar invitación** (`InvitePage`)

| Campo                            | Tipo       | Oblig. | Límites | Validación             | Vacío               | Incorrecto                     |
| -------------------------------- | ---------- | ------ | ------- | ---------------------- | ------------------- | ------------------------------ |
| `password` / Contraseña          | contraseña | Sí     | 8–128   | 4 reglas (front y BFF) | Botón deshabilitado | Reglas sin cumplir             |
| `confirm` / Repite la contraseña | contraseña | Sí     | 8–128   | Igual a la anterior    | Botón deshabilitado | «Las contraseñas no coinciden» |

### Ambos roles

**Cambiar contraseña** (`ChangePasswordFormComponent`)

| Campo                         | Tipo       | Oblig. | Límites | Validación                                     | Vacío                                   | Incorrecto                      |
| ----------------------------- | ---------- | ------ | ------- | ---------------------------------------------- | --------------------------------------- | ------------------------------- |
| `current` / Contraseña actual | contraseña | Sí     | 1–128   | —                                              | «Escribe tu contraseña actual.»         | BFF → credenciales inválidas    |
| `next` / Contraseña nueva     | contraseña | Sí     | 8–128   | 4 reglas y distinta de la actual (front y BFF) | «La nueva no cumple las cuatro reglas.» | Ídem / «tiene que ser distinta» |
| `confirm` / Repite la nueva   | contraseña | Sí     | 8–128   | Igual a la nueva                               | «No coincide…»                          | «No coincide…»                  |

**Foto de perfil** (`ProfileHeroComponent`, alumno y entrenador)

| Campo   | Tipo   | Oblig.          | Límites | Validación                     | Vacío        | Incorrecto                                                   |
| ------- | ------ | --------------- | ------- | ------------------------------ | ------------ | ------------------------------------------------------------ |
| Archivo | imagen | Sí (para subir) | ≤ 8 MB  | JPEG, PNG, WebP o HEIC (QA-35) | No hace nada | «Elige una foto JPG, PNG, WebP o HEIC.» / «pesa más de 8 MB» |

### Alumno

**Editar mis datos** (`StudentProfilePage`)

| Campo                    | Tipo     | Oblig.                    | Límites                     | Validación                   | Vacío                           | Incorrecto            |
| ------------------------ | -------- | ------------------------- | --------------------------- | ---------------------------- | ------------------------------- | --------------------- |
| `firstName` / Nombre \*  | texto    | Sí                        | Front ≤ 40 · BFF 1–80       | Se recorta; no solo espacios | «Escribe tu nombre y apellido.» | —                     |
| `lastName` / Apellido \* | texto    | Front Sí · BFF No (AMB-5) | Front ≤ 40 · BFF ≤ 80       | Se recorta                   | Ídem                            | —                     |
| `phone` / Teléfono       | teléfono | No                        | 8–16 (BFF ≤ 30, sin patrón) | `+`, dígitos y espacios      | Se guarda `null`                | «Revisa el teléfono…» |

**Agregar foto de progreso** (`StudentProgressPage`)

| Campo       | Tipo                    | Oblig. | Límites             | Validación                                                    | Vacío        | Incorrecto                       |
| ----------- | ----------------------- | ------ | ------------------- | ------------------------------------------------------------- | ------------ | -------------------------------- |
| Ángulo      | Frente / Lado / Espalda | Sí     | enum                | Preseleccionado «Frente»                                      | —            | —                                |
| Archivo     | imagen                  | Sí     | ≤ 8 MB              | JPEG, PNG, WebP, HEIC (QA-35)                                 | No hace nada | Mensaje del formato o del tamaño |
| Peso / nota | —                       | No     | BFF: 20–400 / ≤ 500 | El peso se toma de la última evaluación; la nota no se expone | `null`       | —                                |

**Runner de entrenamiento** (`WorkoutRunnerPage`)

| Campo                  | Tipo      | Oblig.                    | Límites                      | Validación                                         | Vacío                    | Incorrecto          |
| ---------------------- | --------- | ------------------------- | ---------------------------- | -------------------------------------------------- | ------------------------ | ------------------- |
| Repeticiones (stepper) | entero    | Sí                        | 1–99 (BFF 0–500)             | Se acota y redondea; precargado de la prescripción | Vuelve al valor anterior | Se ajusta al límite |
| Kg (stepper)           | decimal   | Sí si la carga usa kg     | 0–500, paso 2,5 (BFF 0–1000) | Se acota                                           | Vuelve al anterior       | Se ajusta           |
| Duración (stepper)     | segundos  | Sí si la medida es tiempo | 5 s–2 h                      | Solo botones (`readOnly`, QA-22)                   | —                        | —                   |
| Motivo al saltar       | 4 motivos | No                        | enum                         | «Saltar sin motivo» envía `null`                   | Se acepta                | —                   |

**Agenda** (`StudentSchedulePage`): solo «Confirmar», sin campos. La
cancelación existe en el BFF (motivo obligatorio; nota obligatoria solo con
«Otro», QA-36) pero la UI no la ofrece.

### Entrenador

**Alta / edición de alumno** (`StudentFormComponent`)

| Campo                           | Tipo     | Oblig.                    | Límites                            | Validación                   | Vacío                  | Incorrecto                                                          |
| ------------------------------- | -------- | ------------------------- | ---------------------------------- | ---------------------------- | ---------------------- | ------------------------------------------------------------------- |
| `firstName` / Nombre \*         | texto    | Sí                        | Front ≤ 60 · BFF 1–80              | No solo espacios             | «Escribe el nombre.»   | —                                                                   |
| `lastName` / Apellido \*        | texto    | Front Sí · BFF No (AMB-5) | Front ≤ 60 · BFF ≤ 80              | No solo espacios             | «Escribe el apellido.» | —                                                                   |
| `email` / Correo \* (solo alta) | email    | Sí                        | ≤ 254, único                       | Recorte + minúscula al salir | «Ingresa un correo.»   | «Ese correo no es válido.»; repetido → 409 «Ya existe un registro…» |
| `phone` / Teléfono              | teléfono | No                        | 8–16                               | `+`, dígitos, espacios       | `null`                 | «Solo números y espacios, entre 8 y 16.»                            |
| `birthDate` / Nacimiento        | fecha    | No                        | 1900-01-01 a hoy                   | `dateBetween` con `CLOCK`    | `null`                 | «La fecha no puede ser futura ni anterior a 1900.»                  |
| `heightCm` / Estatura (cm)      | entero   | No                        | 100–250 (BFF y base 50–260, AMB-2) | Rango                        | `null`                 | «Entre 100 y 250 cm.»                                               |
| `goal` / Objetivo               | texto    | No                        | ≤ 500                              | Se recorta                   | `null`                 | —                                                                   |

**Anamnesis** (`AnamnesisFormComponent`)

| Campo                                                                      | Tipo     | Oblig.                       | Límites                 | Validación                | Vacío                                  | Incorrecto                            |
| -------------------------------------------------------------------------- | -------- | ---------------------------- | ----------------------- | ------------------------- | -------------------------------------- | ------------------------------------- |
| `declaredGoal` / Objetivo declarado \*                                     | texto    | Sí (front, BFF y base)       | Front ≤ 200 · BFF 1–500 | No solo espacios          | «Sin objetivo no se puede planificar…» | —                                     |
| `weeklyAvailability` / Disponibilidad semanal \*                           | días 1–7 | Sí                           | 1–7 días                | —                         | «Marca al menos un día.»               | —                                     |
| Antecedentes, lesiones, cirugías, medicamentos, alergias, actividad previa | texto    | No                           | ≤ 2000 c/u              | Se recortan               | `null`                                 | —                                     |
| `contactName` / Nombre del contacto                                        | texto    | Condicional: si hay teléfono | ≤ 120                   | Contacto completo o vacío | —                                      | «hacen falta su nombre y su teléfono» |
| `contactPhone` / Teléfono del contacto                                     | teléfono | Condicional: si hay nombre   | 8–16                    | Patrón                    | —                                      | «Revisa el teléfono del contacto…»    |
| `contactRelation` / Parentesco                                             | texto    | No                           | ≤ 60                    | —                         | Se guarda «Sin especificar» (AMB-7)    | —                                     |

**Evaluación física** (`AssessmentFormComponent`)

| Campo                                     | Tipo    | Oblig.                 | Límites                                      | Validación | Vacío                               | Incorrecto            |
| ----------------------------------------- | ------- | ---------------------- | -------------------------------------------- | ---------- | ----------------------------------- | --------------------- |
| `weightKg` / Peso (kg) \*                 | decimal | Sí (front, BFF y base) | 20–300 (BFF 20–400)                          | Rango      | «Peso y estatura son obligatorios…» | «Entre 20 y 300 kg.»  |
| `heightCm` / Estatura (cm) \*             | número  | Sí                     | 100–250 (BFF 50–260); precargada de la ficha | Rango      | Ídem                                | «Entre 100 y 250 cm.» |
| `bodyFatPct` / Grasa (%)                  | decimal | No                     | 2–70                                         | Rango      | `null`                              | «Entre 2 y 70 %.»     |
| `muscleMassKg` / Masa muscular (kg)       | decimal | No                     | 1–150 (BFF 0–300)                            | Rango      | `null`                              | «Entre 1 y 150 kg.»   |
| Pecho, cintura, cadera, brazo, muslo (cm) | decimal | No                     | 10–250 (BFF 0–400)                           | Rango      | `null`                              | «Entre 10 y 250 cm.»  |
| `notes` / Notas                           | texto   | No                     | ≤ 1000                                       | Se recorta | `null`                              | —                     |

**Nuevo ejercicio** (`ExerciseFormComponent`)

| Campo                             | Tipo                 | Oblig. | Límites                | Validación                        | Vacío              | Incorrecto                                 |
| --------------------------------- | -------------------- | ------ | ---------------------- | --------------------------------- | ------------------ | ------------------------------------------ |
| `name` / Nombre \*                | texto                | Sí     | Front ≤ 80 · BFF 1–120 | No solo espacios                  | «Ponle un nombre…» | —                                          |
| `muscleGroup` / Grupo muscular \* | enum                 | Sí     | 8 grupos               | Preseleccionado «Cuerpo completo» | —                  | —                                          |
| `equipment` / Equipamiento        | texto                | No     | ≤ 120                  | Se recorta                        | `null`             | —                                          |
| `instructions` / Instrucciones    | texto, una por línea | No     | ≤ 20 pasos de ≤ 500    | Líneas vacías se descartan        | `[]`               | «Hasta 20 pasos…» / «hasta 500 caracteres» |

**Constructor de rutina** (`RoutineBuilderComponent`)

| Campo                    | Tipo    | Oblig.                      | Límites                 | Validación                             | Vacío                                      | Incorrecto                                |
| ------------------------ | ------- | --------------------------- | ----------------------- | -------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| `name` / Nombre \*       | texto   | Sí                          | Front ≤ 80 · BFF 1–120  | No solo espacios                       | «Completa nombre y objetivo.»              | —                                         |
| `goal` / Objetivo \*     | texto   | Front Sí · BFF No (AMB-6)   | Front ≤ 120 · BFF ≤ 500 | No solo espacios                       | Ídem                                       | —                                         |
| Días                     | lista   | Front ≥ 1 · BFF ≥ 0 (AMB-6) | ≤ 7                     | —                                      | «Agrega al menos un día…»                  | —                                         |
| Día de la semana         | 1–7     | Sí                          | único por rutina        | —                                      | —                                          | «Hay dos días de rutina en el mismo día…» |
| Foco                     | enum    | Sí                          | 8 grupos                | Selector muestra el valor real (QA-33) | —                                          | —                                         |
| Título \*                | texto   | Sí (BFF y base)             | ≤ 120                   | No solo espacios (QA-01)               | «Cada día necesita un título.»             | —                                         |
| Minutos                  | entero  | Sí                          | 10–180 (BFF 1–600)      | Se acota al salir (QA-03)              | Vuelve a 50                                | Se ajusta                                 |
| Ejercicios del día       | lista   | Front ≥ 1 · BFF ≥ 0         | ≤ 30                    | —                                      | «Cada día necesita al menos un ejercicio.» | —                                         |
| Carga / Medida           | enum    | Sí                          | —                       | Peso corporal borra los kg             | —                                          | —                                         |
| Series                   | entero  | Sí                          | 1–20 (BFF 1–50)         | Se acota (QA-02)                       | Conserva el valor                          | Se ajusta                                 |
| Reps (medida reps)       | entero  | Sí                          | 1–100 (BFF 0–500)       | Se acota                               | Conserva                                   | Se ajusta                                 |
| Duración (medida tiempo) | min + s | Sí                          | 5 s–2 h                 | Se acota                               | —                                          | Se ajusta                                 |
| Kg                       | decimal | No                          | 0–1000                  | Coma o punto                           | `null`                                     | Se ajusta                                 |
| Descanso (s)             | entero  | Sí                          | 0–600 (BFF 0–3600)      | Se acota                               | Conserva                                   | Se ajusta                                 |

**Asignar rutina** (`RoutineAssignComponent`)

| Campo                  | Tipo     | Oblig.             | Límites                      | Validación                                   | Vacío                                           | Incorrecto                             |
| ---------------------- | -------- | ------------------ | ---------------------------- | -------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| Alumnos marcados       | checkbox | No                 | ≤ 200                        | Sin marcados = quitar todas las asignaciones | Se acepta                                       | —                                      |
| Inicio \* (por alumno) | fecha    | Sí si está marcado | —                            | Se envía `yyyy-MM-dd` (QA-21)                | «Cada alumno marcado necesita fecha de inicio.» | —                                      |
| Fin (por alumno)       | fecha    | No                 | ≥ inicio (front, BFF y base) | `min` = inicio                               | `null`                                          | «no puede ser anterior a la de inicio» |

**Editar mis datos** (`TrainerProfilePage`)

| Campo                              | Tipo                     | Oblig.                    | Límites                    | Validación         | Vacío                           | Incorrecto            |
| ---------------------------------- | ------------------------ | ------------------------- | -------------------------- | ------------------ | ------------------------------- | --------------------- |
| `firstName` / Nombre \*            | texto                    | Sí                        | Front ≤ 40 · BFF 1–80      | No solo espacios   | «Escribe tu nombre y apellido.» | —                     |
| `lastName` / Apellido \*           | texto                    | Front Sí · BFF No (AMB-5) | ≤ 40                       | —                  | Ídem                            | —                     |
| `phone` / Teléfono                 | teléfono                 | No                        | 8–16                       | Patrón             | `null`                          | «Revisa el teléfono…» |
| `specialty` / Especialidad         | texto                    | No                        | Front ≤ 60 · BFF ≤ 120     | —                  | `null`                          | —                     |
| `certifications` / Certificaciones | texto separado por comas | No                        | Front ≤ 200 · BFF 30 × 120 | Se parte por comas | `[]`                            | —                     |
| `bio` / Sobre ti                   | texto                    | No                        | Front ≤ 280 · BFF ≤ 2000   | —                  | `null`                          | —                     |

**Buscador y filtros de alumnos** (`TrainerStudentsPage`): búsqueda opcional
sin límite (filtra en memoria por nombre o correo, sin tildes ni mayúsculas)
y pestañas Activos/Suspendidos. Vacío muestra todos; sin coincidencias, un
estado vacío propio.

**Estado de la cuenta e invitación** (detalle de alumno): suspender/reactivar,
reemitir y revocar son acciones con confirmación, sin campos.

### Resultado de la auditoría de obligatoriedad

- **Opcionales que sí se pueden omitir:** todos los marcados «No» se probaron
  vacíos en tests (y en vivo el alta de alumno y la evaluación): viajan como
  `null` o `[]` y el envío no se bloquea.
- **Obligatorios que no dejan continuar vacíos:** todos los «Sí»; probados con
  formularios vacíos o con solo espacios.
- **Contradicciones front ↔ BFF ↔ base:** apellido (AMB-5), objetivo de la
  rutina y días/ejercicios mínimos (AMB-6), parentesco por defecto (AMB-7) y
  nota de cancelación con «Otro» (QA-36, corregida). El resto de las
  diferencias son límites del front más estrictos que el BFF, que es lo
  esperado.
- **Obligatorios sin marca visual:** corregidos en QA-34.

## Privacidad, indexación y acceso exclusivo desde aplicación móvil

### Diagnóstico (producción, 2026-11-03)

| Revisión                      | Resultado en `https://neque-ten.vercel.app`                                           |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `X-Robots-Tag`                | No existe                                                                             |
| Meta `robots` en `index.html` | No existe                                                                             |
| `/robots.txt`                 | No existe: el fallback de la SPA devolvía la app con 200                              |
| `/sitemap.xml`                | No existe: también devolvía la app con 200                                            |
| Rutas sin autenticación       | Inicio/login, recuperación, invitación y 404, todas usables desde cualquier navegador |
| Datos sin sesión              | Ninguno: toda la API privada responde 401 (verificado)                                |

**Por qué aparece en buscadores:** el dominio es público, responde 200 a
cualquier ruta y no declara `noindex` en ninguna capa.

### Cambios implementados

| Medida                                                        | Dónde                                                                         | Efecto                                                                                                                                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Robots-Tag: noindex, nofollow, noarchive`                  | `scripts/build-vercel.mjs` (rutas de Vercel, todo el dominio incluida la API) | Saca de los resultados las URLs ya indexadas cuando el buscador las vuelve a rastrear                                                                                                        |
| `<meta name="robots" content="noindex, nofollow, noarchive">` | `src/index.html`                                                              | Segunda capa en el HTML                                                                                                                                                                      |
| `robots.txt` con `Allow: /`                                   | `src/robots.txt`                                                              | Deja de devolver la app como robots. Permite el rastreo **a propósito**: con `Disallow: /` el buscador no vería el `noindex` y las URLs indexadas quedarían en los resultados                |
| Sitemap                                                       | —                                                                             | No existe ni se crea                                                                                                                                                                         |
| Bloqueo web                                                   | `routesFor()` en `app.routes.ts` + `MobileOnlyPage`                           | En la build web de producción **todas** las rutas cargan la pantalla «Ñeque está disponible solo en la app». No se descarga ningún módulo de la app, no hay formularios ni llamadas a la API |
| Enlace de invitación                                          | `MobileOnlyPage`                                                              | `/i/<token>` ofrece «Abrir en la app» → `neque://i/<token>`; el intento se hace al tocar, para que Safari no muestre un error sin la app                                                     |
| Recepción del enlace                                          | `AppComponent` + `@capacitor/app` + `deepLinkPath()`                          | La app instalada escucha `appUrlOpen` y navega a la ruta; los guards de siempre aplican                                                                                                      |
| Esquema `neque://`                                            | `.github/workflows/ios-ipa.yml` (`CFBundleURLTypes`)                          | La IPA declara el esquema                                                                                                                                                                    |
| Pantalla visible en escritorio                                | `styles.scss`                                                                 | La regla solo-vertical ya no tapa el aviso (QA-40)                                                                                                                                           |

**Qué no se bloquea, a propósito:** la app nativa (Capacitor sirve su propia
copia del front y solo usa `/api/v1`) y `ng serve` (desarrollo y QA local).

**Dependencia nueva:** `@capacitor/app@^6.0.3`, plugin oficial de la misma
versión de Capacitor. Sin él la app no puede recibir enlaces; es una
excepción a la regla de no agregar librerías.

### Seguridad: el bloqueo web no protege datos

La pantalla «solo app» es experiencia de uso, no seguridad: cualquiera puede
llamar a la API con `curl`. La protección real es el BFF, y se verificó:

| Prueba                                                                                                                    | Entorno              | Resultado                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| Rutas privadas sin token (`/me/notifications`, `/students/:id`, `/trainers/:id/students`, `POST /routines`, `/exercises`) | Producción           | 401                                                              |
| Las mismas con un JWT falso                                                                                               | Producción           | 401                                                              |
| Origen ajeno (`Origin: https://evil.example`)                                                                             | Producción           | Sin `Access-Control-Allow-Origin`                                |
| Alumno, fotos y cartera de otro entrenador con una sesión válida                                                          | BFF local + Supabase | 404 (no revela que existe)                                       |
| Id mal formado                                                                                                            | BFF local + Supabase | 404                                                              |
| Ruta de alumno con sesión de entrenador                                                                                   | BFF local + Supabase | 403                                                              |
| Enlace profundo a una ruta privada                                                                                        | Tests                | Pasa por `authGuard`/`roleGuard`, igual que la navegación normal |

Tokens en URL: el único es el de invitación, que es de un solo uso, vence en
48 h y se puede revocar. Los tokens de sesión viajan en la cabecera
`Authorization`, nunca en la URL.

### Pruebas de aceptación

| Escenario                                         | Resultado                                                | Estado                                                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buscar la app en Google                           | —                                                        | **Requiere despliegue y Search Console.** Con el cambio en producción, Google la saca al volver a rastrear (días a semanas). Para acelerar: Search Console → Eliminaciones |
| Cabeceras `noindex` en producción                 | Sin `X-Robots-Tag` hoy                                   | **Pendiente de despliegue.** Verificar después con `curl -I https://neque-ten.vercel.app/`                                                                                 |
| Abrir URL desde escritorio                        | Pantalla informativa, sin controles ni llamadas a la API | Validado en la build local de producción; pendiente en producción                                                                                                          |
| Abrir `/i/<token>` en el navegador                | Aviso + «Abrir en la app» (`neque://i/<token>`)          | Validado en la build local de producción                                                                                                                                   |
| Abrir el enlace desde Safari con la app instalada | Debe abrir la app en la invitación                       | **Requiere iPhone** con una IPA generada después de este cambio                                                                                                            |
| Abrir el enlace desde Chrome Android              | —                                                        | **Requiere desarrollo:** no hay proyecto Android                                                                                                                           |
| Abrir el enlace sin la app instalada              | Aviso + «pídele a tu entrenador cómo instalarla»         | No hay tienda a la que enviar (AMB-9)                                                                                                                                      |
| Rutas privadas desde el navegador                 | No existen en la web de producción                       | Validado en la build local de producción                                                                                                                                   |
| API sin autorización                              | 401                                                      | Validado en producción                                                                                                                                                     |
| Deep links                                        | Respetan guards y pertenencia                            | Validado en tests; en dispositivo, pendiente                                                                                                                               |

### Configuración externa pendiente

1. **Desplegar** estos cambios a producción y verificar con
   `curl -I https://neque-ten.vercel.app/` que aparece `X-Robots-Tag`.
2. **Google Search Console:** verificar el dominio, pedir en «Eliminaciones»
   la retirada temporal del prefijo `https://neque-ten.vercel.app/` e
   inspeccionar una URL para confirmar que Google ve el `noindex`. Repetir en
   Bing Webmaster Tools si aparece allí.
3. **Universal Links (iOS)**, para que el enlace `https://…/i/<token>` abra la
   app sin pasar por el botón: requiere cuenta de Apple Developer, el Team ID,
   firmar la IPA con el entitlement _Associated Domains_
   (`applinks:<dominio>`) y servir `/.well-known/apple-app-site-association`
   con `appID: <TEAMID>.com.duocuc.neque` y la ruta `/i/*`. `deepLinkPath()`
   ya acepta esos enlaces https.
4. **Android App Links:** agregar la plataforma (`npx cap add android`),
   `intent-filter` con `autoVerify` y servir `/.well-known/assetlinks.json`
   con el SHA-256 del certificado de firma.
5. **Distribución:** publicar en App Store / Google Play (o TestFlight) para
   tener a dónde enviar a quien no tiene la app (AMB-9).
6. **Dominio propio** antes de imprimir QRs: los dos archivos de
   asociación dependen del dominio.

### Switch de acceso web (presentación)

Para que jueces y profesores prueben la app sin instalar la IPA, el bloqueo
web tiene un switch:

| `NEQUE_WEB_ACCESS` (Vercel)       | Navegador móvil     | Navegador de escritorio | Indexación |
| --------------------------------- | ------------------- | ----------------------- | ---------- |
| `off` o sin definir (por defecto) | Pantalla «solo app» | Pantalla «solo app»     | `noindex`  |
| `mobile`                          | App completa        | Pantalla «solo app»     | `noindex`  |

- **Cómo funciona:** `scripts/build-vercel.mjs` lee la variable al compilar y
  la escribe como `<meta name="neque-web-access">` en el `index.html`
  publicado; `webAccessEnabled()` la lee al arrancar. No hay llamadas extra.
  Un valor distinto de `off` o `mobile` hace fallar el build antes de
  compilar.
- **Para encenderlo:** Vercel → Project Settings → Environment Variables →
  `NEQUE_WEB_ACCESS = mobile` (entorno Production) → Redeploy. Para apagarlo,
  `off` (o borrarla) y Redeploy.
- **Qué es «móvil»:** User-Agent de Android, iPhone o iPad (incluido el iPad
  que se anuncia como Mac táctil). Es una decisión de experiencia, no de
  seguridad: falsificar el User-Agent solo da acceso a la misma pantalla de
  login; los datos siguen protegidos por el BFF.
- **Verificado** con el build real de Vercel servido en local: con `mobile`,
  un móvil ve el login y el escritorio la pantalla «solo app»; con `off`,
  el móvil vuelve a la pantalla «solo app»; un valor inválido falla el build.
- **Pendiente:** encenderlo en producción y probarlo desde un teléfono real,
  y definir las cuentas de los jueces.

### Antes de desplegar

**Al desplegar, la web deja de funcionar para todos**, también para
entrenadores y alumnos que hoy la usen en el navegador. Y como la app no está
en ninguna tienda, un alumno nuevo solo podrá aceptar su invitación si ya tiene
la IPA instalada con el esquema `neque://`. Hay que decidir la distribución
(AMB-9) antes de publicar este cambio.

Mientras tanto, para la presentación o para no dejar sin acceso a quien hoy
usa la web, el switch `NEQUE_WEB_ACCESS=mobile` mantiene la app disponible en
navegadores móviles.
