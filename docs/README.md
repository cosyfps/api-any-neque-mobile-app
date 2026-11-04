# Documentación de Ñeque

Índice de la carpeta `docs/`. Las convenciones de trabajo están en
[`CONTRIBUTING.md`](../CONTRIBUTING.md) y la guía para Claude Code en
[`CLAUDE.md`](../CLAUDE.md).

## Producto

| Documento                          | Qué contiene                                |
| ---------------------------------- | ------------------------------------------- |
| [PRD](PRD.md)                      | Requisitos del producto                     |
| [Backlog](BACKLOG.md)              | Épicas, historias y tablero de tickets      |
| [Modelo de datos](modelo-datos.md) | Contrato front ↔ BFF                        |
| [Tickets](tickets/README.md)       | Un archivo por ticket, por épica e historia |

## Arquitectura y operación (monolito)

Leer en orden: cada documento asume el anterior.

| Documento                                                            | Qué contiene                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| [01 — Arquitectura monolítica](monolito/01-arquitectura-monolito.md) | Front, BFF y Supabase en un repo y un proyecto Vercel |
| [02 — Directrices del BFF](monolito/02-bff-directrices.md)           | Principios, framework, contrato y seguridad           |
| [03 — Directrices de Supabase](monolito/03-supabase-directrices.md)  | Esquema, RLS, funciones y storage                     |
| [04 — Despliegue en Vercel](monolito/04-vercel-despliegue.md)        | Build, variables y entornos                           |
| [05 — Backlog y roadmap](monolito/05-backlog-roadmap.md)             | Hitos hacia producción                                |
| [Parte 4 — Cierre](monolito/06-parte-4-cierre.md)                    | Cierre de la app (2026-11-03)                         |

## Auditorías

| Fecha      | Documento                                                                                |
| ---------- | ---------------------------------------------------------------------------------------- |
| 2026-09-18 | [Auditoría de la app del alumno](auditoria/2026-09-18-auditoria-app-alumno.md)           |
| 2026-09-18 | [Cierre de la Épica 11](auditoria/2026-09-18-cierre-epica-11.md)                         |
| 2026-11-02 | [Auditoría integral](auditoria/2026-11-02-auditoria-integral.md)                         |
| 2026-11-03 | [Auditoría QA + UX/UI](../QA_AUDIT_REPORT.md)                                            |
| 2026-11-03 | [Cambios de la auditoría (resumen)](auditoria/2026-11-03-cambios-auditoria.md)           |
| 2026-11-03 | [Interrogación de producto y pendientes](auditoria/2026-11-03-interrogacion-producto.md) |
| 2026-11-04 | [Plan de trabajo](auditoria/2026-11-04-plan-de-trabajo.md)                               |

## Planes

| Fecha      | Documento                                                                             |
| ---------- | ------------------------------------------------------------------------------------- |
| 2026-09-19 | [HU-11.6 y Épica 9](planes/2026-09-19-epica-9-y-hu-11.6.md)                           |
| 2026-09-25 | [Épica 12: cierre de brechas contra el PRD](planes/2026-09-25-epica-12-cierre-prd.md) |
