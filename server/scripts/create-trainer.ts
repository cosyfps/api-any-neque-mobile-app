import { existsSync } from 'node:fs';

import { adminClient } from '../infrastructure/supabase';

/**
 * Alta manual de un entrenador (el PRD lo deja fuera de la app).
 *
 *   TRAINER_PASSWORD='...' npm run create:trainer -- correo@dominio.cl Nombre Apellido
 *
 * La contrasena va por variable de entorno para que no quede en el
 * historial de la terminal.
 */
async function main(): Promise<void> {
  if (existsSync('.env.local')) {
    process.loadEnvFile('.env.local');
  }
  const [email, firstName, lastName = ''] = process.argv.slice(2);
  const password = process.env['TRAINER_PASSWORD'];
  if (email === undefined || firstName === undefined || password === undefined) {
    throw new Error(
      'Uso: TRAINER_PASSWORD=... npm run create:trainer -- <correo> <nombre> [apellido]',
    );
  }

  const db = adminClient();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await db.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
    app_metadata: { role: 'trainer' },
  });
  if (error !== null) {
    throw new Error(`No se pudo crear el usuario: ${error.message}`);
  }
  const userId = data.user.id;

  const profile = await db.from('profiles').insert({
    id: userId,
    role: 'trainer',
    email: normalized,
    display_name: `${firstName} ${lastName}`.trim(),
  });
  const trainer =
    profile.error === null
      ? await db
          .from('trainers')
          .insert({ user_id: userId, first_name: firstName, last_name: lastName })
      : profile;
  if (trainer.error !== null) {
    await db.auth.admin.deleteUser(userId);
    throw new Error(`No se pudo crear el perfil: ${trainer.error.message}`);
  }
  console.warn(`Entrenador creado: ${normalized}`);
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
