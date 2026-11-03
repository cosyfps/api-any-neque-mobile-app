# Cambios de la auditoría QA — 2026-11-03

Resumen de lo que cambió en la app con el commit `8ab8f37` (rama `develop`). El
detalle técnico, la evidencia y las matrices completas de campos están en
[`QA_AUDIT_REPORT.md`](../../QA_AUDIT_REPORT.md).

## ¿Qué necesito actualizar?

| Dónde usas la app   | ¿Ya tiene los cambios?                                |
| ------------------- | ----------------------------------------------------- |
| Navegador (web)     | **Sí.** El deploy en Vercel ya los publicó.           |
| Backend (API)       | **Sí.** Va en el mismo deploy.                        |
| App instalada (IPA) | **No.** Hay que generar una IPA nueva y reinstalarla. |

La app instalada trae **su propia copia** de las pantallas, empaquetada al
generar la IPA, y del servidor solo usa la API. Por eso:

- Con la IPA vieja ya aplican las **validaciones del backend** (por ejemplo,
  rechazar contraseñas débiles o la nota obligatoria con el motivo «Otro»).
- **No** aplican los cambios de pantallas: los errores por campo, los `*` de
  obligatorio, los rangos del constructor de rutinas, el selector de foco, el
  aviso de fotos ni la apertura de invitaciones con `neque://`.

**Para generar la IPA nueva:** GitHub → Actions → workflow **iOS IPA** → «Run
workflow» sobre `develop`. Al terminar, descarga el artefacto `Neque-ipa` e
instálalo en el teléfono como la vez anterior.

---

## 1. Formularios

Regla común en todos los formularios:

- El botón de guardar queda **habilitado** (salvo mientras guarda). Al pulsarlo
  con datos inválidos, cada error aparece **junto a su campo**. Antes, algunos
  botones quedaban deshabilitados sin decir por qué.
- Los campos obligatorios llevan **`*`**.
- Un texto con **solo espacios** ya no cuenta como completado.
- Los errores **desaparecen al corregir** el campo. Antes quedaban fijos hasta
  volver a guardar.
- Los opcionales se pueden dejar vacíos y se guardan como «sin dato».

### Alta y edición de alumno (entrenador)

| Campo                 | Antes                                                                              | Ahora                                                                         |
| --------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Nombre _, Apellido _  | Aceptaban solo espacios; sin mensaje ni `*`                                        | Obligatorios, con «Escribe el nombre / apellido» junto al campo               |
| Correo \* (solo alta) | Un espacio al final (autocompletado de iOS) dejaba «Crear» deshabilitado sin aviso | Se limpia y pasa a minúsculas al salir del campo; error claro si no es válido |
| Teléfono              | Aceptaba letras                                                                    | Opcional: `+`, números y espacios, entre 8 y 16                               |
| Nacimiento            | Aceptaba fechas futuras o años imposibles                                          | Opcional: desde 1900 hasta hoy                                                |
| Estatura (cm)         | Aceptaba negativos, 0 o 9999                                                       | Opcional: entre 100 y 250                                                     |
| Objetivo              | Sin límite                                                                         | Opcional, hasta 500 caracteres                                                |

Además, al **editar** un alumno la fecha de nacimiento aparecía vacía; ahora se
precarga.

### Anamnesis (entrenador)

| Campo                                   | Antes                                     | Ahora                                                                 |
| --------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| Objetivo declarado \*                   | Aceptaba solo espacios                    | Obligatorio de verdad                                                 |
| Disponibilidad semanal \*               | Sin cambios                               | Al menos un día                                                       |
| Antecedentes, lesiones, cirugías, etc.  | Sin límite (el servidor cortaba en 2000)  | Opcionales, hasta 2000 caracteres                                     |
| Contacto de urgencia: nombre y teléfono | Teléfono sin formato; sin límite de largo | Opcional, pero si llenas uno hace falta el otro; teléfono con formato |
| Parentesco                              | Sin límite                                | Opcional, hasta 60 caracteres                                         |

### Evaluación física (entrenador)

| Campo                                | Antes                                           | Ahora                                     |
| ------------------------------------ | ----------------------------------------------- | ----------------------------------------- |
| Peso (kg) \*                         | Aceptaba −5 o 999; el error decía «obligatorio» | Entre 20 y 300, con «Entre 20 y 300 kg.»  |
| Estatura (cm) \*                     | Sin rango                                       | Entre 100 y 250 (se precarga de la ficha) |
| Grasa (%)                            | Aceptaba 0,5 (el servidor lo rechazaba)         | Opcional, entre 2 y 70                    |
| Masa muscular (kg)                   | Sin rango                                       | Opcional, entre 1 y 150                   |
| Pecho, cintura, cadera, brazo, muslo | Sin rango                                       | Opcionales, entre 10 y 250 cm             |
| Notas                                | Sin límite                                      | Opcional, hasta 1000 caracteres           |

