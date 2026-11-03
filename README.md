# Ñeque

App móvil para **entrenadores personales y sus alumnos**: el entrenador arma rutinas y
lleva su cartera; el alumno entrena, registra su avance y sigue su progreso.

Es una aplicación híbrida — Angular + Ionic empaquetada con Capacitor — así que el mismo
código corre en el navegador, en Android y en iOS.

## Qué hace

**Acceso** — invitation-only, sin registro público. Un login único resuelve el rol y
redirige al shell que corresponde. Incluye recuperación de contraseña en dos pasos con
OTP de 6 dígitos, y `/invite/:token` para que un alumno invitado cree su contraseña.

**App del alumno** — completa y navegable, con estados de carga, error y vacío en cada
pantalla:

- **Inicio** — IMC de la última evaluación, sesión de hoy, progreso semanal en barras y
  último/próximos entrenamientos.
- **Mi rutina** — selector de día, ejercicios con series, repeticiones, peso y descanso,
  check individual y cierre de sesión con modal de celebración.
- **Ejecutar sesión** — pantalla completa que guía serie por serie, con temporizador de
  descanso, y resumen final de duración, ejercicios y series.
- **Progreso** — evolución de peso e IMC en gráfico de línea, historial de evaluaciones,
  y fotos con comparador antes/después.
- **Agenda y notificaciones** — calendario mensual con las citas del entrenador, y avisos
  agrupados por antigüedad.
- **Perfil** — datos, entrenador asignado y cierre de sesión.

**App del entrenador** — el shell y el dashboard existen; clientes, rutinas y perfil
siguen siendo alias temporales al dashboard. Es el alcance de la Épica 9, ver
[`docs/BACKLOG.md`](docs/BACKLOG.md).

## Stack

| Categoría   | Tecnología                                                         |
| ----------- | ------------------------------------------------------------------ |
| Framework   | Angular 17 — standalone components + signals, sin NgModules        |
| UI móvil    | Ionic 8                                                            |
| Nativo      | Capacitor 6 (Android + iOS)                                        |
| Estilos     | SCSS con design tokens propios (`--nq-*`). Sin Tailwind ni PostCSS |
| Formularios | `ReactiveFormsModule`                                              |
| Iconos      | `@lucide/angular`                                                  |
| Testing     | Jest 29 + `jest-preset-angular`                                    |
| Calidad     | ESLint + Prettier + Husky + commitlint                             |
| CI/CD       | GitHub Actions                                                     |

Requiere **Node.js 22** o superior.

## Inicio rápido

```bash
npm ci
npm start
```

La app queda en `http://localhost:4200`. Para verla como en un teléfono, activa la vista
responsive del navegador: el layout está pensado en vertical y bloquea el modo horizontal
en pantallas bajas.

Para un build nativo:

```bash
npm run cap:build
```

Genera el bundle de producción y lo copia a las plataformas nativas. Las carpetas
`/android` y `/ios` se crean con `npx cap add android` / `npx cap add ios`.

## Estructura

El código sigue **arquitectura hexagonal organizada por `{capa}/{feature}`**, no por
vertical slicing:

```
src/
├── app/
│   ├── domain/           # modelos y puertos — no depende de nada
│   │   ├── shared/           # ids, fechas, errores, puerto CLOCK
│   │   ├── auth/ students/ routines/ workouts/
│   │   └── progress/ schedule/ notifications/
│   ├── application/      # facades con signals (casos de uso)
│   │   └── shared/           # AsyncState: loading/error/empty en un solo lugar
│   ├── infrastructure/   # adapters mock + semillas (hoy), HTTP-BFF (mañana)
│   ├── ui/               # páginas y componentes
│   │   ├── auth/             # login, recuperación, invitación
│   │   ├── student/          # app del alumno: home, rutina, runner, progreso…
│   │   ├── trainer/          # shell del entrenador
│   │   └── shared/           # theme, componentes, guards, validators
│   ├── app.config.ts     # providers raíz
│   └── app.routes.ts     # rutas, todas lazy con loadComponent
├── assets/               # imágenes y fuentes (Inter self-hosted)
└── environments/         # configuración por entorno
```

Alias de importación: `@app/*`, `@shared/*` (→ `src/app/ui/shared/*`) y `@env/*`.

