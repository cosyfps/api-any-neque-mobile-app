import { Injectable, inject } from '@angular/core';
import { Observable, of, switchMap } from 'rxjs';

import { Id } from '@app/domain/shared/model/ids';
import { Anamnesis, AnamnesisInput } from '@app/domain/students/model/anamnesis.model';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { Student, StudentStatus } from '@app/domain/students/model/student.model';
import { AnamnesisPort } from '@app/domain/students/port/anamnesis.port';
import { AssessmentsPort } from '@app/domain/students/port/assessments.port';
import {
  StudentEditableFields,
  StudentInput,
  StudentSelfEditableFields,
  StudentsPort,
} from '@app/domain/students/port/students.port';
import { Trainer } from '@app/domain/trainers/model/trainer.model';
import { TrainerEditableFields, TrainersPort } from '@app/domain/trainers/port/trainers.port';

import { ApiClient } from '../http/api-client';
import { isDataUrl, uploadImage } from '../http/uploads';

/**
 * Cambios con avatar: si llega como data URL (recien elegido en el telefono)
 * se sube primero a Storage y el BFF recibe solo su clave.
 */
function withAvatar<T extends { avatarUrl?: string | null }>(
  api: ApiClient,
  changes: T,
): Observable<Omit<T, 'avatarUrl'> & { avatarPath?: string }> {
  const { avatarUrl, ...rest } = changes;
  if (!isDataUrl(avatarUrl)) {
    return of(rest);
  }
  return uploadImage(api, '/me/avatar/upload-url', avatarUrl).pipe(
    switchMap(avatarPath => of({ ...rest, avatarPath })),
  );
}

@Injectable()
export class StudentsHttpAdapter implements StudentsPort {
  private readonly api = inject(ApiClient);

  getById(studentId: Id): Observable<Student> {
    return this.api.get<Student>(`/students/${studentId}`);
  }

  listByTrainer(trainerId: Id): Observable<Student[]> {
    return this.api.get<Student[]>(`/trainers/${trainerId}/students`);
  }

  update(studentId: Id, changes: Partial<StudentSelfEditableFields>): Observable<Student> {
    return withAvatar(this.api, changes).pipe(
      switchMap(body => this.api.patch<Student>(`/students/${studentId}/self`, body)),
    );
  }

  create(input: StudentInput): Observable<Student> {
    return this.api.post<Student>('/students', input);
  }

  edit(studentId: Id, changes: Partial<StudentEditableFields>): Observable<Student> {
    return this.api.patch<Student>(`/students/${studentId}`, changes);
  }

  setStatus(studentId: Id, status: StudentStatus): Observable<Student> {
    return this.api.put<Student>(`/students/${studentId}/status`, { status });
  }
}

@Injectable()
export class AnamnesisHttpAdapter implements AnamnesisPort {
  private readonly api = inject(ApiClient);

  getByStudent(studentId: Id): Observable<Anamnesis | null> {
    return this.api.get<Anamnesis | null>(`/students/${studentId}/anamnesis`);
  }

  save(input: AnamnesisInput): Observable<Anamnesis> {
    return this.api.put<Anamnesis>(`/students/${input.studentId}/anamnesis`, input);
  }
}

@Injectable()
export class AssessmentsHttpAdapter implements AssessmentsPort {
  private readonly api = inject(ApiClient);

  listByStudent(studentId: Id): Observable<Assessment[]> {
    return this.api.get<Assessment[]>(`/students/${studentId}/assessments`);
  }

  latestByStudent(studentId: Id): Observable<Assessment | null> {
    return this.api.get<Assessment | null>(`/students/${studentId}/assessments/latest`);
  }

  create(input: Omit<Assessment, 'id' | 'takenAt'>): Observable<Assessment> {
    return this.api.post<Assessment>(`/students/${input.studentId}/assessments`, input);
  }
}

@Injectable()
export class TrainersHttpAdapter implements TrainersPort {
  private readonly api = inject(ApiClient);

  getById(trainerId: Id): Observable<Trainer> {
    return this.api.get<Trainer>(`/trainers/${trainerId}`);
  }

  update(trainerId: Id, changes: Partial<TrainerEditableFields>): Observable<Trainer> {
    return withAvatar(this.api, changes).pipe(
      switchMap(body => this.api.patch<Trainer>(`/trainers/${trainerId}`, body)),
    );
  }
}
