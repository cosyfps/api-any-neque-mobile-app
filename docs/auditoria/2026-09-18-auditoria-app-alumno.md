# Auditoría Frontend — App del Alumno (Épicas 7 y 8)

**Fecha:** 18-09-2026 · **Rama:** `feat/NEQUE-7.2-shared-kernel`
**Skill aplicada:** `.agents/skills/auditoria-component/SKILL.md`
**Alcance:** 12 pantallas + 5 componentes compartidos. Se leyeron `.ts` y `.scss` de cada uno.

---

## 0. Reglas globales obligatorias

| Regla                           | Estado | Verificación                                                                                                                                                                                    |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overscroll / bounce desactivado | ✅     | `body { overscroll-behavior: none }`, `html { overscroll-behavior-x: none }`, viewport con `maximum-scale=1, user-scalable=no`, `provideIonicAngular({ scrollAssist: false })`                  |
| Swipe-back bloqueado            | ✅     | `swipeBackEnabled: false`, `body { touch-action: pan-y }`, `apple-mobile-web-app-capable`. Además la app usa `<router-outlet>` de Angular, no `ion-router-outlet`: el gesto de Ionic no existe. |
| Portrait-only                   | ❌     | La media query está, pero **condicionada a `and (max-height: 500px)`**                                                                                                                          |

### G-1 · Portrait-only solo cubre teléfonos — Alta

`src/styles.scss:52` — `@media (orientation: landscape) and (max-height: 500px)`.

El `max-height: 500px` limita el bloqueo a teléfonos. Un iPad en horizontal (alto 768–1024) **no dispara el mensaje** y renderiza la app apaisada: `StartPage` tiene `.hero { flex: 0 0 50% }` y `.login-panel { top: calc(50% - 145px) }`, offsets pensados para 812px de alto. Ninguna pantalla declara `max-width`.

Además **`@capacitor/screen-orientation` no está en `package.json`** (sí están camera, share y push-notifications), así que a nivel nativo nada fuerza el portrait.

> El `max-height: 500px` está documentado en `CLAUDE.md` como decisión deliberada. Se reporta igual porque la regla del skill es portrait-only sin excepción y el build de Capacitor puede instalarse en tablet.

**Recomendación:** quitar el `and (max-height: 500px)` o subirlo a `1024px`, e instalar `@capacitor/screen-orientation` con `lock('portrait')` en el arranque.

---

## 1. Tabla resumen global

| Categoría       | Estado | Issues |
| --------------- | ------ | -----: |
| UX              | ❌     |     11 |
| UI              | ❌     |      9 |
| Accesibilidad   | ❌     |     10 |
| Código Angular  | ⚠️     |      9 |
| Mobile UX       | ⚠️     |      5 |
| Reglas globales | ❌     |      1 |

**Total: 45 hallazgos** — 16 Alta, 20 Media, 9 Baja.

## 2. Gate por pantalla

| Pantalla / Componente                    | Gate | Bloqueantes              |
| ---------------------------------------- | ---- | ------------------------ |
| `StartPage`                              | ❌   | T-3, T-7, S-1, S-2       |
| `ForgotPasswordPage`                     | ❌   | T-3, T-7, F-1            |
| `InvitePage`                             | ⚠️   | T-3, I-1                 |
| `NotFoundPage`                           | ⚠️   | T-3                      |
| `StudentLayoutPage`                      | ⚠️   | L-1                      |
| `StudentHomePage`                        | ⚠️   | T-1, T-3, H-1            |
| `StudentRoutinePage`                     | ❌   | T-2 (`.check` 24px), R-1 |
| `WorkoutRunnerPage`                      | ❌   | W-1, W-2, W-3            |
| `StudentProgressPage`                    | ❌   | P-1, P-2, P-3            |
| `StudentProfilePage`                     | ❌   | PR-1 (dato falso), R-1   |
| `StudentNotificationsPage`               | ⚠️   | N-1, N-2                 |
| `StudentSchedulePage`                    | ⚠️   | N-1, SC-1                |
| `<nq-workout-card>`                      | ⚠️   | T-2 (toggle 27px), C-1   |
| `<nq-page-state>`                        | ⚠️   | T-2, A-1                 |
| `<nq-bar-chart>`                         | ⚠️   | CH-1                     |
| `<nq-line-chart>` / `<nq-ring-progress>` | ✅   | —                        |
| `DashboardPage` (entrenador)             | ❌   | Fuera de alcance — §8    |

---

## 3. Hallazgos transversales

### T-1 · `.nq-section` duplica el padding horizontal — Alta · UI