**Por qué esta división.** Un caso de uso puede componer puertos de varias features
—el progreso del alumno combina evaluaciones, fotos y sesiones— sin que ninguna feature
conozca a otra ni se duplique código. La regla de dependencias entre capas está en
[`CONTRIBUTING.md`](CONTRIBUTING.md#arquitectura-hexagonal-por-capafeature).

### Datos: mock hoy, BFF después

La app no habla con ningún backend todavía. Cada puerto tiene un **adapter mock en
memoria** con datos semilla y latencia simulada. Conectar el BFF será reemplazar
`provideMockData()` y `provideStudentMockData()` por sus equivalentes HTTP: **ningún
archivo de `domain/`, `application/` ni `ui/` cambia**. Ese es el criterio de aceptación
de la Épica 10.

Cuentas de prueba:

| Rol        | Correo               | Contraseña     |
| ---------- | -------------------- | -------------- |
| Alumno     | `alejandra@neque.cl` | `Alumno1234!`  |
| Entrenador | `kelvin@neque.cl`    | `Entrenador1!` |

Código OTP de recuperación: `123456`. Invitaciones de prueba: `/invite/inv-valida`,
`/invite/inv-expirada`, `/invite/inv-usada`.

## Scripts

| Script                  | Qué hace                                  |
| ----------------------- | ----------------------------------------- |
| `npm start`             | Servidor de desarrollo                    |
| `npm run build:prod`    | Build de producción                       |
| `npm test`              | Tests con Jest                            |
| `npm run test:watch`    | Tests en modo watch                       |
| `npm run test:coverage` | Tests con reporte de cobertura            |
| `npm run lint`          | ESLint (falla ante cualquier warning)     |
| `npm run format`        | Formatea con Prettier                     |
| `npm run typecheck`     | Chequeo de tipos sin emitir               |
| `npm run cap:sync`      | Sincroniza plugins nativos con Capacitor  |
| `npm run cap:build`     | Build de producción + copia a las nativas |

## Sistema visual

El diseño vive en `src/app/ui/shared/theme/`:

| Parcial            | Contenido                                                        |
| ------------------ | ---------------------------------------------------------------- |
| `_fonts.scss`      | `@font-face` de Inter (self-hosted, licencia OFL)                |
| `_palette.scss`    | Tokens `--nq-*`: colores, radios, sombras, tipografía, espaciado |
| `_utilities.scss`  | Animaciones, skeletons y clases utilitarias                      |
| `_components.scss` | Clases globales: botones, tarjetas, inputs, badges, hojas…       |
| `_mixins.scss`     | Solo mixins: `nq-btn-gradient`, `nq-field-base`, `nq-nav-back`   |
| `_shell.scss`      | Mixin `nq-shell`: layout y tab bar flotante de los dos shells    |

`_components.scss` emite CSS, así que lo importa **solo** `styles.scss`. Una página que
lo haga `@use` duplica ese CSS en su estilo scopeado: usa `_mixins.scss`.

Componentes compartidos en `src/app/ui/shared/components/`: `nq-page-state`
(loading/error/empty/offline), `nq-workout-card` y los gráficos SVG inline
`nq-bar-chart`, `nq-line-chart` y `nq-ring-progress` — sin librerías de charts, con la
matemática aislada en `chart/chart-math.ts`.

El color primario es `#2cb5a0` y la tipografía es Inter. **Todo se declara con tokens
`--nq-*`**: si necesitas un color, una sombra o un radio, tómalo del token; no escribas el
valor literal en el componente.

## Cómo aportar

1. Lee [`CONTRIBUTING.md`](CONTRIBUTING.md) — ahí está el flujo completo: gitflow,
   nomenclatura de ramas, formato de commits y política de merge.
2. Elige un ticket de [`docs/BACKLOG.md`](docs/BACKLOG.md), donde el trabajo está
   descompuesto en épicas → historias → tickets. La regla es **1 ticket = 1 rama = 1 PR**.
3. Trabaja desde `develop` con una rama por ticket:

   ```bash
   git checkout develop
   git checkout -b feat/NEQUE-x.y.z-descripcion-corta
   ```

4. Commitea con [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat(scope): asunto`); commitlint lo valida en el hook de pre-commit.
5. Antes de abrir el PR, corre la secuencia de validación completa:

   ```bash
   npm run lint && npm run format:check && npm run typecheck && npm run test:coverage && npm run build:prod
   ```

6. Abre el PR contra `develop`. El check `ci-gate` debe quedar en verde para poder
   mergear: exige lint, formato, tipos, build y **cobertura mínima del 80% en líneas,
   sentencias, funciones y ramas**.

## Equipo

Proyecto académico de **DuocUC**.

Desarrollo: Kelvin A. Moreno ([@cosyfps](https://github.com/cosyfps))
