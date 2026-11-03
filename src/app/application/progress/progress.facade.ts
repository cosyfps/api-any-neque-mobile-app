import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { SessionFacade } from '@app/application/auth/session.facade';
import {
  PHOTO_ANGLES,
  PhotoAngle,
  ProgressPhoto,
  ProgressPoint,
} from '@app/domain/progress/model/progress-photo.model';
import { PROGRESS_PHOTOS_PORT } from '@app/domain/progress/port/progress-photos.port';
import { parseIsoDate, toIsoDate } from '@app/domain/shared/model/date';
import { Assessment } from '@app/domain/students/model/assessment.model';
import { calculateBmi } from '@app/domain/students/model/bmi';
import { ASSESSMENTS_PORT } from '@app/domain/students/port/assessments.port';
import { WorkoutSession } from '@app/domain/workouts/model/workout-session.model';
import { WORKOUTS_PORT } from '@app/domain/workouts/port/workouts.port';

import { AsyncState, ViewState, asyncState } from '../shared/async-state';

/** Un grupo de fotos tomadas el mismo dia. */
export interface PhotoGroup {
  readonly label: string;
  readonly takenAt: string;
  readonly photos: readonly ProgressPhoto[];
}

const MONTH_FORMAT = new Intl.DateTimeFormat('es-CL', { month: 'short', year: 'numeric' });
const DAY_FORMAT = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long' });

/**
 * Progreso del alumno.
 *
 * Es el ejemplo canonico de facade multi-feature: compone tres puertos de
 * features distintas sin que ninguna feature conozca a la otra.
 */
