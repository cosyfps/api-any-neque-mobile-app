import { Injectable } from '@angular/core';

import { AuthSession } from '@app/domain/auth/model/auth-user.model';
import { SessionStoragePort } from '@app/domain/auth/port/session-storage.port';

import { clearCache } from '../offline/offline-cache';

const STORAGE_KEY = 'neque.session';

/**
 * Persiste la sesion en localStorage.
 *
 * Toda lectura y escritura va en try/catch: en modo privado, con el
 * almacenamiento bloqueado o dentro del WebView el acceso puede lanzar.
 * Ante cualquier fallo la app se comporta como si no hubiera sesion.
 */
@Injectable()
export class LocalStorageSessionAdapter implements SessionStoragePort {
  read(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }

  write(session: AuthSession): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Sesion solo en memoria: no hay nada mejor que hacer aqui.
    }
  }

  /** Cierra la sesion y borra la cache sin conexion, que tiene datos de salud. */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ver comentario de write().
    }
    clearCache();
  }
}
