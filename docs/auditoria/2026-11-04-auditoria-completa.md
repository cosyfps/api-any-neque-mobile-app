# Auditoría completa — 4 de noviembre de 2026

Qué falta en Ñeque frente a lo que pide el PRD, el roadmap del monolito
(`docs/monolito/05-backlog-roadmap.md`) y lo que hoy está en `develop`
(32 commits, árbol limpio). Cada punto está verificado contra el código o la
base, no estimado.

## Resumen

La app está **funcional de punta a punta** para ambos roles, con BFF real y
Supabase: acceso, cartera, anamnesis, evaluaciones, rutinas, ejecución con
carga real, agenda con citas, agenda global, mensajes cifrados, historial de
cargas y notificaciones dentro de la app. 1716 tests, cobertura 97 %.

Lo que falta se agrupa en cinco bloques, de más a menos urgente:

| #   | Bloque                      | Por qué importa                                                     | Puntos |
| --- | --------------------------- | ------------------------------------------------------------------- | ------ |
| 1   | **Seguridad y datos**       | Hay una clave expuesta, sin respaldos y sin ambiente de pruebas     | 6      |
| 2   | **Privacidad y legal**      | Datos de salud sin consentimiento ni derecho a borrado (Ley 21.719) | 4      |
| 3   | **Distribución nativa**     | La IPA no está firmada: sin App Store ni push                       | 4      |
| 4   | **Funcionalidad pendiente** | 3 `Must Have` del PRD y brechas de lo construido                    | 12     |
| 5   | **Calidad técnica**         | Sin E2E, sin offline, rendimiento y monitoreo                       | 9      |

---

## 1. Seguridad y datos (urgente)

| ID  | Hallazgo                                                                                                                                          | Evidencia                                        | Recomendación                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| S-1 | **`SUPABASE_SECRET_KEY` expuesta.** Se pegó en el chat al inicio de la auditoría QA. Da acceso total a la base saltándose RLS.                    | Historial de la sesión                           | Rotarla en Supabase y actualizar Vercel y `.env.local`. **Hoy.**            |
| S-2 | **Un solo proyecto Supabase.** Desarrollo, scripts y producción usan la misma base: hoy se borraron y crearon datos reales desde scripts locales. | `.env.local` apunta al mismo proyecto que Vercel | Crear `neque-dev` para local/Preview (roadmap M4.1, M8.1).                  |
| S-3 | **Sin respaldos ni restauración probada.** La limpieza de hoy fue irreversible.                                                                   | No hay dump ni runbook (M4.8)                    | Activar PITR o dump diario en Supabase y probar una restauración.           |
| S-4 | **Llave `MESSAGES_KEY` sin respaldo ni rotación.** Si se pierde, los mensajes no se recuperan.                                                    | Solo en `.env.local` y Vercel                    | Guardarla en un gestor de secretos; documentar rotación (re-cifrar con v2). |
| S-5 | **Sin CSP** (Content-Security-Policy). Hay HSTS, nosniff, X-Frame y Referrer.                                                                     | `scripts/build-vercel.mjs`                       | Agregar CSP con `connect-src` al dominio de Supabase y la API (M6.1).       |
| S-6 | **Sin escaneo de secretos en CI.**                                                                                                                | No hay `gitleaks` en `.github/`                  | Job de `gitleaks` en `ci-gate` (M6.3).                                      |

## 2. Privacidad y legal

Ñeque guarda **datos sensibles de salud** (anamnesis, medidas, fotos). La Ley
21.719 de Chile exige consentimiento expreso y derechos ARCO.

| ID  | Hallazgo                                                                                                                     | Recomendación                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| P-1 | **Sin consentimiento explícito** al aceptar la invitación ni registro de su fecha (M6.4, riesgo R7 del PRD).                 | Paso de aceptación con política de privacidad y columna `consented_at`.         |
| P-2 | **Sin política de privacidad ni términos** visibles en la app.                                                               | Página pública enlazada desde login y perfil.                                   |
| P-3 | **Sin eliminación ni exportación de cuenta.** El alumno no puede pedir que se borren sus datos; el entrenador solo suspende. | Flujo "Eliminar mi cuenta" (con aviso al entrenador) y exportación en JSON/PDF. |
| P-4 | **Sin política de retención** para sesiones, mensajes y fotos de alumnos suspendidos.                                        | Definir plazo y un job que limpie.                                              |

