# Plan — Épica 12: cierre de brechas contra el PRD v2.0

## Contexto

El PRD v2.0 (`docs/PRD.md`) declara 32 funcionalidades hechas y 6 pendientes. La
validación del 2026-09-24 contra la rama `feat/NEQUE-9-app-entrenador` confirma los
gates en verde —lint, typecheck, format, 1174 tests, 98,09 % / 88,85 % de cobertura,
259,32 kB de bundle— pero encuentra **cuatro funcionalidades marcadas ✅ que el código no
cumple** y cinco diferencias entre lo que el PRD exige y lo que la configuración aplica.

Esta épica cierra todo lo que corresponde al repo móvil. Lo que depende del BFF queda
diseñado aquí y se termina de cerrar en la Épica 10.

### Alcance

| Entra                                                       | No entra                                  |
| ----------------------------------------------------------- | ----------------------------------------- |
| Las 4 brechas de funcionalidades marcadas ✅                | El BFF (Épica 10, repo aparte)            |
| Los 5 `Must Have` pendientes del lado móvil                 | Reporte PDF (`Nice to Have`, §14)         |
| La configuración alineada con los umbrales de §7            | Alta de entrenadores (manual en Supabase) |
| Las plataformas nativas, necesarias para cámara, push y CA8 | Publicación en tiendas (Épica 6)          |

---

## Hallazgos que condicionan el plan (verificados en el código)

| Hallazgo                                                                                              | Consecuencia                                                                                  |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `TrainerStudentDetailFacade` no inyecta `WORKOUTS_PORT`                                               | El entrenador no ve la carga real que registra el alumno. **CA4 falla aunque exista el BFF.** |
| `SCHEDULE_PORT` está registrado en `trainer-providers.ts` pero ninguna pantalla del entrenador lo usa | M5 dice «Cancelación… Ambos»: el entrenador no puede cancelar.                                |
| `ScheduleFacade` toma el alumno de `SessionFacade.profileId()`                                        | No sirve al entrenador tal cual: el alumno lo decide la ruta, no la sesión.                   |
| `Trainer` no tiene plan y ninguna facade cuenta alumnos activos                                       | El freemium de §1.2 (3 alumnos activos) no existe, y tampoco aparece en la tabla de §6.       |
| `PageStateType` incluye `'offline'`, pero ninguna pantalla lo usa y nada detecta la red               | §7.1 no tiene ninguna base.                                                                   |
| `RoutineStatus = 'active' \| 'archived'` y `Routine.studentId: Id` no admite nulo                     | Una plantilla no cabe en `Routine` sin propagar `null` a todas las facades.                   |
| `modelo-datos.md` no tiene notas, plantillas, plan del entrenador ni tokens de dispositivo            | Cada módulo nuevo agrega su tabla al contrato **antes** de tocar código.                      |
| `notification-target.ts` solo mapea a rutas del alumno                                                | Un push para el entrenador necesita su propio mapeo. **Resuelto en la 0.0.4** (T-13.5.7).     |
| Las fotos entran por `<input type="file">` como data URL                                              | La cámara puede devolver el mismo formato, así que `ProgressFacade.addPhoto` no cambia.       |
| No existen `android/` ni `ios/`                                                                       | Cámara y push no se pueden verificar en dispositivo, que la DoD de §11.1 exige.               |
| `coverageThreshold` en 80 %, budget en 500 kB, `flowApiUrl` en `environments/`                        | La configuración contradice §7 y §14.                                                         |
| La sección «Fuera de alcance» del BACKLOG lista share, cámara y push                                  | Desactualizada: share está en uso y cámara y push ahora son `Must Have`.                      |

---

## Decisiones propuestas

> Pendientes de confirmar. Cada una trae el valor por defecto que se usará si no se
> dice otra cosa.

