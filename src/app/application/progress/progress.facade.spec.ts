import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { ProgressPhoto } from '@app/domain/progress/model/progress-photo.model';
import {
  PROGRESS_PHOTOS_PORT,
  ProgressPhotosPort,
} from '@app/domain/progress/port/progress-photos.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { toIsoDate } from '@app/domain/shared/model/date';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { ASSESSMENTS_PORT, AssessmentsPort } from '@app/domain/students/port/assessments.port';
import { WorkoutSession, WorkoutStatus } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { ProgressFacade } from './progress.facade';

const assessment = (id: string, takenAt: string, weightKg: number): Assessment => ({
  id,
  studentId: 'std-001',
  takenAt,
  weightKg,
  heightCm: 165,
  bodyFatPct: null,
  muscleMassKg: null,
  measurements: { chestCm: null, waistCm: null, hipCm: null, armCm: null, thighCm: null },
  notes: null,
});

const ASSESSMENTS: Assessment[] = [
  assessment('a3', '2026-09-07T10:00:00.000Z', 58.9),
  assessment('a1', '2026-03-05T10:00:00.000Z', 61.4),
  assessment('a2', '2026-06-04T10:00:00.000Z', 60.2),
];

const photo = (id: string, takenAt: string, angle: ProgressPhoto['angle']): ProgressPhoto => ({
  id,
  studentId: 'std-001',
  takenAt,
  url: `data:image/svg+xml;utf8,<svg id="${id}"/>`,
  angle,
  weightKg: null,
  note: null,
});

const PHOTOS: ProgressPhoto[] = [
  photo('p1', '2026-03-05T09:00:00.000Z', 'front'),
  photo('p2', '2026-03-05T09:01:00.000Z', 'side'),
  photo('p3', '2026-09-07T09:00:00.000Z', 'front'),
];

const workout = (id: string, status: WorkoutStatus): WorkoutSession => ({
  id,
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-001',
  title: 'Sesión',
  scheduledFor: toIsoDate(new Date(2026, 8, 14, 18)),
  startedAt: null,
  completedAt: null,
  status,
  durationMinutes: null,
  estimatedMinutes: 50,
  exercises: [],
});

const WORKOUTS: WorkoutSession[] = [
  workout('w1', 'completed'),
  workout('w2', 'completed'),
  workout('w3', 'skipped'),
  workout('w4', 'scheduled'),
];