Ya resuelto en esta jornada: mensajes cifrados en la base, avisos sin el texto
del mensaje, `noindex` en todo el dominio.

## 3. Distribución nativa

| ID  | Hallazgo                                                                                                                    | Evidencia                       | Recomendación                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| D-1 | **La IPA se compila sin firma** (`CODE_SIGNING_ALLOWED=NO`). No se puede publicar ni recibir push. CA8 del PRD sin cumplir. | `.github/workflows/ios-ipa.yml` | Cuenta Apple Developer de pago, certificado y perfil en el workflow (M10.4). Es AMB-9. |
| D-2 | **No hay proyecto Android.** `android/` no existe y no hay workflow de APK.                                                 | `ls android`                    | `npx cap add android` + workflow de APK firmado.                                       |
| D-3 | **Push bloqueado** (A-1). Existen la tabla `device_tokens` y el plugin, sin uso.                                            | Depende de D-1                  | Tras D-1: registro del token, envío APNs/FCM desde `notify()`.                         |
| D-4 | **Universal Links / App Links** no configurados: los enlaces de invitación abren la web, no la app.                         | QA_AUDIT_REPORT                 | `apple-app-site-association` y `assetlinks.json` tras D-1/D-2.                         |

## 4. Funcionalidad pendiente

### 4.1 Frente al PRD (§6)

| ID  | Funcionalidad                                     | Prioridad PRD | Estado real                                                                                                       |
| --- | ------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| F-1 | **Notas privadas del entrenador** sobre el alumno | Must          | ⬜ No existe (`trainer_notes` no está en la base).                                                                |
| F-2 | **Cámara del dispositivo** para fotos de progreso | Must          | 🟡 Parcial: el `<input type=file>` de iOS ofrece "Tomar foto", pero `@capacitor/camera` está instalado y sin uso. |
| F-3 | **Push nativas**                                  | Must          | ⛔ Bloqueado por D-1.                                                                                             |
| F-4 | **Alta de entrenador** desde la app               | Must          | 🟡 Solo por script (`npm run create:trainer`). Aceptable para el piloto.                                          |
| F-5 | Reporte PDF de progreso                           | Nice          | ⬜ No existe.                                                                                                     |
| F-6 | Plantillas de rutinas                             | Must          | ✅ Cubierto por la biblioteca + **Duplicar** (T-4). El PRD aún lo marca pendiente.                                |

### 4.2 Brechas en lo construido

| ID   | Área                     | Falta                                                                                                                                                                      |
| ---- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-7  | Mensajes                 | **Bandeja del entrenador**: hoy solo entra a una conversación desde cada ficha; no ve quién le escribió.                                                                   |
| F-8  | Mensajes                 | **Indicador de no leídos** en la lista de alumnos, la ficha y el perfil del alumno.                                                                                        |
| F-9  | Mensajes                 | Tiempo real: se consulta cada 20 s. Aceptable; Supabase Realtime lo haría instantáneo.                                                                                     |
| F-10 | Progreso                 | **El entrenador no ve la progresión de carga** de un alumno (solo el detalle sesión por sesión). CA4 queda a medias. Reusar la sección "Cargas por ejercicio" en la ficha. |
| F-11 | Mi rutina                | **Mover un entrenamiento no avisa al entrenador.**                                                                                                                         |
| F-12 | Agenda                   | El alumno no puede **solicitar** una cita; no hay recordatorio previo a la cita (depende de push).                                                                         |
| F-13 | Agenda global            | No se puede **agendar desde la agenda**; hay que ir a la ficha.                                                                                                            |
| F-14 | Inicio del entrenador    | "Por atender" no incluye **mensajes sin responder** ni entrenamientos movidos.                                                                                             |
| F-15 | Decisiones AMB-1 a AMB-9 | Siguen abiertas (contraseña en login, rangos, apellido, objetivo, parentesco, perfil QA, instalación) y si se bloquea entrenar semanas futuras.                            |
| F-16 | Documentación            | **PRD §6 desactualizado**: dice que todo es "contra datos simulados" y no lista citas, agenda global, mensajes, cargas, reprogramar, hora por día ni duplicar.             |

## 5. Calidad técnica

