import { z } from 'zod';

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  /** Clave publica (`sb_publishable_…` o la `anon` heredada). Login y OTP. */
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /** Clave secreta (`sb_secret_…` o `service_role`). Nunca sale del servidor. */
  SUPABASE_SECRET_KEY: z.string().min(1),
  /** Origenes web extra permitidos por CORS, separados por coma. */
  ALLOWED_ORIGINS: z.string().default(''),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Variables del BFF, validadas una vez por instancia.
 *
 * Falla en la primera peticion con un mensaje claro si falta alguna, en vez
 * de romper a mitad de un flujo.
 */
export function env(): Env {
  if (cached === null) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map(issue => issue.path.join('.')).join(', ');
      throw new Error(`Variables de entorno invalidas: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}
