import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SESSION_STORAGE_PORT } from '@app/domain/auth/port/session-storage.port';
import { NOTIFICATIONS_PORT } from '@app/domain/notifications/port/notifications.port';
import { PROGRESS_PHOTOS_PORT } from '@app/domain/progress/port/progress-photos.port';
import { EXERCISE_CATALOG_PORT, ROUTINES_PORT } from '@app/domain/routines/port/routines.port';
import { SCHEDULE_PORT } from '@app/domain/schedule/port/schedule.port';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { ASSESSMENTS_PORT } from '@app/domain/students/port/assessments.port';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { API_BASE_URL } from './http/api-client';
import { provideStudentData } from './student-providers';
import { provideTrainerData } from './trainer-providers';

describe.each([
  ['provideStudentData', provideStudentData],
  ['provideTrainerData', provideTrainerData],
])('%s', (_label, provide) => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        { provide: SESSION_STORAGE_PORT, useValue: { read: () => null } },
        { provide: CLOCK, useValue: { now: () => new Date() } },
        ...provide(),
      ],
    });
  });

  it.each([
    ['STUDENTS_PORT', STUDENTS_PORT],
    ['ASSESSMENTS_PORT', ASSESSMENTS_PORT],
    ['ROUTINES_PORT', ROUTINES_PORT],
    ['EXERCISE_CATALOG_PORT', EXERCISE_CATALOG_PORT],
    ['WORKOUTS_PORT', WORKOUTS_PORT],
    ['SCHEDULE_PORT', SCHEDULE_PORT],
    ['NOTIFICATIONS_PORT', NOTIFICATIONS_PORT],
  ])('resuelve %s', (_name, token) => {
    expect(TestBed.inject(token)).toBeDefined();
  });

  it('cada puerto resuelve a la misma instancia en toda la ruta', () => {
    expect(TestBed.inject(WORKOUTS_PORT)).toBe(TestBed.inject(WORKOUTS_PORT));
  });
});

describe('provideStudentData', () => {
  it('registra las fotos de progreso', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: API_BASE_URL, useValue: '/api/v1' },
        ...provideStudentData(),
      ],
    });
    expect(TestBed.inject(PROGRESS_PHOTOS_PORT)).toBeDefined();
  });
});