`_components.scss:323` define `.nq-section { padding: 0 var(--nq-page-px) }` (20px). Las páginas envuelven todo en `.page { padding: 24px var(--nq-page-px) 0 }` (otros 20px).

Resultado: en Home, Progreso y Perfil las secciones quedan a **40px del borde** mientras la tarjeta de IMC, la de "Hoy te toca" y el header quedan a 20px. Los títulos de sección y las tarjetas no alinean con el resto de la página.

**Recomendación:** `.nq-section { padding: 0 }` cuando vive dentro de `.page`, o quitar el padding lateral de `.page` y dejar que cada bloque use `.nq-px`.

### T-2 · Touch targets bajo 44×44 — Alta · UI

Doce controles interactivos incumplen el mínimo. Los tres primeros son acciones principales:

| Control                              | Archivo                                           | Tamaño real             |
| ------------------------------------ | ------------------------------------------------- | ----------------------- |
| `.check` — marcar ejercicio          | `student-routine.page.scss:117`                   | **24 × 24**             |
| `.photo-remove` — borrar foto        | `student-progress.page.scss:229`                  | **26 × 26**             |
| `.toggle` — switch de la tarjeta     | `workout-card.component.scss:91`                  | **46 × 27**             |
| `.confirm-btn` — confirmar sesión    | `student-schedule.page.scss:224`                  | ~13 alto (sin padding)  |
| `.mark-all`                          | `student-notifications.page.scss:33`              | ~15 alto (sin padding)  |
| `.nq-section-action` — "Agenda"      | `_components.scss:341`                            | ~17 alto (`padding: 0`) |
| `.series-btn`                        | `student-progress.page.scss:76`                   | ~27 alto                |
| `.nq-tab`                            | `_components.scss:401`                            | ~33 alto                |
| `.angle-btn`                         | `student-progress.page.scss:196`                  | ~35 alto                |
| `.month-btn`                         | `student-schedule.page.scss:38`                   | 36 × 36                 |
| `.nq-btn-sm` / `.retry-btn`          | `_components.scss:127`, `page-state.component.ts` | ~36–39 alto             |
| `.resend-btn` / `.change-email-link` | `forgot-password.page.scss:176,213`               | ~38–40 alto             |

**Recomendación:** `min-height: 44px` y `min-width: 44px` en todos, agrandando el área táctil con padding o `::after` sin cambiar el tamaño visual del ícono.

### T-3 · Contraste insuficiente en tokens de uso masivo — Alta · Accesibilidad

