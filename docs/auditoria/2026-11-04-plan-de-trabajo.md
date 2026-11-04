# Plan de trabajo — 4 de noviembre de 2026

Lo que quedó pendiente al cierre del 3 de noviembre, en el orden en que
conviene resolverlo. La prioridad acordada antes de la presentación es
**estabilizar y desplegar**; la funcionalidad nueva va después.

Contexto: [Interrogación de producto](2026-11-03-interrogacion-producto.md) ·
[QA_AUDIT_REPORT](../../QA_AUDIT_REPORT.md) ·
[Cambios de la auditoría](2026-11-03-cambios-auditoria.md)

## Estado al cierre del día 3

Hecho y validado (lint, formato, typecheck, 1572 tests, build sin avisos),
**sin commitear**:

- Editar y eliminar ejercicios propios (modal de opciones en lista).
- Inicio del alumno: solo la rutina vigente, barras por porcentaje.
- Horas en 24 h; los campos se deslizan en horizontal (`touch-action`).
- Mi agenda muestra los días de entrenamiento de la rutina.
- El entrenador agenda citas desde la ficha del alumno.
- QA-30, QA-31 y QA-32 corregidos.
- Pulido de diseño: buscador, lista de alumnos, ficha en tarjetas, gráfico
  de progreso con un solo punto.
- BFF: al guardar una rutina se borran las sesiones sin empezar de días
  reemplazados.
- Hora de inicio por día de rutina (migración `20261104000000` ya aplicada).

Datos corregidos en producción: sesiones duplicadas de Conan borradas
(progreso 1/4). Sus días quedaron en martes, miércoles, viernes y sábado a
propósito.

## Bloque 1 — Desplegar (mañana temprano)

- [x] **Commits.** Hechos en dos commits (`e9affbe`, `5677e4d`). Separar en commits de ≤ 200 líneas cuando se pueda
      (`CLAUDE.md`). Sugerencia de cortes:
  1. `feat(exercises)`: BFF + facade + modal de ejercicios.
  2. `feat(schedule)`: citas del entrenador + agenda con la rutina.
  3. `feat(routines)`: hora de inicio por día + migración.
  4. `fix(student)`: rutina vigente, barras, horas 24 h, `touch-action`.
  5. `fix`: limpieza de sesiones al guardar rutina.
  6. `style`: pulido de diseño.
  7. `test`/`chore`: QA-30 a QA-32 y documentación.
- [x] **Push** a `develop` y confirmar el despliegue en Vercel (rutas nuevas responden en producción).
- [ ] **IPA nueva**: GitHub → Actions → iOS IPA (`workflow_dispatch`).
- [ ] **Recorrido de humo en producción** con los dos roles (E-8):
  - Entrenador: Inicio, alumnos, ficha, agendar una cita, editar un
    ejercicio, poner hora a un día de rutina.
  - Alumno: Inicio, Mi rutina, completar un ejercicio, Agenda, Progreso.
- [ ] **Acceso web** (E-4): `NEQUE_WEB_ACCESS=mobile`, redeploy y probar
      desde un teléfono real.

## Bloque 2 — Verificar lo nuevo con datos reales

- [ ] Poner la hora a los días de Benjamin y Conan y revisar que "Hoy" y
      "Hoy te toca" la muestren.
- [ ] Agendar una cita de prueba y confirmar que el alumno recibe el aviso,
      la ve en Mi agenda y puede confirmarla.
- [ ] Confirmar que guardar una rutina ya no deja sesiones duplicadas
      (progreso semanal correcto).
- [ ] Revisar en el iPhone, con la IPA nueva: modal de ejercicios,
      deslizamiento en campos largos, horas de "Hoy".

## Bloque 3 — Pendientes chicos detectados

- [x] **Hora en Mi agenda**: la tarjeta de entrenamiento del día no muestra
      la hora de inicio cuando la rutina la tiene.
