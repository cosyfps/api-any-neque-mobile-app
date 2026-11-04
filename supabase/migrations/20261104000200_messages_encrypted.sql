-- El texto de los mensajes se guarda cifrado (AES-256-GCM, en el BFF).
--
-- `body` ya no es el texto sino `v1:` + base64(iv | tag | cifrado): un
-- mensaje de 1000 caracteres (hasta 4000 bytes en UTF-8) ocupa ~5400. El
-- limite de 1000 caracteres del texto lo sigue aplicando el BFF; aqui solo se
-- acota el tamaño de lo cifrado.
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages
  add constraint messages_body_check check (length(body) between 1 and 8000);

comment on column public.messages.body is
  'Texto cifrado por el BFF (AES-256-GCM, llave MESSAGES_KEY). Nunca texto en claro.';
