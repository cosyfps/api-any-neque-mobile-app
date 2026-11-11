import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Routine } from '@app/domain/routines/model/routine.model';
import { ScheduledSession } from '@app/domain/schedule/model/scheduled-session.model';
import { DateRange } from '@app/domain/shared/model/date-range';
import { Id } from '@app/domain/shared/model/ids';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student } from '@app/domain/students/model/student.model';
import { Trainer } from '@app/domain/trainers/model/trainer.model';

import { ScheduleHttpAdapter } from '../engagement.http-adapters';
import { RoutinesHttpAdapter } from '../routines/routines.http-adapter';
import {
  AssessmentsHttpAdapter,
  StudentsHttpAdapter,
  TrainersHttpAdapter,
} from '../students/students.http-adapter';

import { withCache } from './offline-cache';

/*
 * Lecturas del alumno que se ven sin conexion: Inicio, Mi rutina, Agenda y
 * Perfil. Solo cambian las lecturas; las escrituras siguen pidiendo red.
 */

@Injectable()
export class OfflineRoutinesAdapter extends RoutinesHttpAdapter {
  override getActiveForStudent(studentId: Id): Observable<Routine | null> {
    return withCache(`routine.${studentId}`, super.getActiveForStudent(studentId));
  }
}

@Injectable()
export class OfflineStudentsAdapter extends StudentsHttpAdapter {
  override getById(studentId: Id): Observable<Student> {
    return withCache(`student.${studentId}`, super.getById(studentId));
  }
}

@Injectable()
export class OfflineTrainersAdapter extends TrainersHttpAdapter {
  override getById(trainerId: Id): Observable<Trainer> {
    return withCache(`trainer.${trainerId}`, super.getById(trainerId));
  }
}

@Injectable()
export class OfflineAssessmentsAdapter extends AssessmentsHttpAdapter {
  override listByStudent(studentId: Id): Observable<Assessment[]> {
    return withCache(`assessments.${studentId}`, super.listByStudent(studentId));
  }

  override latestByStudent(studentId: Id): Observable<Assessment | null> {
    return withCache(`assessment.${studentId}`, super.latestByStudent(studentId));
  }
}

@Injectable()
export class OfflineScheduleAdapter extends ScheduleHttpAdapter {
  override listByStudent(studentId: Id, range: DateRange): Observable<ScheduledSession[]> {
    return withCache(
      `schedule.${studentId}.${range.from}.${range.to}`,
      super.listByStudent(studentId, range),
    );
  }
}