| ID  | Hallazgo                                                                                                                                                                        | Evidencia                                | Recomendación                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| Q-1 | **Sin modo sin conexión** (PRD §7.1, CA5). Entrenar sin señal falla.                                                                                                            | Sin cola local ni `clientOpId`           | Cachear rutina/sesión del día y cola de series con reintento idempotente (M10.6). |
| Q-2 | **Sin E2E** (H-14) ni prueba del flujo completo en dispositivo.                                                                                                                 | No hay `e2e/` ni Playwright              | Playwright con F1–F6 contra Preview a 375 y 320 (M7.2).                           |
| Q-3 | **Aislamiento entre entrenadores (CA7) sin test.** RLS está cerrado y todo pasa por el BFF; la protección depende de los `assert*` de cada caso de uso, sin una matriz probada. | No hay tests de API ni pgTAP             | Test por endpoint: ajeno → 404, rol erróneo → 403 (M6.2).                         |
| Q-4 | **Inicio del entrenador con N+1** (H-05): 4 peticiones por alumno; con 20 alumnos, ~81. La agenda global repite el patrón.                                                      | `trainer-home.facade.ts` `cargarTablero` | Endpoint agregado `GET /trainers/me/dashboard` (M2.4/M3.12).                      |
| Q-5 | **Bundle inicial 303 kB**, sobre la meta de 300 kB del PRD (era 259 kB).                                                                                                        | `build:prod`                             | Revisar qué entró al chunk inicial (tema, tour, theme-picker).                    |
| Q-6 | **Sesión en `localStorage` también en iOS.** iOS puede purgarlo y cerrar la sesión.                                                                                             | `local-storage-session.adapter.ts`       | `@capacitor/preferences` en nativo (M5.2).                                        |
| Q-7 | **Sin monitoreo**: ni uptime de `/api/v1/health`, ni Sentry, ni alertas.                                                                                                        | —                                        | Uptime gratuito + alerta por correo (M8.5).                                       |
| Q-8 | **Umbral de cobertura en 80 %**, bajo el 95/85 del PRD aunque el real es 97 %.                                                                                                  | `package.json`                           | Subirlo a 95/85 para que proteja de verdad (M1.3).                                |
| Q-9 | **Arranque en frío y latencia p95 sin medir** en dispositivo ni con carga.                                                                                                      | PRD §7                                   | Medir en el iPhone y prueba de carga 100×20 (M7.4).                               |

---

## Orden recomendado

1. **Esta semana (bloqueante y barato):** pasos en
   [`docs/runbooks/claves-y-respaldos.md`](../runbooks/claves-y-respaldos.md).
   S-1 rotar la clave, S-4 respaldar
   `MESSAGES_KEY`, S-3 activar respaldos y ✅ F-16 PRD actualizado a v2.1.0.
2. **Antes del piloto con entrenadores reales (CA9):** S-2 ambiente de pruebas,
   P-1 a P-3 consentimiento, privacidad y borrado de cuenta, F-1 notas privadas,
   F-7/F-8 bandeja y no leídos, F-10 cargas en la ficha, Q-3 matriz de
   autorización, Q-7 monitoreo.
3. **Para publicar (CA8):** D-1 firma iOS → D-3 push → D-4 Universal Links, y
   D-2 Android.
4. **Robustez:** Q-1 offline, Q-2 E2E, Q-4 dashboard agregado, Q-5 bundle,
   Q-6 sesión nativa.
5. **Mejoras:** F-11 a F-14, F-5 PDF, S-5/S-6 CSP y gitleaks, Q-8/Q-9.

## Criterios de aceptación del MVP (PRD §13)

| CA  | Criterio                                  | Estado                                           |
| --- | ----------------------------------------- | ------------------------------------------------ |
| CA1 | Inicio del entrenador con datos reales    | ✅ (con N+1, Q-4)                                |
| CA2 | Invitación aceptada en otro dispositivo   | ✅                                               |
| CA3 | Rutina de 5 ejercicios en ≤3 min          | ✅                                               |
| CA4 | Carga real visible para el entrenador     | 🟡 Sesión por sesión; falta la progresión (F-10) |
| CA5 | Entrenar sin conexión                     | ⬜ Q-1                                           |
| CA6 | Gráfico con tres evaluaciones             | ✅                                               |
| CA7 | Aislamiento entre entrenadores verificado | 🟡 Implementado, sin test (Q-3)                  |
| CA8 | Publicada en las tiendas                  | ⬜ D-1, D-2                                      |
| CA9 | Dos entrenadores reales por dos semanas   | ⬜ Depende de los bloques 1 y 2                  |
