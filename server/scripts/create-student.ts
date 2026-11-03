import { existsSync } from 'node:fs';

import { isPasswordValid } from '@app/ui/shared/validators/password-rules';

import { createStudent } from '../application/people';
import { resolveActor } from '../http/context';
import { adminClient, must } from '../infrastructure/supabase';

/**
 * Alta manual de un alumno de pruebas, ya con contrasena.
 *
 *   STUDENT_PASSWORD='...' npm run create:student -- correo@dominio.cl Nombre Apellido correo-entrenador@dominio.cl
 *
 * Usa el mismo caso de uso que la app (`createStudent`), asi que el alumno
 * queda igual que uno dado de alta por su entrenador; la unica diferencia es
 * que la contrasena se fija aqui en vez de por la invitacion. La contrasena va
 * por variable de entorno para que no quede en el historial de la terminal.
 */
async function main(): Promise<void> {
  if (existsSync('.env.local')) {
    process.loadEnvFile('.env.local');
  }
  const [email, firstName, lastName, trainerEmail] = process.argv.slice(2);
  const password = process.env['STUDENT_PASSWORD'];
  if (
    email === undefined ||
    firstName === undefined ||
    lastName === undefined ||
    trainerEmail === undefined ||
    password === undefined
  ) {
    throw new Error(
      'Uso: STUDENT_PASSWORD=... npm run create:student -- <correo> <nombre> <apellido> <correo-entrenador>',
    );
  }
  // Las mismas reglas que exige el login: si no, el alumno no podria ingresar.
  if (!isPasswordValid(password)) {
    throw new Error('La contraseña necesita 8+ caracteres, una mayúscula, un número y un símbolo.');
  }

  const db = adminClient();
  const trainer = await must<{ id: string }>(
    db
      .from('profiles')
      .select('id')
      .eq('email', trainerEmail.trim().toLowerCase())
      .eq('role', 'trainer')
      .single(),
  ).catch(() => {
    throw new Error(`No hay un entrenador con el correo ${trainerEmail}.`);
  });

  const student = await createStudent(await resolveActor(trainer.id), {
    trainerId: '',
    firstName,
    lastName,
    email,
    phone: null,
    birthDate: null,
    heightCm: null,
    goal: null,
  });

  const row = await must<{ user_id: string }>(
    db.from('students').select('user_id').eq('id', student.id).single(),
  );
  const { error } = await db.auth.admin.updateUserById(row.user_id, { password });
  if (error !== null) {
    throw new Error(`Alumno creado, pero no se pudo fijar la contraseña: ${error.message}`);
  }
  console.warn(`Alumno creado: ${student.email} (entrenador: ${trainerEmail})`);
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
