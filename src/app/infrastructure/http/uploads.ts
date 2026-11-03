import { Observable, from, map, switchMap } from 'rxjs';

import { domainError } from '@app/domain/shared/model/app-error';

import { ApiClient } from './api-client';

interface UploadTarget {
  readonly path: string;
  readonly uploadUrl: string;
}

/** Convierte el data URL que entregan los formularios en un Blob subible. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data = ''] = dataUrl.split(',', 2);
  const mime = /data:([^;]+)/.exec(header ?? '')?.[1] ?? 'image/jpeg';
  const bytes = atob(data);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    buffer[i] = bytes.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
}

export const isDataUrl = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.startsWith('data:');

/**
 * Sube una imagen directo a Storage con la URL firmada que entrega el BFF.
 * La foto nunca pasa por la funcion (su cuerpo tiene un limite de tamano).
 * Devuelve la clave del archivo en el bucket.
 */
export function uploadImage(api: ApiClient, endpoint: string, dataUrl: string): Observable<string> {
  const blob = dataUrlToBlob(dataUrl);
  return api.post<UploadTarget>(endpoint, { contentType: blob.type }).pipe(
    switchMap(target =>
      from(
        fetch(target.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': blob.type, 'x-upsert': 'false' },
          body: blob,
        }),
      ).pipe(
        map(response => {
          if (!response.ok) {
            throw domainError('unknown', 'No pudimos subir la imagen. Intenta de nuevo.');
          }
          return target.path;
        }),
      ),
    ),
  );
}
