import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { DateRange } from '@app/domain/shared/model/date-range';
import { Id } from '@app/domain/shared/model/ids';

import {
  CancelReason,
  ScheduledSession,
  ScheduledSessionInput,
} from '../model/scheduled-session.model';

export interface SchedulePort {
  listByStudent(studentId: Id, range: DateRange): Observable<ScheduledSession[]>;
  /** Agenda global: citas de todos los alumnos del entrenador. */
  listByTrainer(trainerId: Id, range: DateRange): Observable<ScheduledSession[]>;
  /** El entrenador agenda una cita; nace pendiente y se le avisa al alumno. */
  create(input: ScheduledSessionInput): Observable<ScheduledSession>;
  /** El entrenador mueve la cita; vuelve a quedar por confirmar. */
  reschedule(
    sessionId: Id,
    changes: Omit<ScheduledSessionInput, 'studentId'>,
  ): Observable<ScheduledSession>;
  confirm(sessionId: Id): Observable<ScheduledSession>;
  /** `note` acompana al motivo; es obligatoria de facto cuando es `other`. */
  cancel(sessionId: Id, reason: CancelReason, note: string | null): Observable<ScheduledSession>;
}

export const SCHEDULE_PORT = new InjectionToken<SchedulePort>('SchedulePort');
