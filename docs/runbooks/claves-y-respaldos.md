# Runbook — Claves y respaldos

Procedimientos para los hallazgos S-1, S-3 y S-4 de la
[auditoría completa](../auditoria/2026-11-04-auditoria-completa.md). Son pasos
manuales en los paneles de Supabase y Vercel: nadie más que el dueño del
proyecto tiene acceso a ellos.

> Ninguna clave se pega en chats, tickets ni commits. Si una clave aparece
> en un lugar así, se trata como comprometida y se rota.

## 1. Rotar `SUPABASE_SECRET_KEY` (S-1)

La clave secreta da acceso total a la base saltándose RLS. La actual se
expuso en un chat el 3 de noviembre de 2026: **rotarla cuanto antes**.

Tiempo estimado: 10 minutos. La app sigue funcionando durante el cambio
porque la clave vieja se revoca al final.

1. **Crear la nueva.** Supabase → proyecto → _Project Settings_ → _API Keys_ →
   _Secret keys_ → **Create new secret key**. Nombre sugerido:
   `bff-vercel-2026-11`. Copiarla (solo se muestra una vez).
2. **Vercel.** _Settings_ → _Environment Variables_ → `SUPABASE_SECRET_KEY` →
   _Edit_ en **Production** y **Preview**, marcada como _Sensitive_. Guardar.
3. **Redesplegar.** _Deployments_ → último de `develop` → _Redeploy_ (las
   variables solo se leen al desplegar).
4. **Local.** Reemplazar el valor en `.env.local` y reiniciar `npm run dev:api`.
5. **Comprobar** antes de revocar la vieja:

   ```bash
   curl -s https://neque-ten.vercel.app/api/v1/health
   ```

   Debe responder 200, y el login en la app debe funcionar.

6. **Revocar la vieja.** Volver a _API Keys_ → _Secret keys_ → la clave
   anterior → **Delete**. Si quedaba la `service_role` heredada en uso,
   deshabilitar las claves heredadas (_Legacy API keys_ → _Disable_).
7. Registrar la fecha de rotación al final de este archivo.

## 2. Respaldar `MESSAGES_KEY` (S-4)

Con ella se cifra el texto de los mensajes (AES-256-GCM). **Si se pierde, los
mensajes guardados no se pueden recuperar.**

1. Abrir `.env.local`, copiar el valor de `MESSAGES_KEY`.
2. Guardarlo en un gestor de contraseñas (1Password, Bitwarden, Llavero de
   iCloud) como «Ñeque — MESSAGES_KEY (producción)».
3. Comprobar que el valor en Vercel (_Production_ y _Preview_) es el mismo.

**Rotación.** Hoy no hay rotación automática: cambiar la llave deja ilegibles
los mensajes anteriores. Si hiciera falta rotarla (por ejemplo, si se filtra),
el procedimiento es agregar un prefijo `v2:` con la llave nueva en
`server/infrastructure/message-cipher.ts`, descifrar con la vieja los `v1:` y
re-cifrarlos en un script. Pedirlo como tarea antes de hacerlo.

## 3. Respaldos de la base (S-3)

Hoy no hay respaldo: la limpieza del 4 de noviembre fue irreversible.

### Opción A — Plan Pro de Supabase (recomendada)

Incluye respaldos diarios con 7 días de retención y, como complemento, PITR
(restaurar a cualquier minuto). _Project Settings_ → _Billing_ → Pro, y luego
_Database_ → _Backups_ para verificar que aparezca el primero al día
siguiente.

### Opción B — Dump manual (plan gratuito)

Requiere la contraseña de la base (_Project Settings_ → _Database_ →
_Connection string_, modo **Session**). Desde una terminal con PostgreSQL 15+:

```bash
pg_dump "postgresql://postgres.<ref>:<password>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" --schema=public --format=custom --file=neque-$(date +%F).dump
```

Guardar el archivo **fuera del repositorio** (contiene datos de salud) en un
almacenamiento cifrado. Repetir al menos una vez por semana y antes de
cualquier limpieza o migración grande.

Las fotos de progreso viven en Storage (bucket `progress-photos`) y **no**
entran en el dump: se respaldan aparte desde el panel o con la CLI de
Supabase.

### Probar la restauración

Un respaldo que nunca se restauró no está probado. Una vez al mes, restaurar
el último dump en un proyecto de pruebas:

```bash
pg_restore --clean --if-exists --no-owner --dbname="<connection string del proyecto de pruebas>" neque-AAAA-MM-DD.dump
```

y comprobar que la app, apuntando a ese proyecto, muestra los alumnos y
rutinas.

## Registro

| Fecha | Acción | Quién |
| ----- | ------ | ----- |
|       |        |       |
