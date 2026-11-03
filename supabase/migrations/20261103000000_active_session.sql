-- Una sola sesión activa por cuenta.
--
-- Cada vez que alguien abre sesión (login, invitación o recuperación) el BFF
-- guarda aquí el `session_id` del token de Supabase. Una petición o un
-- refresh con otro `session_id` se rechaza con `session_replaced`: el otro
-- dispositivo queda fuera. `null` = la cuenta aún no abrió sesión con esta
-- regla y no se aplica hasta su próximo ingreso.
alter table public.profiles
  add column if not exists active_session_id uuid;

comment on column public.profiles.active_session_id is
  'Sesión de Supabase Auth vigente; las demás se rechazan en el BFF.';