| #   | Decisión                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **El límite freemium cuenta alumnos `active`.** Suspender libera un cupo. Reactivar pasa por el mismo control que el alta.                                                                                                                                    |
| 2   | **El límite se valida en el adapter (hoy el mock, mañana el BFF) y la UI solo lo anticipa.** Un control solo en el cliente se salta con una petición directa.                                                                                                 |
| 3   | **Las notas privadas forman una lista fechada**, no un campo único: cada nota tiene fecha y se puede editar o borrar. Borrar pide confirmación (§8.1).                                                                                                        |
| 4   | **Superada por T-13.3.1 (0.0.3): la `Routine` ya es plantilla con asignaciones.** ~~Las plantillas son un modelo propio (`RoutineTemplate`), sin alumno ni estado. `Routine` no cambia. Crear desde una plantilla produce una `Routine` normal sin asignar.~~ |
| 5   | **Cámara con `Camera.getPhoto({ source: Prompt })`**: el sistema ofrece cámara o galería. En web se mantiene el `<input type="file">` actual.                                                                                                                 |
| 6   | **Push por FCM en Android y APNs en iOS.** El móvil registra el token y navega al tocar. El envío es responsabilidad del BFF.                                                                                                                                 |
| 7   | **La red se detecta con `@capacitor/network`** (plugin nuevo, ~2 kB, carga diferida). En web, el plugin usa `navigator.onLine`.                                                                                                                               |
| 8   | **El modo sin conexión es un decorador en `infrastructure/`** alrededor del adapter de workouts. Dominio, aplicación y UI no se enteran, que es la apuesta de §5.3.                                                                                           |
| 9   | **La cola se guarda con `@capacitor/preferences`**: una sesión en curso pesa unos pocos kB y no justifica IndexedDB.                                                                                                                                          |
| 10  | **Cada operación en cola lleva un `clientOpId` (UUID)** para que el BFF descarte reintentos duplicados. Es un cambio de contrato: va a `modelo-datos.md`.                                                                                                     |

---

## Orden de ejecución

El PRD fija el BFF como camino crítico (R1). Por eso esta épica se parte en dos: lo
barato y lo que corrige al PRD va **antes** del BFF; los módulos nuevos van
**en paralelo o después**, como indica la fase 2 del roadmap.

```
Bloque A — antes del BFF (~1 semana)
  HU-12.0 documentación ──► HU-12.1 configuración
                                  ↓
            ┌─────────────────────┼─────────────────────┐
     HU-12.2 progresión     HU-12.3 cancelación    HU-12.4 freemium      (paralelizables)

Bloque B — fase 2 del roadmap, en paralelo con la Épica 10
  HU-12.5 notas privadas     HU-12.6 plantillas                          (paralelizables)
  HU-12.7 plataformas nativas ──► HU-12.8 cámara ──► HU-12.9 push

Bloque C — fase 3 del roadmap, requiere el BFF
  HU-12.10 ejecución sin conexión
```

HU-12.10 se diseña y se prueba contra el mock desde el bloque B, pero **no cierra** hasta
que las series lleguen a un servidor real (CA5).

---

## Historias

### HU-12.0 — Documentación (directo en la rama, sin código)

| Ticket   | Cambio                                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-12.0.1 | PRD §6: M2 «Cancelación» pasa a «Student ✅ / Trainer ⬜»; M4 agrega «Progresión de carga en la ficha» ⬜; M1 agrega «Límite freemium» ⬜.                  |
| T-12.0.2 | PRD §6.1: recalcular el resumen (32 hechas → 31; pendientes 6 → 9).                                                                                         |
| T-12.0.3 | `modelo-datos.md`: tablas `trainerNotes`, `routineTemplates` (+ días y ejercicios), `deviceTokens`; columna `trainers.plan`; `clientOpId` en `workoutSets`. |
| T-12.0.4 | BACKLOG: registrar la Épica 12 y corregir «Fuera de alcance» (share en uso; cámara y push pasan a `Must Have`).                                             |

### HU-12.1 — Configuración alineada con §7

| Ticket   | Cambio                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------ |
| T-12.1.1 | `package.json` → `coverageThreshold`: 95 en lines, statements y functions; 85 en branches.       |
| T-12.1.2 | `angular.json` → budget `initial`: aviso a 300 kB, error a 400 kB.                               |
| T-12.1.3 | Quitar `flowApiUrl` de `environment.ts` y `environment.prod.ts` (pagos fuera de alcance, §14).   |
| T-12.1.4 | `allowedCommonJsDependencies: ["qrcode", "dijkstrajs"]` para silenciar los dos avisos del build. |

