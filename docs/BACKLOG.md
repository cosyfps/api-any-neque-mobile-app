# Backlog — Ñeque

Descomposición del trabajo en **épicas → historias → tickets**. La regla operativa es
**1 ticket = 1 rama = 1 PR**, salvo los tickets sin cambio de lógica (documentación,
plantillas, configuración del repo), que se trabajan directo sobre `develop`
(ver [`CONTRIBUTING.md`](../CONTRIBUTING.md)).

Ñeque es una app de entrenadores personales, **invitation-only**: solo un entrenador crea
cuentas de alumnos.

**Estado a 2026-09-27.** El código sigue **arquitectura hexagonal por `{capa}/{feature}`**
y **las dos apps están completas y navegables** contra adapters mock.

- **Alumno:** login por rol, invitación, home con IMC y progreso semanal, rutina con
  ejecución paso a paso, progreso con gráficos y fotos, agenda y notificaciones.
- **Entrenador:** shell propio de cuatro pestañas, cartera con búsqueda y filtro, alta
  con invitación de 48 h (enlace, compartir nativo y QR), ficha con anamnesis,
  evaluaciones y suspensión, biblioteca de rutinas con constructor y asignación,
  ejercicios propios e Inicio con conteos reales.

La conexión al BFF es la Épica 10.

Desde el 2026-09-25 la app se publica como **IPA** y se prueba en un iPhone 12 Pro. Lo
que sale de cada prueba se registra en la **Épica 13**, una historia por release
(0.0.1 → 0.0.4). La Épica 12, cierre de brechas contra el PRD, está planificada.

> Nota de proceso: en las Épicas 7 y 8 se trabajó **una rama por historia** en vez de una
> por ticket. Los tickets de una misma HU tocan los mismos archivos y no se podían aislar
> en commits separados sin `git add -p`.

---

## Diagnóstico verificado (2026-08-17)

Hechos confirmados leyendo el código y ejecutando los comandos reales del repo — no son
supuestos de diseño. Es la foto que originó la Épica 0; la columna **Estado** indica qué
quedó resuelto y con qué ticket.

