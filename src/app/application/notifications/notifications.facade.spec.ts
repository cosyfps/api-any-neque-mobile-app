import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { AppNotification } from '@app/domain/notifications/model/notification.model';
import {
  NOTIFICATIONS_PORT,
  NotificationsPort,
} from '@app/domain/notifications/port/notifications.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { addDays, toIsoDate } from '@app/domain/shared/model/date';
import { CLOCK } from '@app/domain/shared/port/clock.port';

import { fn, MockOf } from '@testing/typed-mock';

import { NotificationsFacade } from './notifications.facade';

const NOW = new Date(2026, 8, 17, 12, 0, 0);

const notification = (id: string, daysAgo: number, read: boolean): AppNotification => ({
  id,
  userId: 'usr-1',
  kind: 'routine',
  title: `Título ${id}`,
  body: 'Cuerpo',
  createdAt: toIsoDate(addDays(NOW, -daysAgo)),
  readAt: read ? toIsoDate(NOW) : null,
  targetType: null,
  targetId: null,
});

const ITEMS: AppNotification[] = [
  notification('hoy-1', 0, false),
  notification('hoy-2', 0, false),
  notification('semana', 3, true),
  notification('antigua', 30, true),
];

describe('NotificationsFacade', () => {
  let listByUser: MockOf<NotificationsPort['listByUser']>;
  let markRead: MockOf<NotificationsPort['markRead']>;
  let markAllRead: MockOf<NotificationsPort['markAllRead']>;
  let userId: string | null;

  const build = (): NotificationsFacade => {
    TestBed.configureTestingModule({
      providers: [
        NotificationsFacade,
        { provide: CLOCK, useValue: { now: () => NOW } },
        {
          provide: SessionFacade,
          useValue: { user: () => (userId === null ? null : { id: userId }) },
        },
        { provide: NOTIFICATIONS_PORT, useValue: { listByUser, markRead, markAllRead } },
      ],
    });
    return TestBed.inject(NotificationsFacade);
  };

  beforeEach(() => {
    listByUser = fn<NotificationsPort['listByUser']>().mockReturnValue(of(ITEMS));
    markRead = fn<NotificationsPort['markRead']>();
    markAllRead = fn<NotificationsPort['markAllRead']>().mockReturnValue(of(undefined));
    userId = 'usr-1';
  });

  describe('load()', () => {
    it('consulta el puerto con el id del usuario', () => {
      build().load();
      expect(listByUser).toHaveBeenCalledWith('usr-1');
    });

    it('no consulta nada sin sesion', () => {
      userId = null;
      build().load();
      expect(listByUser).not.toHaveBeenCalled();
    });

    it('queda en empty sin notificaciones', () => {
      listByUser.mockReturnValue(of([]));
      const facade = build();
      facade.load();

      expect(facade.viewState()).toBe('empty');
    });

    it('queda en error si el puerto falla', () => {
      listByUser.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(facade.viewState()).toBe('error');
    });
  });

  describe('unreadCount()', () => {
    it('cuenta solo las no leidas', () => {
      const facade = build();
      facade.load();

      expect(facade.unreadCount()).toBe(2);
      expect(facade.hasUnread()).toBe(true);
    });

    it('es cero con todo leido', () => {
      listByUser.mockReturnValue(of(ITEMS.map(item => ({ ...item, readAt: toIsoDate(NOW) }))));
      const facade = build();
      facade.load();

      expect(facade.unreadCount()).toBe(0);
      expect(facade.hasUnread()).toBe(false);
    });
  });

  describe('groups()', () => {
    it('agrupa en hoy, esta semana y antes', () => {
      const facade = build();
      facade.load();

      expect(facade.groups().map(group => group.label)).toEqual(['Hoy', 'Esta semana', 'Antes']);
    });

    it('pone las de hoy en el primer grupo', () => {
      const facade = build();
      facade.load();

      expect(facade.groups()[0]?.items.map(item => item.id)).toEqual(['hoy-1', 'hoy-2']);
    });

    it('omite los grupos vacios', () => {
      listByUser.mockReturnValue(of([notification('sola', 0, false)]));
      const facade = build();
      facade.load();

      expect(facade.groups()).toHaveLength(1);
    });

    it('manda al grupo antiguo lo que no se puede fechar', () => {
      listByUser.mockReturnValue(
        of([{ ...ITEMS[0], createdAt: 'no-es-fecha' } as AppNotification]),
      );
      const facade = build();
      facade.load();

      expect(facade.groups()[0]?.label).toBe('Antes');
    });
  });

  describe('markRead()', () => {
    it('actualiza la notificacion en la lista', async () => {
      const read: AppNotification = { ...(ITEMS[0] as AppNotification), readAt: toIsoDate(NOW) };
      markRead.mockReturnValue(of(read));

      const facade = build();
      facade.load();
      const ok = await facade.markRead('hoy-1');

      expect(ok).toBe(true);
      expect(facade.unreadCount()).toBe(1);
    });

    it('devuelve false si el puerto falla', async () => {
      markRead.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(await facade.markRead('hoy-1')).toBe(false);
    });
  });

  describe('markAllRead()', () => {
    it('deja el contador en cero', async () => {
      const facade = build();
      facade.load();

      const ok = await facade.markAllRead();

      expect(ok).toBe(true);
      expect(facade.unreadCount()).toBe(0);
    });

    it('devuelve false sin sesion', async () => {
      userId = null;
      expect(await build().markAllRead()).toBe(false);
    });

    it('devuelve false si el puerto falla', async () => {
      markAllRead.mockReturnValue(throwError(() => domainError('network')));
      const facade = build();
      facade.load();

      expect(await facade.markAllRead()).toBe(false);
    });
  });

  describe('reload()', () => {
    it('vuelve a consultar el puerto', () => {
      const facade = build();
      facade.load();
      facade.reload();

      expect(listByUser).toHaveBeenCalledTimes(2);
    });
  });
});