**Criterio:** `npm run test:coverage` y `npm run build` pasan sin avisos con los umbrales nuevos.

### HU-12.2 — Progresión de carga en la ficha del alumno (CA4)

| Ticket   | Capa        | Cambio                                                                                                                                                                                                                                  |
| -------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-12.2.1 | domain      | `workouts/model/load-progression.ts`: funciones puras `exercisesWithHistory(sessions)` y `loadProgression(sessions, exerciseId)` → puntos `{ date, topWeightKg, totalReps }` por sesión completada. Solo series con `weightKg` no nulo. |
| T-12.2.2 | application | `TrainerStudentDetailFacade` inyecta `WORKOUTS_PORT` y carga las sesiones del alumno en su `AsyncState` junto con el resto de la ficha.                                                                                                 |
| T-12.2.3 | ui          | Sección «Progresión» en la ficha: selector de ejercicio, `<nq-line-chart>` de carga máxima y las últimas 5 sesiones con series reales frente a las prescritas.                                                                          |
| T-12.2.4 | ui          | Vacío explicado (§8.1): «Aún no hay sesiones con carga registrada». Con un solo punto se muestra el valor, no un gráfico.                                                                                                               |

**Criterio:** el alumno completa una sesión registrando 62,5 kg en vez de 60 kg; la ficha del entrenador muestra 62,5 kg en ese ejercicio.

### HU-12.3 — Cancelación de citas por el entrenador

| Ticket   | Capa        | Cambio                                                                                                                                                                                                                       |
| -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-12.3.1 | ui/shared   | Extraer la hoja de cancelación de `student-schedule.page.ts` a `nq-cancel-session-sheet` (motivo predefinido + nota; nota obligatoria si el motivo es `other`). Es el segundo uso, así que la abstracción se justifica (R6). |
| T-12.3.2 | application | `TrainerStudentDetailFacade` inyecta `SCHEDULE_PORT`: `upcomingSessions` (próximos 14 días, con `CLOCK`) y `cancelSession(id, reason, note)`.                                                                                |
| T-12.3.3 | ui          | Sección «Próximas citas» en la ficha con la acción Cancelar, que abre la hoja compartida (`nqSheetTrap`, `aria-live` al confirmar).                                                                                          |
| T-12.3.4 | ui          | El alumno sigue usando la misma hoja desde su agenda. Sus specs no deben cambiar de comportamiento.                                                                                                                          |

**Criterio:** el entrenador cancela una cita desde la ficha y el alumno la ve cancelada en su agenda (mismo injector, mismo mock).

### HU-12.4 — Límite freemium de 3 alumnos activos

| Ticket   | Capa           | Cambio                                                                                                                                                               |
| -------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-12.4.1 | domain         | `Trainer.plan: 'free' \| 'pro'`; `trainers/model/plan.ts` con `FREE_PLAN_ACTIVE_LIMIT = 3` y `canActivateStudent(plan, activeCount)`. Nuevo `AppError` `plan_limit`. |
| T-12.4.2 | infrastructure | `StudentsMockAdapter.create` y `setStatus('active')` fallan con `plan_limit` al superar el cupo. Semilla: un entrenador `free` y uno `pro`.                          |
| T-12.4.3 | application    | `TrainerStudentsFacade` expone `activeCount`, `limit` y `atLimit` (computed).                                                                                        |
| T-12.4.4 | ui             | Cartera: contador «2 de 3 alumnos activos». Al llegar al límite, Alta queda deshabilitada con explicación visible (no solo `disabled`). Ficha: Reactivar igual.      |
| T-12.4.5 | ui             | Perfil del entrenador: plan actual y cómo pasar a pago («contacta a …»): la app comunica, no cobra (§1.2).                                                           |

**Criterio:** un entrenador `free` con 3 activos no puede dar de alta ni reactivar; suspende uno y ya puede. Un entrenador `pro` no ve el límite.

### HU-12.5 — Notas privadas del entrenador