### Nuevo ejercicio (entrenador)

- **Nombre \***: ya no acepta solo espacios.
- **Instrucciones** (opcional): hasta 20 pasos de 500 caracteres. Antes, pasarse
  daba un error técnico del servidor.
- **Equipamiento** (opcional): hasta 120 caracteres.

### Constructor de rutinas (entrenador)

| Campo                | Antes                                                               | Ahora                                                 |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| Nombre _, Objetivo _ | Aceptaban solo espacios                                             | Obligatorios de verdad                                |
| Título del día \*    | Se podía dejar vacío y la rutina **no se guardaba** (error técnico) | Obligatorio, con «Cada día necesita un título.»       |
| Día y Foco           | Mostraban «Lunes» y «Pecho» aunque el día fuera otro                | Muestran el valor real del día                        |
| Minutos              | Aceptaba 1000 o decimales                                           | Entre 10 y 180, entero (se ajusta al salir del campo) |
| Series               | Aceptaba 0, 2,5 o 999                                               | Entre 1 y 20, entero                                  |
| Repeticiones         | Sin rango                                                           | Entre 1 y 100                                         |
| Descanso (s)         | Sin rango                                                           | Entre 0 y 600                                         |
| Kg                   | Sin tope                                                            | Opcional, hasta 1000                                  |

Si escribes un número fuera de rango, el campo muestra el límite en vez de
fallar al guardar.

### Asignar rutina (entrenador)

- La **fecha de inicio** se guardaba un día antes en zonas horarias al este de
  UTC; ahora se guarda el día elegido.
- La **fecha de fin** no deja elegir un día anterior al inicio.

### Editar mis datos (alumno y entrenador)

- **Nombre \*** y **Apellido \*** ahora marcados como obligatorios.
- Teléfono, especialidad, certificaciones y «Sobre ti» siguen opcionales.

### Fotos (progreso del alumno y foto de perfil)

- Solo se aceptan **JPG, PNG, WebP o HEIC** de hasta **8 MB**, con un mensaje
  claro. Antes un GIF pasaba el selector y fallaba en el servidor, y la foto de
  progreso no revisaba el tamaño.

### Contraseñas

- **Recuperar contraseña:** el correo con espacio al final ya no bloquea el
  botón y se envía en minúsculas; el error de envío se borra al corregir el
  correo; volver desde el paso 3 ya no deja el código usado en pantalla y
  permite reenviar uno nuevo. El teclado de iOS puede sugerir el código.
- **Invitación, recuperación y cambio de contraseña:** el servidor ahora exige
  las mismas 4 reglas que la app (8+ caracteres, mayúscula, número y símbolo).
- **Cambiar contraseña:** los errores quedan asociados a su campo para lectores
  de pantalla.
- **Alta de entrenador por script** (`create:trainer`): rechaza contraseñas
  que después no servirían para ingresar.

### Cancelar cita (servidor)

- Con el motivo **«Otro»** la nota es obligatoria. Antes el servidor la
  aceptaba vacía y la base la rechazaba con un error genérico. Hoy la app no
  muestra esta acción; el cambio deja lista la regla.

---

## 2. Sesión y mensajes de error

- **Ya no te desconecta por perder la señal.** Antes, si el token vencía justo
  sin conexión, la app cerraba la sesión. Ahora solo la cierra si el servidor
  rechaza el token.
- Si el servidor no responde, el mensaje es «El servicio no está disponible en
  este momento…» en vez de «Algo salió mal».
- La **invitación** sin conexión ya no dice «Invitación no válida»: dice «No
  pudimos cargar la invitación» y ofrece **Reintentar**.

## 3. Navegación y accesibilidad

- En recuperar contraseña, la tecla `Tab` ya no llega a botones de pasos ocultos.
- La página 404 tiene su título como encabezado para lectores de pantalla.

## 4. Privacidad y acceso desde el navegador

- **Google ya no debe indexar la app:** cabecera `noindex` en todo el dominio,
  meta `robots` y `robots.txt`. Ya está en producción. Para que desaparezca
  antes de los resultados, se puede pedir en Google Search Console.
- **La web queda bloqueada por defecto:** quien la abre ve «Ñeque está
  disponible solo en la app».
- **Switch para la presentación:** `NEQUE_WEB_ACCESS=mobile` en Vercel (+
  Redeploy) permite usar la app completa desde **navegadores móviles**; el
  escritorio sigue bloqueado. `off` vuelve a bloquear. Hoy está en `mobile`.
- **Enlaces de invitación:** con la web bloqueada, el enlace ofrece «Abrir en
  la app», que abre la IPA nueva directo en la invitación.