- [x] **Días sin hora**: siguen mostrándose a las 09:00 (08:00 en
      invierno). Resuelto: el alumno ve solo el día y el entrenador ve
      "Sin hora" en "Hoy".
- [x] **"Última el 3 de noviembre: 108 kg, 177 cm."** en la ficha: redactar
      mejor el resumen de la última evaluación. Ahora: "Última evaluación ·
      fecha" y debajo "108 kg · 177 cm".

## Bloque 4 — Decisiones de negocio (AMB)

Responder para alinear front y BFF (detalle en `QA_AUDIT_REPORT.md`):

- [ ] AMB-1 reglas de contraseña en el login.
- [ ] AMB-2 rango de estatura (UI 100–250 vs BFF 50–260).
- [ ] AMB-5 apellido obligatorio.
- [ ] AMB-6 objetivo y días de la rutina obligatorios.
- [ ] AMB-7 parentesco del contacto de urgencia.
- [ ] AMB-8 perfil QA.
- [ ] AMB-9 instalación sin tienda.
- [ ] ¿El BFF bloquea entrenar sesiones de semanas futuras?

## Bloque 5 — Funcionalidad nueva (después de la presentación)

En el orden sugerido por la interrogación de producto:

1. [x] **T-2 Reagendar y cancelar** citas desde la ficha, con aviso. Tocar una
       cita abre Reagendar / Cancelar; reagendar la deja por confirmar y
       cancelar pide motivo (nota obligatoria con «Otro motivo»). Ruta nueva
       `PUT /schedule/:id`.
2. [x] **T-1 Agenda global** del entrenador: `/trainer/agenda`, desde el botón
       Agenda de "Hoy". Calendario con citas y entrenamientos de toda la
       cartera activa; cada item abre la ficha. Ruta nueva
       `GET /trainers/:id/schedule`.
3. [x] **T-3 Ver sesiones hechas**: sección "Entrenamientos realizados" en la
       ficha (5 más recientes y "Ver todos"); el detalle muestra cada serie
       ("8 × 60 kg", "45 s", "Saltada · motivo").
4. [x] **A-2 Historial de cargas**: pestaña "Cargas" en Mi progreso. Por
       ejercicio: última carga, máxima, diferencia desde el inicio, gráfico y
       últimas sesiones.
5. [x] **A-3 Reprogramar**: en Mi rutina, "Cambiar de día" mueve un
       entrenamiento sin empezar a otro día de su semana (desde hoy). Ruta
       nueva `PUT /workouts/:id/date`. Solo cambia `scheduled_for`: el día
       original queda en `scheduled_date` y no se regenera.
6. [x] **T-4 Duplicar rutinas**: botón Duplicar en cada tarjeta; la copia nace
       sin alumnos como «Nombre (copia)» y se abre para editar.
7. [ ] **A-1 Notificaciones push** — **bloqueado**. La IPA se compila sin
       firma (`CODE_SIGNING_ALLOWED=NO`) y Apple solo entrega push a apps
       firmadas por un equipo con el permiso `aps-environment` y una llave
       APNs. Ya existen la tabla `device_tokens` y el plugin
       `@capacitor/push-notifications`. Requiere resolver primero AMB-9
       (distribución) y una cuenta Apple Developer de pago.
8. [x] **A-4 Mensajes** entrenador–alumno: "Mensajes con tu entrenador" en el
       Perfil del alumno y botón Mensajes en la ficha. Burbujas, separador por
       día, "Leído", Enter envía y refresco cada 20 s. Aviso al otro lado que
       abre la conversación. **Requiere ejecutar la migración
       `20261104000100_messages.sql`** (tabla `messages` y destino
       `message` en las notificaciones).

## Criterio de cierre de cada punto

- `npm run lint`, `format:check`, `typecheck`, `test:coverage` (≥ 80 %) y
  `build:prod` en verde.
- Pantalla nueva o modificada revisada a 375×812 y 320×568, en claro y
  oscuro, y recorrida con `Tab`.
- Commit con Conventional Commits; nunca push directo a `main`.