| Ticket   | Capa           | Cambio                                                                                                                                                  |
| -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-12.5.1 | domain         | `students/model/trainer-note.model.ts` y `TRAINER_NOTES_PORT`: `listByStudent`, `create`, `update`, `remove`.                                           |
| T-12.5.2 | infrastructure | Mock adapter con semilla, registrado **solo** en `trainer-providers.ts`. Un spec verifica que `student-providers.ts` no lo provee.                      |
| T-12.5.3 | application    | Métodos en `TrainerStudentDetailFacade` (sin facade nueva: la nota solo vive en la ficha).                                                              |
| T-12.5.4 | ui             | Sección «Notas privadas» en la ficha: lista más reciente primero, alta en línea, edición, borrado con confirmación. Rótulo explícito «Solo tú las ves». |

**Criterio:** la nota persiste mientras dura la sesión y ninguna ruta del alumno la puede alcanzar.

### HU-12.6 — Plantillas de rutinas reutilizables

| Ticket   | Capa           | Cambio                                                                                                                                                                                    |
| -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-12.6.1 | domain         | `RoutineTemplate` (nombre, objetivo, días con ejercicios; sin alumno ni estado). En `ROUTINES_PORT`: `listTemplates(trainerId)`, `saveAsTemplate(routineId, name)`, `removeTemplate(id)`. |
| T-12.6.2 | domain         | Función pura `routineInputFromTemplate(template, studentId)`: crear desde plantilla reutiliza `create`, sin método nuevo en el puerto.                                                    |
| T-12.6.3 | infrastructure | Mock y semilla con 2 plantillas (full body 3 días, torso/pierna 4 días).                                                                                                                  |
| T-12.6.4 | application    | `TrainerRoutinesFacade`: estado de plantillas y `createFromTemplate(templateId, studentId)`, que abre el constructor precargado.                                                          |
| T-12.6.5 | ui             | Biblioteca: filtro «Plantillas». «Guardar como plantilla» desde una rutina. «Nueva rutina» ofrece empezar en blanco o desde una plantilla.                                                |

**Criterio:** una plantilla de 5 ejercicios se asigna a un alumno en menos de 1 minuto (mejora CA3). Editar la rutina resultante no modifica la plantilla.

### HU-12.7 — Plataformas nativas

| Ticket   | Cambio                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| T-12.7.1 | `npx cap add android`. Ícono y splash con `@capacitor/assets`.                                                                            |
| T-12.7.2 | `AndroidManifest.xml`: `CAMERA`, `POST_NOTIFICATIONS`, `ACCESS_NETWORK_STATE`.                                                            |
| T-12.7.3 | `npx cap add ios` **si hay Mac disponible** (R3). `Info.plist`: `NSCameraUsageDescription` y `NSPhotoLibraryUsageDescription` en español. |
| T-12.7.4 | Script `cap:run:android` y guía en `CONTRIBUTING.md` para probar en dispositivo físico.                                                   |

**Criterio:** la app arranca en un Android físico de gama media y se mide el arranque en frío (§7, objetivo <3 s).

### HU-12.8 — Foto de progreso con la cámara

| Ticket   | Capa | Cambio                                                                                                                                                                                                     |
| -------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-12.8.1 | ui   | En `student-progress.page.ts`, en nativo: `import('@capacitor/camera')` diferido, `getPhoto({ resultType: DataUrl, source: Prompt, width: 1080, quality: 80 })` → `addPhoto`. En web se mantiene el input. |
| T-12.8.2 | ui   | Permiso denegado o captura cancelada: mensaje con `role="alert"` y camino a Ajustes; cancelar no es un error.                                                                                              |
| T-12.8.3 | test | Specs con el plugin simulado: éxito, cancelación, permiso denegado y la rama web.                                                                                                                          |

**Criterio:** en Android físico se toma la foto, aparece en la galería de progreso y el comparador antes/después la usa.

### HU-12.9 — Notificaciones push

