import { Provider } from '@angular/core';

import { NotificationsFacade } from '@app/application/notifications/notifications.facade';
import { INVITATION_PORT } from '@app/domain/auth/port/invitation.port';
import { NOTIFICATIONS_PORT } from '@app/domain/notifications/port/notifications.port';
import { EXERCISE_CATALOG_PORT, ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { SCHEDULE_PORT } from '@app/domain/schedule/port/schedule.port';
import { ANAMNESIS_PORT } from '@app/domain/students/port/anamnesis.port';
import { ASSESSMENTS_PORT } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { TRAINERS_PORT } from '@app/domain/trainers/port/trainers.port';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { InvitationHttpAdapter } from './auth/auth.http-adapter';
import { NotificationsHttpAdapter, ScheduleHttpAdapter } from './engagement.http-adapters';
import { ExerciseCatalogHttpAdapter, RoutinesHttpAdapter } from './routines/routines.http-adapter';
import {
  AnamnesisHttpAdapter,
  AssessmentsHttpAdapter,
  StudentsHttpAdapter,
  TrainersHttpAdapter,
} from './students/students.http-adapter';
import { WorkoutsHttpAdapter } from './workouts/workouts.http-adapter';

/**
 * Puertos del shell del entrenador contra el BFF, en el chunk lazy de
 * `/trainer`.
 */
export function provideTrainerData(): Provider[] {
  return [
    // Una sola instancia para el inicio (la campana) y la pantalla de
    // notificaciones: leer en una se ve en la otra.
    NotificationsFacade,

    { provide: TRAINERS_PORT, useClass: TrainersHttpAdapter },
    { provide: STUDENTS_PORT, useClass: StudentsHttpAdapter },
    { provide: INVITATION_PORT, useClass: InvitationHttpAdapter },
    { provide: ANAMNESIS_PORT, useClass: AnamnesisHttpAdapter },
    { provide: ASSESSMENTS_PORT, useClass: AssessmentsHttpAdapter },
    { provide: ROUTINES_PORT, useClass: RoutinesHttpAdapter },
    { provide: EXERCISE_CATALOG_PORT, useClass: ExerciseCatalogHttpAdapter },
    { provide: WORKOUTS_PORT, useClass: WorkoutsHttpAdapter },
    { provide: SCHEDULE_PORT, useClass: ScheduleHttpAdapter },
    { provide: NOTIFICATIONS_PORT, useClass: NotificationsHttpAdapter },
  ];
}