// Scoped a la ruta /student: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class ProgressFacade {
  private readonly assessmentsPort = inject(ASSESSMENTS_PORT);
  private readonly photosPort = inject(PROGRESS_PHOTOS_PORT);
  private readonly workoutsPort = inject(WORKOUTS_PORT);
  private readonly session = inject(SessionFacade);

  private readonly _compareAngle = signal<PhotoAngle>('front');
  /** Par elegido a mano; null usa el par por defecto del angulo. */
  private readonly _compareIds = signal<readonly [string, string] | null>(null);

  readonly assessments: AsyncState<Assessment[]> = asyncState<Assessment[]>();
  readonly photos: AsyncState<ProgressPhoto[]> = asyncState<ProgressPhoto[]>();
  readonly sessions: AsyncState<WorkoutSession[]> = asyncState<WorkoutSession[]>();

  /** Evaluaciones de la mas antigua a la mas reciente, para los graficos. */
  private readonly chronological: Signal<readonly Assessment[]> = computed(() =>
    [...(this.assessments.data() ?? [])].sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
  );

  readonly weightSeries: Signal<readonly ProgressPoint[]> = computed(() =>
    this.toSeries(assessment => assessment.weightKg),
  );

  readonly bmiSeries: Signal<readonly ProgressPoint[]> = computed(() =>
    this.toSeries(assessment => calculateBmi(assessment.weightKg, assessment.heightCm)?.value ?? 0),
  );

  readonly latest: Signal<Assessment | null> = computed(() => {
    const all = this.chronological();
    return all[all.length - 1] ?? null;
  });

  readonly first: Signal<Assessment | null> = computed(() => this.chronological()[0] ?? null);

  /** Diferencia de peso entre la primera y la ultima evaluacion. */
  readonly weightDelta: Signal<number | null> = computed(() => {
    const first = this.first();
    const latest = this.latest();
    if (first === null || latest === null || first.id === latest.id) {
      return null;
    }
    return Math.round((latest.weightKg - first.weightKg) * 10) / 10;
  });

  /** Porcentaje de sesiones completadas sobre las que ya pasaron. */
  readonly adherence: Signal<number> = computed(() => {
    const past = (this.sessions.data() ?? []).filter(item => item.status !== 'scheduled');
    if (past.length === 0) {
      return 0;
    }
    const done = past.filter(item => item.status === 'completed').length;
    return Math.round((done / past.length) * 100);
  });

  readonly completedCount: Signal<number> = computed(
    () => (this.sessions.data() ?? []).filter(item => item.status === 'completed').length,
  );

  /** Fotos agrupadas por fecha de toma, de la mas reciente a la mas antigua. */
  readonly photoGroups: Signal<readonly PhotoGroup[]> = computed(() => {
    const groups = new Map<string, ProgressPhoto[]>();

    for (const photo of this.photos.data() ?? []) {
      const key = photo.takenAt.slice(0, 10);
      const bucket = groups.get(key);
      if (bucket === undefined) {
        groups.set(key, [photo]);
      } else {
        bucket.push(photo);
      }
    }

    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, photos]) => {
        const date = parseIsoDate(`${key}T00:00:00.000Z`);
        return {
          takenAt: key,
          label: date === null ? key : DAY_FORMAT.format(date),
          photos,
        };
      });
  });

  /** Angulos con al menos dos fotos: los unicos que se pueden comparar. */
  readonly comparableAngles: Signal<readonly PhotoAngle[]> = computed(() => {
    const photos = this.photos.data() ?? [];
    return PHOTO_ANGLES.filter(angle => photos.filter(p => p.angle === angle).length >= 2);
  });

  /** Angulo del comparador; si el elegido ya no alcanza, el primero que si. */
  readonly compareAngle: Signal<PhotoAngle> = computed(() => {
    const selected = this._compareAngle();
    const comparable = this.comparableAngles();
    return comparable.includes(selected) ? selected : (comparable[0] ?? selected);
  });

  /**
   * Fotos que pueden entrar al comparador, de la mas antigua a la mas
   * reciente. Solo del angulo actual: frente con frente, perfil con perfil,
   * espalda con espalda.
   */
  readonly compareCandidates: Signal<readonly ProgressPhoto[]> = computed(() =>
    (this.photos.data() ?? [])
      .filter(photo => photo.angle === this.compareAngle())
      .sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
  );

  /**
   * Par del comparador, siempre en orden cronologico: la anterior a la
   * izquierda. Sin eleccion valida usa la mas antigua y la mas reciente.
   */
  private readonly comparePair: Signal<readonly [ProgressPhoto, ProgressPhoto] | null> = computed(
    () => {
      const candidates = this.compareCandidates();
      const first = candidates[0];
      const last = candidates[candidates.length - 1];
      if (candidates.length < 2 || first === undefined || last === undefined) {
        return null;
      }

      const ids = this._compareIds();
      const a = candidates.find(photo => photo.id === ids?.[0]);
      const b = candidates.find(photo => photo.id === ids?.[1]);
      if (a === undefined || b === undefined || a.id === b.id) {
        return [first, last];
      }
      return a.takenAt.localeCompare(b.takenAt) <= 0 ? [a, b] : [b, a];
    },
  );

  readonly compareA: Signal<ProgressPhoto | null> = computed(() => this.comparePair()?.[0] ?? null);
  readonly compareB: Signal<ProgressPhoto | null> = computed(() => this.comparePair()?.[1] ?? null);

  readonly canCompare: Signal<boolean> = computed(() => this.comparePair() !== null);

  readonly viewState: Signal<ViewState> = this.assessments.viewState;

  load(): void {
    const studentId = this.session.profileId();
    if (studentId === null) {
      return;
    }
    this.assessments.load(() => this.assessmentsPort.listByStudent(studentId));
    this.photos.load(() => this.photosPort.listByStudent(studentId));
    this.sessions.load(() => this.workoutsPort.listByStudent(studentId));
  }

  reload(): void {
    this.assessments.reload();
    this.photos.reload();
    this.sessions.reload();
  }

  selectCompare(a: string | null, b: string | null): void {
    this._compareIds.set(a === null || b === null ? null : [a, b]);
  }

  /** Cambia el angulo del comparador y vuelve a su par por defecto. */
  selectCompareAngle(angle: PhotoAngle): void {
    if (!this.comparableAngles().includes(angle)) {
      return;
    }
    this._compareAngle.set(angle);
    this._compareIds.set(null);
  }

  /**
   * Reemplaza una de las dos fotos del comparador. Rechaza una foto de otro
   * angulo o la misma que ya esta del otro lado.
   */
  replaceCompare(side: 'before' | 'after', photoId: string): boolean {
    const before = this.compareA();
    const after = this.compareB();
    const photo = this.compareCandidates().find(item => item.id === photoId);
    const other = side === 'before' ? after : before;
    if (photo === undefined || other === null || other.id === photoId) {
      return false;
    }
    this._compareIds.set([photo.id, other.id]);
    return true;
  }

  /** Agrega una foto ya convertida a data-URL por la pagina. */
  addPhoto(dataUrl: string, angle: PhotoAngle, takenAt: Date): Promise<boolean> {
    const studentId = this.session.profileId();
    if (studentId === null) {
      return Promise.resolve(false);
    }

    return new Promise(resolve => {
      this.photosPort
        .add({
          studentId,
          takenAt: toIsoDate(takenAt),
          url: dataUrl,
          angle,
          weightKg: this.latest()?.weightKg ?? null,
          note: null,
        })
        .subscribe({
          next: created => {
            this.photos.set([created, ...(this.photos.data() ?? [])]);
            resolve(true);
          },
          error: () => resolve(false),
        });
    });
  }

  removePhoto(photoId: string): Promise<boolean> {
    return new Promise(resolve => {
      this.photosPort.remove(photoId).subscribe({
        next: () => {
          this.photos.set((this.photos.data() ?? []).filter(photo => photo.id !== photoId));
          resolve(true);
        },
        error: () => resolve(false),
      });
    });
  }

  private toSeries(pick: (assessment: Assessment) => number): ProgressPoint[] {
    const points: ProgressPoint[] = [];

    for (const assessment of this.chronological()) {
      const date = parseIsoDate(assessment.takenAt);
      if (date === null) {
        continue;
      }
      points.push({ date, value: pick(assessment), label: MONTH_FORMAT.format(date) });
    }

    return points;
  }
}
