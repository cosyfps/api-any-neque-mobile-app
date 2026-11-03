# 02 — Directrices del BFF

**Estado:** propuesta (2026-11-02). Lo marcado **[DECISIÓN]** necesita confirmación
antes de empezar el Hito 2.
**Lee antes:** [`01-arquitectura-monolito.md`](01-arquitectura-monolito.md).

---

## 1. Principios no negociables

1. **El contrato lo define el front.** Cada método de los 14 puertos de
   `src/app/domain/**/port` tiene un endpoint. El BFF devuelve exactamente las formas de
   `src/app/domain/**/model` (camelCase, mismos nombres, mismos enums).
2. **Nada de lo que manda el cliente sobre identidad se cree.** `trainerId`,
   `studentId`, `userId`, `role` salen del JWT; si vienen en la URL o el body, se
   comprueba que pertenecen al usuario y si no → **404** (no 403: no se revela que
   existe).
3. **Validación en el servidor siempre**, aunque la UI ya valide.
4. **Las escrituras con más de una fila van en una función SQL** (una transacción).
   supabase-js no ofrece transacciones.
5. **RLS es la última línea, no la única.** El BFF autoriza; RLS impide el error.
6. **Cero secretos en `src/`.** La clave secreta de Supabase solo existe en variables de
   Vercel de tipo servidor y en `server/config/env.ts`.
7. **Sin estado en memoria entre peticiones** (contadores, caches de sesión, colas): una
   función serverless puede ser otra instancia en la siguiente llamada.

---

## 2. Framework **[DECISIÓN]**

Vercel no ejecuta un servidor que haga `listen()`: cada petición invoca una función. El
BFF debe exportar un _handler_.

| Opción                    | Cómo corre en Vercel                                                                                                                                                                                                                                       | Pros                                                                                                                     | Contras                                                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Hono (recomendada)** | `api/[[...route]].ts` exporta la app Hono con el adaptador para Vercel (verificar en la doc vigente de Hono la forma exacta para runtime Node)                                                                                                             | Arranque en frío mínimo, sin decoradores ni `reflect-metadata`, `app.request()` para tests sin servidor, tipado de rutas | Menos "enterprise" para la defensa; la estructura hexagonal la pone el proyecto, no el framework                                                        |
| B. NestJS adaptado        | `NestFactory.create(AppModule, new ExpressAdapter(express))` una vez por instancia (cache en variable de módulo), `await app.init()`, y el handler delega en la instancia de Express. Compilar con `nest build`/`tsc` y apuntar la función al JS compilado | Es lo que nombra el PRD; DI y módulos conocidos                                                                          | Arranque en frío notablemente mayor; `emitDecoratorMetadata` exige compilar con `tsc` (los bundlers tipo esbuild no emiten metadatos); más dependencias |

**Recomendación: A.** El valor arquitectónico que el PRD quiere defender (hexagonal,
regla de dependencias verificable) vive en `server/domain` y `server/application`, que
son TypeScript puro y no dependen del framework. Hono solo aparece en `server/http`. Si
la evaluación académica exige NestJS por nombre, la opción B es viable sin tocar
`domain` ni `application`.

Runtime: **Node.js** (no Edge). Región de la función = región de Supabase.

### Dependencias propuestas (instalar en el Hito 2, no antes)

| Paquete                 | Uso                                                |
| ----------------------- | -------------------------------------------------- |
| `hono`                  | HTTP                                               |
| `@supabase/supabase-js` | Datos, Auth admin, Storage (**solo en `server/`**) |
| `jose`                  | Verificar el JWT con JWKS                          |
| `zod`                   | Validación de entrada y de `env`                   |
| `supabase` (dev)        | CLI: migraciones, `supabase start`, tests pgTAP    |

---

## 3. Capas del BFF

```
server/http/routes/students.ts      → parsea + valida (zod) → llama al caso de uso
server/application/create-student.ts → orquesta: reglas, puertos de salida
server/domain/students/port/students-repository.ts  → interfaz
server/infrastructure/supabase/students.repository.ts → implementación supabase-js
```

- **Un caso de uso = un archivo = una función** `(deps) => (input, actor) => Promise<Result>`.
  Sin clases si no hacen falta (R6 del PRD: nada de sobre-arquitectura).
