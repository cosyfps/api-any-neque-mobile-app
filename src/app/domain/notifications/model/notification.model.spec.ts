import { AppNotification, NOTIFICATION_KIND_LABEL, isUnread } from './notification.model';

const notification = (readAt: string | null): AppNotification => ({
  id: 'ntf-001',
  userId: 'usr-1',
  kind: 'routine',
  title: 'Título',
  body: 'Cuerpo',
  createdAt: '2026-09-17T10:00:00.000Z',
  readAt,
  targetType: null,
  targetId: null,
});

describe('notification model', () => {
  describe('isUnread()', () => {
    it('es no leida cuando readAt es null', () => {
      expect(isUnread(notification(null))).toBe(true);
    });

    it('es leida cuando tiene fecha', () => {
      expect(isUnread(notification('2026-09-17T11:00:00.000Z'))).toBe(false);
    });
  });

  it('cada tipo tiene etiqueta en espanol', () => {
    expect(Object.keys(NOTIFICATION_KIND_LABEL)).toHaveLength(6);
    expect(NOTIFICATION_KIND_LABEL.alert).toBe('Alerta');
    expect(NOTIFICATION_KIND_LABEL.session).toBe('Sesión');
  });
});
