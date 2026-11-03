# Ñeque — Product Requirements Document

> **Plataforma móvil de gestión para entrenadores personales**

| Campo        | Valor                                        |
| ------------ | -------------------------------------------- |
| **Producto** | Ñeque (`com.duocuc.neque`)                   |
| **Versión**  | 2.0.0                                        |
| **Fecha**    | 24 de septiembre de 2026                     |
| **Autor**    | Kelvin A. Moreno                             |
| **Profesor** | _[por definir]_                              |
| **Curso**    | PY71461 · Portafolio de Título — Duoc UC     |
| **Entrega**  | Diciembre 2026                               |
| **Estado**   | Vigente — reemplaza al PRD «FitConnect» v1.0 |

> **Nota sobre este documento.** Sustituye por completo al PRD de FitConnect v1.0. El
> nombre FitConnect queda descartado. Los estados de la sección 6 no son estimaciones:
> están verificados contra el código de la rama de trabajo a la fecha del documento.

---

## Tabla de contenidos

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Contexto y problema](#2-contexto-y-problema)
3. [Objetivos](#3-objetivos)
4. [Roles del sistema](#4-roles-del-sistema)
5. [Stack y arquitectura](#5-stack-y-arquitectura)
6. [Funcionalidades](#6-funcionalidades)
7. [Requisitos no funcionales](#7-requisitos-no-funcionales)
8. [Diseño y UX](#8-diseño-y-ux)
9. [Integraciones externas](#9-integraciones-externas)
10. [Modelo de datos](#10-modelo-de-datos)
11. [Roadmap](#11-roadmap)
12. [Riesgos](#12-riesgos)
13. [Criterios de aceptación del MVP](#13-criterios-de-aceptación-del-mvp)
14. [Fuera de alcance](#14-fuera-de-alcance)

---

## 1. Resumen ejecutivo

Ñeque es una aplicación móvil para iOS y Android que permite a un entrenador personal
gestionar su cartera de alumnos, construirles rutinas y seguir su progreso, y permite al
alumno ver su rutina, ejecutarla guiado y registrar lo que realmente levantó.

Es el trabajo de título del curso PY71461 (Ingeniería en Informática, Duoc UC),
desarrollado por una sola persona con entrega en **diciembre de 2026**. La meta es un MVP
funcional y arquitectónicamente defendible, publicado en ambas tiendas y usado por
entrenadores reales.

### 1.1 Qué aporta a cada rol

| Entrenador                                                | Alumno                                                  |
| --------------------------------------------------------- | ------------------------------------------------------- |
| Cartera de alumnos con búsqueda, estado y ficha completa  | Su rutina del día, lista para ejecutar                  |
| Constructor de rutinas sobre un catálogo de ejercicios    | Ejecución guiada serie por serie, con descanso incluido |
| Registro de anamnesis, evaluaciones físicas y progresión  | Registro de la carga real levantada, no solo del check  |
| Invitación al alumno por enlace o código QR, con vigencia | Historial de progreso con gráficos y fotos de evolución |
| Plantillas de rutinas y notas privadas sobre cada alumno  | Agenda de sesiones y notificaciones de lo que viene     |

### 1.2 Modelo de negocio

**Freemium.** El entrenador usa Ñeque gratis hasta **3 alumnos activos**; por encima de
ese número pasa a un plan de pago.

El cobro **no se implementa en este MVP**: el plan de pago se opera fuera de la
aplicación. La aplicación conoce el límite y lo comunica, pero no procesa dinero. La
pasarela de pagos es una fase posterior (ver §14).

---

## 2. Contexto y problema

### 2.1 Problema

Un entrenador personal independiente gestiona su negocio con herramientas desconectadas:
una planilla para las métricas, mensajería para comunicarse, papel o documentos sueltos
para las rutinas. Esa fragmentación produce tres efectos concretos:

- **La información se pierde.** No hay un historial estructurado del alumno: lo que
  levantaba hace tres meses no está en ninguna parte consultable.
- **El seguimiento no escala.** Mantener la calidad del acompañamiento se vuelve inviable
  a medida que crece la cartera, porque cada alumno exige trabajo manual.
- **El valor del servicio no es demostrable.** Sin evidencia de progreso, el entrenador no
  puede mostrarle al alumno que lo que hace está funcionando.

### 2.2 Qué resuelve Ñeque

Un único lugar donde el entrenador construye y asigna la rutina, y donde el alumno la
ejecuta y deja registro. El dato que el alumno genera entrenando vuelve al entrenador sin
que nadie lo transcriba.

### 2.3 Supuestos

- Entrenador y alumno tienen un smartphone iOS o Android.
- El alumno está dispuesto a instalar la app si su entrenador se la facilita.
- El entrenamiento ocurre con frecuencia en lugares con mala señal, por lo que la
  ejecución de la sesión debe funcionar sin conexión (ver §7 y §12).

> Las afirmaciones sobre tamaño de mercado, competencia o tendencias de la industria se
> omiten deliberadamente: no hay fuente que las respalde a la fecha de este documento. Si
> se necesitan para la defensa, deben incorporarse con su cita.

---

## 3. Objetivos

### 3.1 Objetivos de negocio

| #   | Objetivo                                       | Métrica de éxito                                       |
| --- | ---------------------------------------------- | ------------------------------------------------------ |
| OB1 | Validar el producto con entrenadores reales    | **2 entrenadores** usando Ñeque con alumnos propios    |
| OB2 | Aprobar la evaluación académica con nota alta  | Arquitectura evaluable, defendible y documentada       |
| OB3 | Dejar base técnica para continuar tras el ramo | El MVP es punto de partida, no un prototipo desechable |

**OB1 es el objetivo exigente.** Dos entrenadores reales implica que la app esté
publicada, que sus alumnos puedan instalarla y que el flujo completo funcione sin que el
autor esté presente para arreglarlo.

### 3.2 Objetivos técnicos

- Arquitectura hexagonal con la regla de dependencia respetada y verificable, tanto en la
  app móvil como en el BFF.
- Que conectar el backend reemplace **únicamente** la capa de infraestructura del móvil,
  sin tocar dominio, aplicación ni UI.
- Cobertura de tests que no baje de los umbrales de §7 en ningún merge.
- Cero secretos en el repositorio.

---

## 4. Roles del sistema

| Rol         | Cómo obtiene la cuenta                    | Qué puede hacer                                                         |
| ----------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| **Trainer** | Alta por el administrador                 | Gestión completa: alumnos, anamnesis, evaluaciones, rutinas, su perfil  |
| **Student** | Invitación de su entrenador (enlace o QR) | Ver su rutina, ejecutarla, registrar series, ver su progreso, su agenda |
| **Admin**   | —                                         | Da de alta entrenadores. Sin interfaz en el MVP                         |

**Ñeque es invitation-only en los dos niveles.** No hay registro abierto: ni el entrenador
ni el alumno pueden crearse una cuenta por su cuenta.

- El **alumno** lo invita su entrenador desde la app. La invitación caduca a las **48
  horas** y el alumno define su propia contraseña al aceptarla; el entrenador nunca la
  conoce.
- El **entrenador** lo da de alta el administrador. En el MVP ese alta es un
  **procedimiento manual en la consola de Supabase**, no una funcionalidad de la app. El
  backoffice que lo automatice es una fase posterior (§14).

> Consecuencia a asumir: el alta de entrenadores no es demostrable como funcionalidad
> durante la evaluación. Es una decisión consciente para no abrir un tercer frente de
> desarrollo antes de diciembre.

---

## 5. Stack y arquitectura

### 5.1 Componentes

| Capa         | Tecnología               | Responsabilidad                                            | Despliegue             |
| ------------ | ------------------------ | ---------------------------------------------------------- | ---------------------- |
| App móvil    | Angular 17 + Capacitor 6 | Interfaz para ambos roles, compilada como app nativa       | Play Store · App Store |
| BFF          | NestJS + TypeScript      | Lógica de negocio, hexagonal, contra Supabase              | Vercel Serverless      |
| Datos y auth | Supabase                 | PostgreSQL, Auth JWT, Row Level Security, Storage de fotos | Supabase Cloud         |

### 5.2 Repositorios

| Repositorio                | Stack      | Estado                                       |
| -------------------------- | ---------- | -------------------------------------------- |
| `ui-any-neque-mobile-app`  | Angular 17 | **Existe.** App completa contra datos mock   |
| _BFF (nombre por definir)_ | NestJS     | **No existe.** Es el trabajo pendiente mayor |

### 5.3 Arquitectura de la app móvil

Hexagonal por `{capa}/{feature}`:

```
src/app/
├── domain/{feature}/          modelos + puertos (interfaz + InjectionToken)
├── application/{feature}/     facades con signals (casos de uso)
├── infrastructure/{feature}/  adapters (mock hoy, HTTP mañana) + semillas
└── ui/{feature}/              páginas y componentes
```

**Regla de dependencia.** `domain` no importa de nadie. `application` solo de `domain`.
`infrastructure` solo de `domain`. `ui` de `domain` y `application`, y de `infrastructure`
únicamente para registrar los `provide*()` en los archivos de rutas.

Los puertos devuelven `Observable<T>` precisamente para que el adapter HTTP encaje sin
cambiar ninguna firma. **Esa es la apuesta arquitectónica central del proyecto:** conectar
el BFF debe ser reemplazar `infrastructure/` y nada más.

### 5.4 Decisiones tomadas y su motivo

| Decisión                                     | Motivo                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sin Ionic**                                | De toda la librería solo se usaba `<ion-content>` como contenedor con scroll, y arrastraba 158 kB de `@ionic/core` al bundle inicial. Lo reemplaza `.nq-screen`, una clase del design system propio. El bundle pasó de 494 kB a **259 kB**. |
| Design system propio (`--nq-*`)              | Control total del contraste y del área táctil, que son requisitos duros de §7.                                                                                                                                                              |
| `<router-outlet>` de Angular, no el de Ionic | El outlet de Ionic mantiene una pila push/pop que, con un tab bar propio, apila las pestañas visitadas y las muestra a la vez.                                                                                                              |
| Puerto `CLOCK` en vez de `new Date()`        | Hace determinista todo lo que depende de la fecha: vigencia de invitaciones, saludos, agenda, gráficos.                                                                                                                                     |
| Un solo injector por rol                     | Dos `providers` hermanos crean dos juegos de adapters, y una mutación hecha en una pantalla no se ve en la otra.                                                                                                                            |

---

## 6. Funcionalidades

**Los estados están verificados contra el código**, no estimados. «Hecho» significa
implementado, con tests y comprobado en navegador a 375×812 y 320×568.

### M1 · Acceso

| Funcionalidad                                          | Rol     | Prioridad   | Estado             |
| ------------------------------------------------------ | ------- | ----------- | ------------------ |
| Login único que redirige según el rol                  | Ambos   | `Must Have` | ✅ Hecho           |
| Invitación de alumno por enlace, con vigencia de 48 h  | Trainer | `Must Have` | ✅ Hecho           |
| Compartir la invitación por la hoja nativa del sistema | Trainer | `Must Have` | ✅ Hecho           |
| Código QR de la invitación                             | Trainer | `Must Have` | ✅ Hecho           |
| Reemitir y revocar la invitación                       | Trainer | `Must Have` | ✅ Hecho           |
| El alumno crea su contraseña al aceptar la invitación  | Student | `Must Have` | ✅ Hecho           |
| Recuperación de contraseña en tres pasos               | Ambos   | `Must Have` | ✅ Hecho           |
| Alta de entrenador por el administrador                | Admin   | `Must Have` | ⬜ Manual, sin app |

### M2 · Gestión de alumnos

| Funcionalidad                                                 | Rol     | Prioridad     | Estado       |
| ------------------------------------------------------------- | ------- | ------------- | ------------ |
| Cartera con estado activo/suspendido y contadores             | Trainer | `Must Have`   | ✅ Hecho     |
| Búsqueda por nombre o correo, insensible a tildes             | Trainer | `Should Have` | ✅ Hecho     |
| Alta de alumno que emite su invitación en el mismo gesto      | Trainer | `Must Have`   | ✅ Hecho     |
| Ficha: datos personales, contacto, objetivo                   | Trainer | `Must Have`   | ✅ Hecho     |
| Edición de la ficha                                           | Trainer | `Must Have`   | ✅ Hecho     |
| Anamnesis: antecedentes, lesiones, medicación, disponibilidad | Trainer | `Must Have`   | ✅ Hecho     |
| Aviso de antecedentes clínicos antes de prescribir            | Trainer | `Must Have`   | ✅ Hecho     |
| Suspender y reactivar sin perder ficha ni historial           | Trainer | `Must Have`   | ✅ Hecho     |
| **Notas privadas del entrenador sobre el alumno**             | Trainer | `Must Have`   | ⬜ Por hacer |

### M3 · Rutinas y ejercicios

| Funcionalidad                                                           | Rol     | Prioridad   | Estado       |
| ----------------------------------------------------------------------- | ------- | ----------- | ------------ |
| Catálogo de ejercicios con grupo muscular, equipamiento e instrucciones | Trainer | `Must Have` | ✅ Hecho     |
| Ejercicios propios, privados de cada entrenador                         | Trainer | `Must Have` | ✅ Hecho     |
| Constructor: días, ejercicios, series × reps × carga × descanso         | Trainer | `Must Have` | ✅ Hecho     |
| Asignar una rutina, archivando automáticamente la anterior              | Trainer | `Must Have` | ✅ Hecho     |
| Biblioteca con rutinas asignadas y sin asignar                          | Trainer | `Must Have` | ✅ Hecho     |
| Vista de la rutina para el alumno                                       | Student | `Must Have` | ✅ Hecho     |
| Ejecución guiada serie por serie, con descanso                          | Student | `Must Have` | ✅ Hecho     |
| Registro de la carga y repeticiones realmente levantadas                | Student | `Must Have` | ✅ Hecho     |
| **Plantillas de rutinas reutilizables**                                 | Trainer | `Must Have` | ⬜ Por hacer |

> **Sobre el registro de carga real.** El alumno confirma cada serie con los valores
> prescritos ya precargados: si levantó lo previsto, cerrar la serie cuesta un solo toque,
> igual que antes. Solo corrige cuando hubo diferencia. Es lo que hace posible que el
> entrenador vea progresión real en lugar de una lista de checks.

### M4 · Progreso

| Funcionalidad                                                | Rol     | Prioridad      | Estado       |
| ------------------------------------------------------------ | ------- | -------------- | ------------ |
| Evaluaciones físicas: peso, estatura, % grasa, masa, medidas | Trainer | `Must Have`    | ✅ Hecho     |
| Historial de evaluaciones y gráfico de evolución de peso     | Ambos   | `Must Have`    | ✅ Hecho     |
| IMC derivado de la última evaluación                         | Student | `Must Have`    | ✅ Hecho     |
| Progreso semanal de adherencia                               | Student | `Must Have`    | ✅ Hecho     |
| Fotos de progreso con comparador antes/después               | Student | `Should Have`  | ✅ Hecho     |
| **Tomar la foto con la cámara del dispositivo**              | Student | `Must Have`    | ⬜ Por hacer |
| Reporte PDF de progreso                                      | Trainer | `Nice to Have` | ⬜ Por hacer |

### M5 · Agenda y notificaciones

| Funcionalidad                                               | Rol     | Prioridad   | Estado       |
| ----------------------------------------------------------- | ------- | ----------- | ------------ |
| Agenda mensual de sesiones con confirmación                 | Student | `Must Have` | ✅ Hecho     |
| Cancelación con motivo predefinido y nota libre             | Ambos   | `Must Have` | ✅ Hecho     |
| Bandeja de notificaciones con navegación a su destino       | Student | `Must Have` | ✅ Hecho     |
| Inicio del entrenador: sesiones de hoy y alumnos pendientes | Trainer | `Must Have` | ✅ Hecho     |
| **Notificaciones push nativas**                             | Ambos   | `Must Have` | ⬜ Por hacer |

### 6.1 Resumen de estado

| Módulo        | Hechas | Pendientes |
| ------------- | -----: | ---------: |
| M1 · Acceso   |      7 |          1 |
| M2 · Alumnos  |      8 |          1 |
| M3 · Rutinas  |      8 |          1 |
| M4 · Progreso |      5 |          2 |
| M5 · Agenda   |      4 |          1 |
| **Total**     | **32** |      **6** |

De las 6 pendientes, **5 son `Must Have` del MVP**: notas privadas, plantillas de rutinas,
cámara, push y el alta manual de entrenadores. La sexta (PDF) es `Nice to Have`.

**Todo lo marcado como hecho funciona contra datos simulados en memoria.** Ninguna
funcionalidad persiste entre sesiones todavía: eso llega con el BFF.

---

## 7. Requisitos no funcionales

Los umbrales marcados con ✅ ya se cumplen y están medidos en la app móvil.

| Categoría      | Requisito                  | Criterio                                                                  | Estado                    |
| -------------- | -------------------------- | ------------------------------------------------------------------------- | ------------------------- |
| Accesibilidad  | Contraste WCAG AA          | 4.5:1 en todo texto; 3:1 en texto grande                                  | ✅ Verificado por barrido |
| Accesibilidad  | Área táctil mínima         | 44 × 44 px en todo control interactivo                                    | ✅ Verificado por barrido |
| Accesibilidad  | Nombre accesible           | Todo control tiene nombre; estados anunciados con `aria-live`             | ✅ Verificado por barrido |
| Accesibilidad  | Movimiento reducido        | `prefers-reduced-motion` respetado globalmente                            | ✅                        |
| Mantenibilidad | Cobertura de tests         | ≥95 % en líneas y ≥85 % en ramas                                          | ✅ 98,09 % / 88,85 %      |
| Rendimiento    | Tamaño del bundle inicial  | ≤300 kB                                                                   | ✅ 259,32 kB              |
| Rendimiento    | Arranque en frío           | <3 s en dispositivo de gama media                                         | ⬜ Sin medir en físico    |
| Rendimiento    | Latencia del BFF           | p95 <200 ms en los endpoints de rutinas y alumnos                         | ⬜ Requiere BFF           |
| Seguridad      | JWT firmado                | RS256 verificado en cada petición; nunca Base64 sin firma                 | ⬜ Requiere BFF           |
| Seguridad      | Row Level Security         | Un entrenador no puede leer datos de alumnos de otro bajo ningún caso     | ⬜ Requiere Supabase      |
| Seguridad      | Secretos                   | Cero credenciales en el repositorio                                       | ✅                        |
| Privacidad     | Datos de salud             | Anamnesis, medidas y fotos bajo RLS; nunca compartidos sin consentimiento | ⬜ Requiere Supabase      |
| Disponibilidad | Uptime del BFF             | ≥99 % entre 07:00 y 22:00 CLT                                             | ⬜ Requiere BFF           |
| Escalabilidad  | Capacidad del MVP          | 100 entrenadores × 20 alumnos sin degradación                             | ⬜ Requiere BFF           |
| Resiliencia    | **Ejecución sin conexión** | Ver §7.1                                                                  | ⬜ Por hacer              |

> **Sobre los umbrales de cobertura.** El PRD anterior pedía ≥60 %. Exigir 60 % a un
> proyecto que rinde 98 % no comunica nada, así que el umbral se fija en el nivel real
> alcanzado: sirve como red de protección contra regresiones, que es para lo que existe.

### 7.1 Comportamiento sin conexión

El alumno entrena con frecuencia donde no hay señal. El requisito es **acotado a la
ejecución de la sesión**, no a la aplicación entera:

| Situación                                | Comportamiento exigido                                              |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Alumno abre su rutina sin conexión       | La rutina activa y la sesión del día están cacheadas y se muestran  |
| Alumno ejecuta y registra series sin red | Se guardan en una cola local y se sincronizan al recuperar conexión |
| Cualquier otra operación sin red         | Se informa el estado sin conexión y no se permite operar            |

**Política de conflictos.** Una sesión ejecutada es un **hecho histórico**: se registra lo
que el alumno hizo contra la versión de la rutina que tenía delante, y el servidor la
acepta sin recalcularla. Si el entrenador modificó la rutina entretanto, el cambio aplica
a las sesiones siguientes, nunca a la ya ejecutada.

Esta acotación es deliberada. El offline general —crear rutinas o dar de alta alumnos sin
red— exigiría versionado y resolución de conflictos reales, y queda fuera del MVP.

---

## 8. Diseño y UX

### 8.1 Principios

- **Un alumno a dos toques.** Desde el Inicio del entrenador, cualquier alumno debe estar
  a dos toques como máximo.
- **Mobile-first a 375 px.** Toda pantalla se diseña primero para 375 px de ancho y se
  verifica además a 320 × 568, que es donde se rompen los layouts.
- **Una acción destructiva, una confirmación.** Suspender una cuenta, borrar una foto o
  cerrar sesión piden confirmación explícita.
- **Nunca una métrica inventada.** Si un dato no se puede calcular con lo que hay, la
  pantalla muestra su vacío explicando qué falta, no un cero ni un guion.

### 8.2 Sistema de diseño

| Elemento           | Valor                         | Uso                                                           |
| ------------------ | ----------------------------- | ------------------------------------------------------------- |
| Color de marca     | `#2cb5a0`                     | Decorativo: barras de avance, relleno de gráficos, tintes     |
| Color de contenido | `#0f766e`                     | Todo texto o icono sobre claro, y todo fondo con texto encima |
| Éxito              | `#2e7d32`                     | Estados completados                                           |
| Advertencia        | `#b45309`                     | Suspensiones, antecedentes clínicos, vencimientos             |
| Error              | `#c62828`                     | Errores y acciones destructivas                               |
| Tipografía         | Inter, self-hosteada          | Pesos 400, 500, 600 y 700                                     |
| Radio de borde     | `14px` medio · `20px` grande  | Tarjetas, campos, hojas inferiores                            |
| Componentes        | Design system propio `--nq-*` | Sin librería de componentes de terceros                       |

> **La distinción entre marca y contenido es un requisito, no un matiz.** `#2cb5a0` da
> 2,55:1 sobre blanco y no pasa AA; `#0f766e` da 5,50:1. Si encima va contenido, o el
> color _es_ el contenido, se usa el segundo. Confundirlos rompe el requisito de
> accesibilidad de §7.

### 8.3 Flujos principales

| #   | Rol     | Flujo                                                                |
| --- | ------- | -------------------------------------------------------------------- |
| F1  | Trainer | Alumnos → Alta → se emite la invitación → compartir enlace o QR      |
| F2  | Trainer | Rutinas → Nueva → cabecera, días y ejercicios → Guardar → Asignar    |
| F3  | Trainer | Inicio → alumno pendiente → ficha → registrar anamnesis o evaluación |
| F4  | Student | Invitación → crear contraseña → Inicio con su rutina del día         |
| F5  | Student | Mi rutina → Comenzar → serie a serie con descanso → Guardar y volver |
| F6  | Student | Progreso → foto o evaluación → gráfico de evolución                  |

---

## 9. Integraciones externas

### 9.1 Supabase

- **Auth:** JWT RS256 gestionado por Supabase y verificado en el BFF con un guard real.
- **Base de datos:** PostgreSQL. Migraciones versionadas con la CLI de Supabase.
- **RLS:** políticas por rol en toda tabla con datos personales o de salud. Es requisito
  crítico de §7, no una optimización.
- **Storage:** bucket para fotos de progreso, con URL firmada de expiración corta.
- **Alta de entrenadores:** en el MVP, manual desde la consola.

### 9.2 Capacitor

| Plugin                          | Uso                                        | Estado                 |
| ------------------------------- | ------------------------------------------ | ---------------------- |
| `@capacitor/share`              | Compartir la invitación por la hoja nativa | ✅ En uso              |
| `@capacitor/screen-orientation` | Bloqueo en vertical                        | ✅ En uso              |
| `@capacitor/camera`             | Tomar fotos de progreso                    | ⬜ Instalado, sin usar |
| `@capacitor/push-notifications` | Avisos de sesión y rutina nueva            | ⬜ Instalado, sin usar |

Compilación: `ng build` → `npx cap sync` → build nativo firmado.

Toda integración nativa cae con elegancia: si la hoja de compartir no existe o el usuario
la cancela, el enlace termina en el portapapeles igual.

---

## 10. Modelo de datos

El modelo completo —19 tablas, 12 enumeraciones, claves, índices y restricciones— está en
**[`docs/modelo-datos.md`](modelo-datos.md)**, que es el contrato entre la app y el BFF.

Convenciones acordadas:

- **camelCase** en columnas y en la API. El front no traduce nombres.
- Identificadores **UUID v4**.
- `createdAt`, `updatedAt` y `deletedAt` en todas las tablas; el borrado es lógico.
- Todo en **UTC**; el dispositivo formatea en su huso.
- La base **no guarda rutas del front**: las notificaciones referencian `targetType` +
  `targetId` y el mapeo a pantalla vive en la app.

Entidades principales: `users`, `trainers`, `students`, `invitations`, `anamnesis`,
`assessments`, `exercises`, `routines`, `routineDays`, `routineExercises`,
`workoutSessions`, `workoutExerciseLogs`, `workoutSets`, `progressPhotos`,
`scheduledSessions`, `notifications`.

Restricciones de negocio que la base debe garantizar:

- Un alumno tiene **una sola rutina activa** a la vez (índice único parcial).
- Una rutina tiene **un solo día por día de la semana** (índice único).
- La anamnesis es **única por alumno** y se edita; no hay historial de versiones.

---

## 11. Roadmap

Entrega del MVP en **diciembre de 2026**. Tres fases desde la fecha de este documento.

| Fase                | Entregables                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 · Backend**     | Repo del BFF, hexagonal, con esquema y migraciones en Supabase, Auth JWT y RLS por rol. Endpoints de los puertos que el móvil ya define.                  |
| **2 · Conexión**    | Adapters HTTP que reemplacen los mock del móvil. Cierre de los 5 `Must Have` pendientes: notas privadas, plantillas, cámara, push y alta de entrenadores. |
| **3 · Publicación** | Ejecución sin conexión (§7.1), build firmado, pruebas en dispositivo físico, publicación en ambas tiendas y onboarding de los 2 entrenadores reales.      |

**El camino crítico es la fase 1.** Mientras no exista el BFF, nada persiste y ninguno de
los criterios de aceptación que dependen de datos reales se puede cerrar.

### 11.1 Definición de terminado

Toda funcionalidad nueva cumple, sin excepción:

- Criterios de aceptación escritos antes de empezar y verificados al cerrar.
- Tests que cubran el caso de uso y sus caminos de error.
- `lint`, `typecheck`, `format:check`, `test:coverage` y `build` en verde.
- Sin secretos en el diff.
- Verificada en navegador a 375 × 812 y 320 × 568, y en dispositivo físico si toca
  capacidades nativas.

---

## 12. Riesgos

| #   | Riesgo                                                                | Prob. | Impacto | Mitigación                                                                                                                                   |
| --- | --------------------------------------------------------------------- | ----- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **El BFF no llega a tiempo** y el MVP se queda en mock                | Alta  | Crítico | Es el camino crítico: va primero, antes que cualquier funcionalidad pendiente del móvil. Los puertos ya están definidos, el contrato existe. |
| R2  | **Ejecución sin conexión** más compleja de lo previsto                | Media | Alto    | Acotada al runner, con política de conflictos de una frase (§7.1). Si se complica, degrada a lectura offline sin perder el resto del MVP.    |
| R3  | **Publicación en App Store**: cuenta de pago y necesidad de un Mac    | Media | Alto    | Identificar el bloqueo pronto. Play Store es viable sin Mac; si App Store no es alcanzable, se documenta y se entrega solo Android.          |
| R4  | **Divergencia entre documento y código**                              | Alta  | Alto    | Este PRD nace de una auditoría del código, no al revés. Los estados de §6 se re-verifican en cada entrega de fase.                           |
| R5  | **Sin alta de entrenadores en la app**: OB1 depende de un paso manual | Media | Medio   | Aceptado. Con 2 entrenadores el alta manual es viable; deja de serlo al crecer, y ahí entra el backoffice.                                   |
| R6  | **Sobre-arquitectura** que retrasa el MVP                             | Media | Alto    | Ninguna abstracción nueva sin un segundo caso de uso concreto que la justifique.                                                             |
| R7  | **Bloqueo técnico sin par** en un proyecto individual                 | Media | Alto    | Decisiones documentadas en los tickets de `docs/tickets/` para poder retomar el hilo.                                                        |

---

## 13. Criterios de aceptación del MVP

El MVP está completo cuando se cumplen **todos**:

| #   | Criterio                                                                                                 | Depende de       |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------- |
| CA1 | Un entrenador dado de alta inicia sesión y ve su Inicio con datos reales en <30 s en dispositivo físico  | BFF              |
| CA2 | El entrenador invita a un alumno; este acepta **en otro dispositivo**, crea su contraseña y ve su rutina | BFF              |
| CA3 | El entrenador construye y asigna una rutina de 5 ejercicios en ≤3 minutos sin errores de interfaz        | ✅ Ya se cumple  |
| CA4 | El alumno ejecuta una sesión registrando carga real, y el entrenador ve esa progresión en la ficha       | BFF              |
| CA5 | El alumno entrena **sin conexión** y sus series aparecen en el servidor al recuperar red                 | Offline + BFF    |
| CA6 | El gráfico de evolución de peso muestra correctamente tres evaluaciones consecutivas                     | ✅ Ya se cumple  |
| CA7 | RLS verificado: el entrenador A no accede a los alumnos del entrenador B bajo ninguna circunstancia      | Supabase         |
| CA8 | La app está publicada o en revisión en Play Store y App Store, con ficha en español                      | Publicación      |
| CA9 | **2 entrenadores reales** usan Ñeque con alumnos propios durante al menos dos semanas                    | Todo lo anterior |

**Estado a la fecha: 2 de 9 cumplidos.** Los siete restantes dependen, directa o
indirectamente, de que exista el backend.

---

## 14. Fuera de alcance

Explícitamente **fuera** del MVP. Aparecen aquí para que no se cuelen por la puerta de
atrás:

| Funcionalidad                           | Cuándo                                                        |
| --------------------------------------- | ------------------------------------------------------------- |
| **Pagos con pasarela**                  | Fase posterior. El plan de pago se opera fuera de la app      |
| **Backoffice de administración**        | Cuando el alta manual de entrenadores deje de escalar         |
| Mensajería entre entrenador y alumno    | No evaluada                                                   |
| Reporte PDF de progreso                 | `Nice to Have`, tras el MVP                                   |
| Video de referencia en los ejercicios   | Descartado del MVP: el ejercicio lleva instrucciones de texto |
| Registro abierto de entrenadores        | Ñeque es invitation-only por decisión de producto             |
| Login social                            | No evaluado                                                   |
| Offline para operaciones del entrenador | Solo el runner opera sin conexión (§7.1)                      |
| Modo oscuro                             | No evaluado                                                   |
| Internacionalización                    | Ñeque es español de Chile                                     |

---

_Ñeque · PRD v2.0 · Septiembre 2026 · Kelvin A. Moreno · PY71461 Duoc UC_
