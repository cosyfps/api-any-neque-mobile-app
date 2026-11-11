import { Observable, catchError, of, tap, throwError } from 'rxjs';

import { DomainError } from '@app/domain/shared/model/app-error';

const PREFIX = 'neque.cache.';

/**
 * Ultima respuesta conocida de cada lectura, para mostrarla sin conexion.
 *
 * Vive en localStorage con todo acceso en try/catch, igual que la sesion:
 * si el almacenamiento falla, la app solo pierde el modo sin conexion.
 */
export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Sin espacio o bloqueado: la lectura sigue funcionando en linea.
  }
}

/** Borra toda la cache. Se llama al cerrar sesion: son datos de salud. */
export function clearCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX) === true) {
        keys.push(key);
      }
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ver comentario de writeCache().
  }
}

/** Sin red, timeout o servicio caido: lo unico que justifica usar la cache. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof DomainError && error.code === 'network';
}

/**
 * Guarda cada respuesta exitosa y, si la peticion falla por red, entrega la
 * ultima guardada. Cualquier otro error se propaga tal cual.
 */
export function withCache<T>(key: string, source: Observable<T>): Observable<T> {
  return source.pipe(
    tap(value => writeCache(key, value)),
    catchError((error: unknown) => {
      const cached = isNetworkError(error) ? readCache<T>(key) : null;
      return cached === null ? throwError(() => error) : of(cached);
    }),
  );
}
