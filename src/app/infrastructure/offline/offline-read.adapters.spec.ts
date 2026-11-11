import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../http/api-client';

import {
  OfflineAssessmentsAdapter,
  OfflineRoutinesAdapter,
  OfflineScheduleAdapter,
  OfflineStudentsAdapter,
  OfflineTrainersAdapter,
} from './offline-read.adapters';

const BASE = '/api/v1';
const RANGE = { from: '2026-11-01', to: '2026-11-30' };

describe('lecturas sin conexion del alumno', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        OfflineRoutinesAdapter,
        OfflineStudentsAdapter,
        OfflineTrainersAdapter,
        OfflineAssessmentsAdapter,
        OfflineScheduleAdapter,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  const cases: [string, () => Observable<unknown>][] = [
    ['rutina vigente', () => TestBed.inject(OfflineRoutinesAdapter).getActiveForStudent('s1')],
    ['ficha', () => TestBed.inject(OfflineStudentsAdapter).getById('s1')],
    ['entrenador', () => TestBed.inject(OfflineTrainersAdapter).getById('t1')],
    ['evaluaciones', () => TestBed.inject(OfflineAssessmentsAdapter).listByStudent('s1')],
    ['ultima evaluacion', () => TestBed.inject(OfflineAssessmentsAdapter).latestByStudent('s1')],
    ['agenda', () => TestBed.inject(OfflineScheduleAdapter).listByStudent('s1', RANGE)],
  ];

  it.each(cases)('%s: sin red muestra lo ultimo que se vio', async (_name, call) => {
    const online = firstValueFrom(call());
    const [req] = http.match(() => true);
    req?.flush({ id: 'x' });
    await online;

    const sinRed = firstValueFrom(call());
    http
      .match(() => true)
      .forEach(pending => pending.error(new ProgressEvent('error'), { status: 0 }));
    await expect(sinRed).resolves.toEqual({ id: 'x' });
  });
});
