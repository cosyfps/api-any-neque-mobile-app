-- Buckets privados. Sin politicas en storage.objects: solo el BFF, con la
-- clave secreta, firma URLs de subida y de lectura.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('progress-photos', 'progress-photos', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('avatars', 'avatars', false, 2097152,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