describe('ProgressFacade', () => {
  let listAssessments: MockOf<AssessmentsPort['listByStudent']>;
  let listPhotos: MockOf<ProgressPhotosPort['listByStudent']>;
  let listWorkouts: MockOf<WorkoutsPort['listByStudent']>;
  let addPhoto: MockOf<ProgressPhotosPort['add']>;
  let removePhoto: MockOf<ProgressPhotosPort['remove']>;
  let profileId: string | null;

  const build = (): ProgressFacade => {
    TestBed.configureTestingModule({
      providers: [
        ProgressFacade,
        { provide: SessionFacade, useValue: { profileId: () => profileId } },
        {
          provide: ASSESSMENTS_PORT,
          useValue: {
            listByStudent: listAssessments,
            latestByStudent: fn<AssessmentsPort['latestByStudent']>(),
            create: fn<AssessmentsPort['create']>(),
          },
        },
        {
          provide: PROGRESS_PHOTOS_PORT,
          useValue: { listByStudent: listPhotos, add: addPhoto, remove: removePhoto },
        },
        {
          provide: WORKOUTS_PORT,
          useValue: {
            listByStudent: listWorkouts,
            getById: fn<WorkoutsPort['getById']>(),
            start: fn<WorkoutsPort['start']>(),
            markExercise: fn<WorkoutsPort['markExercise']>(),
            logSet: fn<WorkoutsPort['logSet']>(),
            complete: fn<WorkoutsPort['complete']>(),
          },
        },
      ],
    });
    return TestBed.inject(ProgressFacade);
  };

  const loaded = (): ProgressFacade => {
    const facade = build();
    facade.load();
    return facade;
  };

  beforeEach(() => {
    listAssessments = fn<AssessmentsPort['listByStudent']>().mockReturnValue(of(ASSESSMENTS));
    listPhotos = fn<ProgressPhotosPort['listByStudent']>().mockReturnValue(of(PHOTOS));
    listWorkouts = fn<WorkoutsPort['listByStudent']>().mockReturnValue(of(WORKOUTS));
    addPhoto = fn<ProgressPhotosPort['add']>();
    removePhoto = fn<ProgressPhotosPort['remove']>().mockReturnValue(of(undefined));
    profileId = 'std-001';
  });

  describe('load()', () => {
    it('consulta los tres puertos', () => {
      loaded();

      expect(listAssessments).toHaveBeenCalledWith('std-001');
      expect(listPhotos).toHaveBeenCalledWith('std-001');
      expect(listWorkouts).toHaveBeenCalledWith('std-001');
    });

    it('no consulta nada sin sesion', () => {
      profileId = null;
      build().load();

      expect(listAssessments).not.toHaveBeenCalled();
    });

    it('queda en empty sin evaluaciones', () => {
      listAssessments.mockReturnValue(of([]));

      expect(loaded().viewState()).toBe('empty');
    });

    it('queda en error si falla el puerto de evaluaciones', () => {
      listAssessments.mockReturnValue(throwError(() => domainError('network')));

      expect(loaded().viewState()).toBe('error');
    });
  });

  describe('series', () => {
    it('ordena el peso de la evaluacion mas antigua a la mas reciente', () => {
      expect(
        loaded()
          .weightSeries()
          .map(point => point.value),
      ).toEqual([61.4, 60.2, 58.9]);
    });

    it('calcula la serie de IMC', () => {
      const series = loaded().bmiSeries();

      expect(series).toHaveLength(3);
      expect(series[2]?.value).toBe(21.6);
    });

    it('descarta puntos con fecha no parseable', () => {
      listAssessments.mockReturnValue(of([assessment('roto', 'no-es-fecha', 60)]));

      expect(loaded().weightSeries()).toEqual([]);
    });
  });

  describe('first() y latest()', () => {
    it('devuelven los extremos cronologicos', () => {
      const facade = loaded();

      expect(facade.first()?.id).toBe('a1');
      expect(facade.latest()?.id).toBe('a3');
    });
  });

  describe('weightDelta()', () => {
    it('resta la primera evaluacion de la ultima', () => {
      expect(loaded().weightDelta()).toBe(-2.5);
    });

    it('es null con una sola evaluacion', () => {
      listAssessments.mockReturnValue(of([ASSESSMENTS[0] as Assessment]));

      expect(loaded().weightDelta()).toBeNull();
    });
  });

  describe('adherence()', () => {
    it('ignora las sesiones aun programadas', () => {
      // 2 completadas de 3 ya ocurridas.
      expect(loaded().adherence()).toBe(67);
    });

    it('es cero sin sesiones pasadas', () => {
      listWorkouts.mockReturnValue(of([workout('w4', 'scheduled')]));

      expect(loaded().adherence()).toBe(0);
    });

    it('cuenta las completadas', () => {
      expect(loaded().completedCount()).toBe(2);
    });
  });

  describe('photoGroups()', () => {
    it('agrupa las fotos por dia', () => {
      expect(loaded().photoGroups()).toHaveLength(2);
    });

    it('ordena de la mas reciente a la mas antigua', () => {
      expect(loaded().photoGroups()[0]?.takenAt).toBe('2026-09-07');
    });

    it('junta las fotos del mismo dia', () => {
      const older = loaded().photoGroups()[1];
      expect(older?.photos).toHaveLength(2);
    });
  });

  describe('comparador', () => {
    it('elige por defecto los extremos del angulo frontal', () => {
      const facade = loaded();

      expect(facade.compareA()?.id).toBe('p1');
      expect(facade.compareB()?.id).toBe('p3');
      expect(facade.canCompare()).toBe(true);
    });

    it('no compara con menos de dos fotos frontales', () => {
      listPhotos.mockReturnValue(of([PHOTOS[0] as ProgressPhoto]));
      const facade = loaded();

      expect(facade.canCompare()).toBe(false);
    });

    describe('con varias fotos por angulo', () => {
      const MANY: ProgressPhoto[] = [
        photo('f1', '2026-03-05T09:00:00.000Z', 'front'),
        photo('f2', '2026-06-04T09:00:00.000Z', 'front'),
        photo('f3', '2026-09-07T09:00:00.000Z', 'front'),
        photo('s1', '2026-03-05T09:01:00.000Z', 'side'),
        photo('s2', '2026-09-07T09:01:00.000Z', 'side'),
        photo('b1', '2026-09-07T09:02:00.000Z', 'back'),
      ];

      beforeEach(() => listPhotos.mockReturnValue(of(MANY)));

      it('solo ofrece los angulos con dos fotos o mas', () => {
        expect(loaded().comparableAngles()).toEqual(['front', 'side']);
      });

      it('los candidatos son del angulo actual, del mas antiguo al mas reciente', () => {
        expect(
          loaded()
            .compareCandidates()
            .map(p => p.id),
        ).toEqual(['f1', 'f2', 'f3']);
      });

      it('respeta una seleccion explicita del mismo angulo', () => {
        const facade = loaded();

        facade.selectCompare('f2', 'f3');

        expect(facade.compareA()?.id).toBe('f2');
        expect(facade.compareB()?.id).toBe('f3');
      });

      it('ignora una seleccion que mezcla angulos', () => {
        const facade = loaded();

        facade.selectCompare('f2', 's2');

        expect(facade.compareA()?.id).toBe('f1');
        expect(facade.compareB()?.id).toBe('f3');
      });

      it('replaceCompare() cambia un lado y mantiene el orden cronologico', () => {
        const facade = loaded();

        expect(facade.replaceCompare('after', 'f2')).toBe(true);
        expect([facade.compareA()?.id, facade.compareB()?.id]).toEqual(['f1', 'f2']);

        // Una "anterior" mas reciente que la otra pasa a la derecha.
        expect(facade.replaceCompare('before', 'f3')).toBe(true);
        expect([facade.compareA()?.id, facade.compareB()?.id]).toEqual(['f2', 'f3']);
      });

      it('replaceCompare() rechaza otro angulo o la foto del otro lado', () => {
        const facade = loaded();

        expect(facade.replaceCompare('before', 's1')).toBe(false);
        expect(facade.replaceCompare('before', 'f3')).toBe(false);
        expect([facade.compareA()?.id, facade.compareB()?.id]).toEqual(['f1', 'f3']);
      });

      it('selectCompareAngle() cambia de angulo y vuelve al par por defecto', () => {
        const facade = loaded();
        facade.replaceCompare('after', 'f2');

        facade.selectCompareAngle('side');

        expect(facade.compareAngle()).toBe('side');
        expect([facade.compareA()?.id, facade.compareB()?.id]).toEqual(['s1', 's2']);
      });

      it('selectCompareAngle() ignora un angulo con menos de dos fotos', () => {
        const facade = loaded();

        facade.selectCompareAngle('back');

        expect(facade.compareAngle()).toBe('front');
      });

      it('si el angulo elegido deja de alcanzar, pasa al primero que si', () => {
        const facade = loaded();
        facade.selectCompareAngle('side');

        facade.photos.set(MANY.filter(p => p.id !== 's2'));

        expect(facade.compareAngle()).toBe('front');
      });
    });
  });

  describe('addPhoto()', () => {
    it('agrega la foto al inicio de la lista', async () => {
      const created = photo('p4', '2026-11-01T09:00:00.000Z', 'back');
      addPhoto.mockReturnValue(of(created));
      const facade = loaded();

      const ok = await facade.addPhoto(created.url, 'back', new Date(2026, 10, 1));

      expect(ok).toBe(true);
      expect(facade.photos.data()?.[0]?.id).toBe('p4');
    });

    it('devuelve false sin sesion', async () => {
      profileId = null;
      expect(await build().addPhoto('data:', 'front', new Date())).toBe(false);
    });

    it('devuelve false si el puerto falla', async () => {
      addPhoto.mockReturnValue(throwError(() => domainError('network')));
      const facade = loaded();

      expect(await facade.addPhoto('data:', 'front', new Date())).toBe(false);
    });
  });

  describe('removePhoto()', () => {
    it('quita la foto de la lista', async () => {
      const facade = loaded();

      const ok = await facade.removePhoto('p1');

      expect(ok).toBe(true);
      expect(facade.photos.data()?.map(item => item.id)).not.toContain('p1');
    });

    it('devuelve false si el puerto falla', async () => {
      removePhoto.mockReturnValue(throwError(() => domainError('not_found')));
      const facade = loaded();

      expect(await facade.removePhoto('p1')).toBe(false);
    });
  });

  describe('reload()', () => {
    it('vuelve a consultar los tres puertos', () => {
      const facade = loaded();
      facade.reload();

      expect(listAssessments).toHaveBeenCalledTimes(2);
      expect(listPhotos).toHaveBeenCalledTimes(2);
      expect(listWorkouts).toHaveBeenCalledTimes(2);
    });
  });
});
