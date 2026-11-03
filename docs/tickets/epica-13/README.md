# Épica 13 — QA en dispositivo (releases 0.0.x)

Registra, en orden, lo que salió de probar cada IPA en un iPhone 12 Pro. Cada ticket es
un commit de la release, así que el hash del ticket lleva directo al cambio.

| Historia                                               | Release       | Tickets | Estado                   |
| ------------------------------------------------------ | ------------- | ------: | ------------------------ |
| [HU-13.1 — Primera IPA](hu-13.1/)                      | release 0.0.1 |       1 | Terminado                |
| [HU-13.2 — QA de la IPA 0.0.1](hu-13.2/)               | release 0.0.2 |       8 | Terminado                |
| [HU-13.3 — Rutinas compartidas](hu-13.3/)              | release 0.0.3 |       3 | Terminado                |
| [HU-13.4 — Login y ajustes en iPhone 12 Pro](hu-13.4/) | release 0.0.3 |      10 | Terminado                |
| [HU-13.5 — Mejoras para la IPA 0.0.4](hu-13.5/)        | release 0.0.4 |       8 | Terminado · PR pendiente |

> La épica nació después de los hechos: las releases 0.0.1 a 0.0.3 se publicaron sin
> actualizar este repositorio documental. Se registró el 2026-09-27, junto con la 0.0.4,
> siguiendo el historial de git.

## Decisiones que dejó la épica

| Decisión                                    | Por qué                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Viewport sin zoom y campos de 16px          | Regla global de la skill `auditoria-component`; 16px evita el auto-zoom. |
| Sin pull-to-refresh                         | Su indicador aparecía en todas las páginas de la IPA.                    |
| Sin selección de texto fuera de los campos  | Un toque largo sobre la interfaz se sentía de web.                       |
| El botón de ingresar siempre habilitado     | Un botón deshabilitado no explica qué falta; valida al tocarlo.          |
| La rutina es una plantilla con asignaciones | La misma rutina sirve a varios alumnos con fechas propias.               |
| El botón flotante lo pinta el shell         | Un `position: fixed` dentro del scroll de iOS se movía con el contenido. |
