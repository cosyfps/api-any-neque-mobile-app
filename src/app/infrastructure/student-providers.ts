import { Provider } from '@angular/core';

import { NotificationsFacade } from '@app/application/notifications/notifications.facade';
import { ProgressFacade } from '@app/application/progress/progress.facade';
import { StudentRoutineFacade } from '@app/application/routines/student-routine.facade';
import { ScheduleFacade } from '@app/application/schedule/schedule.facade';
import { StudentProfileFacade } from '@app/application/students/student-profile.facade';
import { WorkoutFacade } from '@app/application/workouts/workout.facade';
import { NOTIFICATIONS_PORT } from '@app/domain/notifications/port/notifications.port';
import { PROGRESS_PHOTOS_PORT } from '@app/domain/progress/port/progress-photos.port';
import { EXERCISE_CATALOG_PORT, ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { SCHEDULE_PORT } from '@app/domain/schedule/port/schedule.port';
import { ASSESSMENTS_PORT } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { TRAINERS_PORT } from '@app/domain/trainers/port/trainers.port';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import {
  NotificationsHttpAdapter,
  ProgressPhotosHttpAdapter,
  ScheduleHttpAdapter,
} from './engagement.http-adapters';
import { ExerciseCatalogHttpAdapter, RoutinesHttpAdapter } from './routines/routines.http-adapter';
import {
  AssessmentsHttpAdapter,
  StudentsHttpAdapter,
  TrainersHttpAdapter,
} from './students/students.http-adapter';
import { WorkoutsHttpAdapter } from './workouts/workouts.http-adapter';

/**
 * Puertos del shell del alumno contra el BFF.
 *
 * Se registran en `providers` de la ruta `/student` para que viajen en ese
 * chunk lazy. Las facades viven en este injector y no en el raiz: dependen
 * de los puertos de abajo, que solo existen dentro de /student.
 */
export function provideStudentData(): Provider[] {
  return [
    StudentProfileFacade,
    WorkoutFacade,
    StudentRoutineFacade,
    ProgressFacade,
    ScheduleFacade,
    NotificationsFacade,

    { provide: STUDENTS_PORT, useClass: StudentsHttpAdapter },
    { provide: TRAINERS_PORT, useClass: TrainersHttpAdapter },
    { provide: ASSESSMENTS_PORT, useClass: AssessmentsHttpAdapter },
    { provide: ROUTINES_PORT, useClass: RoutinesHttpAdapter },
    { provide: EXERCISE_CATALOG_PORT, useClass: ExerciseCatalogHttpAdapter },
    { provide: WORKOUTS_PORT, useClass: WorkoutsHttpAdapter },
    { provide: PROGRESS_PHOTOS_PORT, useClass: ProgressPhotosHttpAdapter },
    { provide: SCHEDULE_PORT, useClass: ScheduleHttpAdapter },
    { provide: NOTIFICATIONS_PORT, useClass: NotificationsHttpAdapter },
  ];
}
