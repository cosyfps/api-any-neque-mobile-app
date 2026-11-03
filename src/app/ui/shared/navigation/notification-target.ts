import { UserRole } from '@app/domain/auth/model/auth-user.model';
import { NotificationTarget } from '@app/domain/notifications/model/notification.model';
import { Id } from '@app/domain/shared/model/ids';

type Rutas = Partial<Record<NotificationTarget, (targetId: Id) => string[]>>;

/**
 * Traduce el destino de una notificacion a una ruta, segun el rol.
 *
 * El mapeo vive aqui y no en los datos a proposito: la base guarda
 * `targetType` + `targetId`, no conoce la navegacion del front. Si manana la
 * ruta de una entidad cambia, cambia en este archivo y en ninguno mas.
 *
 * Cada rol declara solo los destinos que tiene: un destino que no le
 * corresponde no abre nada en vez de mandarlo a una pantalla ajena.
 */
const RUTAS: Record<UserRole, Rutas> = {
  student: {
    routine: () => ['/student/routine'],
    session: targetId => ['/student/workout', targetId],
    assessment: () => ['/student/schedule'],
    photo: () => ['/student/progress'],
  },
  trainer: {
    student: targetId => ['/trainer/students', targetId],
  },
};

export function notificationRoute(
  targetType: NotificationTarget | null,
  targetId: Id | null,
  role: UserRole = 'student',
): string[] | null {
  if (targetType === null || targetId === null) {
    return null;
  }
  return RUTAS[role][targetType]?.(targetId) ?? null;
}