| Área | Hallazgo | | Estado |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | | ------ |
| Testing | **0 archivos `.spec.ts`** en todo `src/`, pese al `coverageThreshold.global` de 80% en las 4 métricas declarado en el bloque `jest` de `package.json`. | ✅ T-0.2.2/0.2.3/0.2.4 — 6 archivos `.spec.ts`, 69 tests |
| `test:coverage` | `npm run test:coverage` → `"No tests found, exiting with code 0"` (pasa por `--passWithNoTests`). | ✅ T-0.2.1 — corre specs reales |
| `coverage-summary.json` | Con cero specs, las 4 métricas quedan como el string `"Unknown"` (no `0`) — confirmado ejecutando el comando arriba y leyendo el archivo generado. | ✅ T-0.2.2/0.2.3/0.2.4 — 99.13 / 91.11 / 100 / 100 |
| `ci.yml` — "Verify coverage threshold" | Promedia las 4 métricas del summary. `"Unknown"` concatenado 4 veces `/ 4` da `NaN`, y `NaN < 80` es `false` en JS → el step imprime `OK` y pasa. **Falso verde activo hoy.** | ✅ T-0.2.5 — compara métrica por métrica y exige valores numéricos |
| `ci.yml` — `ci-gate` | Agrega `needs.*.result` y falla solo si matchea `/failure\|cancelled/` — no contempla `skipped` explícitamente. Hoy no es explotable (el DAG es lineal y cualquier fallo real también aparece como `failure`), pero conviene endurecerlo. | ✅ T-0.2.5 — `skipped` incluido en el patrón |
| `tsconfig.spec.json` | `"types": ["jasmine"]` aunque el runner real es Jest. | ✅ T-0.2.1 — `["jest"]` |
| `angular.json` | Conserva el target `test` con builder Karma (muerto; Jest corre por fuera vía script npm). Tampoco declara `fileReplacements`: `environment.prod.ts` es código muerto. | ✅ T-0.2.1 / T-0.3.1 — target Karma eliminado y `fileReplacements` agregado |
| `commitlint.config.js` | Comentario residual `// Tipos permitidos para FitConnect` — un tercer nombre de proyecto heredado (ni Ñeque ni ningún otro usado en el repo). | ✅ T-0.3.2 — comentario eliminado |
| `.github/` | No existe `pull_request_template.md`, ni `ISSUE_TEMPLATE/`, ni `CODEOWNERS`. | ✅ T-0.1.3 — plantillas, `ISSUE_TEMPLATE/` y `CODEOWNERS` creados |
| Git remoto | Solo existe `main` en `origin` (`gh api .../branches`). `develop` no está publicada — sí queda una local, remanente de trabajo previo. | ⬜ T-0.1.1 — pendiente de publicar |
| Branch protection | No configurada en `main` (`gh api .../branches/main/protection` → `404 Branch not protected`). Ahora es posible: el repositorio se hizo público durante esta sesión (antes daba 403 por plan Free + privado). | ⬜ T-0.1.2 — pendiente de configurar |
| `_components.scss` / `_utilities.scss` | Definen versiones **duplicadas y con valores distintos** de `.nq-state`, `.nq-state-icon`, `.nq-state-title`, `.nq-state-desc` y `.nq-divider`. | ✅ T-0.3.3 — se conserva solo la copia de `_components.scss` |
| Tipografía | `'Inter'` está en `--nq-font-family` pero nunca se carga — sin `@font-face`, sin `<link>`, `src/assets/` vacío salvo `.gitkeep`. | ✅ T-0.3.4 — Inter self-hosteada en `src/assets/fonts/` |
| Auth | `StartPage.onLogin()`, los tres handlers de `ForgotPasswordPage` (`onSendCode`/`onVerifyOtp`/`resendCode`) y `DashboardPage.loadData()` tienen `// TODO: wire to (auth) service` — no hay backend conectado. | ⬜ Épica 1 |
| `environments/` | `supabaseUrl`/`supabaseAnonKey` declarados y vacíos, sin ningún consumidor — única pista de que Supabase era el backend planeado. `flowApiUrl` (Flow.cl) también declarado y sin uso; no hay evidencia de una feature de pagos más allá de esa URL. | ➡️ `fileReplacements` ya conectado (T-0.3.1); las claves siguen vacías hasta la Épica 1 |
| Rutas | `/trainer/clients`, `/trainer/routines` y `/trainer/profile` cargan el mismo `DashboardPage` como placeholder — no son páginas propias todavía. | ⬜ Épicas 2–4 |
| Dependencias | `@capacitor/camera`, `@capacitor/push-notifications` y `@capacitor/share` están instaladas pero **sin ningún código que las use**. | ⬜ Fuera de alcance por ahora |
| GitHub | 4 PRs ya mergeados (#1–#4, ver tablero), **0 issues** creados. | ⬜ Sin cambios |

### Decisiones tomadas

- El repositorio se hizo público el 2026-08-17 (durante la sesión que abrió este backlog)
  para poder configurar branch protection real en el plan Free de GitHub.
- El backlog cubre primero la **Épica 0** (fundación real, fundada en el diagnóstico de
  arriba) y luego un **roadmap de producto inferido** de las rutas placeholder existentes
  (Épicas 1–5). Las épicas 1–5 son una propuesta a confirmar/ajustar, no un alcance ya
  validado — cada una lo indica explícitamente.
- Prefijo de ticket: **`NEQUE-<épica>.<historia>.<ticket>`**.
- Sin automatización de creación de issues por script: el backlog vive solo como este
  documento Markdown, sin `scripts/create-issues.sh` ni equivalente.

---

## ÉPICA 0 — Fundación y Desbloqueo de CI real

> Deja el pipeline verde de verdad — sin el `NaN` que hoy lo maquilla —, publica `develop`
> con protección real y limpia los residuos de configuración heredados. Sin esta épica
> ningún ticket de producto debería mergear con confianza.
>
> **Definición de terminado:** `develop` publicada y protegida junto con `main`, `ci-gate`
> en verde con cobertura real (no `NaN`), cero residuos de Karma/Jasmine ni nombres de
> proyecto heredados, plantillas de GitHub en su lugar.
>
> **Estado:** todo el trabajo sobre archivos está cerrado (ver tablero). Pendiente solo la
> parte operativa en GitHub: T-0.1.1, T-0.1.2 y T-0.1.7.

### HU-0.1 — Infraestructura de Gitflow

| Ticket  | Rama                      | Qué hace                                                                                                                                                     |
| ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-0.1.1 | _(sin PR)_                | Recrear y publicar `develop` desde `main` — hoy `origin` solo tiene `main`.                                                                                  |
| T-0.1.2 | _(sin PR)_                | Branch protection en `main` y `develop`: required check `ci-gate`, PR obligatorio con **0 aprobaciones**, sin force-push ni borrado de rama. Ver nota abajo. |
| T-0.1.3 | `develop` (directo)       | `pull_request_template.md`, `ISSUE_TEMPLATE/` (bug, feature, task), `CODEOWNERS` — no existen hoy.                                                           |
| T-0.1.4 | `develop` (directo)       | `CONTRIBUTING.md`.                                                                                                                                           |
| T-0.1.5 | `develop` (directo)       | Este documento.                                                                                                                                              |
| T-0.1.6 | `develop` (directo)       | `README.md`.                                                                                                                                                 |
| T-0.1.7 | **PR `develop` → `main`** | Bootstrap del gitflow: lleva a `main` la infraestructura de T-0.1.3/0.1.4/0.1.5/0.1.6 y valida que `ci-gate` corre y bloquea.                                |

T-0.1.3, T-0.1.4, T-0.1.5 y T-0.1.6 no cambian lógica — solo documentación y
plantillas — así que van directo sobre `develop` sin rama propia. El PR de T-0.1.7 los
agrupa a los cuatro.

**Nota sobre T-0.1.2 — por qué 0 aprobaciones.** GitHub no permite aprobar tu propio PR.
En un repo de una sola persona, exigir 1 aprobación bloquearía todos los merges. Se exige
PR + `ci-gate` en verde, que es lo que realmente protege. Si más adelante entran
colaboradores, subir el número es un cambio de un campo.

`enforce_admins` queda en `false` a propósito: el owner puede seguir commiteando directo
sobre `develop` para los tickets sin cambio de lógica. Para cualquier otra cuenta, el push
directo a `main` y `develop` es rechazado.

**Criterios de aceptación:** el PR `develop` → `main` dispara `ci-gate` y no puede mergear
sin él; una cuenta no-admin no puede pushear directo a `main` ni a `develop`.

### HU-0.2 — Desbloquear el gate de coverage real

| Ticket  | Rama                                              | Qué hace                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0.2.1 | `ci/NEQUE-0.2.1-jest-config-fix`                  | `tsconfig.spec.json`: `"types": ["jasmine"]` → `["jest"]`. Eliminar el target `test` con builder Karma de `angular.json` (muerto). En `package.json`, cambiar `setupFiles` → `setupFilesAfterEnv` — **a validar empíricamente con un spec real durante el ticket**, no asumido como bug confirmado sin evidencia.                                                       |
| T-0.2.2 | `test/NEQUE-0.2.2-start-page-specs`               | Specs de `StartPage`: validación de email, las 4 reglas de password, `formValid`, toggle del panel de login, `isSubmitting`.                                                                                                                                                                                                                                            |
| T-0.2.3 | `test/NEQUE-0.2.3-forgot-password-specs`          | Specs de `ForgotPasswordPage`: OTP auto-advance, backspace, paste de 6 dígitos, countdown de reenvío, enmascarado de email.                                                                                                                                                                                                                                             |
| T-0.2.4 | `test/NEQUE-0.2.4-trainer-layout-dashboard-specs` | Specs de `TrainerLayoutPage` (tab activa vía `toSignal(NavigationEnd)`) y `DashboardPage` (switch de estados, `greetingLabel` según hora del día).                                                                                                                                                                                                                      |
| T-0.2.5 | `ci/NEQUE-0.2.5-harden-ci-gate`                   | Dos endurecimientos de `ci.yml`: (1) el step "Verify coverage threshold" debe comparar cada métrica individualmente y validar que sean numéricas antes de comparar, no promediarlas — hoy el promedio con `"Unknown"` da `NaN` y pasa. (2) sumar `skipped` al patrón del agregador de `ci-gate` por defensividad, aunque hoy no sea explotable en el DAG lineal actual. |

**Orden:** T-0.2.1 primero — el resto depende de que Jest corra specs reales.

**Criterios de aceptación:** `npm run lint && npm run typecheck && npm run test:coverage && npm run build:prod`
pasa limpio (lint y typecheck ya pasan hoy) y `ci-gate` reporta verde por cobertura real,
no por `NaN`.

### HU-0.3 — Limpieza de configuración y estilos

| Ticket  | Rama                                           | Qué hace                                                                                                                                                |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0.3.1 | `chore/NEQUE-0.3.1-add-file-replacements`      | `fileReplacements` en `angular.json` para que un build de producción use de verdad `environment.prod.ts`.                                               |
| T-0.3.2 | `chore/NEQUE-0.3.2-commitlint-cleanup`         | Quitar el comentario `// Tipos permitidos para FitConnect` de `commitlint.config.js`.                                                                   |
| T-0.3.3 | `fix/NEQUE-0.3.3-dedupe-state-divider-classes` | Resolver los duplicados `.nq-state`, `.nq-state-icon`, `.nq-state-title`, `.nq-state-desc`, `.nq-divider` entre `_components.scss` y `_utilities.scss`. |
| T-0.3.4 | `feat/NEQUE-0.3.4-self-host-inter-font`        | Self-hostear Inter en `src/assets/fonts/` (`@font-face`) o quitarla de `--nq-font-family` si no se va a usar.                                           |

---

## ÉPICA 1 — Autenticación real (Supabase) — **re-encuadrada**

> ⚠️ **Esta épica quedó superada (2026-09-17).** Se descartó que la app hable directo
> con Supabase: hablará con un **BFF propio**, y hasta que exista se trabaja contra
> adapters mock detrás de puertos. El alcance funcional se cumplió en la **Épica 7**.
>
> | Ticket  | Estado                                                        |
> | ------- | ------------------------------------------------------------- |
> | T-1.1.1 | ❌ **Descartado.** No se instala `@supabase/supabase-js`.     |
> | T-1.1.2 | ➡️ Absorbido por T-7.3.1 / T-7.3.2 / T-7.3.3.                 |
> | T-1.2.1 | ➡️ Absorbido por T-7.3.4.                                     |
> | T-1.2.2 | ➡️ Absorbido por T-7.3.5 (guard por rol, no solo por sesión). |
> | T-1.3.1 | ➡️ Absorbido por T-7.3.6.                                     |
>
> Las claves `supabaseUrl`/`supabaseAnonKey` de `environments/` quedan como código
> muerto hasta la Épica 10, que las reemplaza por `apiBaseUrl`.

<details>
<summary>Contenido original de la épica</summary>

> _Roadmap inferido de los `// TODO: wire to auth service` existentes y del scaffolding
> vacío de `supabaseUrl`/`supabaseAnonKey` en `environments/`._
>
> **Definición de terminado:** `StartPage.onLogin()` y el flujo completo de
> `ForgotPasswordPage` llaman a un servicio de auth real; `/trainer` está protegido por
> un guard que redirige a `/` si no hay sesión.

### HU-1.1 — Cliente Supabase y AuthService

| Ticket  | Rama                                        | Qué hace                                                                                                                                           |
| ------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1.1.1 | `chore/NEQUE-1.1.1-add-supabase-dependency` | `npm i @supabase/supabase-js`; completar `supabaseUrl`/`supabaseAnonKey` en `environments/`. **No commitear claves de producción.**                |
| T-1.1.2 | `feat/NEQUE-1.1.2-auth-service`             | `AuthService` (`providedIn: 'root'`) con `login(email, password)`, `sendPasswordReset(email)`, `verifyOtp(email, token)`, `signOut()`. **+ spec.** |

### HU-1.2 — Login real

| Ticket  | Rama                                     | Qué hace                                                                                                                                                                               |
| ------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1.2.1 | `feat/NEQUE-1.2.1-wire-start-page-login` | Reemplazar el `TODO` de `onLogin()` por `AuthService.login()`; manejo de error (credenciales inválidas) reusando `.nq-field-error`; `isSubmitting` real. **+ spec del caso de error.** |
| T-1.2.2 | `feat/NEQUE-1.2.2-trainer-route-guard`   | Guard funcional en `/trainer` que redirige a `/` si no hay sesión activa. **+ spec.**                                                                                                  |

### HU-1.3 — Recuperación de contraseña real

| Ticket  | Rama                                         | Qué hace                                                                                                                |
| ------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| T-1.3.1 | `feat/NEQUE-1.3.1-wire-forgot-password-flow` | `onSendCode`/`onVerifyOtp`/`resendCode` contra `AuthService` en vez de los `setTimeout` simulados actuales. **+ spec.** |

</details>

---

## ÉPICA 2 — Gestión de Alumnos

> **Definición de terminado:** `/trainer/clients` deja de ser un alias a
> `DashboardPage` y permite al entrenador autenticado registrar, listar, buscar,
> consultar, editar y desactivar alumnos. También permite registrar su anamnesis y
> evaluaciones físicas. Cada entrenador solo puede acceder a los alumnos vinculados a
> su cuenta y la desactivación conserva su historial.
>
> En la interfaz se utiliza el término **alumno**. Los nombres técnicos existentes
> mantienen `Client` y `/trainer/clients` hasta que el líder técnico determine si
> corresponde realizar un cambio global de nomenclatura.

### Decisiones funcionales confirmadas

- Solo un entrenador puede crear cuentas de alumnos; no existe registro autónomo para
  alumnos.
- Al crear la cuenta, el entrenador genera una invitación que puede compartir por correo,
  WhatsApp o código QR.
- El alumno utiliza la invitación para establecer su propia contraseña. El entrenador no
  conoce ni define esa contraseña.
- El entrenador no puede eliminar la cuenta de un alumno. Solo puede suspenderla y
  reactivarla, conservando la ficha y todo su historial.
- La vigencia, cantidad de usos y mecanismo técnico de las invitaciones quedan pendientes
  de refinamiento.

### HU-2.1 — Modelo y servicio de alumnos

> _Historia habilitadora técnica. La estructura del modelo, las tablas y las políticas
> de acceso deben validarse con el líder técnico antes de crear los issues._

| Ticket  | Rama                              | Qué hace                                                                                                                                               |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-2.1.1 | `feat/NEQUE-2.1.1-client-model`   | Define el modelo de alumno con identificación, datos personales, información de contacto, estado y vínculo con el entrenador.                          |
| T-2.1.2 | `feat/NEQUE-2.1.2-client-service` | Implementa `ClientService` sobre Supabase para administrar alumnos del entrenador autenticado e impedir el acceso a alumnos no vinculados. **+ spec.** |

### HU-2.2 — Listar y buscar alumnos

> Como entrenador, quiero consultar y buscar a mis alumnos para acceder rápidamente a
> la persona que necesito gestionar.

| Ticket  | Rama                                     | Qué hace                                                                                                                                  |
| ------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.2.1 | `feat/NEQUE-2.2.1-clients-page-scaffold` | Crea `ClientsPage` standalone y reemplaza el alias a `DashboardPage` en `/trainer/clients`. **+ spec.**                                   |
| T-2.2.2 | `feat/NEQUE-2.2.2-clients-list-states`   | Lista los alumnos vinculados al entrenador y contempla estados `loading/error/empty/success`, reutilizando `<nq-page-state>`. **+ spec.** |
| T-2.2.3 | `feat/NEQUE-2.2.3-clients-search`        | Permite buscar alumnos por nombre o correo dentro de la cartera del entrenador. **+ spec.**                                               |

### HU-2.3 — Registrar alumno

> Como entrenador, quiero registrar un alumno para incorporarlo a mi cartera y
> enviarle una invitación con la que pueda establecer su contraseña y acceder a Ñeque.

| Ticket  | Rama                                    | Qué hace                                                                                                                                                                   |
| ------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.3.1 | `feat/NEQUE-2.3.1-client-create-form`   | Implementa el formulario de registro con los datos personales y de contacto definidos para el MVP, reutilizando `.nq-sheet` y `.nq-field-*`. **+ spec.**                   |
| T-2.3.2 | `feat/NEQUE-2.3.2-client-create-submit` | Conecta el formulario con `ClientService`, valida los campos obligatorios, evita duplicados y genera la invitación que el entrenador compartirá con el alumno. **+ spec.** |

### HU-2.4 — Consultar ficha del alumno

> Como entrenador, quiero consultar la ficha de un alumno para acceder a sus
> antecedentes, evaluaciones, planificación e historial.

| Ticket  | Rama                                      | Qué hace                                                                                                                                                               |
| ------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.4.1 | `feat/NEQUE-2.4.1-client-detail-page`     | Implementa la vista de detalle del alumno y restringe su acceso al entrenador vinculado. **+ spec.**                                                                   |
| T-2.4.2 | `feat/NEQUE-2.4.2-client-detail-sections` | Organiza la ficha en secciones de información personal, anamnesis, evaluaciones y planificación, mostrando estados vacíos cuando aún no existen registros. **+ spec.** |

### HU-2.5 — Editar datos del alumno

> Como entrenador, quiero actualizar los datos de un alumno para mantener su ficha
> vigente.

| Ticket  | Rama                                  | Qué hace                                                                                                   |
| ------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| T-2.5.1 | `feat/NEQUE-2.5.1-client-edit-form`   | Permite editar los datos personales y de contacto reutilizando el formulario de registro. **+ spec.**      |
| T-2.5.2 | `feat/NEQUE-2.5.2-client-edit-submit` | Guarda los cambios mediante `ClientService` sin alterar el vínculo ni el historial del alumno. **+ spec.** |

### HU-2.6 — Registrar anamnesis

> Como entrenador, quiero registrar la anamnesis de un alumno para considerar sus
> antecedentes al momento de planificar sus entrenamientos.

| Ticket  | Rama                                       | Qué hace                                                                                                                                                             |
| ------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-2.6.1 | `feat/NEQUE-2.6.1-anamnesis-model-service` | Define el modelo de anamnesis y las operaciones para registrar y consultar los antecedentes del alumno, restringiendo el acceso al entrenador vinculado. **+ spec.** |
| T-2.6.2 | `feat/NEQUE-2.6.2-anamnesis-form`          | Implementa el formulario de anamnesis dentro de la ficha del alumno con los campos y validaciones definidos para el MVP. **+ spec.**                                 |
| T-2.6.3 | `feat/NEQUE-2.6.3-anamnesis-detail`        | Muestra la anamnesis registrada y permite actualizarla sin modificar el resto de la ficha. **+ spec.**                                                               |

### HU-2.7 — Registrar evaluación física

> Como entrenador, quiero registrar evaluaciones físicas para mantener un historial de
> la condición y evolución del alumno.

| Ticket  | Rama                                        | Qué hace                                                                                                                |
| ------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| T-2.7.1 | `feat/NEQUE-2.7.1-assessment-model-service` | Define el modelo de evaluación física y las operaciones para registrar y consultar evaluaciones del alumno. **+ spec.** |
| T-2.7.2 | `feat/NEQUE-2.7.2-assessment-form`          | Implementa el formulario de evaluación física con fecha, mediciones y observaciones definidas para el MVP. **+ spec.**  |
| T-2.7.3 | `feat/NEQUE-2.7.3-assessment-history`       | Muestra el historial cronológico de evaluaciones físicas del alumno. **+ spec.**                                        |

### HU-2.8 — Suspender y reactivar alumno

> Como entrenador, quiero suspender y reactivar la cuenta de un alumno para controlar su
> acceso sin eliminar su ficha ni su historial.

| Ticket  | Rama                                       | Qué hace                                                                                                                                         |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-2.8.1 | `feat/NEQUE-2.8.1-client-suspension`       | Permite suspender y reactivar la cuenta de un alumno mediante confirmación, conservando su ficha, evaluaciones, rutinas e historial. **+ spec.** |
| T-2.8.2 | `feat/NEQUE-2.8.2-suspended-client-filter` | Oculta por defecto los alumnos suspendidos y permite consultarlos mediante un filtro. **+ spec.**                                                |

---

## ÉPICA 3 — Módulo Rutinas

> _Roadmap inferido — mismo disclaimer que la Épica 1._
>
> **Definición de terminado:** `/trainer/routines` deja de ser un alias, lista/crea/edita
> rutinas y permite asignarlas a un cliente de la Épica 2.

### HU-3.1 — Modelo y servicio

| Ticket  | Rama                               | Qué hace                                     |
| ------- | ---------------------------------- | -------------------------------------------- |
| T-3.1.1 | `feat/NEQUE-3.1.1-routine-model`   | `src/app/shared/models/routine.model.ts`.    |
| T-3.1.2 | `feat/NEQUE-3.1.2-routine-service` | `RoutineService` sobre Supabase. **+ spec.** |

### HU-3.2 — Listado

| Ticket  | Rama                                      | Qué hace                                                              |
| ------- | ----------------------------------------- | --------------------------------------------------------------------- |
| T-3.2.1 | `feat/NEQUE-3.2.1-routines-page-scaffold` | `RoutinesPage` standalone, reemplaza el alias en la ruta. **+ spec.** |
| T-3.2.2 | `feat/NEQUE-3.2.2-routines-list-states`   | Estados `loading/error/empty/success`.                                |

### HU-3.3 — Alta, edición y asignación

| Ticket  | Rama                                        | Qué hace                                                   |
| ------- | ------------------------------------------- | ---------------------------------------------------------- |
| T-3.3.1 | `feat/NEQUE-3.3.1-routine-form`             | Formulario de alta/edición de rutina.                      |
| T-3.3.2 | `feat/NEQUE-3.3.2-assign-routine-to-client` | Asignar una rutina a un cliente (relación con la Épica 2). |

---

## ÉPICA 4 — Perfil del Entrenador

> _Roadmap inferido — mismo disclaimer que la Épica 1._
>
> **Definición de terminado:** `/trainer/profile` deja de ser un alias, muestra los datos
> del entrenador autenticado y permite cerrar sesión.

### HU-4.1 — Página de perfil

| Ticket  | Rama                                     | Qué hace                                                             |
| ------- | ---------------------------------------- | -------------------------------------------------------------------- |
| T-4.1.1 | `feat/NEQUE-4.1.1-profile-page-scaffold` | `ProfilePage` standalone, reemplaza el alias en la ruta. **+ spec.** |
| T-4.1.2 | `feat/NEQUE-4.1.2-profile-logout`        | Botón de cerrar sesión usando `AuthService.signOut()` de la Épica 1. |

---

## ÉPICA 5 — Dashboard con datos reales

> _Roadmap inferido — mismo disclaimer que la Épica 1._
>
> **Definición de terminado:** las 2 métricas de `DashboardPage` (hoy `"—"` hardcodeado)
> muestran conteos reales de `ClientService`/`RoutineService`, y el saludo usa el nombre
> del entrenador autenticado en vez de `"Kelvin"` hardcodeado en el template.

### HU-5.1 — Conectar métricas reales

| Ticket  | Rama                                      | Qué hace                                                                                                                 |
| ------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| T-5.1.1 | `feat/NEQUE-5.1.1-wire-dashboard-metrics` | Reemplazar el `signal<ViewState>('success')` fijo y las métricas `"—"` por datos reales de las Épicas 2 y 3. **+ spec.** |

---

## ÉPICA 6 — Release v1.0.0

> **Definición de terminado:** el tag `v1.0.0` produce un GitHub Release con APK y IPA
> descargables.

### HU-6.1 — QA de integración

| Ticket  | Rama                                        | Qué hace                                                                                                                              |
| ------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T-6.1.1 | `test/NEQUE-6.1.1-integration-qa-checklist` | Recorrido login → dashboard → clientes → rutinas → perfil → logout. Estados vacíos/error, bloqueo de landscape. Checklist en `docs/`. |

### HU-6.2 — Plataformas nativas (iOS + Android)

| Ticket  | Rama                                          | Qué hace                                                                                                                                                                               |
| ------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-6.2.1 | `chore/NEQUE-6.2.1-capacitor-add-android`     | `npx cap add android`. Hoy `/android` no existe (gitignored, nunca se corrió `cap add`). Verificar el APK vía `gradlew assembleRelease`.                                               |
| T-6.2.2 | `chore/NEQUE-6.2.2-capacitor-add-ios`         | `npx cap add ios`. Mismo caso. Verificar el archive en macOS.                                                                                                                          |
| T-6.2.3 | `ci/NEQUE-6.2.3-fix-release-workflow-signing` | `release.yml` construye APK y archive iOS **sin firma**. Definir el esquema de firma (keystore Android, certificado/provisioning iOS como secrets) para producir binarios instalables. |

### HU-6.3 — Corte de release

| Ticket  | Rama                                       | Qué hace                                                                                                      |
| ------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| T-6.3.1 | `chore/NEQUE-6.3.1-version-bump-changelog` | Bump de versión en `package.json` + `CHANGELOG.md`. PR a `develop`.                                           |
| T-6.3.2 | `release/1.0.0`                            | Rama de release desde `develop` → PR a `main` (merge normal), tag `v1.0.0`, back-merge de `main` a `develop`. |

---

---

## ÉPICA 7 — Arquitectura hexagonal, sesión por rol e invitación

> **Decisión (2026-09-17).** El código se organiza por **`{capa}/{feature}`**, no por
> vertical slicing: `domain/`, `application/`, `infrastructure/` y `ui/`. Así un caso de
> uso puede componer puertos de varias features sin duplicar código ni crear
> dependencias entre slices.
>
> Mientras no exista el BFF, cada puerto tiene un **adapter mock en memoria**. Conectar
> el backend es reemplazar `provideMockData()` / `provideStudentMockData()` por sus
> equivalentes HTTP: **ningún archivo de `domain/`, `application/` ni `ui/` cambia**.
>
> **Definición de terminado:** no queda `src/app/pages` ni `src/app/shared`; el login
> único resuelve el rol y redirige; ambos shells están protegidos por guard;
> `/invite/:token` permite al alumno establecer su contraseña.

### Regla de dependencias entre capas

| Capa              | Puede importar de         | Nunca importa de                                |
| ----------------- | ------------------------- | ----------------------------------------------- |
| `domain/`         | solo de `domain/`         | application, infrastructure, ui                 |
| `application/`    | `domain/`                 | infrastructure, ui                              |
| `infrastructure/` | `domain/`                 | application, ui                                 |
| `ui/`             | `domain/`, `application/` | infrastructure, salvo los `provide*()` en rutas |

Una facade puede inyectar varios puertos y **una sola otra facade: `SessionFacade`**.

### HU-7.0 — Documentación

Tickets sin cambio de lógica: van directo sobre `develop`, sin rama propia.

| Ticket  | Rama                | Qué hace                                                                             |
| ------- | ------------------- | ------------------------------------------------------------------------------------ |
| T-7.0.1 | `develop` (directo) | Épicas 7 y 8 en este documento; re-encuadre de la Épica 1 y reserva de la 9 y la 10. |
| T-7.0.2 | `develop` (directo) | `docs/tickets/epica-7/` y `epica-8/`: un archivo por ticket, con criterios escritos. |

### HU-7.1 — Migración de estructura

| Ticket  | Rama                                              | Qué hace                                                                               |
| ------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| T-7.1.1 | `chore/NEQUE-7.1.1-wire-path-aliases-jest-eslint` | `moduleNameMapper` de `@app/@env/@shared` en Jest y `pathGroups` en `import/order`.    |
| T-7.1.2 | `refactor/NEQUE-7.1.2-move-shared-to-ui-shared`   | `src/app/shared` → `src/app/ui/shared`; actualiza `styles.scss` y `tsconfig`.          |
| T-7.1.3 | `refactor/NEQUE-7.1.3-move-pages-to-ui`           | `pages/start` y `pages/forgot-password` → `ui/auth/`; `pages/trainer` → `ui/trainer/`. |
| T-7.1.4 | `refactor/NEQUE-7.1.4-adopt-path-aliases-in-ui`   | Imports cruzados pasan a `@app/…` / `@shared/…`.                                       |
| T-7.1.5 | `refactor/NEQUE-7.1.5-split-theme-mixins`         | Separa `_mixins.scss` de `_components.scss`. Ver nota abajo.                           |
| T-7.1.6 | `develop` (directo)                               | `CONTRIBUTING.md` y `README.md` a la estructura hexagonal y los patrones de test.      |

**Por qué T-7.1.5.** `_components.scss` mezclaba 3 mixins con ~555 líneas de CSS global.
Cada `@use` de una página inyectaba **todo** ese CSS en su estilo scopeado:
`start.page.scss` compilaba a 12.44 kB desde 4.0 kB de fuente y dos páginas ya excedían
el budget de 8 kB. Con ~15 pantallas nuevas habrían sido ~150 kB de CSS duplicado.

### HU-7.2 — Núcleo compartido

| Ticket  | Rama                                    | Qué hace                                                                                               |
| ------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| T-7.2.1 | `feat/NEQUE-7.2.1-domain-shared-kernel` | `Id`, `IsoDateString`, `DateRange`, `DomainError`, helpers de fecha puros y puerto `CLOCK`.            |
| T-7.2.2 | `feat/NEQUE-7.2.2-async-state`          | `AsyncState<T>`: **único** lugar con loading/error/empty. `viewState()` mapea 1:1 a `<nq-page-state>`. |
| T-7.2.3 | `feat/NEQUE-7.2.3-mock-infra-kit`       | `simulate`, `simulateError`, `cloneSeed`, `SystemClock`, `provideMockData()`.                          |

`CLOCK` existe para que nada dependa de `new Date()`: los tests inyectan un reloj fijo
en vez de usar fake timers en cada constructor.

### HU-7.3 — Auth por rol

| Ticket  | Rama                                         | Qué hace                                                                                       |
| ------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| T-7.3.1 | `feat/NEQUE-7.3.1-auth-domain-port`          | `AuthUser/AuthSession/Credentials`, `AUTH_PORT`, `SESSION_STORAGE_PORT`, `homeRouteForRole()`. |
| T-7.3.2 | `feat/NEQUE-7.3.2-auth-mock-adapter`         | Cuentas semilla de entrenador y alumno; sesión en `localStorage`.                              |
| T-7.3.3 | `feat/NEQUE-7.3.3-session-facade`            | `SessionFacade` con `role`, `profileId`, `login/restore/signOut`.                              |
| T-7.3.4 | `feat/NEQUE-7.3.4-wire-start-page-login`     | `StartPage.onLogin()` contra el puerto; error con `.nq-field-error`; redirect por rol.         |
| T-7.3.5 | `feat/NEQUE-7.3.5-role-guards`               | `authGuard`, `roleGuard(role)` y `publicOnlyGuard` con `canMatch`.                             |
| T-7.3.6 | `feat/NEQUE-7.3.6-wire-forgot-password-flow` | Los 3 `setTimeout` simulados pasan a `AUTH_PORT`.                                              |
| T-7.3.7 | `feat/NEQUE-7.3.7-not-found-route`           | Ruta `**` con CTA según sesión y rol.                                                          |

**`AuthUser.profileId`** viaja en la sesión a propósito: evita que cada feature necesite
un `getByUserId` propio para resolver el alumno o el entrenador autenticado.

### HU-7.4 — Invitación `/invite/:token`

| Ticket  | Rama                                          | Qué hace                                                                 |
| ------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| T-7.4.1 | `feat/NEQUE-7.4.1-invitation-domain-port`     | `InvitationDetails` + `INVITATION_PORT`.                                 |
| T-7.4.2 | `feat/NEQUE-7.4.2-invitation-mock-adapter`    | Tres tokens semilla: válido, expirado y ya usado.                        |
| T-7.4.3 | `refactor/NEQUE-7.4.3-extract-password-rules` | Las 4 reglas de password salen de `StartPage` a `ui/shared/validators/`. |
| T-7.4.4 | `feat/NEQUE-7.4.4-invite-page-scaffold`       | Ruta pública con estados `loading/error/success`.                        |
| T-7.4.5 | `feat/NEQUE-7.4.5-invite-set-password-submit` | Password + confirmación, auto-login y redirect al home del alumno.       |

Para probar a mano: `/invite/inv-valida`, `/invite/inv-expirada`, `/invite/inv-usada`.

### HU-7.5 — Outlet de rutas

| Ticket  | Rama                                        | Qué hace                                                                  |
| ------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| T-7.5.1 | `fix/NEQUE-7.5.1-use-angular-router-outlet` | `<ion-router-outlet>` → `<router-outlet>` en el shell y en ambos layouts. |

**Por qué.** `ion-router-outlet` mantiene una pila pensada para push/pop. Con el tab bar
propio de Ñeque dejaba la página entrante en `ion-page-invisible` de forma permanente
—tras el login la app se veía congelada en el formulario— y al navegar entre pestañas
apilaba todas las visitadas mostrándolas a la vez. Las transiciones visuales las aportan
las animaciones `nq-ani` del design system. Efecto secundario: el bundle inicial bajó de
514.76 kB a **492.11 kB**, por debajo del budget de 500 kB que `develop` ya excedía.

---

## ÉPICA 8 — App del Alumno

> **Definición de terminado:** el alumno autenticado navega `/student` con 4 pestañas
> (Inicio, Mi rutina, Progreso, Perfil), ve su IMC y su progreso semanal, ejecuta una
> sesión paso a paso con temporizador de descanso, marca ejercicios y sesiones, consulta
> y compara fotos, y revisa su agenda y sus notificaciones — todo contra adapters mock.

### Decisiones funcionales

- Las métricas del Home se limitan a lo que el backlog puede alimentar: **IMC** (de la
  última evaluación física), **progreso semanal** y **último/próximos entrenamientos**.
  Pulso, agua, sueño y calorías quedan fuera: exigen un wearable que no existe.
- Los puertos y adapters del alumno se registran en `providers` de la ruta `/student`
  para que viajen en su chunk lazy. **Las facades del alumno también**: dependen de esos
  puertos, así que `providedIn: 'root'` las rompe en tiempo de ejecución.
- Los gráficos son SVG inline propios (`<nq-bar-chart>`, `<nq-line-chart>`,
  `<nq-ring-progress>`), sin librerías. Toda la matemática vive en `chart-math.ts`.

| HU                   | Tickets           | Contenido                                                                                       |
| -------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| 8.1 Shell            | T-8.1.1           | `StudentLayoutPage` con las 4 pestañas y `canMatch: [roleGuard('student')]`.                    |
| 8.2 Dominio y datos  | T-8.2.1 … T-8.2.7 | Modelos y puertos de alumnos, evaluaciones, rutinas, catálogo y sesiones; adapters mock.        |
| 8.3 Home             | T-8.3.1 … T-8.3.7 | `StudentProfileFacade`, `WorkoutFacade`, `<nq-workout-card>`, `<nq-bar-chart>`, tarjeta de IMC. |
| 8.4 Mi rutina        | T-8.4.1 … T-8.4.4 | Selector de día, check por ejercicio y modal de celebración.                                    |
| 8.5 Ejecutar sesión  | T-8.5.1 … T-8.5.4 | `WorkoutRunnerFacade` (`idle/exercise/rest/summary`), `/student/workout/:id`, resumen final.    |
| 8.6 Progreso y fotos | T-8.6.1 … T-8.6.7 | `ProgressFacade` multi-feature, `<nq-line-chart>`, galería y comparador.                        |
| 8.7 Agenda           | T-8.7.1 … T-8.7.5 | `buildMonthGrid()` puro, calendario en CSS grid, detalle del día.                               |
| 8.8 Notificaciones   | T-8.8.1 … T-8.8.4 | Agrupación hoy/semana/antes, `unreadCount` computed y badge en el Home.                         |
| 8.9 Perfil           | T-8.9.1, T-8.9.2  | Datos, entrenador asignado, accesos y cierre de sesión con confirmación.                        |

### Cuentas y datos de prueba

| Rol        | Correo               | Contraseña     |
| ---------- | -------------------- | -------------- |
| Entrenador | `kelvin@neque.cl`    | `Entrenador1!` |
| Alumno     | `alejandra@neque.cl` | `Alumno1234!`  |

Código OTP del flujo de recuperación: `123456`. El historial de sesiones se genera
relativo al reloj inyectado, así que el Home siempre muestra "hoy" y "próximos" con
sentido; los tests usan un reloj fijo y siguen siendo deterministas.

---

## ÉPICA 9 — App del Entrenador (reservada)

> Amplía `/trainer` con la gestión de alumnos, rutinas y perfil descrita en las
> Épicas 2–5, reutilizando los puertos ya definidos: `STUDENTS_PORT`, `ASSESSMENTS_PORT`,
> `ROUTINES_PORT` y `WORKOUTS_PORT` ya declaran los métodos de escritura que necesita,
> así que **extiende adapters en vez de rehacer puertos**.

## ÉPICA 10 — Conexión al BFF (reservada)

> Agrega `provideHttpClient(withFetch())` y adapters HTTP contra el BFF NestJS. El
> criterio de aceptación es que **ningún archivo de `domain/`, `application/` ni `ui/`
> cambie**.

## ÉPICA 11 — Correcciones de auditoría

> **Se ejecuta antes que la 9 y la 10.** El número identifica, no ordena.
>
> Cierra los hallazgos bloqueantes y de accesibilidad de
> [`docs/auditoria/2026-09-18-auditoria-app-alumno.md`](auditoria/2026-09-18-auditoria-app-alumno.md),
> que cerró en ❌ NO APROBADO con 45 hallazgos sobre 12 pantallas y 5 componentes.
>
> **DoD:** las cinco categorías del informe en verde, contraste AA en toda pantalla,
> ningún control interactivo bajo 44×44, y el recorrido del alumno navegable con teclado.

### Decisiones tomadas

| #   | Decisión                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Alcance: bloqueantes + accesibilidad. El resto queda documentado como tickets pendientes de esta misma épica.                   |
| 2   | Contraste por token nuevo `--nq-primary-strong` (#0f766e). `--nq-primary` (#2cb5a0) sigue siendo la marca en fondos y gráficos. |
| 3   | La recuperación de contraseña gana su paso 3: verificar el OTP deja de abrir sesión.                                            |
| 4   | Una rama por historia, como en las Épicas 7 y 8.                                                                                |

### HU-11.0 — Documentación (directo en `develop`, sin rama)

| Ticket   | Qué hace                                                                                    |
| -------- | ------------------------------------------------------------------------------------------- |
| T-11.0.1 | Épica 11 en este backlog, con el cruce al informe de auditoría.                             |
| T-11.0.2 | `docs/tickets/epica-11/` con README y un `.md` por ticket, incluidos los diferidos.         |
| T-11.0.3 | Regla de uso de `--nq-primary` vs `--nq-primary-strong` en `CLAUDE.md` y `CONTRIBUTING.md`. |

### HU-11.1 — Design system: contraste, targets y grid

Rama: `fix/NEQUE-11.1-design-system-contraste-targets`

| Ticket   | Hallazgo | Qué hace                                                                                                                         |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| T-11.1.1 | T-3      | Tokens: `--nq-primary-strong` (5.50:1), `--nq-text-muted` a #647976 (4.66:1), `--nq-danger` a #c62828, `--nq-warning` a #b45309. |
| T-11.1.2 | T-3      | Aplicación en el theme, los 10 `.scss` de página y los tres gráficos. `nq-btn-gradient` pasa a fondo sólido.                     |
| T-11.1.3 | T-2      | Mixins `nq-tap-target` y `nq-tap-halo` sobre los 12 controles bajo 44×44.                                                        |
| T-11.1.4 | T-1      | `.nq-section` y `.nq-tabs` sin padding lateral: dentro de `.page` quedaban al doble.                                             |
| T-11.1.5 | —        | Baja 18 clases globales muertas y el `nq-scroll` inerte de seis páginas.                                                         |

### HU-11.2 — Bugs funcionales bloqueantes

Rama: `fix/NEQUE-11.2-bugs-bloqueantes`

| Ticket   | Hallazgo | Qué hace                                                                                     |
| -------- | -------- | -------------------------------------------------------------------------------------------- |
| T-11.2.1 | PR-1     | `Student.trainerName` denormalizado: el Perfil mostraba "Kelvin Moreno" fijo a todo alumno.  |
| T-11.2.2 | W-1      | `saving` pasa de `computed(() => false)` a `signal`: el botón del runner guardaba dos veces. |
| T-11.2.3 | P-2      | La pestaña Fotos deja de depender del estado de las evaluaciones.                            |
| T-11.2.4 | P-1      | Confirmación antes de borrar una foto.                                                       |
| T-11.2.5 | S-1      | El login deja de exigir composición de contraseña.                                           |

### HU-11.3 — Scroll en pantallas de alto fijo

Rama: `fix/NEQUE-11.3-scroll-start-runner`

| Ticket   | Hallazgo | Qué hace                                                                                        |
| -------- | -------- | ----------------------------------------------------------------------------------------------- |
| T-11.3.1 | S-2      | Panel de login con scroll propio, anclado al viewport y a pantalla completa bajo 700px de alto. |
| T-11.3.2 | W-3      | El runner deja de recortar la fase `exercise` en pantallas bajas.                               |

### HU-11.4 — Accesibilidad transversal

Rama: `fix/NEQUE-11.4-accesibilidad`

| Ticket   | Hallazgo | Qué hace                                                                                     |
| -------- | -------- | -------------------------------------------------------------------------------------------- |
| T-11.4.1 | T-6      | `:focus-visible` global más el anillo del contenedor de inputs.                              |
| T-11.4.2 | T-4      | `role="status"`/`role="alert"` en `<nq-page-state>` y región viva para las fases del runner. |
| T-11.4.3 | T-5      | Bloque `prefers-reduced-motion`.                                                             |
| T-11.4.4 | R-1      | `SheetTrapDirective`: foco al abrir, trampa de Tab y cierre con `Escape` en los tres sheets. |
| T-11.4.5 | T-9      | `.nq-section-title` de `<span>` a `<h2>`.                                                    |
| T-11.4.6 | S-3…SC-2 | Nombres accesibles: campanita con contador, progressbars con rango, día con fecha completa.  |
| T-11.4.7 | P-3      | El uploader de fotos entra en el orden de tabulación.                                        |

### HU-11.5 — Paso de contraseña nueva en la recuperación

Rama: `feat/NEQUE-11.5-reset-password-step`

| Ticket   | Hallazgo | Qué hace                                                                                      |
| -------- | -------- | --------------------------------------------------------------------------------------------- |
| T-11.5.1 | F-1      | `verifyOtp()` devuelve un `PasswordResetTicket` de un solo uso y se agrega `resetPassword()`. |
| T-11.5.2 | F-1      | Tercer paso en `/forgot-password` con reglas de contraseña, confirmación y auto-login.        |

### HU-11.6 — Hallazgos diferidos

Rama: `fix/NEQUE-11.6-hallazgos-diferidos`

**Cerrados en la segunda tanda (15):** CH-1 (`track` duplicado en `nq-bar-chart`), I-4
(`/invite/:token` sin `publicOnlyGuard`), L-1 (pestaña activa en Notificaciones y Agenda),
N-1 ("Volver" respeta el origen), SC-1 (Confirmar con estado de carga), W-2 (confirmación
al salir del runner), P-4 (feedback al subir foto), P-5 (peso vacío como guion), H-1
(nombre con esqueleto en vez de respaldo falso), H-4 (se elimina el modo `upcoming`
muerto), A-2 (estilos inline del esqueleto), T-10 (`CLOCK` en vez de `new Date()`), T-12
(`safe-area-inset-top`), I-1 (adapter fuera de `invite.page.ts`) y G-1 (portrait-only real
en web y en nativo).

> **G-1 destapó que el bloqueo de horizontal nunca había funcionado.** `ion-app` lleva la
> clase `ion-page` y su `display: flex` ganaba por especificidad al selector de elemento,
> así que la app nunca se ocultaba y el aviso de rotar quedaba pintado debajo, fuera de
> pantalla. La auditoría lo había dado por bueno leyendo el CSS.

**Cerrados en la tercera tanda (6), el 2026-09-24 en `f8607d8`:** los que llevaban una
decisión de diseño detrás. La tanda no actualizó este backlog; se registró el 2026-09-27.

| Hallazgo | Resolución                                                                  | Después                                   |
| -------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| T-7      | `StartPage` y `ForgotPasswordPage` en español.                              | —                                         |
| T-8      | Escala 4/8/12/16/24/32/40/48 y piso de 12px en la app del alumno.           | La Épica 9 dejó un texto de 11px.         |
| T-11     | Directiva de pull-to-refresh en las listas del alumno.                      | **Retirada** en la 0.0.3 (T-13.4.6).      |
| T-14     | Componentes compartidos con `input()`; no queda ningún `@Input()` en `ui/`. | —                                         |
| PR-2     | Arrastre hacia abajo del bottom sheet en `nqSheetTrap`.                     | Solo desde el asa en la 0.0.4 (T-13.5.2). |
| P-6      | Comparador superpuesto con divisor arrastrable.                             | Solo desde la agarradera (T-13.5.8).      |

## ÉPICA 12 — Cierre de brechas contra el PRD (planificada)

> Plan en [`docs/planes/2026-09-25-epica-12-cierre-prd.md`](planes/2026-09-25-epica-12-cierre-prd.md),
> con las 10 decisiones **pendientes de confirmar**. Cierra las cuatro funcionalidades
> que el PRD v2.0 marca ✅ y el código no cumple, los `Must Have` pendientes del lado
> móvil y la configuración de §7. Lo que depende del BFF se termina en la Épica 10.

| Bloque              | Historias                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| A — antes del BFF   | HU-12.0 documentación · 12.1 configuración · 12.2 progresión de carga · 12.3 cancelación · 12.4 freemium |
| B — fase 2          | HU-12.5 notas privadas · 12.6 plantillas · 12.7 plataformas nativas · 12.8 cámara · 12.9 push            |
| C — requiere el BFF | HU-12.10 ejecución sin conexión                                                                          |

**Lo que la Épica 13 ya cambió del plan:**

- **T-12.9.4 adelantado:** desde la 0.0.4 `notificationRoute` recibe el rol y el
  entrenador tiene sus notificaciones (T-13.5.7).
- **HU-12.6 hay que revisarla:** la 0.0.3 convirtió la `Routine` en una plantilla con
  asignaciones por alumno (T-13.3.1). La decisión 4 del plan, un `RoutineTemplate`
  aparte, quedó superada.
- **T-12.0.4 hecho en parte:** la Épica 12 queda registrada aquí y «Fuera de alcance» ya
  está corregido.

## ÉPICA 13 — QA en dispositivo (releases 0.0.x)

> Registra en orden lo que salió de probar cada IPA en un iPhone 12 Pro. **Cada ticket es
> un commit** de la release. Se registró después de los hechos, el 2026-09-27, a partir
> del historial de git. Tickets en [`docs/tickets/epica-13/`](tickets/epica-13/).

### HU-13.1 — Primera IPA · release 0.0.1 (2026-09-25)

| Ticket   | Commit    | Qué hace                                         |
| -------- | --------- | ------------------------------------------------ |
| T-13.1.1 | `8ec9286` | Workflow de GitHub que genera un IPA sin firmar. |

### HU-13.2 — QA de la IPA 0.0.1 · release 0.0.2 (2026-09-26)

| Ticket   | Commit    | Qué hace                                                             |
| -------- | --------- | -------------------------------------------------------------------- |
| T-13.2.1 | `65cee2c` | `--nq-page-pt`: menos aire sobre las pantallas con pestañas.         |
| T-13.2.2 | `72b6b55` | Tono teal en las pestañas, métricas y selector de serie de Progreso. |
| T-13.2.3 | `19d1d6b` | Fotos de progreso también desde la galería (sin `capture`).          |
| T-13.2.4 | `09eed9f` | El tab bar se oculta mientras hay un sheet abierto.                  |
| T-13.2.5 | `a6d435a` | Abrir un formulario enfoca el sheet y no levanta el teclado.         |
| T-13.2.6 | `bddfd92` | Botones en dos columnas sin texto partido.                           |
| T-13.2.7 | `9229be8` | Botonera fija al pie en los cinco formularios largos.                |
| T-13.2.8 | `50bf0ad` | El alumno semilla pasa a Alejandra Acosta.                           |

### HU-13.3 — Rutinas compartidas · release 0.0.3 (2026-09-26)

Rama: `feat/rutinas-compartidas`

| Ticket   | Commit    | Qué hace                                                                  |
| -------- | --------- | ------------------------------------------------------------------------- |
| T-13.3.1 | `f4bffb8` | La rutina es una plantilla con `assignments` por alumno y fechas propias. |
| T-13.3.2 | `9871287` | Opciones de asignación con sugerencia por objetivo.                       |
| T-13.3.3 | `1b1eb88` | Hoja para asignar una rutina a varios alumnos.                            |

### HU-13.4 — Login y ajustes en iPhone 12 Pro · release 0.0.3 (2026-09-27)

Rama: `feat/rutinas-compartidas`, a continuación de la HU-13.3.

| Ticket    | Commit    | Qué hace                                                                 |
| --------- | --------- | ------------------------------------------------------------------------ |
| T-13.4.1  | `a4ab98d` | Requisitos de contraseña y teclado iOS en el login.                      |
| T-13.4.2  | `6cdb089` | Campos de 16px (`--nq-font-input`) contra el auto-zoom de iOS.           |
| T-13.4.3  | `9cd1006` | Bloqueo de 5 minutos tras 5 intentos fallidos (`too_many_attempts`).     |
| T-13.4.4  | `717d7fd` | Foco, envío y contador de requisitos; el botón queda siempre habilitado. |
| T-13.4.5  | `93274f8` | Ícono y texto del error de ingreso alineados.                            |
| T-13.4.6  | `2058470` | Se retira el pull-to-refresh.                                            |
| T-13.4.7  | `c94b08d` | Sin selección de texto fuera de los campos.                              |
| T-13.4.8  | `0be0734` | Comparador: fotos solo del mismo ángulo y fechas `dd/mm/aaaa`.           |
| T-13.4.9  | `20653ac` | Aviso centrado cuando no hay fotos.                                      |
| T-13.4.10 | `96d1dff` | Correcciones de la skill `auditoria-component` y viewport sin zoom.      |

### HU-13.5 — Mejoras para la IPA 0.0.4 (2026-09-27)

Rama: `release/0.0.4` — PR pendiente de merge.

| Ticket   | Commit    | Qué hace                                                                                |
| -------- | --------- | --------------------------------------------------------------------------------------- |
| T-13.5.1 | `d072c1c` | Enlace público `/i/:token` (`PUBLIC_APP_URL`, `vercel.json`) y QR que se genera.        |
| T-13.5.2 | `e8ad14e` | Botón flotante del shell, scroll en hojas y vacíos con `.nq-empty-inline`.              |
| T-13.5.3 | `dc68a66` | Eliminar rutinas; carga (libre, corporal, peso extra) y medida (repeticiones o tiempo). |
| T-13.5.4 | `9d0767d` | Runner: saltar con motivo, ejercicios por tiempo y "Sesión completada" en teal.         |
| T-13.5.5 | `7f2f7cc` | Perfil vista A de alumno y entrenador, con cambio de contraseña.                        |
| T-13.5.6 | `713fc1e` | Inicio del entrenador: indicadores, "Por atender" con acción directa, hoy y actividad.  |
| T-13.5.7 | `89f6750` | Notificaciones del entrenador con campana, en una pantalla compartida por rol.          |
| T-13.5.8 | `abab426` | El comparador solo se mueve desde la agarradera.                                        |

### Decisiones que dejó la épica

| Decisión                                    | Por qué                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Viewport sin zoom y campos de 16px          | Regla global de `auditoria-component`; con 16px iOS no hace auto-zoom.   |
| Sin pull-to-refresh                         | Su indicador aparecía en todas las páginas de la IPA.                    |
| Sin selección de texto fuera de los campos  | Un toque largo sobre la interfaz se sentía de web.                       |
| Botón de ingresar siempre habilitado        | Un botón deshabilitado no explica qué falta; valida al tocarlo.          |
| La rutina es una plantilla con asignaciones | La misma rutina sirve a varios alumnos, cada uno con sus fechas.         |
| El botón flotante lo pinta el shell         | Un `position: fixed` dentro del scroll de iOS se movía con el contenido. |
| Alumno en riesgo                            | Adherencia bajo el 60 %, o 7+ días sin completar con sesiones agendadas. |

## Resumen

| Épica                              | Historias | Tickets | Estado                                |
| ---------------------------------- | --------- | ------- | ------------------------------------- |
| 0 — Fundación y CI real            | 3         | 16      | ✅ salvo 3 tickets de git/GitHub      |
| 1 — Autenticación real (Supabase)  | 3         | 5       | ❌ re-encuadrada → absorbida por la 7 |
| 2 — Gestión de Alumnos             | 8         | 19      | ✅ absorbida por la Épica 9           |
| 3 — Módulo Rutinas                 | 3         | 6       | ✅ absorbida por la Épica 9           |
| 4 — Perfil del Entrenador          | 1         | 2       | ✅ absorbida por la Épica 9           |
| 5 — Dashboard con datos reales     | 1         | 1       | ✅ absorbida por la Épica 9           |
| 6 — Release v1.0.0                 | 3         | 6       | ⬜ al final                           |
| **7 — Arquitectura hexagonal**     | **6**     | **24**  | ✅                                    |
| **8 — App del Alumno**             | **9**     | **41**  | ✅                                    |
| **9 — App del Entrenador**         | **13**    | **52**  | ✅                                    |
| 10 — Conexión al BFF               | —         | —       | ⬜ reservada                          |
| **11 — Correcciones de auditoría** | **7**     | **45**  | ✅                                    |
| 12 — Cierre de brechas del PRD     | 11        | 49      | ⬜ planificada                        |
| **13 — QA en dispositivo**         | **5**     | **30**  | ✅ 22 publicados · 🔄 8 en PR         |

**El número de épica identifica, no ordena.** La Épica 11 se ejecuta antes que la 9 y la
10; la Épica 6 (release) queda al final, después de todas, pese a llevar un número menor.

### Estado del código (2026-09-27, `release/0.0.4`)

| Métrica                             | Valor                                                   |
| ----------------------------------- | ------------------------------------------------------- |
| Tests                               | 1474 en 86 suites                                       |
| Cobertura                           | 97.81 / 86.95 / 97.14 / 97.78 (stmts/branch/func/lines) |
| Bundle inicial                      | 273.46 kB — 55 % del budget de 500 kB                   |
| `lint`, `typecheck`, `format:check` | limpios                                                 |

Del 2026-09-24 al 2026-09-27: +300 tests y +14 kB de bundle por la Épica 13. La
cobertura bajó 0,3 puntos en líneas y 1,9 en branches, siempre sobre el umbral del 80 %.

> El bundle bajó de 494 kB a 259 kB al retirar Ionic en la Épica 9: de toda la
> librería solo se usaba `<ion-content>` como contenedor con scroll, y traía 158 kB
> de `@ionic/core` al bundle inicial. Ese contenedor es ahora `.nq-screen`.

### Orden de ejecución

- **Épica 0**: secuencial por historia (0.1 → 0.2 → 0.3). Bloquea a todas las demás.
  **Cerrada en código**: los 13 tickets que tocan archivos están hechos y la secuencia
  `lint → format:check → typecheck → test:coverage → build:prod` pasa limpia, con
  cobertura real de 99.13 / 91.11 / 100 / 100 (statements / branches / functions / lines).
  Quedan abiertos T-0.1.1, T-0.1.2 y T-0.1.7, que son operaciones de git y GitHub, no
  cambios de archivos. La Épica 1 se desbloquea al ejecutarlos.
- **Épica 1**: depende de que cierre la Épica 0 (se necesita CI verde real antes de
  construir sobre él); secuencial 1.1 → 1.2 → 1.3.
- **Épicas 2 y 3**: dependen de la Épica 1 (necesitan saber qué entrenador está
  autenticado), pero pueden avanzar en paralelo entre sí. Dentro de la Épica 2, la
  secuencia inicial es 2.1 → 2.2 → 2.3 → 2.4. Con la ficha disponible, 2.5, 2.6 y 2.7
  pueden avanzar de manera independiente. La HU-2.8 queda al final para garantizar que
  la desactivación conserve correctamente toda la información relacionada.
- **Épica 4**: depende solo de la Épica 1.
- **Épica 5**: depende de que las Épicas 2 y 3 tengan sus servicios listos (consume
  ambos).
- **Épica 6**: al final, con las Épicas 1–5 integradas en `develop`.

Dentro de cada historia los tickets son secuenciales salvo donde se indique.

---

## Tablero de ejecución

Lista plana en orden de trabajo. Estados: ✅ mergeado · 🔄 en curso · ⬜ pendiente.

#### Trabajo previo a este backlog

Antes de que existiera este documento ya se mergearon 4 PRs a mano, sin ticket
`NEQUE-x.y.z` asociado — es el trabajo de diseño de `StartPage` y `ForgotPasswordPage`:

| PR  | Título                                                  | Estado      |
| --- | ------------------------------------------------------- | ----------- |
| #1  | `develop: Release Funcionalidades a Main`               | ✅ mergeado |
| #2  | `feat(ui-design): start-page & login-page`              | ✅ mergeado |
| #3  | `feat(ui-design-login): login page`                     | ✅ mergeado |
| #4  | `feat(ui-design-forgot-password): forgot password flow` | ✅ mergeado |

### Épica 0 — Fundación

| #   | Ticket  | Rama                                              | Estado |
| --- | ------- | ------------------------------------------------- | ------ |
| 01  | T-0.1.1 | _(sin PR)_ recrear/publicar `develop`             | ⬜     |
| 02  | T-0.1.2 | _(sin PR)_ branch protection                      | ⬜     |
| 03  | T-0.1.3 | `develop` (directo) plantillas GitHub             | ✅     |
| 04  | T-0.1.4 | `develop` (directo) `CONTRIBUTING.md`             | ✅     |
| 05  | T-0.1.5 | `develop` (directo) `docs/BACKLOG.md`             | ✅     |
| 06  | T-0.1.6 | `develop` (directo) `README.md`                   | ✅     |
| 07  | T-0.1.7 | PR `develop` → `main`                             | ⬜     |
| 08  | T-0.2.1 | `ci/NEQUE-0.2.1-jest-config-fix`                  | ✅     |
| 09  | T-0.2.2 | `test/NEQUE-0.2.2-start-page-specs`               | ✅     |
| 10  | T-0.2.3 | `test/NEQUE-0.2.3-forgot-password-specs`          | ✅     |
| 11  | T-0.2.4 | `test/NEQUE-0.2.4-trainer-layout-dashboard-specs` | ✅     |
| 12  | T-0.2.5 | `ci/NEQUE-0.2.5-harden-ci-gate`                   | ✅     |
| 13  | T-0.3.1 | `chore/NEQUE-0.3.1-add-file-replacements`         | ✅     |
| 14  | T-0.3.2 | `chore/NEQUE-0.3.2-commitlint-cleanup`            | ✅     |
| 15  | T-0.3.3 | `fix/NEQUE-0.3.3-dedupe-state-divider-classes`    | ✅     |
| 16  | T-0.3.4 | `feat/NEQUE-0.3.4-self-host-inter-font`           | ✅     |

### Épica 1 — Autenticación real

| #   | Ticket  | Rama                                         | Estado |
| --- | ------- | -------------------------------------------- | ------ |
| 17  | T-1.1.1 | `chore/NEQUE-1.1.1-add-supabase-dependency`  | ⬜     |
| 18  | T-1.1.2 | `feat/NEQUE-1.1.2-auth-service`              | ⬜     |
| 19  | T-1.2.1 | `feat/NEQUE-1.2.1-wire-start-page-login`     | ⬜     |
| 20  | T-1.2.2 | `feat/NEQUE-1.2.2-trainer-route-guard`       | ⬜     |
| 21  | T-1.3.1 | `feat/NEQUE-1.3.1-wire-forgot-password-flow` | ⬜     |

### Épica 2 — Gestión de Alumnos

| #   | Ticket  | Rama                                        | Estado |
| --- | ------- | ------------------------------------------- | ------ |
| 22  | T-2.1.1 | `feat/NEQUE-2.1.1-client-model`             | ⬜     |
| 23  | T-2.1.2 | `feat/NEQUE-2.1.2-client-service`           | ⬜     |
| 24  | T-2.2.1 | `feat/NEQUE-2.2.1-clients-page-scaffold`    | ⬜     |
| 25  | T-2.2.2 | `feat/NEQUE-2.2.2-clients-list-states`      | ⬜     |
| 26  | T-2.2.3 | `feat/NEQUE-2.2.3-clients-search`           | ⬜     |
| 27  | T-2.3.1 | `feat/NEQUE-2.3.1-client-create-form`       | ⬜     |
| 28  | T-2.3.2 | `feat/NEQUE-2.3.2-client-create-submit`     | ⬜     |
| 29  | T-2.4.1 | `feat/NEQUE-2.4.1-client-detail-page`       | ⬜     |
| 30  | T-2.4.2 | `feat/NEQUE-2.4.2-client-detail-sections`   | ⬜     |
| 31  | T-2.5.1 | `feat/NEQUE-2.5.1-client-edit-form`         | ⬜     |
| 32  | T-2.5.2 | `feat/NEQUE-2.5.2-client-edit-submit`       | ⬜     |
| 33  | T-2.6.1 | `feat/NEQUE-2.6.1-anamnesis-model-service`  | ⬜     |
| 34  | T-2.6.2 | `feat/NEQUE-2.6.2-anamnesis-form`           | ⬜     |
| 35  | T-2.6.3 | `feat/NEQUE-2.6.3-anamnesis-detail`         | ⬜     |
| 36  | T-2.7.1 | `feat/NEQUE-2.7.1-assessment-model-service` | ⬜     |
| 37  | T-2.7.2 | `feat/NEQUE-2.7.2-assessment-form`          | ⬜     |
| 38  | T-2.7.3 | `feat/NEQUE-2.7.3-assessment-history`       | ⬜     |
| 39  | T-2.8.1 | `feat/NEQUE-2.8.1-client-suspension`        | ⬜     |
| 40  | T-2.8.2 | `feat/NEQUE-2.8.2-suspended-client-filter`  | ⬜     |

### Épica 3 — Módulo Rutinas

| #   | Ticket  | Rama                                        | Estado |
| --- | ------- | ------------------------------------------- | ------ |
| 41  | T-3.1.1 | `feat/NEQUE-3.1.1-routine-model`            | ⬜     |
| 42  | T-3.1.2 | `feat/NEQUE-3.1.2-routine-service`          | ⬜     |
| 43  | T-3.2.1 | `feat/NEQUE-3.2.1-routines-page-scaffold`   | ⬜     |
| 44  | T-3.2.2 | `feat/NEQUE-3.2.2-routines-list-states`     | ⬜     |
| 45  | T-3.3.1 | `feat/NEQUE-3.3.1-routine-form`             | ⬜     |
| 46  | T-3.3.2 | `feat/NEQUE-3.3.2-assign-routine-to-client` | ⬜     |

### Épica 4 — Perfil del Entrenador

| #   | Ticket  | Rama                                     | Estado |
| --- | ------- | ---------------------------------------- | ------ |
| 47  | T-4.1.1 | `feat/NEQUE-4.1.1-profile-page-scaffold` | ⬜     |
| 48  | T-4.1.2 | `feat/NEQUE-4.1.2-profile-logout`        | ⬜     |

### Épica 5 — Dashboard con datos reales

| #   | Ticket  | Rama                                      | Estado |
| --- | ------- | ----------------------------------------- | ------ |
| 49  | T-5.1.1 | `feat/NEQUE-5.1.1-wire-dashboard-metrics` | ⬜     |

### Épica 6 — Release v1.0.0

| #   | Ticket  | Rama                                          | Estado |
| --- | ------- | --------------------------------------------- | ------ |
| 50  | T-6.1.1 | `test/NEQUE-6.1.1-integration-qa-checklist`   | ⬜     |
| 51  | T-6.2.1 | `chore/NEQUE-6.2.1-capacitor-add-android`     | ⬜     |
| 52  | T-6.2.2 | `chore/NEQUE-6.2.2-capacitor-add-ios`         | ⬜     |
| 53  | T-6.2.3 | `ci/NEQUE-6.2.3-fix-release-workflow-signing` | ⬜     |
| 54  | T-6.3.1 | `chore/NEQUE-6.3.1-version-bump-changelog`    | ⬜     |
| 55  | T-6.3.2 | `release/1.0.0` → `main` + tag `v1.0.0`       | ⬜     |

### Épica 7 — Arquitectura hexagonal

Se trabajó **una rama por historia**, no una por ticket: los tickets de una misma HU
tocan los mismos archivos y no se podían aislar en commits separados sin `add -p`.

| #   | Historia | Rama                                               | Estado |
| --- | -------- | -------------------------------------------------- | ------ |
| 56  | HU-7.1   | `refactor/NEQUE-7.1-hexagonal-structure-migration` | ✅     |
| 57  | HU-7.2   | `feat/NEQUE-7.2-shared-kernel`                     | ✅     |
| 58  | HU-7.3   | `feat/NEQUE-7.3-auth-por-rol`                      | ✅     |
| 59  | HU-7.4   | `feat/NEQUE-7.4-invitacion`                        | ✅     |
| 60  | HU-7.5   | `fix/NEQUE-7.5-angular-router-outlet`              | ✅     |

### Épica 8 — App del Alumno

| #   | Historia | Rama                                   | Estado |
| --- | -------- | -------------------------------------- | ------ |
| 61  | HU-8.1   | `feat/NEQUE-8.1-student-shell`         | ✅     |
| 62  | HU-8.2   | `feat/NEQUE-8.2-student-domain-data`   | ✅     |
| 63  | HU-8.3   | `feat/NEQUE-8.3-student-home`          | ✅     |
| 64  | HU-8.4   | `feat/NEQUE-8.4-student-routine`       | ✅     |
| 65  | HU-8.5   | `feat/NEQUE-8.5-workout-runner`        | ✅     |
| 66  | HU-8.6   | `feat/NEQUE-8.6-student-progress`      | ✅     |
| 67  | HU-8.7   | `feat/NEQUE-8.7-student-schedule`      | ✅     |
| 68  | HU-8.8   | `feat/NEQUE-8.8-student-notifications` | ✅     |
| 69  | HU-8.9   | `feat/NEQUE-8.9-student-profile`       | ✅     |

### Épica 9 — App del Entrenador

| #   | Historia | Rama                                        | Estado |
| --- | -------- | ------------------------------------------- | ------ |
| 70  | HU-9.0   | docs, directo sobre la rama de épica        | ✅     |
| 71  | HU-9.1   | `feat/NEQUE-9.1-trainer-domain`             | ✅     |
| 72  | HU-9.2   | `feat/NEQUE-9.2-trainer-adapters`           | ✅     |
| 73  | HU-9.12  | `refactor/NEQUE-9.12-contrato-modelo-datos` | ✅     |
| 74  | HU-9.3   | `refactor/NEQUE-9.3-trainer-shell-redesign` | ✅     |
| 75  | HU-9.4   | `feat/NEQUE-9.4-students-list`              | ✅     |
| 76  | HU-9.5   | `feat/NEQUE-9.5-student-create-invite`      | ✅     |
| 77  | HU-9.6   | `feat/NEQUE-9.6-student-detail`             | ✅     |
| 78  | HU-9.7   | `feat/NEQUE-9.7-anamnesis-assessments`      | ✅     |
| 79  | HU-9.8   | `feat/NEQUE-9.8-routines`                   | ✅     |
| 80  | HU-9.9   | `feat/NEQUE-9.9-own-exercises`              | ✅     |
| 81  | HU-9.10  | `feat/NEQUE-9.10-trainer-profile`           | ✅     |
| 82  | HU-9.11  | `feat/NEQUE-9.11-trainer-home`              | ✅     |

**HU-9.12 fue antes que las pantallas** aunque su número sea el último: alinea el
contrato con [`modelo-datos.md`](modelo-datos.md) y toca el runner del alumno, del que
depende la progresión de carga que ve el entrenador.

#### Decisiones que dejó la épica

| Decisión                                               | Por qué                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Ionic fuera del proyecto                               | Solo se usaba `<ion-content>`; costaba 158 kB del bundle inicial. Lo reemplaza `.nq-screen` del design system.      |
| `clients` → `students` en rutas, carpetas y selectores | En la interfaz siempre se dijo «alumno»; el nombre técnico heredado ya no tenía a quién servir.                     |
| El alta crea al alumno **y** emite su invitación       | Dar de alta sin invitar deja una ficha que nadie puede usar.                                                        |
| Una rutina nace sin asignar                            | Activarla implica archivar la anterior del alumno, y eso es una decisión aparte. La pestaña se llama «Sin asignar». |
| El QR entra por `import()` dinámico                    | La librería pesa más que la pantalla y solo la necesita quien toca «Ver código QR».                                 |
| Los ejercicios propios son privados                    | `listForTrainer` devuelve el catálogo público más los del entrenador; nunca los de otro.                            |

### Épica 11 — Correcciones de auditoría

Se ejecutó **entre la 8 y la 9** (19 al 24 de septiembre). Se agrega aquí para no
renumerar el tablero.

| #   | Historia | Rama                                               | Estado |
| --- | -------- | -------------------------------------------------- | ------ |
| 83  | HU-11.0  | docs, directo sobre la rama de épica               | ✅     |
| 84  | HU-11.1  | `fix/NEQUE-11.1-design-system-contraste-targets`   | ✅     |
| 85  | HU-11.2  | `fix/NEQUE-11.2-bugs-bloqueantes`                  | ✅     |
| 86  | HU-11.3  | `fix/NEQUE-11.3-scroll-start-runner`               | ✅     |
| 87  | HU-11.4  | `fix/NEQUE-11.4-accesibilidad`                     | ✅     |
| 88  | HU-11.5  | `feat/NEQUE-11.5-reset-password-step`              | ✅     |
| 89  | HU-11.6  | `fix/NEQUE-11.6-hallazgos-diferidos` (tres tandas) | ✅     |

### Épica 13 — QA en dispositivo

| #   | Historia | Rama                       | Release | Estado |
| --- | -------- | -------------------------- | ------- | ------ |
| 90  | HU-13.1  | `develop`                  | 0.0.1   | ✅     |
| 91  | HU-13.2  | `release/0.0.2`            | 0.0.2   | ✅     |
| 92  | HU-13.3  | `feat/rutinas-compartidas` | 0.0.3   | ✅     |
| 93  | HU-13.4  | `feat/rutinas-compartidas` | 0.0.3   | ✅     |
| 94  | HU-13.5  | `release/0.0.4`            | 0.0.4   | 🔄     |

#### Historial de releases

| Release | Fecha      | PR        | Contenido                                                         |
| ------- | ---------- | --------- | ----------------------------------------------------------------- |
| 0.0.1   | 2026-09-25 | #11       | Épicas 0, 7, 8, 9 y 11 (PRs #9 y #10) y la primera IPA (HU-13.1). |
| 0.0.2   | 2026-09-26 | #12       | QA de la IPA 0.0.1 (HU-13.2).                                     |
| 0.0.3   | 2026-09-27 | #13       | Rutinas compartidas (HU-13.3) y login en iPhone (HU-13.4).        |
| 0.0.4   | 2026-09-27 | pendiente | Mejoras para la IPA 0.0.4 (HU-13.5).                              |

---

## Componentes que se reutilizan tal cual

- **Mixins:** `nq-btn-gradient`, `nq-field-base`, `nq-nav-back`.
- **Clases:** `.nq-card`, `.nq-search`, `.nq-badge*`, `.nq-avatar`, `.nq-tabs`/`.nq-tab`,
  `.nq-overlay`/`.nq-sheet*`, `.nq-state*`, `.nq-skeleton-*`, `.nq-scroll`.
- **Keyframes:** `nq-fade-up`, `nq-spin`, `nq-shimmer`.
- **Patrones:** `toSignal(NavigationEnd)` de `trainer-layout.page.ts` (tab bar activa) y
  `page-state.component.ts` (loading/error/empty/offline).

### Agregados en las Épicas 7 y 8

- **Componentes:** `<nq-workout-card>` (modos `progress` y `upcoming`), `<nq-bar-chart>`,
  `<nq-line-chart>`, `<nq-ring-progress>`.
- **Mixin de shell:** `nq-shell` en `ui/shared/theme/_shell.scss`, compartido por los
  layouts de entrenador y alumno. Es mixin y no clase global para que el CSS viaje en
  los chunks lazy y no en el bundle inicial.
- **Aplicación:** `AsyncState<T>` con su `viewState()`, `SessionFacade`.
- **Dominio:** `DomainError`, helpers de fecha, `CLOCK`, `calculateBmi()`,
  `weeklyProgress()`, `buildMonthGrid()`.
- **UI compartida:** `authGuard` / `roleGuard` / `publicOnlyGuard`, `passwordRules()`,
  `chart-math.ts`, `NotFoundPage`.

### Agregados en la Épica 13

- **Componentes:** `<nq-profile-hero>`, `<nq-change-password-form>`, `<nq-stepper>`.
- **Navegación:** `FabRegistry` / `useFab()` (botón flotante que pinta el shell) y la
  pantalla de notificaciones compartida en `ui/shared/pages/notifications`.
- **Dominio:** `prescription.ts` (carga y medida), `streak.ts`, `adherence.ts` y
  `risk.ts` (`studentRisk()`, `riskLabel()`).
- **Tokens:** `--nq-page-pt`, `--nq-font-input`, `--nq-fab-size`, `--nq-fab-space`.
- **Clases:** `.nq-empty-inline`.

### Patrón de página

Toda página nueva resuelve sus estados con un único `@switch` sobre la facade:

```
@switch (facade.viewState()) {
  @case ('loading') { <nq-page-state type="loading" /> }
  @case ('error')   { <nq-page-state type="error" [retry]="reload" /> }
  @case ('empty')   { <nq-page-state type="empty" title="…" message="…" /> }
  @case ('success') { …contenido… }
}
```

`reload` se declara como **campo arrow** (`reload = () => this.facade.reload();`): el
input `[retry]` es `() => void` y `strictTemplates` no acepta un método desbindado.

---

## Fuera de alcance por ahora

- **Pagos vía Flow.cl** — solo hay una URL declarada en `environments/` sin ningún
  consumidor; no se planifica una épica de pagos hasta confirmar la necesidad real.
- ~~**Push notifications**~~ — ya no está fuera de alcance: es `Must Have` en el PRD y
  está planificado en la HU-12.9.
- ~~**Compartir contenido**~~ — `@capacitor/share` ya se usa para compartir la
  invitación (HU-9.5).
- ~~**Cámara**~~ — ya no está fuera de alcance: está planificada en la HU-12.8. Hoy las
  fotos entran por `<input type="file">`, que en iOS ofrece cámara o galería (T-13.2.3).
- **Auth social o recuperación por SMS** — el alcance inferido de la Épica 1 asume
  únicamente email + contraseña + OTP por email.
- **Analítica de uso.**
