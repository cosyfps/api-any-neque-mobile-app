# Auditoría integral — Ñeque (2026-11-02)

**Rol:** Tech Lead · Arquitecto · QA Senior.
**Alcance:** repositorio `ui-any-neque-mobile-app`, rama `main` en `c4bf697` (Release/0.0.4, #14).
**Naturaleza:** diagnóstico y planificación. No se modificó código, no se instalaron
dependencias, no se tocó Supabase ni Vercel.

Documentos que acompañan a esta auditoría (las directrices a seguir):

| Documento                                                                            | Contenido                                                       |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| [`../monolito/01-arquitectura-monolito.md`](../monolito/01-arquitectura-monolito.md) | Arquitectura actual vs. objetivo y estructura de carpetas       |
| [`../monolito/02-bff-directrices.md`](../monolito/02-bff-directrices.md)             | Cómo construir el BFF: capas, endpoints, auth, errores, tests   |
| [`../monolito/03-supabase-directrices.md`](../monolito/03-supabase-directrices.md)   | Esquema PostgreSQL, RLS, Storage, migraciones, seeds, respaldos |
| [`../monolito/04-vercel-despliegue.md`](../monolito/04-vercel-despliegue.md)         | Despliegue, ambientes, variables, CI/CD, límites                |
| [`../monolito/05-backlog-roadmap.md`](../monolito/05-backlog-roadmap.md)             | Backlog nuevo por épicas, roadmap e hitos                       |

---

## 0. Cómo se obtuvo la evidencia

| Fuente                                                     | Qué se hizo                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Documentación                                              | Lectura completa de `docs/BACKLOG.md`, `docs/PRD.md`, `docs/modelo-datos.md`, plan de la Épica 12 e índices de `docs/tickets/`                                                                                                                                                                         |
| Código                                                     | Lectura de los 14 puertos de `domain/`, todos los modelos, `app.config.ts`, `app.routes.ts`, guards, `SessionFacade`, adapters mock de auth/rutinas/workouts, providers por rol, facades del entrenador                                                                                                |
| Configuración                                              | `package.json`, `angular.json`, `vercel.json`, `capacitor.config.ts`, `environments/`, `.github/workflows/`                                                                                                                                                                                            |
| Git                                                        | `git log`, `git branch -a`                                                                                                                                                                                                                                                                             |
| Gates (`lint`, `typecheck`, `test:coverage`, `build:prod`) | **No se pudieron ejecutar**: `node_modules/` no está instalado y la regla de la auditoría prohíbe instalar dependencias. Las métricas de calidad citadas abajo vienen del backlog (2026-09-27) y **quedan pendientes de re-verificación** con `npm ci && npm run test:coverage && npm run build:prod`. |

---

## 1. Resumen ejecutivo

**Qué hay:** una app Angular 17 + Capacitor 6, bien estructurada en hexagonal
(`domain / application / infrastructure / ui`), con **las dos apps (entrenador y alumno)
completas y navegables contra adapters mock en memoria**. 130 archivos de código, 86
specs, cobertura declarada 97,8 % líneas. Documentación de producto y de tickets muy por
encima de la media.

**Qué no hay:** backend. **Ninguna funcionalidad persiste** (recargar la página pierde
todo cambio), la autenticación es simulada (token `mock-token-<id>`), no existe base de
datos, ni RLS, ni Storage, ni API. De los 9 criterios de aceptación del MVP del PRD
(§13) solo se cumplen **2** (CA3, CA6), y los 7 restantes dependen del backend.

**Veredicto:** el frontend está en **estabilización**; el producto completo está en
**Preparación inicial**. El camino crítico es exactamente el que el PRD ya identificaba
(R1): BFF + Supabase. El cambio a monolito **reduce** ese riesgo (un repo, un deploy, un
pipeline) y la arquitectura actual lo permite sin reescribir: conectar el backend es
sustituir `infrastructure/` por adapters HTTP, salvo tres excepciones documentadas en
§6 (N+1 del Inicio del entrenador, generación de sesiones, citas de agenda).

| Pregunta                       | Respuesta corta                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| ¿Qué está realmente terminado? | La UI y las reglas de dominio de ambos roles, contra datos simulados                                   |
| ¿Qué HU están pendientes?      | Épica 10 (BFF), Épica 12 (10 de 11 HU), Épica 6 (release), auth real                                   |
| ¿Qué falta para producción?    | BFF, esquema Supabase con RLS, Auth real, Storage, despliegue, E2E, SMTP, plataformas nativas firmadas |
| ¿Cuánto falta?                 | Ver el backlog en `05-backlog-roadmap.md`: ~45 tareas, la mayoría S/M                                  |

---

## 2. Estado actual del repositorio

### 2.1 Stack

| Área    | Tecnología                                                                                                            | Observación                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| UI      | Angular 17 standalone, signals, `@if/@switch`                                                                         | Sin Ionic desde la Épica 9                                                     |
| Nativo  | Capacitor 6 (`share`, `screen-orientation` en uso; `camera`, `push-notifications` instalados sin uso)                 | No existen `android/` ni `ios/` en el repo                                     |
| Estado  | Facades con `signal` + `AsyncState<T>`                                                                                | Patrón uniforme, bueno                                                         |
| Tests   | Jest + jest-preset-angular + Testing Library                                                                          | 86 specs; **0 E2E**                                                            |
| Calidad | ESLint, Prettier, Husky, commitlint, lint-staged                                                                      |                                                                                |
| CI      | `ci.yml` (deps → lint → typecheck → test:coverage → build → `ci-gate`), `ios-ipa.yml` (IPA sin firmar), `release.yml` |                                                                                |
| Hosting | `vercel.json` con build estático y rewrite SPA                                                                        | `publicAppUrl: https://neque.vercel.app`                                       |
| Backend | **No existe**                                                                                                         | `supabaseUrl`/`supabaseAnonKey` vacíos y sin consumidores; `flowApiUrl` muerto |

### 2.2 Estructura

```
src/app/
├── domain/          14 puertos (InjectionToken + interfaz) y modelos puros
├── application/     facades por feature (auth, students, trainers, routines, workouts, …)
├── infrastructure/  adapters *.mock-adapter.ts + seed/ + providers por rol
└── ui/              auth/, student/, trainer/, shared/ (componentes, guards, theme)
```

**Hallazgo positivo clave para el monolito:** los **modelos de `domain/*/model/*.ts` no
importan Angular** (solo `ids`, `date`, otros modelos). Son reutilizables tal cual por el
BFF (tipos y funciones puras como `withDerivedStatus`, `studentRisk`, `goalsMatch`,
`INVITATION_TTL_HOURS`). Los **puertos sí** importan `@angular/core` (`InjectionToken`)
y `rxjs`, así que no se comparten con el servidor.

### 2.3 Persistencia, auth y entorno

| Tema                 | Estado verificado                                                                     | Evidencia                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Persistencia         | En memoria por injector. Se pierde al recargar                                        | `provideMockData()` en `app.config.ts`; `provideStudentMockData()` / `provideTrainerMockData()` |
| Sesión               | JSON plano en `localStorage['neque.session']`                                         | `local-storage-session.adapter.ts`                                                              |
| Token                | `mock-token-${userId}`, expira a 7 días                                               | `auth.mock-adapter.ts` `buildSession()`                                                         |
| Autorización         | Solo en cliente: `authGuard`, `roleGuard`, `publicOnlyGuard` leen la sesión local     | `ui/shared/guards/auth.guard.ts`                                                                |
| Bloqueo por intentos | 5 intentos → 5 min, en memoria                                                        | `auth.mock-adapter.ts`                                                                          |
| Credenciales semilla | En `accounts.seed.ts`, cargado por el injector **raíz** → viajan en el bundle inicial | `mock-providers.ts` → `provideAuthMockAdapters()`                                               |
| Variables de entorno | Compile-time (`environment*.ts` + `fileReplacements`). Sin `apiBaseUrl`               | `src/environments/`                                                                             |

---

## 3. Inventario y matriz de HU

### 3.1 Fuente

Backlog formal en `docs/BACKLOG.md` + un `.md` por ticket en `docs/tickets/epica-*`. Las
HU **no** son reconstruidas: todas salen de esos archivos. La Épica 12 está solo en
`docs/planes/2026-09-25-epica-12-cierre-prd.md` (sin carpeta de tickets).

Las Épicas 1–5 están **absorbidas** por la 7 y la 9 según el propio backlog. Se listan
aparte y **no se cuentan** en el porcentaje, para no duplicar.

### 3.2 Criterio de estados

- **COMPLETADA (mock):** criterios cumplidos contra adapters mock, con specs. Es el
  máximo alcanzable sin backend. **No** implica persistencia.
- Cualquier criterio que mencione Supabase, persistencia o restricción de acceso entre
  entrenadores **no** puede estar completado hoy → PARCIAL o BLOQUEADA.

### 3.3 Matriz de trazabilidad

| HU        | Descripción                                                                                          | Estado                      | Implementado                                                          | Pendiente                                                              | Evidencia                                      |
| --------- | ---------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| 0.1       | Gitflow                                                                                              | PENDIENTE DE VALIDACIÓN     | Plantillas, CODEOWNERS, CONTRIBUTING, README. `origin/develop` existe | Confirmar branch protection (T-0.1.2); el tablero aún marca T-0.1.1 ⬜ | `git branch -a`, `.github/`                    |
| 0.2       | Gate de coverage real                                                                                | COMPLETADA                  | `ci.yml` compara métrica a métrica                                    | Re-ejecutar local                                                      | `.github/workflows/ci.yml`                     |
| 0.3       | Limpieza config/estilos                                                                              | COMPLETADA                  | `fileReplacements`, Inter self-host                                   | —                                                                      | `angular.json`, `src/assets/fonts`             |
| 6.1       | QA de integración (checklist)                                                                        | NO IMPLEMENTADA             | —                                                                     | Checklist en `docs/`                                                   | No existe                                      |
| 6.2       | Plataformas nativas                                                                                  | PARCIAL                     | IPA sin firmar por workflow                                           | `android/`, firma, `ios/` versionado                                   | `ios-ipa.yml`                                  |
| 6.3       | Corte v1.0.0                                                                                         | NO IMPLEMENTADA             | Releases 0.0.x                                                        | Tag v1.0.0, CHANGELOG                                                  | `git log`                                      |
| 7.0       | Docs épicas 7/8                                                                                      | COMPLETADA                  |                                                                       |                                                                        | `docs/tickets/epica-7`                         |
| 7.1       | Migración hexagonal                                                                                  | COMPLETADA                  | `{capa}/{feature}`                                                    |                                                                        | `src/app/`                                     |
| 7.2       | Núcleo compartido                                                                                    | COMPLETADA                  | `DomainError`, `AsyncState`, `CLOCK`                                  |                                                                        | `domain/shared`, `application/shared`          |
| 7.3       | Auth por rol                                                                                         | PARCIAL                     | Login, guards por rol, recuperación, 404                              | Auth real, token firmado, expiración en caliente, 401 global           | `auth.mock-adapter.ts`                         |
| 7.4       | Invitación `/invite/:token`                                                                          | PARCIAL                     | UI, estados, auto-login                                               | Token real, de un uso, en servidor                                     | `invitation.mock-adapter.ts`                   |
| 7.5       | `<router-outlet>`                                                                                    | COMPLETADA                  |                                                                       |                                                                        | `app.component.ts`                             |
| 8.1       | Shell alumno                                                                                         | COMPLETADA (mock)           |                                                                       |                                                                        | `ui/student/student-layout.page.ts`            |
| 8.2       | Dominio y datos alumno                                                                               | PARCIAL                     | Puertos y adapters mock                                               | Adapters HTTP                                                          | `infrastructure/student-providers.ts`          |
| 8.3       | Home alumno                                                                                          | COMPLETADA (mock)           | IMC, progreso semanal                                                 |                                                                        | `ui/student/home`                              |
| 8.4       | Mi rutina                                                                                            | COMPLETADA (mock)           |                                                                       |                                                                        | `ui/student/routine`                           |
| 8.5       | Runner                                                                                               | COMPLETADA (mock)           | Fases, descanso, series reales                                        | Offline (12.10)                                                        | `workout-runner.facade.ts`                     |
| 8.6       | Progreso y fotos                                                                                     | COMPLETADA (mock)           | Gráficos, galería, comparador                                         | Fotos persistentes (Storage)                                           | `progress.facade.ts`                           |
| 8.7       | Agenda                                                                                               | COMPLETADA (mock)           | Calendario, confirmar, cancelar                                       | **Nadie puede crear citas** (ver H-07)                                 | `schedule.port.ts`                             |
| 8.8       | Notificaciones                                                                                       | COMPLETADA (mock)           |                                                                       | Emisión real de eventos                                                | `notifications.mock-adapter.ts`                |
| 8.9       | Perfil alumno                                                                                        | COMPLETADA (mock)           |                                                                       |                                                                        | `ui/student/profile`                           |
| 9.0–9.1   | Docs y dominio entrenador                                                                            | COMPLETADA                  |                                                                       |                                                                        | `docs/tickets/epica-9`                         |
| 9.2       | Infra entrenador                                                                                     | PARCIAL                     | Adapters mock                                                         | Adapters HTTP                                                          | `trainer-providers.ts`                         |
| 9.3–9.11  | Shell, cartera, alta+invitación, ficha, anamnesis, evaluaciones, rutinas, ejercicios, perfil, inicio | COMPLETADA (mock)           |                                                                       | Ver H-05 (N+1)                                                         | `ui/trainer/**`                                |
| 9.12      | Alineación de contrato                                                                               | COMPLETADA                  | `targetType/targetId`, `workoutSets`, `cancel(reason)`                | `modelo-datos.md` quedó desactualizado después (H-09)                  | `docs/modelo-datos.md`                         |
| 11.0–11.6 | Correcciones de auditoría                                                                            | COMPLETADA                  | 45 hallazgos cerrados                                                 |                                                                        | `docs/auditoria/2026-09-18-cierre-epica-11.md` |
| 12.0      | Docs Épica 12                                                                                        | PARCIAL                     | Registrada en backlog                                                 | PRD §6 y `modelo-datos.md`                                             | Plan Épica 12                                  |
| 12.1      | Config alineada a §7                                                                                 | NO IMPLEMENTADA             |                                                                       | Umbral 95/85, budget 300 kB, quitar `flowApiUrl`                       | `package.json` sigue en 80; budget 500 kB      |
| 12.2      | Progresión de carga en ficha                                                                         | NO IMPLEMENTADA             |                                                                       | **CA4 falla aunque exista BFF**                                        | Plan Épica 12                                  |
| 12.3      | Cancelación por el entrenador                                                                        | NO IMPLEMENTADA             |                                                                       |                                                                        | Plan Épica 12                                  |
| 12.4      | Freemium 3 alumnos                                                                                   | NO IMPLEMENTADA             |                                                                       | `Trainer.plan` no existe                                               | `trainer.model.ts`                             |
| 12.5      | Notas privadas                                                                                       | NO IMPLEMENTADA             |                                                                       |                                                                        | —                                              |
| 12.6      | Plantillas                                                                                           | NO IMPLEMENTADA             | (Superada en parte por T-13.3.1)                                      | Redefinir alcance                                                      | BACKLOG §12                                    |
| 12.7      | Plataformas nativas                                                                                  | NO IMPLEMENTADA             |                                                                       |                                                                        | —                                              |
| 12.8      | Cámara                                                                                               | NO IMPLEMENTADA             | `<input type=file>`                                                   |                                                                        | —                                              |
| 12.9      | Push                                                                                                 | PARCIAL                     | T-12.9.4 (mapa por rol)                                               | Registro de token, envío                                               | `notification-target.ts`                       |
| 12.10     | Offline del runner                                                                                   | BLOQUEADA                   |                                                                       | Requiere BFF                                                           | `PageStateType 'offline'` sin uso              |
| 13.1–13.5 | QA en dispositivo 0.0.1–0.0.4                                                                        | COMPLETADA                  |                                                                       | El backlog marca 13.5 🔄 pero #14 está mergeado                        | `git log`                                      |
| 10        | Conexión al BFF                                                                                      | BLOQUEADA → **se redefine** | —                                                                     | Todo                                                                   | Épica reservada, sin HU                        |

**Absorbidas (no contadas):** Épica 1 (3 HU, re-abierta de hecho por el cambio a
Supabase Auth), Épicas 2–5 (13 HU, cumplidas en UI por la 9; sus criterios de
"impedir acceso a alumnos no vinculados" siguen pendientes hasta RLS).

### 3.4 Funcionalidades sin HU

| Funcionalidad                                   | Dónde                                   | Comentario                                |
| ----------------------------------------------- | --------------------------------------- | ----------------------------------------- |
| Alertas al entrenador derivadas (dolor, riesgo) | `trainer-notifications.mock-adapter.ts` | Lógica de negocio que debe mudarse al BFF |
| Sugerencia de rutina por objetivo               | `goalsMatch()` en `routine.model.ts`    | Pura, reutilizable                        |
| "Alumno en riesgo"                              | `risk.ts`                               | Pura, reutilizable                        |
| Enlace corto `/i/:token`                        | `app.routes.ts`                         |                                           |

---

## 4. Avance real del backlog

Universo contado: **57 HU** (Épicas 0, 6, 7, 8, 9, 11, 12, 13).

| Estado                      |  HU |      % |
| --------------------------- | --: | -----: |
| COMPLETADA (incluye "mock") |  38 | 66,7 % |
| PARCIAL                     |   7 | 12,3 % |
| NO IMPLEMENTADA             |  10 | 17,5 % |
| PENDIENTE DE VALIDACIÓN     |   1 |  1,8 % |
| BLOQUEADA                   |   1 |  1,8 % |

**Lectura correcta del número:** el 66,7 % mide **UI + dominio**. Medido contra el MVP
del PRD (§13), el avance es **2 de 9 criterios (22 %)**, y medido contra persistencia
real es **0 %**. La Épica 10 no tiene HU, así que su peso no aparece en la tabla: es la
mayor parte del trabajo restante.

---

## 5. Auditoría QA

> "Verificado en código" = leído y razonado. "No verificable" = depende de backend.
> No se ejecutó la app (sin `node_modules`).

### 5.1 Funcional

| Área                                    | Estado                      | Observación                                                                              |
| --------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| Flujos F1–F6 del PRD                    | Verificado en código (mock) | Todos existen y están conectados facade → puerto → adapter                               |
| Estados loading/error/empty             | ✅                          | Patrón único `AsyncState` + `<nq-page-state>`                                            |
| Mensajes de error                       | ✅                          | `DomainError` con mensajes en español                                                    |
| Persistencia                            | ❌                          | Recargar = perder todo. En la PWA de Vercel esto ya es visible para cualquiera           |
| Consistencia entre pantallas            | ✅ dentro de un rol         | Un injector por rol. Entre roles no hay consistencia (dos juegos de mocks)               |
| Sesión expirada en caliente             | ❌                          | `isExpired` solo se evalúa en `restore()`; ningún interceptor reacciona a `unauthorized` |
| Error de red                            | ⚠️                          | Existe `network` en `DomainErrorCode`, nada lo produce todavía                           |
| Creación de citas                       | ❌                          | `SchedulePort` no tiene `create`; la agenda solo tiene datos semilla                     |
| Generación de sesiones de entrenamiento | ❌                          | Las sesiones salen de `buildWorkoutSeed()`; asignar una rutina no crea nada persistente  |

### 5.2 Negativas y casos límite (plan para cuando exista el BFF)

| Caso                                        | Hoy                            | Debe cubrirse en                                           |
| ------------------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| Campos vacíos / inválidos                   | Validación en UI               | **Repetir en BFF** (zod) — la UI se salta con `curl`       |
| Correo duplicado al dar de alta             | `conflict` en mock             | Índice único + 409                                         |
| Registro inexistente / de otro entrenador   | `not_found` en mock            | RLS + 404 (no 403, para no filtrar existencia)             |
| Doble envío (doble toque)                   | Corregido en runner (T-11.2.2) | Idempotencia con `clientOpId` en series                    |
| Operaciones simultáneas (dos entrenadores…) | N/A                            | Transacciones en funciones SQL                             |
| Timeout / pérdida de red a mitad de sesión  | N/A                            | HU-12.10                                                   |
| Recarga de página                           | Pierde datos                   | Desaparece con BFF                                         |
| Acceso directo a `/trainer/*` siendo alumno | ✅ `roleGuard`                 | Además, 403/404 en API                                     |
| Token alterado en localStorage              | **Se acepta**                  | JWT verificado en servidor                                 |
| Foto de 8 MB                                | Data URL en memoria            | Subida directa a Storage (límite 4,5 MB de body en Vercel) |
| Invitación expirada/usada/revocada          | ✅ mock                        | Estado en BD + 410                                         |

### 5.3 UX

Fuerte: contraste AA, 44×44, foco visible, `aria-live`, reduced-motion (Épica 11),
probado en iPhone 12 Pro (Épica 13). Débil: no hay pantalla de "sin conexión", no hay
onboarding del entrenador nuevo (cartera vacía es el único guiado), modo escritorio no
evaluado (la PWA en Vercel se verá a ancho completo).

### 5.4 Calidad técnica

| Tema                                                     | Observación                                                                                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Arquitectura                                             | Hexagonal respetada; regla de dependencias documentada y aplicada                                                                             |
| Tamaño de componentes                                    | Páginas grandes (`student-progress.page.ts` ~600 líneas, `trainer-profile.page.ts` ~400)                                                      |
| Lógica de negocio en el front que debe vivir en servidor | Bloqueo por intentos, vigencia de invitación, alertas al entrenador, archivado de rutina previa, unicidad de correo, límite freemium (futuro) |
| N+1                                                      | `TrainerHomeFacade.cargarTablero` y `TrainerProfileFacade.adherenciaPromedio` hacen 4 y 1 llamadas **por alumno activo**                      |
| Tests                                                    | Unitarios abundantes; **sin integración ni E2E**; sin pruebas de contrato                                                                     |
| Observabilidad                                           | Ninguna (no hay logging ni captura de errores)                                                                                                |

---

## 6. Hallazgos y bugs

| ID   | Sev.    | Hallazgo                                                                                                                                    | Evidencia                                                                                                                                                    | Acción                                                                                                    |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| H-01 | Crítico | No hay backend ni persistencia                                                                                                              | `app.config.ts` → `provideMockData`                                                                                                                          | Épicas BFF + Supabase                                                                                     |
| H-02 | Crítico | Autorización solo en cliente; token falsificable editando `localStorage`                                                                    | `auth.guard.ts`, `buildSession()`                                                                                                                            | JWT Supabase verificado en BFF + RLS                                                                      |
| H-03 | Alto    | Contraseñas semilla en el bundle inicial publicado en Vercel                                                                                | `accounts.seed.ts` cargado desde el injector raíz                                                                                                            | Retirar mocks del build de producción                                                                     |
| H-04 | Alto    | El rewrite de `vercel.json` captura `/api/*` y lo manda a `index.html`                                                                      | `"source": "/((?!.*\\.).*)"`                                                                                                                                 | Excluir `api/` (ver `04-vercel-despliegue.md`)                                                            |
| H-05 | Alto    | N+1 en Inicio y Perfil del entrenador: con 20 alumnos, ~81 peticiones HTTP                                                                  | `trainer-home.facade.ts:302`, `trainer-profile.facade.ts:126`                                                                                                | Endpoint agregado `GET /trainers/me/dashboard` (rompe la regla "solo infra cambia": aceptar y documentar) |
| H-06 | Alto    | Las sesiones de entrenamiento no se generan al asignar rutina                                                                               | `buildWorkoutSeed()` solo en el mock                                                                                                                         | Materialización en el BFF                                                                                 |
| H-07 | Alto    | No existe forma de crear citas de agenda                                                                                                    | `SchedulePort` sin `create`                                                                                                                                  | HU nueva (entrenador agenda citas)                                                                        |
| H-08 | Alto    | Sin manejo global de 401 ni refresh de token                                                                                                | `SessionFacade.restore()`                                                                                                                                    | Interceptor HTTP + refresh                                                                                |
| H-09 | Medio   | `modelo-datos.md` desactualizado vs. código                                                                                                 | `Routine` ya es plantilla con `assignments`; `load/measure/durationSeconds`; `skipped/skipReason`; `NotificationKind` `alert`/`invitation`; target `student` | Reemplazado por `03-supabase-directrices.md`                                                              |
| H-10 | Medio   | Fotos y avatares viajan como data URL                                                                                                       | `progress.facade.ts:222`, `profile-hero.component.ts:193`                                                                                                    | Subida firmada a Storage dentro del adapter HTTP                                                          |
| H-11 | Medio   | `DomainErrorCode` no tiene `forbidden`, `validation`, `plan_limit`, `offline`                                                               | `app-error.ts`                                                                                                                                               | Ampliar el enum (cambio de dominio, pequeño)                                                              |
| H-12 | Medio   | Config contradice PRD §7: cobertura 80 vs 95/85, budget 500 kB vs 300                                                                       | `package.json`, `angular.json`                                                                                                                               | HU-12.1                                                                                                   |
| H-13 | Medio   | `environments/` con claves Supabase vacías y `flowApiUrl` muerto; falta `apiBaseUrl`                                                        | `src/environments/`                                                                                                                                          | Reemplazar                                                                                                |
| H-14 | Medio   | Sin E2E                                                                                                                                     | No existe carpeta `e2e/`                                                                                                                                     | Playwright contra Preview                                                                                 |
| H-15 | Medio   | Sin cabeceras de seguridad (CSP, HSTS, etc.)                                                                                                | `vercel.json`                                                                                                                                                | `headers` en Vercel                                                                                       |
| H-16 | Bajo    | Backlog inconsistente: 0.0.4 figura pendiente pero #14 está mergeado; `develop` publicada pero T-0.1.1 ⬜; PRD §5.2 asume repo BFF separado | `BACKLOG.md`, `git log`                                                                                                                                      | Actualizar docs al cerrar Hito 2                                                                          |
| H-17 | Bajo    | Fechas "solo día" (`birthDate`, `startDate`) como `IsoDateString`: riesgo de corrimiento de un día si se guardan como `timestamptz`         | `ids.ts`, `RoutineAssignment`                                                                                                                                | Columnas `date` y formato `YYYY-MM-DD` en el contrato                                                     |

---

## 7. Seguridad

| Control                                    | Estado                                                 | Requisito para producción                                                       |
| ------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Autenticación                              | Simulada                                               | Supabase Auth; el BFF verifica el JWT con JWKS en **cada** petición             |
| Autorización                               | Solo guards de UI                                      | Middleware de rol + verificación de propiedad + RLS                             |
| Sesión                                     | JSON en `localStorage`                                 | Access token corto + refresh token; logout revoca refresh                       |
| Datos de salud (anamnesis, medidas, fotos) | En memoria                                             | RLS + bucket privado + URL firmada corta                                        |
| Variables de entorno                       | Sin secretos (bien)                                    | Secretos **solo** en Vercel (server-side). Nada `SUPABASE_SECRET_KEY` en `src/` |
| SQL injection                              | N/A                                                    | Solo queries parametrizadas (supabase-js / RPC); nada de SQL concatenado        |
| XSS                                        | Angular escapa por defecto; no se encontró `innerHTML` | CSP en Vercel                                                                   |
| CORS                                       | N/A                                                    | Web mismo origen; nativo necesita `capacitor://localhost` y `https://localhost` |
| Rate limit                                 | Mock en memoria                                        | Tabla `login_attempts` (las funciones serverless no comparten memoria)          |
| Invitaciones                               | Token semilla legible                                  | 32 bytes aleatorios, guardado como hash SHA-256, un solo uso                    |
| RLS (CA7)                                  | No existe                                              | Políticas por tabla + tests pgTAP "entrenador A no ve alumnos de B"             |

---

## 8. Arquitectura actual vs. objetivo

Detalle completo en [`01-arquitectura-monolito.md`](../monolito/01-arquitectura-monolito.md).

|         | Actual                                     | Objetivo                                                                                        |
| ------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Repos   | 1 (front); PRD planeaba BFF en repo aparte | 1 monorepo-monolito: `src/` (Angular) + `server/` (BFF) + `api/` (entrada Vercel) + `supabase/` |
| Backend | —                                          | BFF TypeScript hexagonal en Vercel Functions                                                    |
| Datos   | Mocks en memoria                           | Supabase PostgreSQL + Storage                                                                   |
| Auth    | Mock                                       | Supabase Auth (email+password, OTP de recuperación) detrás del BFF                              |
| Deploy  | Front estático en Vercel                   | Un proyecto Vercel: estático + funciones                                                        |

## 9–10. Supabase y Vercel

Ver [`03-supabase-directrices.md`](../monolito/03-supabase-directrices.md) y
[`04-vercel-despliegue.md`](../monolito/04-vercel-despliegue.md).

---

## 11. GAP Analysis

| Área            | Estado actual            | Estado objetivo                                      | Brecha                                                     | Prioridad   |
| --------------- | ------------------------ | ---------------------------------------------------- | ---------------------------------------------------------- | ----------- |
| Frontend        | Completo contra mock     | Adapters HTTP, interceptor auth, offline runner      | Infra HTTP, 401/refresh, Storage, 3 cambios de application | Alta        |
| BFF             | No existe                | `server/` hexagonal, ~45 endpoints                   | Todo                                                       | **Crítica** |
| Arquitectura    | Hexagonal en front       | Hexagonal en front y BFF, modelos compartidos        | Estructura `server/`, alias `@domain/*`                    | Alta        |
| Base de datos   | No existe                | 21 tablas, enums, índices, funciones transaccionales | Todo                                                       | **Crítica** |
| Autenticación   | Mock                     | Supabase Auth + JWKS + refresh                       | Todo                                                       | **Crítica** |
| Seguridad       | Guards de UI             | RLS, validación servidor, CSP, rate limit            | Todo                                                       | **Crítica** |
| Testing         | Unit 97 %                | + integración BFF, pgTAP RLS, E2E Playwright         | 3 niveles nuevos                                           | Alta        |
| Infraestructura | Vercel estático          | Vercel estático + Functions; Supabase dev/prod       | Proyectos, regiones, SMTP                                  | Alta        |
| Despliegue      | `vercel.json` SPA        | Rewrites con `/api`, headers, previews con BD de dev | Config + secretos                                          | Alta        |
| Documentación   | Excelente pero desfasada | PRD §5, `modelo-datos.md`, BACKLOG actualizados      | Actualización                                              | Media       |
| Nativo          | IPA sin firmar           | Android + iOS firmados apuntando a la API            | Épica 6/12.7                                               | Media       |

---

## 12–13. Backlog y roadmap

Ver [`05-backlog-roadmap.md`](../monolito/05-backlog-roadmap.md).

---

## 14. Riesgos y bloqueantes

| #   | Riesgo                                                                              | Prob. | Impacto | Mitigación                                                                                                    |
| --- | ----------------------------------------------------------------------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------- |
| R1  | BFF + BD no llegan a diciembre                                                      | Alta  | Crítico | Monolito, migrar por vertical (auth → alumnos → rutinas → workouts), no por capa                              |
| R2  | SMTP por defecto de Supabase solo envía a miembros del equipo y con límite muy bajo | Alta  | Alto    | SMTP propio (p. ej. Resend) antes del Hito 4 — **bloquea recuperación de contraseña**                         |
| R3  | Supabase Free pausa proyectos inactivos y no tiene backups diarios                  | Media | Alto    | Plan Pro para prod o `pg_dump` programado en GitHub Actions                                                   |
| R4  | Vercel Hobby prohíbe uso comercial; OB1 son entrenadores reales                     | Media | Medio   | Confirmar si el piloto académico califica; si no, Pro                                                         |
| R5  | Arranque en frío de funciones + latencia a Supabase                                 | Media | Medio   | Misma región (São Paulo: Supabase `sa-east-1`, Vercel `gru1`), framework ligero                               |
| R6  | Cambio de firmas de `application` por N+1 rompe la promesa "solo infra" del PRD     | Alta  | Bajo    | Aceptarlo y documentarlo como decisión                                                                        |
| R7  | Datos de salud: obligaciones de la Ley 19.628 / 21.719 (Chile)                      | Media | Alto    | Consentimiento explícito al aceptar invitación; política de privacidad (fuera del alcance técnico, se señala) |

**Bloqueantes actuales:** no existe proyecto Supabase, no hay decisión tomada sobre
framework del BFF (ver 02), no hay SMTP.

---

## 15. Preparación para producción

| Indicador                                           | Valor                                                     | Fuente             |
| --------------------------------------------------- | --------------------------------------------------------- | ------------------ |
| HU completadas                                      | 66,7 % (UI+dominio)                                       | §4                 |
| HU parciales                                        | 12,3 %                                                    | §4                 |
| HU pendientes (no impl. + bloqueadas + por validar) | 21,1 %                                                    | §4                 |
| Criterios MVP (PRD §13)                             | 2/9                                                       | PRD                |
| Cobertura                                           | 97,8 / 86,9 / 97,1 / 97,8 declarada; **no re-verificada** | BACKLOG 2026-09-27 |
| Madurez arquitectónica front                        | Alta                                                      | §2                 |
| Integración Supabase                                | 0 %                                                       | —                  |
| Integración Vercel                                  | Solo estático; rewrite incompatible con API               | `vercel.json`      |
| Riesgos críticos abiertos                           | H-01, H-02                                                | §6                 |

**Nivel: Preparación inicial** (el frontend por sí solo estaría "En estabilización").

Justificación: aunque la UI está madura y probada en dispositivo, el producto no puede
usarse por un entrenador real: no persiste nada, no autentica a nadie y no protege
ningún dato. Ninguna de las tres cosas es un detalle; son el núcleo del MVP.
