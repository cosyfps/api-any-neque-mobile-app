import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { ProgressFacade } from '@app/application/progress/progress.facade';
import { ProgressPhoto } from '@app/domain/progress/model/progress-photo.model';
import {
  PROGRESS_PHOTOS_PORT,
  ProgressPhotosPort,
} from '@app/domain/progress/port/progress-photos.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { ASSESSMENTS_PORT, AssessmentsPort } from '@app/domain/students/port/assessments.port';
import { WORKOUTS_PORT, WorkoutsPort } from '@app/domain/workouts/port/workouts.port';

import { fn, MockOf } from '@testing/typed-mock';

import { StudentProgressPage } from './student-progress.page';

const assessment = (id: string, takenAt: string, weightKg: number): Assessment => ({
  id,
  studentId: 'std-001',
  takenAt,
  weightKg,
  heightCm: 165,
  bodyFatPct: 24,
  muscleMassKg: null,
  measurements: { chestCm: null, waistCm: null, hipCm: null, armCm: null, thighCm: null },
  notes: 'Nota',
});

const ASSESSMENTS = [
  assessment('a1', '2026-03-05T10:00:00.000Z', 61.4),
  assessment('a2', '2026-09-07T10:00:00.000Z', 58.9),
];

const photo = (id: string, angle: ProgressPhoto['angle'], takenAt: string): ProgressPhoto => ({
  id,
  studentId: 'std-001',
  takenAt,
  url: 'data:image/svg+xml;utf8,<svg/>',
  angle,
  weightKg: null,
  note: null,
});

const PHOTOS = [
  photo('p1', 'front', '2026-03-05T09:00:00.000Z'),
  photo('p2', 'front', '2026-09-07T09:00:00.000Z'),
  photo('p3', 'front', '2026-06-04T09:00:00.000Z'),
  photo('s1', 'side', '2026-06-04T09:01:00.000Z'),
];

