import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { Id } from '@app/domain/shared/model/ids';

import { Student, StudentStatus } from '../model/student.model';

/**
 * Campos que el propio alumno puede actualizar desde su perfil. Estatura y
 * objetivo no: los define el entrenador.
 */
export type StudentSelfEditableFields = Pick<
  Student,
  'firstName' | 'lastName' | 'phone' | 'avatarUrl'
>;

/** Datos con los que el entrenador da de alta a un alumno. */
export type StudentInput = Pick<
  Student,
  'trainerId' | 'firstName' | 'lastName' | 'email' | 'phone' | 'birthDate' | 'heightCm' | 'goal'
>;

/** Campos que el entrenador puede corregir de la ficha. */
export type StudentEditableFields = Omit<StudentInput, 'trainerId' | 'email'>;

/**
 * Acceso a alumnos.
 *
 * `create`, `edit` y `setStatus` los agrego la Epica 9: el backlog daba por
 * hecho que el puerto ya los tenia y no era cierto.
 */
export interface StudentsPort {
  getById(studentId: Id): Observable<Student>;
  listByTrainer(trainerId: Id): Observable<Student[]>;
  update(studentId: Id, changes: Partial<StudentSelfEditableFields>): Observable<Student>;
  /** Alta del alumno. Falla con `duplicate` si el correo ya existe. */
  create(input: StudentInput): Observable<Student>;
  /** Edicion desde la ficha del entrenador. */
  edit(studentId: Id, changes: Partial<StudentEditableFields>): Observable<Student>;
  /** Suspende o reactiva. El alumno nunca se elimina. */
  setStatus(studentId: Id, status: StudentStatus): Observable<Student>;
}

export const STUDENTS_PORT = new InjectionToken<StudentsPort>('StudentsPort');