- **Los datos siguen protegidos por el servidor**, haya o no bloqueo: sin
  sesión o con una sesión falsa, la API responde 401, y los datos de otro
  entrenador, 404 (verificado en producción).

---

## Pendiente

- Generar e instalar la **IPA nueva** (ver arriba) y probar en el teléfono el
  enlace de invitación.
- Recorrer en vivo las pantallas del alumno desde la IPA nueva.
- **Definiciones de negocio** (detalle en `QA_AUDIT_REPORT.md`): ¿el apellido
  es obligatorio?, ¿el objetivo de la rutina es obligatorio?, qué guardar si el
  parentesco queda vacío, y cómo se distribuirá la app (tienda o TestFlight).
- Configuración externa para que los enlaces `https://` abran la app sin
  botón: cuenta de Apple Developer (Universal Links) y proyecto Android (App
  Links).

---

## 5. Nueva función: una sola sesión por cuenta

Una cuenta solo puede tener la sesión abierta en **un dispositivo a la vez**.
Si ingresas en otro, el anterior se cierra y vuelve al login con el aviso
«Tu sesión se cerró porque ingresaste desde otro dispositivo» en un modal que se cierra con «Entendido». Vale igual en
los dos sentidos y para cualquier forma de abrir sesión: login, aceptar una
invitación o recuperar la contraseña.

- **Cómo funciona:** al abrir sesión, el servidor guarda cuál es la sesión
  vigente de la cuenta (`profiles.active_session_id`). Toda petición o
  renovación de otra sesión de la misma cuenta se rechaza con
  `session_replaced`, y esa sesión se cierra también en Supabase.
- **Cuándo se entera el otro dispositivo:** en su siguiente acción o al volver a
  abrir la app; no hay aviso en tiempo real mientras está quieto.
- **Cambiar la contraseña** no cuenta como un ingreso nuevo: no saca a nadie.
- **Cuentas que aún no ingresan** desde que existe la regla no se ven
  afectadas hasta su próximo ingreso.
- **Requiere la migración** `supabase/migrations/20261103000000_active_session.sql`
  aplicada en Supabase **antes** de desplegar el código.
- **Requiere IPA nueva** para ver el aviso en la app instalada; el cierre de la
  sesión vieja funciona igual con la IPA anterior (lo hace el servidor).

## 6. Nueva función: tutorial de primer ingreso

La primera vez que un usuario entra en un dispositivo, la app lo guía por sus
pestañas: oscurece la pantalla, deja a la vista el elemento del paso y muestra
una tarjeta con «Guía», el contador («2 de 7»), el título, la explicación y
los botones **Omitir** y **Siguiente** (en el último, **Entendido**).

| Rol        | Pasos                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Alumno     | Bienvenida · Inicio · Notificaciones · Mi rutina · Progreso · Perfil (6)                            |
| Entrenador | Bienvenida · Resumen (KPIs) · Notificaciones · Alumnos · Registrar e invitar · Rutinas · Perfil (7) |

- Cada paso abre su pestaña. Si el elemento no aparece (pantalla vacía o
  cargando), la tarjeta sale centrada y el recorrido sigue.
- **Omitir** o terminar lo marcan como visto **en ese dispositivo y para ese
  usuario**: vuelve a salir al reinstalar la app o al ingresar desde otro
  teléfono.
- **Perfil → Ver tutorial** lo lanza de nuevo cuando quieras.
- Mientras corre, la pantalla de atrás no responde; se cierra también con
  `Escape` y el foco queda en «Siguiente».
- Requiere **IPA nueva** para verlo en la app instalada; en la web llega con el
  deploy.

## 7. Nueva función: modo oscuro

Paleta **Grafito**: gris neutro con el verde de marca. Contraste medido (AA =
4,5:1): texto 15,9:1, secundario 8,8:1, tenue 6,1:1, verde 9,8:1, texto de
botón 8,7:1, error 6,0:1, aviso 9,9:1.

- **Por defecto sigue al teléfono** (`prefers-color-scheme`). En **Perfil →
  Preferencias → Apariencia** se elige Automático, Claro u Oscuro; se guarda
  en el dispositivo y se aplica antes de pintar, sin destello en claro.
- En oscuro, el verde pasa a claro (`#34d3be`) y el texto de los botones, a
  verde muy oscuro: el verde oscuro del tema claro casi no se lee sobre fondo
  oscuro.
- Las etiquetas sobre fotos (comparador) siguen blancas sobre velo oscuro en
  ambos temas, y el **QR conserva su fondo blanco** para que las cámaras lo lean.
- «Ver tutorial» se movió a la nueva sección **Preferencias** del perfil.
- Requiere **IPA nueva** para verlo en la app instalada.