| Ticket   | Capa           | Cambio                                                                                                                                                                        |
| -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-12.9.1 | domain         | `notifications/port/push-registration.port.ts`: `register(token, platform)` y `unregister(token)`.                                                                            |
| T-12.9.2 | infrastructure | Mock que guarda en memoria. Proyecto Firebase y `google-services.json` fuera del repo: el archivo se inyecta en CI (§3.2, cero secretos).                                     |
| T-12.9.3 | application    | `PushFacade`: al iniciar sesión en nativo pide permiso, registra el token y lo da de baja al cerrar sesión. Solo depende de `SessionFacade`.                                  |
| T-12.9.4 | ui/shared      | **Hecho en la 0.0.4 (T-13.5.7).** `notification-target.ts` recibe el rol: el entrenador va a `/trainer/students/:id`. `pushNotificationActionPerformed` navega con ese mapeo. |
| T-12.9.5 | docs           | Catálogo de eventos para el BFF: alumno (cita confirmada o cancelada, rutina nueva, evaluación); entrenador (sesión completada, cita cancelada por el alumno).                |

**Criterio (móvil):** permiso pedido una sola vez, token registrado, y un push de prueba enviado desde la consola de Firebase abre la pantalla correcta. **Cierre completo:** con el envío desde el BFF (Épica 10).

### HU-12.10 — Ejecución sin conexión (§7.1, CA5)

| Ticket    | Capa           | Cambio                                                                                                                                                                                                                  |
| --------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-12.10.1 | domain         | `shared/port/connectivity.port.ts`: `online: Observable<boolean>`. Nuevo `AppError` `offline`.                                                                                                                          |
| T-12.10.2 | infrastructure | Adapter con `@capacitor/network`.                                                                                                                                                                                       |
| T-12.10.3 | infrastructure | `OfflineWorkoutsAdapter`, decorador de `WORKOUTS_PORT`: las lecturas guardan copia en caché y la sirven sin red; `start`, `logSet`, `markExercise` y `complete` se aplican sobre la copia y entran a una cola en orden. |
| T-12.10.4 | infrastructure | Igual para `ROUTINES_PORT.getActiveForStudent` (solo lectura).                                                                                                                                                          |
| T-12.10.5 | infrastructure | `OutboxSync`: al volver la red vacía la cola en orden con `clientOpId`; ante un fallo reintenta con backoff; nunca reordena ni recalcula (política de §7.1).                                                            |
| T-12.10.6 | ui             | Banner global «Sin conexión». Las demás pantallas muestran `nq-page-state` `offline` y deshabilitan mutaciones. El runner muestra «N series por sincronizar».                                                           |
| T-12.10.7 | test           | Specs del decorador y de la cola: cortar a mitad de sesión, reiniciar la app con cola pendiente, reconectar, duplicado rechazado.                                                                                       |

**Criterio (móvil):** en modo avión el alumno abre su rutina, completa la sesión y, al reconectar, la cola se vacía sin duplicados. **Cierre completo (CA5):** las series aparecen en Supabase.

---

## Estimación y commits

| HU    | Tamaño | Commits sugeridos (≤ ~200 líneas cada uno)             |
| ----- | ------ | ------------------------------------------------------ |
| 12.0  | S      | `docs:` ×2                                             |
| 12.1  | XS     | `chore(config):` ×1                                    |
| 12.2  | M      | `feat(workouts):` dominio · `feat(trainer):` facade+UI |
| 12.3  | M      | `refactor(shared):` hoja · `feat(trainer):` citas      |
| 12.4  | M      | `feat(trainers):` dominio+mock · `feat(trainer):` UI   |
| 12.5  | M      | dominio+infra · facade+UI                              |
| 12.6  | L      | dominio · infra · facade · UI                          |
| 12.7  | S      | `chore(native):` android · ios                         |
| 12.8  | S      | `feat(progress):` ×1                                   |
| 12.9  | M      | dominio+infra · facade · navegación                    |
| 12.10 | L      | puerto+adapter · decorador · cola · UI                 |

## Definición de terminado (§11.1)

Cada HU cierra con `lint`, `typecheck`, `format:check`, `test:coverage` (con los umbrales
nuevos de HU-12.1) y `build` en verde; verificada en navegador a 375×812 y 320×568, y en
dispositivo físico si toca cámara, push o red. Al cerrar la épica, §6 y §6.1 del PRD se
re-verifican contra el código (R4).
