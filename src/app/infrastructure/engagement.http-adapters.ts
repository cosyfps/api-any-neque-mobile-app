import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, throwError } from 'rxjs';

import { Message } from '@app/domain/messages/model/message.model';
import { MessagesPort } from '@app/domain/messages/port/messages.port';
import { AppNotification } from '@app/domain/notifications/model/notification.model';
import { NotificationsPort } from '@app/domain/notifications/port/notifications.port';
import { ProgressPhoto } from '@app/domain/progress/model/progress-photo.model';
import { ProgressPhotosPort } from '@app/domain/progress/port/progress-photos.port';
import {
  CancelReason,
  ScheduledSession,
  ScheduledSessionInput,
} from '@app/domain/schedule/model/scheduled-session.model';
import { SchedulePort } from '@app/domain/schedule/port/schedule.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { DateRange } from '@app/domain/shared/model/date-range';
import { Id } from '@app/domain/shared/model/ids';

import { ApiClient } from './http/api-client';
import { isDataUrl, uploadImage } from './http/uploads';

const toVoid = map((): void => undefined);

@Injectable()
export class ProgressPhotosHttpAdapter implements ProgressPhotosPort {
  private readonly api = inject(ApiClient);

  listByStudent(studentId: Id): Observable<ProgressPhoto[]> {
    return this.api.get<ProgressPhoto[]>(`/students/${studentId}/photos`);
  }

  /** La foto llega como data URL: se sube a Storage y se registra con su clave. */
  add(input: Omit<ProgressPhoto, 'id'>): Observable<ProgressPhoto> {
    if (!isDataUrl(input.url)) {
      return throwError(() => domainError('validation', 'La foto no es válida.'));
    }
    const base = `/students/${input.studentId}/photos`;
    return uploadImage(this.api, `${base}/upload-url`, input.url).pipe(
      switchMap(path =>
        this.api.post<ProgressPhoto>(base, {
          path,
          angle: input.angle,
          takenAt: input.takenAt,
          weightKg: input.weightKg,
          note: input.note,
        }),
      ),
    );
  }

  remove(photoId: Id): Observable<void> {
    return this.api.delete<null>(`/photos/${photoId}`).pipe(toVoid);
  }
}

@Injectable()
export class ScheduleHttpAdapter implements SchedulePort {
  private readonly api = inject(ApiClient);

  listByStudent(studentId: Id, range: DateRange): Observable<ScheduledSession[]> {
    return this.api.get<ScheduledSession[]>(`/students/${studentId}/schedule`, {
      from: range.from,
      to: range.to,
    });
  }

  create(input: ScheduledSessionInput): Observable<ScheduledSession> {
    const { studentId, ...body } = input;
    return this.api.post<ScheduledSession>(`/students/${studentId}/schedule`, body);
  }

  listByTrainer(trainerId: Id, range: DateRange): Observable<ScheduledSession[]> {
    return this.api.get<ScheduledSession[]>(`/trainers/${trainerId}/schedule`, {
      from: range.from,
      to: range.to,
    });
  }

  reschedule(
    sessionId: Id,
    changes: Omit<ScheduledSessionInput, 'studentId'>,
  ): Observable<ScheduledSession> {
    return this.api.put<ScheduledSession>(`/schedule/${sessionId}`, changes);
  }

  confirm(sessionId: Id): Observable<ScheduledSession> {
    return this.api.post<ScheduledSession>(`/schedule/${sessionId}/confirm`);
  }

  cancel(sessionId: Id, reason: CancelReason, note: string | null): Observable<ScheduledSession> {
    return this.api.post<ScheduledSession>(`/schedule/${sessionId}/cancel`, { reason, note });
  }
}

/** Bandeja del usuario autenticado; el BFF la resuelve por el token. */
@Injectable()
export class NotificationsHttpAdapter implements NotificationsPort {
  private readonly api = inject(ApiClient);

  listByUser(_userId: Id): Observable<AppNotification[]> {
    return this.api.get<AppNotification[]>('/me/notifications');
  }

  markRead(notificationId: Id): Observable<AppNotification> {
    return this.api.post<AppNotification>(`/notifications/${notificationId}/read`);
  }

  markAllRead(_userId: Id): Observable<void> {
    return this.api.post<null>('/me/notifications/read-all').pipe(toVoid);
  }
}

/** Conversacion alumno-entrenador; el BFF sabe quien escribe por el token. */
@Injectable()
export class MessagesHttpAdapter implements MessagesPort {
  private readonly api = inject(ApiClient);

  list(studentId: Id): Observable<Message[]> {
    return this.api.get<Message[]>(`/students/${studentId}/messages`);
  }

  send(studentId: Id, body: string): Observable<Message> {
    return this.api.post<Message>(`/students/${studentId}/messages`, { body });
  }
}
