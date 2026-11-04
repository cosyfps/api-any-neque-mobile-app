-- Mensajes entre entrenador y alumno (A-4).
--
-- Una conversacion por alumno: la identifica `student_id` y la comparten el
-- alumno y su entrenador. El BFF resuelve quien escribe desde el JWT y guarda
-- su rol en `sender_role`; `read_at` marca cuando lo leyo la otra parte.
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id),
  trainer_id  uuid not null references public.trainers (id),
  sender_role text not null check (sender_role in ('trainer', 'student')),
  body        text not null check (length(trim(body)) between 1 and 1000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index messages_conversation_idx on public.messages (student_id, created_at);

-- Igual que el resto del esquema: RLS habilitado y cerrado; solo el BFF
-- (service_role) lee y escribe.
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant all on public.messages to service_role;

-- Las notificaciones de un mensaje abren la conversacion.
alter type public.target_type add value if not exists 'message';
