import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Telefono opcional: digitos y espacios, con + inicial, 8 a 16 caracteres. */
export const PHONE_PATTERN = /^\+?[0-9 ]{8,16}$/;

/**
 * Obligatorio que no se conforma con espacios: "   " no es un nombre.
 *
 * Devuelve `required` para que los mensajes que ya preguntan por esa clave
 * sigan sirviendo.
 */
export const notBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim() === '' ? { required: true } : null;

/**
 * Fecha `yyyy-MM-dd` dentro de un rango, inclusive. Vacio es valido: lo
 * obligatorio lo decide otro validador.
 *
 * Los limites se piden en cada validacion porque "hoy" cambia mientras el
 * formulario sigue abierto.
 */
export function dateBetween(min: () => string, max: () => string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value === '') {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { date: true };
    }
    // `yyyy-MM-dd` se ordena igual como texto que como fecha.
    return value < min() || value > max() ? { dateRange: true } : null;
  };
}

/** `yyyy-MM-dd` en la zona horaria local, la que entiende `<input type="date">`. */
export function localIsoDay(date: Date): string {
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${dos(date.getMonth() + 1)}-${dos(date.getDate())}`;
}

/** Formatos de imagen que acepta el BFF al pedir una URL de subida. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;

/** Valor de `accept` para los `<input type="file">` de fotos. */
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

/** Tope de una foto antes de subirla. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Mensaje para una foto que el BFF rechazaria, o null si sirve. Con
 * `image/*` un GIF pasaba el selector y volvia del servidor como un 400.
 */
export function imageFileError(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Elige una foto JPG, PNG, WebP o HEIC.';
  }
  return file.size > MAX_IMAGE_BYTES ? 'La foto pesa más de 8 MB. Elige otra.' : null;
}

/**
 * Acota un numero escrito a mano: lo redondea a entero si hace falta y lo
 * deja dentro del rango. Null si no es un numero.
 */
export function clampNumber(
  value: number,
  min: number,
  max: number,
  integer = true,
): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const redondeado = integer ? Math.round(value) : value;
  return Math.min(max, Math.max(min, redondeado));
}
