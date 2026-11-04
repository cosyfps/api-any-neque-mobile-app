# Interrogación de producto — 3 de noviembre de 2026

Repaso de los pendientes del día y respuestas del dueño del producto sobre lo
que le falta a la app. Sirve de entrada para el backlog.

## Decisiones

- **Modelo de negocio:** gratis por ahora; sin pagos ni límites de plan. Se
  decide después de la presentación.
- **Prioridad antes de la presentación:** estabilizar y desplegar.

## 1. Estabilizar y desplegar (prioridad)

| #   | Punto                                                               | Origen          |
| --- | ------------------------------------------------------------------- | --------------- |
| E-1 | Commitear y hacer push de los cambios del día a `develop`           | Sesión          |
| E-2 | Generar una IPA nueva (GitHub → Actions → iOS IPA)                  | Sesión          |
| E-3 | ✅ Verificar `X-Robots-Tag` en producción con `curl -I`             | QA, privacidad  |
| E-4 | Probar `NEQUE_WEB_ACCESS=mobile` desde un teléfono real             | QA, privacidad  |
| E-5 | ✅ QA-32: tests deterministas (QR y `FileReader` sin tiempos fijos) | QA_AUDIT_REPORT |
| E-6 | ✅ QA-31: silenciar o reemplazar `qrcode` (no es ESM)               | QA_AUDIT_REPORT |
| E-7 | ✅ QA-30: los títulos de `nq-page-state` como encabezados           | QA_AUDIT_REPORT |
| E-8 | Recorrido de humo en producción con los dos roles                   | Sesión          |

## 2. Decisiones pendientes (AMB)

AMB-1 (reglas de contraseña en el login), AMB-2 (rango de estatura), AMB-5
(apellido obligatorio), AMB-6 (objetivo y días de la rutina), AMB-7
(parentesco), AMB-8 (perfil QA), AMB-9 (instalación sin tienda) y si el BFF
bloquea entrenar semanas futuras. Detalle en `QA_AUDIT_REPORT.md`.

## 3. Funcionalidad nueva — entrenador

| #   | Punto                | Qué resuelve                                                   |
| --- | -------------------- | -------------------------------------------------------------- |
| T-1 | Agenda global        | Calendario con las citas y entrenamientos de todos sus alumnos |
| T-2 | Reagendar y cancelar | Mover o cancelar una cita desde la ficha, con aviso al alumno  |
| T-3 | Ver sesiones hechas  | Series, pesos y repeticiones registradas en cada entrenamiento |
| T-4 | Duplicar rutinas     | Copiar una rutina como base de otra                            |

## 4. Funcionalidad nueva — alumno

| #   | Punto               | Qué resuelve                                                        |
| --- | ------------------- | ------------------------------------------------------------------- |
| A-1 | Notificaciones push | Recordatorios en el teléfono antes de entrenar o de una cita (APNs) |
| A-2 | Historial de cargas | Evolución del peso levantado por ejercicio                          |
| A-3 | Reprogramar entreno | Mover el entrenamiento de un día a otro de la misma semana          |
| A-4 | Mensajes            | Conversación con el entrenador dentro de la app                     |

## Orden sugerido después de la presentación

1. T-2 y T-1: completan la agenda que ya existe.
2. T-3 y A-2: usan datos que ya se registran (series y cargas).
3. A-3 y T-4: cambios acotados sobre rutinas.
4. A-1 y A-4: requieren infraestructura nueva (push con APNs y mensajería
   en tiempo real).