- `actor` = `{ userId, role, profileId }` extraído del JWT por el middleware.
- Los repositorios devuelven **modelos del dominio** (camelCase). El mapeo
  `snake_case ↔ camelCase` vive solo en `infrastructure/supabase/mappers/`.
- Composición en `server/http/app.ts`: crea los repositorios con el cliente de Supabase
  **por petición** (lleva el JWT del usuario) y se los pasa a los casos de uso.

---

## 4. Autenticación con Supabase Auth

### 4.1 Decisión

Supabase Auth reemplaza las tablas `users.passwordHash`, `otpCodes` y `authSessions` de
`modelo-datos.md`. El front **nunca** habla con Supabase Auth: lo hace el BFF.

### 4.2 Flujos

| Puerto                   | Endpoint                                           | Implementación                                                                                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login`                  | `POST /api/v1/auth/login`                          | 1) `login_attempts`: si bloqueado → 429 `too_many_attempts`. 2) `auth.signInWithPassword`. 3) Fallo → sumar intento (5 → bloqueo 5 min, igual que el mock). 4) Éxito → limpiar intentos, construir `AuthSession`                                      |
| —                        | `POST /api/v1/auth/refresh`                        | `auth.refreshSession({ refresh_token })`. No está en `AuthPort`: lo usa solo el interceptor                                                                                                                                                           |
| `signOut`                | `POST /api/v1/auth/logout`                         | `auth.admin.signOut(accessToken)` revoca los refresh tokens                                                                                                                                                                                           |
| `requestPasswordReset`   | `POST /api/v1/auth/password-reset`                 | `auth.resetPasswordForEmail(email)` con plantilla de correo que incluye `{{ .Token }}` (código de 6 dígitos). **Responde 204 exista o no la cuenta** (anti-enumeración) **[DECISIÓN: cambia el mensaje "No hay una cuenta con ese correo" del mock]** |
| `verifyOtp`              | `POST /api/v1/auth/password-reset/verify`          | `auth.verifyOtp({ email, token, type: 'recovery' })`. La sesión que devuelve Supabase **se descarta**; se crea un `password_reset_tickets` (token aleatorio de 32 bytes, se guarda el hash, 15 min, un uso) y se devuelve `{ email, token }`          |
| `resetPassword`          | `POST /api/v1/auth/password-reset/complete`        | Valida ticket (hash, vigencia, `used_at is null`) → `auth.admin.updateUserById(id, { password })` → marca usado → `signInWithPassword` → `AuthSession`                                                                                                |
| `changePassword`         | `POST /api/v1/auth/password/change`                | Ignora el `email` del puerto, usa el del JWT. Verifica la actual con `signInWithPassword`, luego `admin.updateUserById`                                                                                                                               |
| `InvitationPort.resolve` | `GET /api/v1/invitations/:token` (público)         | Hash del token → fila `pending` y vigente → `InvitationDetails` con JOIN. Otro estado → 410 `invalid_invitation`                                                                                                                                      |
| `InvitationPort.accept`  | `POST /api/v1/invitations/:token/accept` (público) | RPC `accept_invitation` (marca aceptada) + `admin.updateUserById(password)` + `signInWithPassword` + notificación al entrenador                                                                                                                       |

### 4.3 Alta de usuarios

- **Entrenador (manual, PRD §4):** script `supabase/scripts/create-trainer.sql` +
  procedimiento en el README. Se crea el usuario en el panel de Auth y luego se inserta
  `profiles` + `trainers` y se fija `app_metadata`.
- **Alumno (`StudentsPort.create`):**
  1. `auth.admin.createUser({ email, email_confirm: true, app_metadata: { role: 'student' } })` sin contraseña.
  2. RPC `create_student(...)` inserta `profiles` + `students` (verifica freemium y
     unicidad).
  3. `auth.admin.updateUserById(id, { app_metadata: { role, profile_id } })`.
  4. Si 2 o 3 fallan → `auth.admin.deleteUser(id)` (compensación: Auth y la BD no
     comparten transacción).

### 4.4 Claims y verificación del JWT

- El proyecto Supabase debe usar **claves de firma asimétricas** (JWT Signing Keys,
  RS256 o ES256). El PRD §7 exige RS256: elegir RS256 al crear la clave.
- Middleware `auth`:
  ```ts
  const jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `${env.SUPABASE_URL}/auth/v1`,
    audience: 'authenticated',
  });
  // actor = { userId: payload.sub, role: payload.app_metadata.role, profileId: payload.app_metadata.profile_id }
  ```
  `jwks` se crea a nivel de módulo (lo cachea `jose` entre invocaciones de la misma instancia).
- `role` y `profile_id` viajan en **`app_metadata`** (el usuario no puede editarlo;
  `user_metadata` sí, nunca usarlo para autorizar).
- Middleware `requireRole('trainer' | 'student')` por router.

### 4.5 Forma de `AuthSession`

```json
{
  "user": {
    "id": "…",
    "email": "…",
    "role": "trainer",
    "displayName": "…",
    "avatarUrl": null,
    "profileId": "…"
  },
  "token": "<access_token>",
  "expiresAt": "2026-11-02T15:00:00.000Z",
  "refreshToken": "<refresh_token>"
}
```

`refreshToken` es un campo extra que el adapter HTTP guarda **aparte** (no entra al
modelo de dominio). `expiresAt` es el vencimiento del access token (≈1 h), no 7 días:
la persistencia larga la da el refresh.

---

## 5. Mapa de endpoints (puerto → API)

Prefijo `/api/v1`. **T** = entrenador, **S** = alumno, **P** = público.
"Dueño" = el recurso pertenece al actor (directo o vía su cartera).

| Puerto.método         | Método y ruta                                          | Rol                                          | Notas                                                                                                                          |
| --------------------- | ------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Students**          |                                                        |                                              |                                                                                                                                |
| `getById`             | `GET /students/:id`                                    | T dueño · S sí mismo                         | Incluye `email` (JOIN auth) y `trainerName`                                                                                    |
| `listByTrainer`       | `GET /trainers/:trainerId/students`                    | T (`trainerId` = actor)                      |                                                                                                                                |
| `update`              | `PATCH /students/:id/self`                             | S sí mismo                                   | Solo `firstName, lastName, phone, avatarUrl`                                                                                   |
| `create`              | `POST /students`                                       | T                                            | `trainerId` del JWT. 409 `conflict` si el correo existe. 409 `plan_limit` (HU-12.4)                                            |
| `edit`                | `PATCH /students/:id`                                  | T dueño                                      | Sin `email` ni `trainerId`                                                                                                     |
| `setStatus`           | `PUT /students/:id/status`                             | T dueño                                      | Reactivar pasa por freemium                                                                                                    |
| **Invitation**        |                                                        |                                              |                                                                                                                                |
| `resolve` / `accept`  | ver §4.2                                               | P                                            | Rate limit por IP                                                                                                              |
| `getForStudent`       | `GET /students/:id/invitation`                         | T dueño                                      | `null` → 200 con `null`                                                                                                        |
| `create`              | `POST /students/:id/invitation`                        | T dueño                                      | Revoca la pendiente anterior en la misma RPC                                                                                   |
| `revoke`              | `DELETE /invitations/:token`                           | T dueño                                      |                                                                                                                                |
| **Anamnesis**         | `GET` · `PUT /students/:id/anamnesis`                  | T dueño                                      | `PUT` = upsert (única por alumno). El alumno **no** la lee                                                                     |
| **Assessments**       |                                                        |                                              |                                                                                                                                |
| `listByStudent`       | `GET /students/:id/assessments`                        | T dueño · S sí mismo                         | Orden `taken_at` asc                                                                                                           |
| `latestByStudent`     | `GET /students/:id/assessments/latest`                 | T dueño · S                                  | `null` permitido                                                                                                               |
| `create`              | `POST /students/:id/assessments`                       | T dueño                                      | `takenAt = now()` en BD                                                                                                        |
| **Trainers**          | `GET` · `PATCH /trainers/:id`                          | T sí mismo · S lee el suyo (campos públicos) |                                                                                                                                |
| **ExerciseCatalog**   |                                                        |                                              |                                                                                                                                |
| `list`                | `GET /exercises`                                       | T                                            | Solo `owner_trainer_id is null`                                                                                                |
| `listForTrainer`      | `GET /trainers/:trainerId/exercises`                   | T sí mismo                                   | Públicos + propios                                                                                                             |
| `getById`             | `GET /exercises/:id`                                   | T · S                                        | Visible si público, propio, o en una rutina asignada al alumno                                                                 |
| `create`              | `POST /exercises`                                      | T                                            | `ownerTrainerId` = actor, ignorando el body                                                                                    |
| **Routines**          |                                                        |                                              |                                                                                                                                |
| `getActiveForStudent` | `GET /students/:id/routine`                            | S sí mismo · T dueño                         | `null` si no tiene                                                                                                             |
| `listByTrainer`       | `GET /trainers/:trainerId/routines`                    | T sí mismo                                   | Con `days`, `exercises`, `assignments`                                                                                         |
| `getById`             | `GET /routines/:id`                                    | T dueño · S asignado                         |                                                                                                                                |
| `create`              | `POST /routines`                                       | T                                            | RPC `save_routine` (cabecera + días + ejercicios)                                                                              |
| `update`              | `PUT /routines/:id`                                    | T dueño                                      | RPC `save_routine`; regenera los `workout_exercise_logs` de sesiones **futuras sin series**                                    |
| `setAssignments`      | `PUT /routines/:id/assignments`                        | T dueño (y dueño de cada alumno)             | RPC `set_routine_assignments` (una transacción); luego materializa                                                             |
| `remove`              | `DELETE /routines/:id`                                 | T dueño                                      | `deleted_at`; cierra asignaciones; historial intacto                                                                           |
| **Workouts**          |                                                        |                                              |                                                                                                                                |
| `listByStudent`       | `GET /students/:id/workouts?from&to`                   | S sí mismo · T dueño                         | Antes de leer: `ensure_workout_sessions(student, from, to)` (§6)                                                               |
| `getById`             | `GET /workouts/:id`                                    | S dueño · T dueño                            |                                                                                                                                |
| `start`               | `POST /workouts/:id/start`                             | S dueño                                      | Idempotente                                                                                                                    |
| `markExercise`        | `PUT /workouts/:id/exercises/:routineExerciseId/done`  | S dueño                                      | Body `{ done }`                                                                                                                |
| `logSet`              | `POST /workouts/:id/exercises/:routineExerciseId/sets` | S dueño                                      | Body `WorkoutSetInput` + `clientOpId`. Upsert por `(log, setNumber)`; duplicado de `clientOpId` → devuelve la sesión sin error |
| `skipExercise`        | `POST /workouts/:id/exercises/:routineExerciseId/skip` | S dueño                                      | Si `reason = 'pain'` → notificación `alert` al entrenador                                                                      |
| `complete`            | `POST /workouts/:id/complete`                          | S dueño                                      | Aplica `withDerivedStatus` (modelo compartido)                                                                                 |
| **ProgressPhotos**    |                                                        |                                              |                                                                                                                                |
| `listByStudent`       | `GET /students/:id/photos`                             | S sí mismo · T dueño                         | `url` = URL firmada de 10 min                                                                                                  |
| `add` (paso 1)        | `POST /students/:id/photos/upload-url`                 | S sí mismo                                   | Devuelve `{ path, signedUploadUrl }`                                                                                           |
| `add` (paso 2)        | `POST /students/:id/photos`                            | S sí mismo                                   | Body `{ path, angle, takenAt, weightKg, note }`; valida que `path` empiece por `{studentId}/`                                  |
| `remove`              | `DELETE /photos/:id`                                   | S dueño                                      | Borra objeto + `deleted_at`                                                                                                    |
| **Schedule**          |                                                        |                                              |                                                                                                                                |
| `listByStudent`       | `GET /students/:id/schedule?from&to`                   | S sí mismo · T dueño                         |                                                                                                                                |
| `confirm`             | `POST /schedule/:id/confirm`                           | S dueño                                      |                                                                                                                                |
| `cancel`              | `POST /schedule/:id/cancel`                            | S dueño · T dueño                            | `note` obligatoria si `reason = other` (400). `cancelled_by` del JWT                                                           |
| _nuevo_ `create`      | `POST /students/:id/schedule`                          | T dueño                                      | **H-07**: hoy no existe                                                                                                        |
| **Notifications**     |                                                        |                                              |                                                                                                                                |
| `listByUser`          | `GET /me/notifications`                                | T · S                                        | Ignora el `userId` del puerto                                                                                                  |
| `markRead`            | `POST /notifications/:id/read`                         | dueño                                        |                                                                                                                                |
| `markAllRead`         | `POST /me/notifications/read-all`                      | T · S                                        |                                                                                                                                |
| **Nuevos**            |                                                        |                                              |                                                                                                                                |
| Dashboard (H-05)      | `GET /trainers/me/dashboard`                           | T                                            | Una consulta/vista: alumnos activos + sesiones + rutina activa + anamnesis usable + última evaluación                          |
| Avatar                | `POST /me/avatar/upload-url`                           | T · S                                        | Igual que fotos, bucket `avatars`                                                                                              |
| Push (HU-12.9)        | `POST /me/devices` · `DELETE /me/devices/:token`       | T · S                                        |                                                                                                                                |
| Salud                 | `GET /health`                                          | P                                            | Verifica conexión a BD; sin datos                                                                                              |

---

## 6. Materialización de sesiones de entrenamiento (H-06)

Hoy las `WorkoutSession` solo existen como semilla. En el BFF:

- **Cuándo:** perezosamente, en `GET /students/:id/workouts` y
  `GET /students/:id/routine`, para el rango `[max(startDate, hoy-7), min(endDate, hoy+14)]`.
- **Cómo:** RPC `ensure_workout_sessions(p_student_id, p_from, p_to)` inserta una
  sesión `scheduled` por cada `routine_day` cuyo `weekday` cae en el rango, con
  `ON CONFLICT (student_id, routine_day_id, scheduled_date) DO NOTHING`, y copia la
  prescripción a `workout_exercise_logs` (foto, decisión 6 del modelo).
- **Edición de la rutina:** solo se regeneran los logs de sesiones `scheduled` sin series
  registradas. Una sesión empezada es historia (PRD §7.1).
- **Días pasados no hechos:** se dejan `scheduled`; la adherencia del dominio
  (`adherence.ts`) ya los cuenta como no completados.

---

## 7. Errores

### 7.1 Forma de la respuesta

```json
{
  "error": {
    "code": "conflict",
    "message": "Ya existe un registro con esos datos.",
    "requestId": "req_…"
  }
}
```

`code` es siempre un `DomainErrorCode`. El adapter HTTP del front construye
`domainError(code, message)` sin traducir nada.

### 7.2 Mapeo

| Origen                                                   | HTTP | `code`                                                      |
| -------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| JWT ausente / inválido / vencido                         | 401  | `unauthorized`                                              |
| Rol incorrecto                                           | 403  | `forbidden` (nuevo)                                         |
| Recurso inexistente **o ajeno**                          | 404  | `not_found`                                                 |
| zod falla                                                | 400  | `validation` (nuevo), `message` con el primer error legible |
| Postgres `23505` (único)                                 | 409  | `conflict`                                                  |
| `RAISE ... USING ERRCODE = 'P0001', HINT = 'plan_limit'` | 409  | `plan_limit` (nuevo)                                        |
| Invitación no `pending` o vencida                        | 410  | `invalid_invitation`                                        |
| Login bloqueado / rate limit                             | 429  | `too_many_attempts`                                         |
| PostgREST `PGRST116` (0 filas en `.single()`)            | 404  | `not_found`                                                 |
| Postgres `42501` (RLS)                                   | 404  | `not_found` + log `warn` (indica bug de autorización)       |
| Cualquier otro                                           | 500  | `unknown` (sin detalle al cliente; detalle en log)          |

---

## 8. Validación

- Un esquema zod por endpoint en `server/http/schemas/`, con `.strict()` (rechaza
  campos desconocidos: evita que alguien mande `trainerId` o `status` donde no toca).
- Límites: textos ≤ 2 000, nombres ≤ 80, `notes` ≤ 1 000, arrays de días ≤ 7, ejercicios
  por día ≤ 30, `weightKg` 0–500, `reps` 0–200, `durationSeconds` 0–7 200.
- Fechas "solo día" como `YYYY-MM-DD` (`z.string().date()`); instantes como ISO-8601 UTC.
- Reutilizar `passwordRules()` del front **copiándolas** como esquema zod (están en
  `ui/shared/validators`, no en dominio): o moverlas a `domain/auth/model` — esto
  último es preferible **[DECISIÓN]**.

---

## 9. Seguridad del BFF

| Control                      | Directriz                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORS                         | Web: mismo origen, sin CORS. Nativo: permitir solo `capacitor://localhost` (iOS) y `https://localhost` (Android, `androidScheme: 'https'`). Previews: `*.vercel.app` del propio equipo, nunca `*` |
| Rate limit                   | `login`, `password-reset*`, `invitations/*` por IP + email en tabla (`login_attempts`). Sin memoria del proceso                                                                                   |
| Cabeceras                    | `Cache-Control: no-store` en toda respuesta con datos personales                                                                                                                                  |
| Logs                         | JSON estructurado `{ level, requestId, route, status, ms, userId }`. **Nunca** correo, contraseña, token, anamnesis ni medidas                                                                    |
| Clave secreta de Supabase    | Solo en `infrastructure/auth` (admin de usuarios) y `infrastructure/storage` (firmar URLs). El resto usa el cliente con el JWT del usuario para que RLS aplique                                   |
| Tokens de invitación y reset | `crypto.randomBytes(32).toString('base64url')`; en BD solo `sha256`                                                                                                                               |
| Body                         | Rechazar > 1 MB (las fotos no pasan por el BFF)                                                                                                                                                   |

