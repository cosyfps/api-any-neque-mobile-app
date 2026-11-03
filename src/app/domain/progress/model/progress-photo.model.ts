import { Id, IsoDateString } from '@app/domain/shared/model/ids';

export type PhotoAngle = 'front' | 'side' | 'back';

/** Angulos en el orden en que se muestran. */
export const PHOTO_ANGLES: readonly PhotoAngle[] = ['front', 'side', 'back'];

export const PHOTO_ANGLE_LABEL: Record<PhotoAngle, string> = {
  front: 'Frente',
  side: 'Perfil',
  back: 'Espalda',
};

/** Foto de seguimiento que el alumno sube para comparar su evolucion. */
export interface ProgressPhoto {
  readonly id: Id;
  readonly studentId: Id;
  readonly takenAt: IsoDateString;
  readonly url: string;
  readonly angle: PhotoAngle;
  readonly weightKg: number | null;
  readonly note: string | null;
}

/** Un punto de una serie temporal para los graficos de progreso. */
export interface ProgressPoint {
  readonly date: Date;
  readonly value: number;
  readonly label: string;
}