Ratios calculados sobre `--nq-bg` (#ffffff):

| Token                              | Valor     |      Ratio | Estado | Dónde se usa                                                                                                |
| ---------------------------------- | --------- | ---------: | ------ | ----------------------------------------------------------------------------------------------------------- |
| `--nq-text-muted`                  | `#94a8a5` | **2.50:1** | ❌     | placeholders, `.time`, `.group-label`, `.exercise-note`, `.section-empty`, labels de gráficos, tab inactiva |
| `--nq-primary` sobre blanco        | `#2cb5a0` | **2.55:1** | ❌     | `.forgot-link`, `.mark-all`, `.confirm-btn`, `.nq-btn-ghost`, `.nq-section-action`, `.nq-badge-primary`     |
| Blanco sobre `--nq-primary`        | —         | **2.55:1** | ❌     | **`.nq-btn-primary`** (todos los CTA principales)                                                           |
| Blanco sobre `--nq-gradient-start` | `#7eeacc` | **1.45:1** | ❌     | **`nq-btn-gradient`** — "Log In", "Send Code", "Verify Code"                                                |
| `--nq-primary-dark`                | `#0d9488` | **3.74:1** | ❌     | `.today-label`, `.stage-label`, `.week-summary`, `.upload`, `.pwd-rule.met`                                 |
| `--nq-danger`                      | `#ef4444` | **3.76:1** | ❌     | `.nq-field-error` — todos los errores de formulario                                                         |
| `--nq-warning`                     | `#f59e0b` | **2.15:1** | ❌     | `.nq-badge-warning` — estado "pendiente" en Agenda                                                          |
| `--nq-text-secondary`              | `#5a706d` |     5.22:1 | ✅     | —                                                                                                           |
| `--nq-success`                     | `#2e7d32` |     5.12:1 | ✅     | —                                                                                                           |

El caso peor es el botón con `nq-btn-gradient`: **texto blanco a 1.45:1 sobre el extremo claro del degradado**, en el CTA de entrada a la app.

**Recomendación:** oscurecer los tokens de texto (`--nq-text-muted` → ~`#6b7f7c`, `--nq-danger` → ~`#c62828`, `--nq-warning` → ~`#b45309`), usar `--nq-primary-dark` como color de texto/enlace sobre blanco y, en `nq-btn-gradient`, invertir el degradado o fijar el texto en `--nq-text` sobre los tramos claros.

### T-4 · Sin regiones `aria-live` en toda la app — Media · Accesibilidad

`grep -r "aria-live\|role=\"status\"\|aria-busy" src/` devuelve **cero resultados**. Un lector de pantalla no anuncia: el cambio a estado loading, el countdown de descanso del runner, el cambio de fase `exercise → rest → summary`, el marcado de notificaciones como leídas, ni el alta de una foto.

**Recomendación:** `role="status"` + `aria-live="polite"` en `<nq-page-state>` cuando `type === 'loading'`, y en el contenedor de fase del runner.

### T-5 · Sin `prefers-reduced-motion` — Media · Accesibilidad

Cero resultados en `src/`. Cada pantalla entra con `nq-ani` (fade-up), el panel de login desliza 400ms, el sheet desliza 400ms, el anillo de descanso interpola y los skeletons hacen shimmer infinito.

**Recomendación:** bloque global en `_utilities.scss` que anule `animation` y `transition` bajo `@media (prefers-reduced-motion: reduce)`.

### T-6 · Foco de teclado invisible en inputs — Media · Accesibilidad

`.nq-field-input input` (`_components.scss:44`) y `.nq-input` (`:202`) declaran `outline: none` sin `:focus-visible` que lo reponga. El único indicador es `:focus-within { border-color: var(--nq-primary-light) }` — `#7eeacc` sobre `#e2ece9`, contraste ~1.2:1, imperceptible.

`:focus-visible` solo existe en `_mixins.scss` y `start.page.scss`; no está en `.nq-btn`, `.nq-tab`, `.nq-list-item` ni en ninguna página del alumno.

### T-7 · Mezcla de idiomas — Alta · UX

`StartPage` y `ForgotPasswordPage` están **íntegramente en inglés** ("Welcome Back!", "Log In", "Email is required", "Send Code", "Verification Code", "Resend code"). Toda la app del alumno, el `<nq-page-state>`, el mensaje de rotación y los modelos de dominio están en español.

Las dos pantallas en inglés son **las primeras que ve el usuario**.

### T-8 · Escala de espaciado y tipografía no se respeta — Media · UI

La escala declarada es 4/8/12/16/24/32/40/48. Conviven valores fuera de escala en todas las pantallas: `3px`, `5px`, `6px`, `7px`, `9px`, `10px`, `13px`, `14px`, `18px`, `22px`, `26px`, `28px`, `38px`, `100px`, `120px`.

Tipografía: la escala declara Caption 12px como piso, pero hay **10px** (`.photo figcaption`, `.bell-badge`) y **11px** en trece lugares (`.metric-label`, `.target-label`, `.summary-label`, `.session-duration`, `.exercise-note`, labels de ambos gráficos…). Los títulos de pantalla usan 17/18/19px en vez del H3 = 20px declarado.

### T-9 · Sin estructura de encabezados bajo el `<h1>` — Media · Accesibilidad

`.nq-section-title` es un `<span>` en las ocho pantallas que lo usan. La navegación por encabezados de un lector de pantalla ve un solo `<h1>` y nada más. Además, en Home el `<h1>` es **el nombre del alumno**, no el título de la pantalla.

### T-10 · `new Date()` saltándose el puerto `CLOCK` — Media · Código Angular

El proyecto creó `CLOCK` precisamente para esto (`domain/shared/port/clock.port.ts`), y seis facades lo inyectan. Aun así:

- `student-home.page.ts:214` y `:220` — saludo y fecha de hoy.
- `student-progress.page.ts:291` — fecha de la foto nueva.
- `student-notifications.page.ts` — `relativeTime()` usa `Date.now()`.
- `student-routine.facade.ts:22` y `schedule.facade.ts:28` — **inyectan `CLOCK` en la línea de arriba y usan `new Date()` en la de abajo** para el estado inicial.

Efecto: tests no deterministas y el saludo/`todayLabel` quedan memoizados en un `computed` sin dependencias, así que nunca se actualizan si la pantalla queda abierta cruzando el mediodía.

### T-11 · Sin `pull-to-refresh` en ninguna lista — Media · Mobile UX

Home, Mi rutina, Progreso, Notificaciones y Agenda no ofrecen forma de recargar salvo que el estado sea `error`. Las páginas del alumno no usan `ion-content`, así que no hay `ion-refresher` disponible.

### T-12 · Falta safe-area superior — Media · Mobile UX

`index.html` declara `viewport-fit=cover`, pero la única pantalla que usa `env(safe-area-inset-top)` es `forgot-password.page.scss:48`. El resto abre con `padding-top: 16px` o `24px` fijo: en un dispositivo con notch el saludo del Home, el `<h1>` de cada pantalla y el botón "Volver" quedan bajo la barra de estado.

### T-13 · `.nq-scroll` es inerte en las páginas — Baja · Código Angular

`.nq-scroll` (`_utilities.scss:192`) aplica `flex: 1; overflow-y: auto`. Se usa en seis `.page`, pero el contenedor padre `.layout-content` no es flex y `.page` no tiene altura acotada, así que ni `flex` ni `overflow` hacen nada — el scroll real lo hace `.layout-content`. En `student-routine.page.ts:34` se aplica además a `.day-tabs`, donde su `overflow-x: hidden` contradice el `overflow-x: auto` local.

### T-14 · Mezcla de `@Input()` decorador y signals — Baja · Código Angular

`page-state`, `workout-card` y los tres gráficos usan `@Input()` con setters que escriben en un `signal` privado. El resto del código es signal-first. Angular 17 ya ofrece `input()` / `input.required()`.

---

## 4. Hallazgos por pantalla

### StartPage

**S-1 · Reglas de contraseña en el login — Alta · UX/Funcionalidad**
`start.page.ts:246` muestra las 4 reglas de composición mientras el usuario _ingresa_, y `formValid()` exige `passwordValid()` (`:331`). Un usuario cuya contraseña vigente no cumple las reglas actuales **no puede pulsar "Log In"**: el botón queda deshabilitado sin explicar por qué. Las reglas pertenecen a `/invite` (donde ya están) y a un futuro cambio de contraseña.
_Recomendación:_ en login, validar solo `required`; el backend decide si la credencial sirve.

**S-2 · Panel de login sin scroll y recortado — Alta · Mobile UX**
`<ion-content [scrollY]="false">` + `.form-section { overflow: hidden }` (`start.page.scss:120`) + `.login-panel { top: calc(50% - 145px) }`. En un iPhone SE (568px) el alto disponible es ~429px y el formulario mide ~520px con la lista de reglas desplegada: el botón "Log In" y el texto de ayuda **quedan fuera y son inalcanzables**. Con el teclado virtual abierto, y `scrollAssist: false`, el campo de contraseña también queda tapado.

**S-3 · `toggle-password` sin nombre accesible — Media · Accesibilidad**
`start.page.ts:213` — botón de solo ícono sin `aria-label`. La misma acción en `invite.page.ts:78` sí lo tiene y alterna el texto; replicar ese patrón.

**S-4 · `aria-label="Go back"` en un botón que cierra — Baja · UX**
`start.page.ts:99` — el ícono es una X y la acción es `showLogin = false`; no navega.

**S-5 · Estado mutable fuera de signals — Baja · Código Angular**
`showLogin`, `showPassword` y `passwordFocused` son campos planos; el resto de la app usa `signal()`.

### ForgotPasswordPage

**F-1 · El flujo nunca restablece la contraseña — Alta · UX/Funcionalidad**
La pantalla promete "Enter your email… to reset your password", pero tras verificar el OTP `onVerifyOtp()` (`:413`) hace `session.adopt(session)` y navega al home del rol. **No existe el paso 3 de nueva contraseña.** El resultado es que un código de 6 dígitos funciona como credencial completa y la contraseña anterior sigue vigente.
_Recomendación:_ agregar el paso "Nueva contraseña" reutilizando `passwordRules()` y el layout de `/invite` antes de adoptar la sesión.

**F-2 · OTP sin `autocomplete="one-time-code"` — Media · Funcionalidad**
`:179` — sin este atributo iOS y Android no ofrecen el autorrelleno del código, que es la única forma cómoda de completarlo. Tampoco hay `enterkeyhint`.

**F-3 · `setTimeout` de foco sin limpiar — Baja · Código Angular**
`:317` — `setTimeout(() => this.otpInputs.first?.nativeElement.focus(), 100)` no se cancela en `onDestroy`.

### InvitePage

**I-1 · La página importa un adapter de `infrastructure` — Alta · Código Angular**
`invite.page.ts:10` importa `InvitationMockAdapter` y lo registra en sus `providers` (`:28`). Es la única página que rompe la regla de dependencias documentada en `CONTRIBUTING.md` (`ui → application/domain`) y **rompe el criterio de éxito de la arquitectura**: conectar el BFF obligaría a editar este archivo de `ui`.
_Recomendación:_ mover el trío a un `provideInvitationData()` en `infrastructure` y referenciarlo desde el `providers` de la ruta `invite/:token` en `app.routes.ts`.

**I-2 · Reglas de contraseña sin vínculo con el campo — Media · Accesibilidad**
El `<ul class="pwd-rules">` (`:94`) no tiene `id` y el input no lo referencia con `aria-describedby`.

**I-3 · Estado `empty` renderizado como `error` sin mensaje — Baja · UX**
`:53` usa `type="error"` con `title` pero sin `message`; el usuario ve una tarjeta de error muda.

**I-4 · `/invite/:token` sin `publicOnlyGuard` — Media · Funcionalidad**
`app.routes.ts:19` — un usuario ya autenticado puede abrir un enlace de invitación y aceptar, sobrescribiendo su sesión actual.

### StudentLayoutPage

**L-1 · Notificaciones y Agenda dejan el tab bar sin pestaña activa — Media · UX**
`isActive()` (`:79`) hace `startsWith` de la URL contra las 4 rutas de tab. `/student/notifications` y `/student/schedule` son hijas del layout pero no coinciden con ninguna, así que **las cuatro pestañas quedan apagadas** y el usuario pierde la referencia de dónde está. El comentario de `activeTab` (`:76`) afirma lo contrario; además el runner ni siquiera vive dentro del layout.

**L-2 · `inject(Router)` tres veces — Baja · Código Angular**
`:70`, `:73` y `:76`.

### StudentHomePage

**H-1 · El header se pinta fuera del `@switch` — Media · UX**
`:36-56` — durante `loading` y `error` se ve el saludo con el fallback "Alumno" y la campanita; al resolver, el nombre cambia de golpe.

**H-2 · Badge de notificaciones sin anunciar — Media · Accesibilidad**
`:44` — `aria-label="Notificaciones"` fijo; el número de no leídas nunca llega al lector de pantalla.

**H-3 · `todayLabel` no se usa — Baja · Código Angular** (`:220`)

**H-4 · El modo `upcoming` de `<nq-workout-card>` no se usa en ningún lado — Media · Código Angular**
Los próximos entrenamientos se renderizan con `mode="progress"` (`:167`), mostrando una barra al 0% y un chevron. La rama `upcoming` con toggle — la mitad del componente, su `@Output() toggled` y todo el CSS de `.toggle`/`.toggle-knob` — es código muerto.

### StudentRoutinePage

**R-1 · Overlays siempre presentes y sin focus trap — Media · Accesibilidad**
`.nq-overlay` cerrado solo aplica `opacity: 0; pointer-events: none` (`_components.scss:436`), **no `visibility: hidden` ni `inert`**. Los botones del sheet de celebración (Rutina) y del de cerrar sesión (Perfil) siguen en el árbol de accesibilidad y son alcanzables con Tab mientras el modal está invisible — en Perfil eso significa poder activar "Cerrar sesión" sin verlo. Tampoco hay focus trap, ni cierre con `Escape`, ni `aria-labelledby`.

**R-2 · `role="progressbar"` sin nombre ni rango — Media · Accesibilidad**
`:82` declara `aria-valuenow` sin `aria-valuemin`/`aria-valuemax` ni `aria-label`. Mismo patrón en `workout-runner.page.ts:57` y `workout-card.component.ts:26` (este sí trae min/max, le falta el nombre).

**R-3 · `aria-label` del check no refleja el estado — Baja · Accesibilidad**
`:105` siempre dice "Marcar X", incluso cuando `aria-checked="true"`.

### WorkoutRunnerPage

**W-1 · `saving()` es un `computed` que siempre devuelve `false` — Alta · Funcionalidad**
`:231` — `readonly saving = computed(() => false);` alimenta `[disabled]="saving()"` del botón "Guardar y volver" (`:215`). El botón **nunca se deshabilita**, así que un doble toque dispara `finish()` dos veces: dos persistencias de la sesión y dos `navigate`.

**W-2 · Salir en medio del entrenamiento sin confirmar — Media · UX**
`exit()` (`:255`) navega a `/student/routine` sin aviso. Se pierde el cronómetro y la fase en curso; no hay forma de retomar la sesión donde iba.

**W-3 · Sin scroll y contenido que puede no caber — Media · Mobile UX**
`[scrollY]="false"` con `.runner { height: 100% }` y `.stage` centrado. En la fase `exercise` el bloque suma label + título (hasta 2 líneas) + badge de serie + 3 tarjetas de objetivo + CTA + fila de navegación ≈ 430px, más header y barra ≈ 90px. En pantallas de 568px de alto se recorta sin posibilidad de scroll.

**W-4 · Cambios de fase mudos para lectores de pantalla — Media · Accesibilidad** (ver T-4)

### StudentProgressPage

**P-1 · Borrar foto sin confirmación — Alta · UX**
`remove()` (`:299`) llama a `removePhoto` en el toque. Es destructivo, irreversible y el botón mide 26×26 junto al borde de la miniatura: el toque accidental es probable.

**P-2 · La pestaña "Fotos" queda bloqueada por el estado de las evaluaciones — Alta · Funcionalidad**
El `@switch (facade.viewState())` (`:48`) envuelve **las dos** pestañas, y `viewState()` viene de las evaluaciones. Un alumno sin evaluaciones ve "Sin evaluaciones aún" también en Fotos: **no puede subir su primera foto**, que es justamente lo que un alumno nuevo querría hacer.
_Recomendación:_ sacar el `@switch` de la rama `photos` y darle su propio estado.

**P-3 · El uploader no es alcanzable con teclado — Media · Accesibilidad**
`.upload input { display: none }` (`:218`) saca el input del orden de tabulación y el `<label>` no es focusable. Usar una clase visually-hidden (`position: absolute; opacity: 0; width: 1px`) en vez de `display: none`.

**P-4 · Sin feedback al subir una foto — Media · UX**
`onFile()` lee el archivo y llama a `addPhoto()` con `void`: entre el toque y la aparición de la miniatura pasan ~420ms de mock sin spinner ni deshabilitar el control. Tampoco hay manejo de error de `FileReader`.

**P-5 · "Peso actual" puede renderizarse vacío — Media · UI**
`:79` — `{{ facade.latest()?.weightKg }} kg` imprime " kg" si `latest()` es `null`. La regla de dashboards pide `—`, como sí hace Perfil (`student-profile.page.ts:70`).

**P-6 · El comparador no es el que se planificó — Media · Documentación**
El plan de la Épica 8 describe un comparador con divisor arrastrable; lo implementado son dos `<figure>` lado a lado. Alinear el plan con la realidad o completar la funcionalidad.

> **Corrección del 19-09-2026.** La primera redacción de este hallazgo culpaba al ticket
> `T-8.6.7`, y el ticket era correcto: dice «lado a lado». Quien prometía el arrastre era
> el plan de la sesión. Resuelto en `T-11.6.21`: el comparador ahora arrastra.

### StudentProfilePage

**PR-1 · Nombre del entrenador hardcodeado en la plantilla — Alta · Funcionalidad**
`student-profile.page.ts:117` — `<span class="trainer-name">Kelvin Moreno</span>`. **Todo alumno ve el mismo nombre**, sea quien sea su entrenador. Es un dato falso mostrado en producción.
_Recomendación:_ `AuthUser.profileId` ya viaja en la sesión; exponer `trainerName` desde `StudentProfileFacade` vía `STUDENTS_PORT`.

**PR-2 · `.nq-sheet-handle` sugiere un gesto que no existe — Media · UX**
`:139` pinta el asa de arrastre del bottom sheet, pero no hay handler de swipe-down: el usuario arrastra y no pasa nada.

**PR-3 · `bmiLabel` no se usa — Baja · Código Angular** (`:186`)

### StudentNotificationsPage y StudentSchedulePage

**N-1 · "Volver" siempre va a Home — Media · UX**
`student-notifications.page.ts:145` y `student-schedule.page.ts:218` hacen `navigate(['/student/home'])` fijo. Ambas pantallas se alcanzan también desde Perfil (`student-profile.page.ts:88,94`): al volver, el usuario aterriza en Home en lugar de donde estaba.

**N-2 · `aria-label` en un `<span>` sin rol — Media · Accesibilidad**
`student-notifications.page.ts:97` — `<span class="dot" aria-label="No leída">`. En un elemento genérico sin rol el `aria-label` se ignora; el estado "no leída" solo existe como color de fondo.

**SC-1 · "Confirmar" sin estado ni protección — Media · Funcionalidad**
`student-schedule.page.ts:214` — `void this.facade.confirm(...)` sin deshabilitar el botón ni mostrar progreso; doble toque, doble llamada.

**SC-2 · El día seleccionado no se comunica — Media · Accesibilidad**
`:112` — `dayAria()` devuelve solo el número ("15", "15, con sesiones"): sin mes, sin día de la semana y sin `aria-pressed`/`aria-selected` que indique cuál está elegido. El calendario tampoco declara `role="grid"`.

### Componentes compartidos

**A-1 · `<nq-page-state>` sin semántica de estado — Media · Accesibilidad**
Ni el skeleton de `loading` ni las tarjetas de `error`/`empty` declaran `role="status"`, `role="alert"` o `aria-busy`.

**A-2 · Estilos inline en la plantilla — Baja · UI**
`page-state.component.ts:19-30` — `style="width:44px;height:44px"`, `style="flex:1;display:flex;…"`, `style="height:100px"`. Valores crudos fuera del design system.

**C-1 · `role="progressbar"` sin nombre accesible en la tarjeta — Media · Accesibilidad** (`workout-card.component.ts:26`)

**C-2 · `#fff` hardcodeado en 10 archivos — Baja · UI**
`workout-card.component.scss:114`, `invite.page.scss:85`, `student-home.page.scss:57,70`, `student-routine.page.scss:136,240`, `student-progress.page.scss:239`, `student-schedule.page.scss:108,112`, `workout-runner.page.scss:212`, más `_mixins.scss:11`. Existe `--nq-text-inverse`.

**CH-1 · `<nq-bar-chart>` genera claves duplicadas en `@for` — Media · Código Angular**
`student-home.page.ts:19` define `WEEKDAY_LABELS = ['L','M','M','J','V','S','D']` — martes y miércoles comparten la "M". El componente hace `@for (bar of bars(); track bar.label)` en **dos** bucles (`bar-chart.component.ts:18` y `:31`). Angular exige claves únicas en `track`; con duplicados reusa y reordena nodos mal, y en dev emite `NG0955`.
_Recomendación:_ `track $index` en ambos bucles, o incluir el índice en la clave.

---

## 5. Lo que sí está bien

No todo es hallazgo. Vale registrar lo que pasó la revisión:

- Los **cuatro estados** (`loading` / `error` / `empty` / `success`) existen en las 8 pantallas con datos, con el mismo patrón `@switch (facade.viewState())` y `<nq-page-state>`. Es el punto más sólido del código.
- **Cero fugas de suscripción**: todo pasa por `takeUntilDestroyed(destroyRef)` o `toSignal`; los timers del runner y del reenvío de OTP se limpian en `DestroyRef.onDestroy`.
- **Protección contra doble submit** correcta en login, invitación, cerrar sesión, marcar ejercicio y completar sesión (la única excepción es W-1).
- **Validación inline** junto al campo con `aria-describedby` y `role="alert"` en los tres formularios; nada de alertas genéricas.
- `-webkit-tap-highlight-color: transparent` en **29 de 30** elementos interactivos.
- El enmascarado del correo en el paso OTP (`maskedEmail()`) es buena práctica de privacidad.
- Los gráficos son SVG inline con la matemática pura y testeada en `chart-math.ts`, con `role="img"` + `aria-label`, ids de degradado únicos por instancia y cero dependencias nuevas.
- `canMatch` en los guards: el chunk del rol equivocado ni se descarga.

---

## 6. Correcciones — Frontend (implementar ahora)

Priorizadas. Las 9 primeras son las que bloquean el gate.

1. **PR-1** — Quitar "Kelvin Moreno" hardcodeado del Perfil y traer el nombre del entrenador desde el puerto.
2. **T-3** — Corregir los tokens de contraste: `--nq-text-muted`, `--nq-danger`, `--nq-warning`, y el texto de `nq-btn-gradient` / `.nq-btn-primary`.
3. **T-2** — `min-height`/`min-width` de 44px en los 12 controles listados, empezando por `.check` (24px), `.photo-remove` (26px) y `.toggle` (27px).
4. **W-1** — Reemplazar `saving = computed(() => false)` por un `signal` real y deshabilitar "Guardar y volver" mientras `finish()` corre.
5. **P-2** — Sacar la pestaña "Fotos" del `@switch` de evaluaciones.
6. **P-1** — Confirmación antes de borrar una foto (reutilizar el `.nq-sheet` de Perfil).
7. **S-1** — Quitar las reglas de composición del formulario de login y validar solo `required`.
8. **S-2 / W-3** — Permitir scroll en `StartPage` y `WorkoutRunnerPage` (quitar `[scrollY]="false"` o dar `overflow-y: auto` al contenedor).
9. **T-1** — Resolver el doble padding de `.nq-section` dentro de `.page`.
10. **F-1** — Agregar el paso "Nueva contraseña" al flujo de recuperación.
11. **T-7** — Traducir `StartPage` y `ForgotPasswordPage` al español.
12. **I-1** — Mover `InvitationMockAdapter` fuera de `invite.page.ts` a un `provideInvitationData()`.
13. **G-1** — Ampliar la media query de landscape e instalar `@capacitor/screen-orientation`.
14. **R-1** — `visibility: hidden` / `inert` en `.nq-overlay` cerrado, focus trap y cierre con `Escape`.
15. **T-6** — `:focus-visible` en `.nq-btn`, `.nq-tab`, `.nq-list-item` y los inputs.
16. **T-4 / T-5** — `role="status"` en el estado loading y bloque `prefers-reduced-motion`.
17. **CH-1** — `track $index` en `<nq-bar-chart>`.
18. **L-1** — Mantener la pestaña de origen activa en Notificaciones y Agenda.
19. **N-1** — "Volver" que respete la pantalla de origen.
20. **T-12** — `env(safe-area-inset-top)` en el `padding-top` de todas las páginas.
21. **T-10** — Usar `CLOCK` en Home, Progreso, Notificaciones y en los dos facades que lo inyectan sin usarlo.
22. **P-3 / P-4** — Uploader accesible por teclado y con feedback de carga.
23. **W-2 / PR-2 / SC-1** — Confirmación al salir del runner, gesto real (o quitar el asa) en el sheet, estado de carga en "Confirmar".
24. **H-4** — Usar o eliminar el modo `upcoming` de `<nq-workout-card>`.
25. **T-8 / T-9** — Normalizar espaciados/tipografías fuera de escala y convertir `.nq-section-title` en `<h2>`.
26. Limpieza menor: **H-3**, **PR-3**, **F-3**, **L-2**, **T-13**, **C-2**, **A-2**, **S-4**, **S-5**, **I-3**, **R-3**.

## 7. Correcciones — Backend (implementación futura)

1. **F-1** — Endpoint de `reset-password` que reciba el OTP verificado y la nueva contraseña; hoy `AUTH_PORT.verifyOtp` devuelve una sesión directa.
2. **F-2** — Envío real del código y ventana de expiración; el reenvío de 60s hoy solo existe en el cliente.
3. **PR-1** — `StudentsPort` debe exponer el entrenador asignado (nombre e id) en la ficha del alumno.
4. **P-4** — Subida real de imágenes: hoy la foto vive como data-URL en memoria, sin límite de tamaño ni compresión. Requiere almacenamiento, validación de tipo/peso y URLs firmadas.
5. **T-11** — Endpoints de refresco para el pull-to-refresh, con invalidación por `ETag` o `updatedAt`.
6. **H-2 / T-4** — Conteo de no leídas en servidor y push (`@capacitor/push-notifications` ya está instalado, sin usar).
7. **SC-1** — Confirmación de sesión agendada con persistencia y resolución de conflictos.
8. **I-4** — Invalidación del token de invitación en servidor al aceptarlo y al expirar.
9. **Trainer (Épica 9)** — Todo lo de §8.

## 8. Fuera del alcance de esta sesión — `DashboardPage` (entrenador)

Se audita para dejar constancia; la Épica 9 lo ampliará.

- `state = signal<ViewState>('success')` fijo y `loadData()` con `// TODO: wire to service`: los estados `loading`/`error`/`empty` son inalcanzables.
- `<h1 class="greeting-name">Kelvin</h1>` hardcodeado, igual que PR-1.
- Métricas fijas en `&mdash;`.
- `app.routes.ts:29-45` — **`/trainer/clients`, `/trainer/routines` y `/trainer/profile` cargan los tres `DashboardPage`**: pulsar "Clientes" no cambia nada visible.
- `.metric`, `.section`, `.section-title` locales duplican `.nq-metric`, `.nq-section`, `.nq-section-title` globales.
- `constructor(private router: Router)` y `new Date()` en campos, contra la convención `inject()` + `CLOCK` del resto del proyecto.

---

## 9. Gate de aprobación

# ❌ NO APROBADO

No por inacabado — el flujo del alumno está completo y navegable, y la arquitectura por capas se sostiene — sino por cinco defectos que no son cosméticos:

1. **PR-1** — El Perfil muestra un nombre de entrenador falso a todos los alumnos.
2. **T-3** — Los CTA principales tienen texto blanco a **1.45:1** y **2.55:1**; los errores de formulario a 3.76:1. Ninguna pantalla pasa WCAG AA.
3. **T-2** — La acción central de "Mi rutina" (marcar ejercicio) es un target de **24×24**, y borrar una foto —destructivo e irreversible— mide 26×26 y **no pide confirmación** (P-1).
4. **W-1** — "Guardar y volver" del runner nunca se deshabilita: doble toque, doble guardado.
5. **P-2** — Un alumno sin evaluaciones no puede subir su primera foto.

Los puntos 1 a 9 de §6 deben cerrarse antes del push. El resto puede ir en una segunda tanda sin bloquear el avance.
