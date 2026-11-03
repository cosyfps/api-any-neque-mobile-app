import { Component, computed, inject, signal } from '@angular/core';
import {
  LucideCamera,
  LucideChevronDown,
  LucideImagePlus,
  LucideLoaderCircle,
  LucideTrash2,
  LucideTrendingDown,
  LucideTrendingUp,
} from '@lucide/angular';

import { ProgressFacade } from '@app/application/progress/progress.facade';
import {
  PHOTO_ANGLE_LABEL,
  PHOTO_ANGLES,
  PhotoAngle,
} from '@app/domain/progress/model/progress-photo.model';
import { CLOCK } from '@app/domain/shared/port/clock.port';

import { SeriesPoint } from '@shared/components/chart/chart-math';
import { LineChartComponent } from '@shared/components/chart/line-chart.component';
import { PageStateComponent } from '@shared/components/page-state.component';
import { SheetTrapDirective } from '@shared/directives/sheet-trap.directive';
import { IMAGE_ACCEPT, imageFileError } from '@shared/validators/field-rules';

type ProgressTab = 'metrics' | 'photos';
type MetricSeries = 'weight' | 'bmi';
type CompareSide = 'before' | 'after';

@Component({
  selector: 'app-student-progress',
  standalone: true,
  imports: [
    PageStateComponent,
    SheetTrapDirective,
    LineChartComponent,
    LucideCamera,
    LucideChevronDown,
    LucideImagePlus,
    LucideLoaderCircle,
    LucideTrash2,
    LucideTrendingDown,
    LucideTrendingUp,
  ],
  template: `
    <div class="page" [class.page-fill]="photosEmpty()">
      <header class="head">
        <h1 class="nq-h2">Mi progreso</h1>
      </header>

      <div class="nq-tabs">
        <button
          class="nq-tab"
          type="button"
          [class.active]="tab() === 'metrics'"
          (click)="tab.set('metrics')"
        >
          Mediciones
        </button>
        <button
          class="nq-tab"
          type="button"
          [class.active]="tab() === 'photos'"
          (click)="tab.set('photos')"
        >
          Fotos
        </button>
      </div>

      <!-- Cada pestana tiene su propio estado. Con un switch unico sobre las
           evaluaciones, un alumno al que el entrenador todavia no le registra
           ninguna veia "Sin evaluaciones" tambien en Fotos y no podia subir
           la primera. -->
      @if (tab() === 'metrics') {
        @switch (facade.viewState()) {
          @case ('loading') {
            <nq-page-state type="loading" />
          }
          @case ('error') {
            <nq-page-state type="error" [retry]="reload" />
          }
          @case ('empty') {
            <nq-page-state
              type="empty"
              title="Sin evaluaciones aún"
              message="Cuando tu entrenador registre tu primera evaluación, la verás acá."
            />
          }
          @case ('success') {
            <section class="metrics nq-ani">
              <div class="metric">
                <span class="metric-value">{{ weightLabel() }}</span>
                <span class="metric-label">Peso actual</span>
              </div>
              <div class="metric">
                <span class="metric-value">{{ facade.adherence() }}%</span>
                <span class="metric-label">Adherencia</span>
              </div>
              <div class="metric">
                <span class="metric-value">{{ facade.completedCount() }}</span>
                <span class="metric-label">Sesiones</span>
              </div>
            </section>

            @if (facade.weightDelta(); as delta) {
              <p class="delta nq-ani nq-d1" [class.down]="delta < 0">
                @if (delta < 0) {
                  <svg lucideTrendingDown [size]="15" [strokeWidth]="2"></svg>
                } @else {
                  <svg lucideTrendingUp [size]="15" [strokeWidth]="2"></svg>
                }
                {{ delta > 0 ? '+' : '' }}{{ delta }} kg desde tu primera evaluación
              </p>
            }

            <section class="nq-section nq-ani nq-d2">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Evolución</h2>
                <div class="series-toggle">
                  <button
                    class="series-btn"
                    type="button"
                    [class.active]="series() === 'weight'"
                    (click)="series.set('weight')"
                  >
                    Peso
                  </button>
                  <button
                    class="series-btn"
                    type="button"
                    [class.active]="series() === 'bmi'"
                    (click)="series.set('bmi')"
                  >
                    IMC
                  </button>
                </div>
              </div>

              <div class="nq-card chart-card">
                <nq-line-chart [data]="activeSeries()" [ariaLabel]="seriesAria()" />
              </div>
            </section>

            <section class="nq-section nq-ani nq-d3">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Historial</h2>
              </div>

              <ul class="history">
                @for (assessment of history(); track assessment.id) {
                  <li class="history-item">
                    <span class="history-date">{{ formatDate(assessment.takenAt) }}</span>
                    <span class="history-values">
                      {{ assessment.weightKg }} kg
                      @if (assessment.bodyFatPct !== null) {
                        · {{ assessment.bodyFatPct }}% grasa
                      }
                    </span>
                    @if (assessment.notes !== null) {
                      <span class="history-note">{{ assessment.notes }}</span>
                    }
                  </li>
                }
              </ul>
            </section>
          }
        }
      } @else {
        @switch (facade.photos.viewState()) {
          @case ('loading') {
            <nq-page-state type="loading" />
          }
          @case ('error') {
            <nq-page-state type="error" [retry]="reload" />
          }
          @default {
            <!-- Comparador antes / despues -->
            @if (facade.canCompare()) {
              <section class="nq-section nq-ani">
                <div class="nq-section-header">
                  <h2 class="nq-section-title">Comparación</h2>
                </div>

                <!-- Solo se compara el mismo angulo: uno con menos de dos
                     fotos no tiene con que compararse. -->
                <div class="angle-row" role="group" aria-label="Ángulo a comparar">
                  @for (angle of angles; track angle) {
                    <button
                      class="angle-btn"
                      type="button"
                      [class.active]="facade.compareAngle() === angle"
                      [attr.aria-pressed]="facade.compareAngle() === angle"
                      [disabled]="!facade.comparableAngles().includes(angle)"
                      (click)="facade.selectCompareAngle(angle)"
                    >
                      {{ angleLabel(angle) }}
                    </button>
                  }
                </div>

                @if (facade.compareA(); as before) {
                  @if (facade.compareB(); as after) {
                    <!-- Las dos fotos se superponen y el divisor recorta la de
                         arriba. Una al lado de otra no deja ver el cambio. -->
                    <figure class="compare" #comparador>
                      <img class="compare-img" [src]="before.url" alt="Foto anterior" />
                      <img
                        class="compare-img compare-after"
                        [src]="after.url"
                        alt="Foto reciente"
                        [style.clip-path]="'inset(0 0 0 ' + divisor() + '%)'"
                      />

                      <button
                        class="compare-date izquierda"
                        type="button"
                        [attr.aria-label]="'Cambiar foto anterior, ' + formatDate(before.takenAt)"
                        (click)="openPicker('before')"
                      >
                        {{ formatShortDate(before.takenAt) }}
                        <svg lucideChevronDown [size]="14" [strokeWidth]="1.8"></svg>
                      </button>
                      <button
                        class="compare-date derecha"
                        type="button"
                        [attr.aria-label]="'Cambiar foto reciente, ' + formatDate(after.takenAt)"
                        (click)="openPicker('after')"
                      >
                        {{ formatShortDate(after.takenAt) }}
                        <svg lucideChevronDown [size]="14" [strokeWidth]="1.8"></svg>
                      </button>

                      <span class="compare-line" [style.left.%]="divisor()"></span>
                      <!-- Solo la agarradera mueve el divisor: tocar la foto no
                           hace nada, asi un toque al pasar no cambia la comparacion. -->
                      <button
                        class="compare-handle"
                        type="button"
                        role="slider"
                        aria-label="Comparar fotos"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        [attr.aria-valuenow]="divisor()"
                        [attr.aria-valuetext]="divisorTexto()"
                        [style.left.%]="divisor()"
                        (keydown)="alTeclearDivisor($event)"
                        (pointerdown)="alTomarDivisor($event)"
                        (pointermove)="alArrastrarDivisor($event, comparador)"
                        (pointerup)="alSoltarDivisor()"
                        (pointercancel)="alSoltarDivisor()"
                      ></button>
                    </figure>
                    <p class="compare-hint">Toca una fecha para elegir otra foto.</p>
                  }
                }
              </section>
            }

            <section class="nq-section nq-ani nq-d1">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Agregar foto</h2>
              </div>

              <div class="angle-row">
                @for (angle of angles; track angle) {
                  <button
                    class="angle-btn"
                    type="button"
                    [class.active]="selectedAngle() === angle"
                    (click)="selectedAngle.set(angle)"
                  >
                    {{ angleLabel(angle) }}
                  </button>
                }
              </div>

              <label class="upload" [class.busy]="uploading()">
                @if (uploading()) {
                  <svg
                    class="upload-spinner"
                    lucideLoaderCircle
                    [size]="18"
                    [strokeWidth]="2"
                  ></svg>
                  Subiendo…
                } @else {
                  <svg lucideCamera [size]="18" [strokeWidth]="1.8"></svg>
                  Tomar o elegir foto
                }
                <input
                  type="file"
                  [accept]="imageAccept"
                  aria-label="Tomar o elegir foto de progreso"
                  [disabled]="uploading()"
                  (change)="onFile($event)"
                />
              </label>
              @if (uploadError()) {
                <p class="nq-field-error" role="alert">{{ uploadError() }}</p>
              }
            </section>

            @if (facade.photoGroups().length > 0) {
              @for (group of facade.photoGroups(); track group.takenAt) {
                <section class="nq-section nq-ani nq-d2">
                  <div class="nq-section-header">
                    <h2 class="nq-section-title">{{ group.label }}</h2>
                  </div>

                  <div class="gallery">
                    @for (photo of group.photos; track photo.id) {
                      <figure class="photo">
                        <img [src]="photo.url" [alt]="'Foto ' + angleLabel(photo.angle)" />
                        <figcaption>{{ angleLabel(photo.angle) }}</figcaption>
                        <button
                          class="photo-remove"
                          type="button"
                          [attr.aria-label]="'Eliminar foto ' + angleLabel(photo.angle)"
                          (click)="askRemove(photo.id)"
                        >
                          <svg lucideTrash2 [size]="14" [strokeWidth]="2"></svg>
                        </button>
                      </figure>
                    }
                  </div>
                </section>
              }
            } @else {
              <div class="nq-state photos-empty nq-ani nq-d2" role="status">
                <div class="nq-state-icon">
                  <svg lucideImagePlus [size]="28" [strokeWidth]="1.6"></svg>
                </div>
                <h2 class="nq-state-title">Aún no tienes fotos</h2>
                <p class="nq-state-desc">
                  Sube una foto de frente, perfil o espalda. Con dos del mismo ángulo podrás
                  comparar tu evolución.
                </p>
              </div>
            }
          }
        }
      }
    </div>

    <!-- Selector de foto del comparador: solo fotos del angulo actual. -->
    <div class="nq-overlay" [class.open]="pickerSide() !== null" (click)="closePicker()">
      <div
        class="nq-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pick-photo-title"
        [nqSheetTrap]="pickerSide() !== null"
        (dismissed)="closePicker()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="pick-photo-title">
          {{ pickerSide() === 'before' ? 'Elegir foto anterior' : 'Elegir foto reciente' }}
        </h2>
        <p class="picker-desc">Fotos de {{ angleLabel(facade.compareAngle()) }}</p>

        <div class="picker-grid">
          @for (option of pickerOptions(); track option.photo.id) {
            <button
              class="pick"
              type="button"
              [class.current]="option.current"
              [attr.aria-pressed]="option.current"
              [disabled]="option.inUse"
              (click)="pick(option.photo.id)"
            >
              <img [src]="option.photo.url" alt="" />
              <span class="pick-date">{{ formatShortDate(option.photo.takenAt) }}</span>
              @if (option.inUse) {
                <span class="pick-tag">En uso</span>
              }
            </button>
          }
        </div>
      </div>
    </div>

    <!-- Borrar una foto no tiene vuelta atras: se confirma. El overlay vive
         siempre en el DOM y solo conmuta la clase open, que es como el design
         system lo anima. -->
    <div class="nq-overlay" [class.open]="pendingRemoval() !== null" (click)="cancelRemove()">
      <div
        class="nq-sheet confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-photo-title"
        [nqSheetTrap]="pendingRemoval() !== null"
        (dismissed)="cancelRemove()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="remove-photo-title">¿Eliminar esta foto?</h2>
        <p class="confirm-desc">No se puede deshacer: tendrás que volver a subirla.</p>

        <div class="confirm-actions">
          <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelRemove()">
            Cancelar
          </button>
          <button
            class="nq-btn nq-btn-primary"
            type="button"
            [disabled]="removing()"
            (click)="confirmRemove()"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './student-progress.page.scss',
})
export class StudentProgressPage {
  readonly facade = inject(ProgressFacade);

  private readonly clock = inject(CLOCK);

  readonly angles = PHOTO_ANGLES;
  readonly tab = signal<ProgressTab>('metrics');
  readonly series = signal<MetricSeries>('weight');
  readonly selectedAngle = signal<PhotoAngle>('front');
  readonly imageAccept = IMAGE_ACCEPT;
  /** Posicion del divisor del comparador, en porcentaje. */
  readonly divisor = signal(50);
  private arrastrandoDivisor = false;

  readonly uploading = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly pendingRemoval = signal<string | null>(null);
  /** Pestaña de fotos cargada y sin fotos: el aviso ocupa el resto de la pantalla. */
  readonly photosEmpty = computed(() => {
    const state = this.facade.photos.viewState();
    return (
      this.tab() === 'photos' &&
      state !== 'loading' &&
      state !== 'error' &&
      this.facade.photoGroups().length === 0
    );
  });

  /** Lado del comparador que se esta eligiendo; null con la hoja cerrada. */
  readonly pickerSide = signal<CompareSide | null>(null);

  /** Candidatos para el lado abierto, del mas reciente al mas antiguo. */
  readonly pickerOptions = computed(() => {
    const side = this.pickerSide();
    const current = side === 'before' ? this.facade.compareA() : this.facade.compareB();
    const other = side === 'before' ? this.facade.compareB() : this.facade.compareA();
    return [...this.facade.compareCandidates()].reverse().map(photo => ({
      photo,
      current: photo.id === current?.id,
      inUse: photo.id === other?.id,
    }));
  });
  readonly removing = signal(false);

  /** Sin evaluacion el valor es un guion, no un " kg" con el numero en blanco. */
  readonly weightLabel = computed(() => {
    const weight = this.facade.latest()?.weightKg;
    return weight === undefined ? '—' : `${weight} kg`;
  });

  readonly history = computed(() =>
    [...(this.facade.assessments.data() ?? [])].sort((a, b) => b.takenAt.localeCompare(a.takenAt)),
  );

  readonly activeSeries = computed((): readonly SeriesPoint[] => {
    const source =
      this.series() === 'weight' ? this.facade.weightSeries() : this.facade.bmiSeries();
    return source.map(point => ({ value: point.value, label: point.label }));
  });

  readonly seriesAria = computed(() =>
    this.series() === 'weight'
      ? 'Evolución del peso en kilos'
      : 'Evolución del índice de masa corporal',
  );

  readonly reload = (): void => this.facade.reload();

  constructor() {
    this.facade.load();
  }

  /** Texto que lee el lector de pantalla en vez de un porcentaje pelado. */
  divisorTexto(): string {
    return `${this.divisor()}% de la foto reciente a la vista`;
  }

  /**
   * Toma la agarradera sin moverla: el divisor se desplaza recien al
   * arrastrar. La captura mantiene el arrastre aunque el dedo salga del
   * circulo.
   */
  alTomarDivisor(event: PointerEvent): void {
    this.arrastrandoDivisor = true;
    const agarradera = event.currentTarget as HTMLElement | null;
    agarradera?.setPointerCapture?.(event.pointerId);
  }

  alArrastrarDivisor(event: PointerEvent, contenedor: HTMLElement): void {
    if (this.arrastrandoDivisor) {
      this.moverDivisor(event, contenedor);
    }
  }

  alSoltarDivisor(): void {
    this.arrastrandoDivisor = false;
  }

  /** Con teclado el divisor se mueve de a 5%, y a los extremos con Inicio y Fin. */
  alTeclearDivisor(event: KeyboardEvent): void {
    const salto: Record<string, number> = { ArrowLeft: -5, ArrowRight: 5 };
    const delta = salto[event.key];

    if (delta !== undefined) {
      event.preventDefault();
      this.divisor.update(valor => Math.min(100, Math.max(0, valor + delta)));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      this.divisor.set(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.divisor.set(100);
    }
  }

  private moverDivisor(event: PointerEvent, contenedor: HTMLElement): void {
    const caja = contenedor.getBoundingClientRect();
    if (caja.width === 0) {
      return;
    }
    const porcentaje = ((event.clientX - caja.left) / caja.width) * 100;
    this.divisor.set(Math.round(Math.min(100, Math.max(0, porcentaje))));
  }

  angleLabel(angle: PhotoAngle): string {
    return PHOTO_ANGLE_LABEL[angle];
  }

  formatDate(iso: string): string {
    if (iso === '') {
      return '';
    }
    return new Intl.DateTimeFormat('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  }

  /** "05/03/2026": ancho fijo, las dos fechas del comparador se ven parejas. */
  formatShortDate(iso: string): string {
    const date = new Date(iso);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${date.getFullYear()}`;
  }

  /** Lee el archivo como data-URL: el adapter HTTP lo sube a Storage. */
  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file === undefined || this.uploading()) {
      return;
    }
    const invalida = imageFileError(file);
    if (invalida !== null) {
      this.uploadError.set(invalida);
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.uploadError.set(null);

    const reader = new FileReader();
    reader.onerror = () => {
      this.uploading.set(false);
      this.uploadError.set('No pudimos leer la imagen. Intenta con otra.');
      input.value = '';
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        this.uploading.set(false);
        this.uploadError.set('No pudimos leer la imagen. Intenta con otra.');
        input.value = '';
        return;
      }
      void this.facade.addPhoto(result, this.selectedAngle(), this.clock.now()).then(ok => {
        this.uploading.set(false);
        if (!ok) {
          this.uploadError.set('No pudimos guardar la foto. Intenta de nuevo.');
        }
        input.value = '';
      });
    };
    reader.readAsDataURL(file);
  }

  openPicker(side: CompareSide): void {
    this.pickerSide.set(side);
  }

  closePicker(): void {
    this.pickerSide.set(null);
  }

  pick(photoId: string): void {
    const side = this.pickerSide();
    if (side !== null) {
      this.facade.replaceCompare(side, photoId);
    }
    this.closePicker();
  }

  askRemove(photoId: string): void {
    this.pendingRemoval.set(photoId);
  }

  cancelRemove(): void {
    this.pendingRemoval.set(null);
  }

  async confirmRemove(): Promise<void> {
    const photoId = this.pendingRemoval();
    if (photoId === null || this.removing()) {
      return;
    }
    this.removing.set(true);
    await this.facade.removePhoto(photoId);
    this.removing.set(false);
    this.pendingRemoval.set(null);
  }
}
