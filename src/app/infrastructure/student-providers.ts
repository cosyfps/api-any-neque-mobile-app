import { Provider } from '@angular/core';

import { NotificationsFacade } from '@app/application/notifications/notifications.facade';
import { ProgressFacade } from '@app/application/progress/progress.facade';
import { StudentRoutineFacade } from '@app/application/routines/student-routine.facade';
import { ScheduleFacade } from '@app/application/schedule/schedule.facade';
import { StudentProfileFacade } from '@app/application/students/student-profile.facade';
import { WorkoutSyncFacade } from '@app/application/workouts/workout-sync.facade';
import { WorkoutFacade } from '@app/application/workouts/workout.facade';
import { MESSAGES_PORT } from '@app/domain/messages/port/messages.port';
import { NOTIFICATIONS_PORT } from '@app/domain/notifications/port/notifications.port';
import { PROGRESS_PHOTOS_PORT } from '@app/domain/progress/port/progress-photos.port';
import { EXERCISE_CATALOG_PORT, ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { SCHEDULE_PORT } from '@app/domain/schedule/port/schedule.port';
import { ASSESSMENTS_PORT } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { TRAINERS_PORT } from '@app/domain/trainers/port/trainers.port';
import { WORKOUT_SYNC_PORT } from '@app/domain/workouts/port/workout-sync.port';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import {
  MessagesHttpAdapter,
  NotificationsHttpAdapter,
  ProgressPhotosHttpAdapter,
} from './engagement.http-adapters';
import {
  OfflineAssessmentsAdapter,
  OfflineRoutinesAdapter,
  OfflineScheduleAdapter,
  OfflineStudentsAdapter,
  OfflineTrainersAdapter,
} from './offline/offline-read.adapters';
import { OfflineWorkoutsAdapter } from './offline/offline-workouts.adapter';
import { ExerciseCatalogHttpAdapter } from './routines/routines.http-adapter';

/**
 * Puertos del shell del alumno contra el BFF.
 *
 * Se registran en `providers` de la ruta `/student` para que viajen en ese
 * chunk lazy. Las facades viven en este injector y no en el raiz: dependen
 * de los puertos de abajo, que solo existen dentro de /student.
 *
 * Las lecturas y el runner usan los adapters sin conexion (PRD §7.1).
 */
export function provideStudentData(): Provider[] {
  return [
    StudentProfileFacade,
    WorkoutFacade,
    StudentRoutineFacade,
    ProgressFacade,
    ScheduleFacade,
    NotificationsFacade,
    WorkoutSyncFacade,

    { provide: STUDENTS_PORT, useClass: OfflineStudentsAdapter },
    { provide: TRAINERS_PORT, useClass: OfflineTrainersAdapter },
    { provide: ASSESSMENTS_PORT, useClass: OfflineAssessmentsAdapter },
    { provide: ROUTINES_PORT, useClass: OfflineRoutinesAdapter },
    { provide: EXERCISE_CATALOG_PORT, useClass: ExerciseCatalogHttpAdapter },
    OfflineWorkoutsAdapter,
    { provide: WORKOUTS_PORT, useExisting: OfflineWorkoutsAdapter },
    { provide: WORKOUT_SYNC_PORT, useExisting: OfflineWorkoutsAdapter },
    { provide: PROGRESS_PHOTOS_PORT, useClass: ProgressPhotosHttpAdapter },
    { provide: SCHEDULE_PORT, useClass: OfflineScheduleAdapter },
    { provide: NOTIFICATIONS_PORT, useClass: NotificationsHttpAdapter },
    { provide: MESSAGES_PORT, useClass: MessagesHttpAdapter },
  ];
}