---

## 10. Cambios en el front (Épica 10 redefinida)

| Archivo nuevo                             | Responsabilidad                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infrastructure/http/api-client.ts`       | `HttpClient` con `apiBaseUrl`, timeout 15 s                                                                                                                |
| `infrastructure/http/auth.interceptor.ts` | Añade `Authorization: Bearer`. En 401: un único refresh concurrente (_single-flight_), reintenta una vez; si falla, limpia sesión y emite `sessionExpired` |
| `infrastructure/http/error-mapper.ts`     | `HttpErrorResponse` → `DomainError` (status 0 → `network`)                                                                                                 |
| `infrastructure/http/*.http-adapter.ts`   | Un adapter por puerto, misma clase de tests que el mock                                                                                                    |
| `infrastructure/http/storage-upload.ts`   | Data URL → `Blob` → `PUT` a la URL firmada (fotos y avatar)                                                                                                |
| `infrastructure/*-http-providers.ts`      | `provideHttpAdapters()`, `provideStudentHttpAdapters()`, `provideTrainerHttpAdapters()`                                                                    |
| `app.config.ts`                           | `provideHttpClient(withFetch(), withInterceptors([...]))`; elige mock o HTTP según `environment.dataSource`                                                |

Excepción adicional a la regla "solo infraestructura": `SessionFacade` necesita
enterarse de `sessionExpired` para limpiar su signal y redirigir. Proponer un puerto
`AUTH_EVENTS_PORT` en `domain/auth/port` (Observable de eventos) que el interceptor emite
y la facade escucha.

Los mocks **no se borran**: siguen sirviendo a los tests unitarios y a un build `demo`.
El build de producción **no** debe incluir `accounts.seed.ts` (H-03).

---

## 11. Pruebas del BFF

| Nivel            | Herramienta                                                             | Qué cubre                                                                                   | Umbral                            |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------- |
| Unit             | Jest (config aparte `jest.server.config.js`, `testEnvironment: node`)   | Casos de uso con repositorios en memoria                                                    | 95 % líneas / 85 % ramas (PRD §7) |
| Integración HTTP | Jest + `app.request()` de Hono contra `supabase start` local            | Cada endpoint: feliz, 400, 401, 404 ajeno, 409                                              | Todos los endpoints de §5         |
| RLS              | pgTAP (`supabase test db`)                                              | CA7: entrenador A no lee ni escribe nada de B; alumno no lee `trainer_notes` ni `anamnesis` | Una prueba por tabla              |
| Contrato         | Fixture JSON por endpoint validado con los tipos de `@domain/*` (`tsc`) | Que la forma no derive                                                                      | —                                 |
| E2E              | Playwright contra el Preview de Vercel                                  | F1–F6 del PRD                                                                               | Smoke en cada PR                  |

CI: agregar job `server` (lint + `tsc -p tsconfig.server.json` + unit) y job
`integration` (levanta Supabase local con la CLI, aplica migraciones, corre integración
y pgTAP). `ci-gate` depende de ambos.

---

## 12. Definición de terminado de un endpoint

- [ ] Esquema zod `.strict()` y límites.
- [ ] Autorización: rol + propiedad, 404 si ajeno.
- [ ] Caso de uso con unit test (feliz + cada error).
- [ ] Test de integración contra Supabase local.
- [ ] Política RLS de las tablas que toca, con test pgTAP.
- [ ] Adapter HTTP del front con spec (mismos casos que el mock).
- [ ] Sin PII en logs.
- [ ] Documentado en la tabla §5 si cambió algo.