describe('StudentProgressPage', () => {
  let page: StudentProgressPage;
  let addPhoto: MockOf<ProgressPhotosPort['add']>;
  let removePhoto: MockOf<ProgressPhotosPort['remove']>;

  const createPage = (): StudentProgressPage => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProgressFacade,
        { provide: CLOCK, useValue: { now: () => new Date('2026-09-18T10:00:00.000Z') } },
        { provide: SessionFacade, useValue: { profileId: () => 'std-001' } },
        {
          provide: ASSESSMENTS_PORT,
          useValue: {
            listByStudent: () => of(ASSESSMENTS),
            latestByStudent: fn<AssessmentsPort['latestByStudent']>(),
            create: fn<AssessmentsPort['create']>(),
          },
        },
        {
          provide: PROGRESS_PHOTOS_PORT,
          useValue: { listByStudent: () => of(PHOTOS), add: addPhoto, remove: removePhoto },
        },
        {
          provide: WORKOUTS_PORT,
          useValue: {
            listByStudent: () => of([]),
            getById: fn<WorkoutsPort['getById']>(),
            start: fn<WorkoutsPort['start']>(),
            markExercise: fn<WorkoutsPort['markExercise']>(),
            logSet: fn<WorkoutsPort['logSet']>(),
            complete: fn<WorkoutsPort['complete']>(),
          },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new StudentProgressPage());
  };

  beforeEach(() => {
    addPhoto = fn<ProgressPhotosPort['add']>().mockReturnValue(
      of(photo('p3', 'back', '2026-11-01T09:00:00.000Z')),
    );
    removePhoto = fn<ProgressPhotosPort['remove']>().mockReturnValue(of(undefined));
    page = createPage();
  });

  describe('estado inicial', () => {
    it('arranca en la pestana de mediciones', () => {
      expect(page.tab()).toBe('metrics');
      expect(page.series()).toBe('weight');
      expect(page.selectedAngle()).toBe('front');
    });

    it('carga las evaluaciones', () => {
      expect(page.facade.viewState()).toBe('success');
    });
  });

  describe('history()', () => {
    it('ordena de la mas reciente a la mas antigua', () => {
      expect(page.history().map(item => item.id)).toEqual(['a2', 'a1']);
    });
  });

  describe('activeSeries()', () => {
    it('devuelve la serie de peso por defecto', () => {
      expect(page.activeSeries().map(point => point.value)).toEqual([61.4, 58.9]);
    });

    it('cambia a la serie de IMC', () => {
      page.series.set('bmi');

      expect(page.activeSeries()[1]?.value).toBe(21.6);
    });

    it('describe la serie activa para lectores de pantalla', () => {
      expect(page.seriesAria()).toContain('peso');

      page.series.set('bmi');
      expect(page.seriesAria()).toContain('masa corporal');
    });
  });

  describe('formatDate()', () => {
    it('formatea una fecha ISO', () => {
      expect(page.formatDate('2026-09-07T10:00:00.000Z')).toContain('2026');
    });

    it('devuelve vacio con una cadena vacia', () => {
      expect(page.formatDate('')).toBe('');
    });
  });

  describe('angleLabel()', () => {
    it.each([
      ['front', 'Frente'],
      ['side', 'Perfil'],
      ['back', 'Espalda'],
    ] as const)('traduce %s a %s', (angle, expected) => {
      expect(page.angleLabel(angle)).toBe(expected);
    });
  });

  describe('weightLabel()', () => {
    it('muestra el peso de la ultima evaluacion', () => {
      expect(page.weightLabel()).toMatch(/kg$/);
    });
  });

  describe('onFile()', () => {
    /** Input con un archivo de verdad: jsdom implementa FileReader. */
    const inputConArchivo = (contenido = 'foto'): HTMLInputElement => {
      const input = document.createElement('input');
      input.type = 'file';
      const file = new File([contenido], 'foto.png', { type: 'image/png' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      return input;
    };

    /**
     * FileReader resuelve en macrotask; se espera a que el control se libere.
     * Hasta 2 s: bajo carga 250 ms no alcanzaban (QA-32).
     */
    const esperarLectura = async (): Promise<void> => {
      for (let i = 0; i < 400 && page.uploading(); i++) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    };

    it('no hace nada sin archivo', () => {
      const input = document.createElement('input');
      page.onFile({ target: input } as unknown as Event);

      expect(addPhoto).not.toHaveBeenCalled();
      expect(page.uploading()).toBe(false);
    });

    // QA-35: con image/* un GIF pasaba el selector y el BFF lo rechazaba.
    it('rechaza un formato que el backend no acepta, sin subir', () => {
      const input = document.createElement('input');
      const gif = new File(['gif'], 'foto.gif', { type: 'image/gif' });
      Object.defineProperty(input, 'files', { value: [gif], configurable: true });

      page.onFile({ target: input } as unknown as Event);

      expect(page.uploadError()).toBe('Elige una foto JPG, PNG, WebP o HEIC.');
      expect(page.uploading()).toBe(false);
      expect(addPhoto).not.toHaveBeenCalled();
    });

    it('rechaza una foto de mas de 8 MB', () => {
      const input = inputConArchivo();
      const archivo = input.files?.[0] as File;
      Object.defineProperty(archivo, 'size', { value: 9 * 1024 * 1024 });

      page.onFile({ target: input } as unknown as Event);

      expect(page.uploadError()).toContain('8 MB');
      expect(addPhoto).not.toHaveBeenCalled();
    });

    it('marca que esta subiendo mientras lee el archivo', () => {
      page.onFile({ target: inputConArchivo() } as unknown as Event);

      expect(page.uploading()).toBe(true);
    });

    it('guarda la foto y libera el control al terminar', async () => {
      page.onFile({ target: inputConArchivo() } as unknown as Event);
      await esperarLectura();

      expect(addPhoto).toHaveBeenCalled();
      expect(page.uploading()).toBe(false);
      expect(page.uploadError()).toBeNull();
    });

    it('avisa cuando el guardado falla', async () => {
      addPhoto.mockReturnValue(throwError(() => domainError('network')));

      page.onFile({ target: inputConArchivo() } as unknown as Event);
      await esperarLectura();

      expect(page.uploading()).toBe(false);
      expect(page.uploadError()).not.toBeNull();
    });

    it('ignora un segundo archivo mientras sube el primero', () => {
      page.onFile({ target: inputConArchivo() } as unknown as Event);
      page.onFile({ target: inputConArchivo('otra') } as unknown as Event);

      expect(page.uploading()).toBe(true);
    });
  });

  describe('borrado con confirmacion', () => {
    it('askRemove solo marca la foto pendiente, sin borrar', () => {
      page.askRemove('p1');

      expect(page.pendingRemoval()).toBe('p1');
      expect(removePhoto).not.toHaveBeenCalled();
    });

    it('cancelRemove descarta la pendiente sin borrar', () => {
      page.askRemove('p1');
      page.cancelRemove();

      expect(page.pendingRemoval()).toBeNull();
      expect(removePhoto).not.toHaveBeenCalled();
    });

    it('confirmRemove borra y limpia la pendiente', async () => {
      page.askRemove('p1');
      await page.confirmRemove();

      expect(removePhoto).toHaveBeenCalledWith('p1');
      expect(page.pendingRemoval()).toBeNull();
      expect(page.removing()).toBe(false);
    });

    it('confirmRemove no hace nada sin foto pendiente', async () => {
      await page.confirmRemove();

      expect(removePhoto).not.toHaveBeenCalled();
    });

    it('confirmRemove ignora el segundo toque mientras borra', async () => {
      page.askRemove('p1');
      const first = page.confirmRemove();
      const second = page.confirmRemove();
      await Promise.all([first, second]);

      expect(removePhoto).toHaveBeenCalledTimes(1);
    });
  });

  describe('comparador arrastrable', () => {
    /** Contenedor de 200px que empieza en x=100. */
    const contenedor = (): HTMLElement =>
      ({ getBoundingClientRect: () => ({ left: 100, width: 200 }) }) as unknown as HTMLElement;

    const puntero = (x: number): PointerEvent => ({ clientX: x }) as PointerEvent;

    /** Toma la agarradera y la arrastra hasta x. */
    const arrastrarA = (x: number, caja = contenedor()): void => {
      page.alTomarDivisor(puntero(200));
      page.alArrastrarDivisor(puntero(x), caja);
    };

    const tecla = (key: string): KeyboardEvent =>
      new KeyboardEvent('keydown', { key, cancelable: true });

    it('arranca en la mitad', () => {
      expect(page.divisor()).toBe(50);
    });

    it('tomar la agarradera no la mueve', () => {
      page.alTomarDivisor(puntero(150));

      expect(page.divisor()).toBe(50);
    });

    it('captura el puntero para no perder el arrastre fuera del circulo', () => {
      const setPointerCapture = fn<Element['setPointerCapture']>();
      page.alTomarDivisor({
        pointerId: 7,
        currentTarget: { setPointerCapture },
      } as unknown as PointerEvent);

      expect(setPointerCapture).toHaveBeenCalledWith(7);
    });

    it('sin tomarla, mover el puntero no hace nada', () => {
      page.alArrastrarDivisor(puntero(260), contenedor());

      expect(page.divisor()).toBe(50);
    });

    it('sigue al puntero mientras se arrastra', () => {
      arrastrarA(150);
      page.alArrastrarDivisor(puntero(260), contenedor());

      expect(page.divisor()).toBe(80);
    });

    it('deja de seguir al soltar', () => {
      page.alTomarDivisor(puntero(200));
      page.alSoltarDivisor();
      page.alArrastrarDivisor(puntero(300), contenedor());

      expect(page.divisor()).toBe(50);
    });

    it('recorta fuera de los bordes', () => {
      arrastrarA(0);
      expect(page.divisor()).toBe(0);

      arrastrarA(9999);
      expect(page.divisor()).toBe(100);
    });

    it('no falla con un contenedor sin ancho', () => {
      const vacio = {
        getBoundingClientRect: () => ({ left: 0, width: 0 }),
      } as unknown as HTMLElement;

      arrastrarA(50, vacio);

      expect(page.divisor()).toBe(50);
    });

    it('las flechas lo mueven de a cinco', () => {
      page.alTeclearDivisor(tecla('ArrowRight'));
      expect(page.divisor()).toBe(55);

      page.alTeclearDivisor(tecla('ArrowLeft'));
      expect(page.divisor()).toBe(50);
    });

    it('Inicio y Fin van a los extremos', () => {
      page.alTeclearDivisor(tecla('Home'));
      expect(page.divisor()).toBe(0);

      page.alTeclearDivisor(tecla('End'));
      expect(page.divisor()).toBe(100);
    });

    it('otra tecla no lo mueve', () => {
      page.alTeclearDivisor(tecla('a'));

      expect(page.divisor()).toBe(50);
    });

    it('describe la posicion para el lector de pantalla', () => {
      expect(page.divisorTexto()).toContain('50%');
    });
  });

  describe('photosEmpty()', () => {
    it('es falso en la pestaña de mediciones', () => {
      expect(page.photosEmpty()).toBe(false);
    });

    it('es falso en fotos si hay fotos', () => {
      page.tab.set('photos');

      expect(page.photosEmpty()).toBe(false);
    });

    it('es verdadero en fotos sin ninguna foto', () => {
      page.tab.set('photos');
      page.facade.photos.set([]);

      expect(page.photosEmpty()).toBe(true);
    });
  });

  describe('selector de fotos del comparador', () => {
    it('formatShortDate() usa dd/mm/aaaa con ceros a la izquierda', () => {
      expect(page.formatShortDate('2026-03-05T09:00:00.000Z')).toBe('05/03/2026');
      expect(page.formatShortDate('2026-09-27T12:00:00.000Z')).toBe('27/09/2026');
    });

    it('arranca cerrado', () => {
      expect(page.pickerSide()).toBeNull();
    });

    it('lista solo fotos del angulo actual, de la mas reciente a la mas antigua', () => {
      page.openPicker('before');

      expect(page.pickerOptions().map(o => o.photo.id)).toEqual(['p2', 'p3', 'p1']);
    });

    it('marca la foto actual del lado y bloquea la del otro lado', () => {
      page.openPicker('before');

      const byId = Object.fromEntries(page.pickerOptions().map(o => [o.photo.id, o]));
      expect(byId['p1']?.current).toBe(true);
      expect(byId['p2']?.inUse).toBe(true);
      expect(byId['p3']?.inUse).toBe(false);
    });

    it('pick() reemplaza la foto de ese lado y cierra la hoja', () => {
      page.openPicker('before');

      page.pick('p3');

      expect(page.facade.compareA()?.id).toBe('p3');
      expect(page.facade.compareB()?.id).toBe('p2');
      expect(page.pickerSide()).toBeNull();
    });

    it('closePicker() cierra sin cambiar el par', () => {
      page.openPicker('after');

      page.closePicker();

      expect(page.pickerSide()).toBeNull();
      expect(page.facade.compareB()?.id).toBe('p2');
    });
  });

  describe('reload', () => {
    it('es un campo arrow invocable', () => {
      expect(() => page.reload()).not.toThrow();
    });
  });
});
