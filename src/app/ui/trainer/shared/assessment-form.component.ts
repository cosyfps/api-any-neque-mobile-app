import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';

import { Assessment } from '@app/domain/students/model/assessment.model';

/** Las cinco medidas corporales, en el orden en que se toman. */
const MEDIDAS = [
  { control: 'chestCm', label: 'Pecho' },
  { control: 'waistCm', label: 'Cintura' },
  { control: 'hipCm', label: 'Cadera' },
  { control: 'armCm', label: 'Brazo' },
  { control: 'thighCm', label: 'Muslo' },
] as const;

type Medida = (typeof MEDIDAS)[number]['control'];
type CampoNumerico = 'weightKg' | 'heightCm' | 'bodyFatPct' | 'muscleMassKg' | Medida;

/**
 * Rango de cada dato, el mismo que anuncian los `min`/`max` de su input y
 * dentro de lo que acepta el backend.
 */
const RANGOS: Record<CampoNumerico, { min: number; max: number; unidad: string }> = {
  weightKg: { min: 20, max: 300, unidad: 'kg' },
  heightCm: { min: 100, max: 250, unidad: 'cm' },
  bodyFatPct: { min: 2, max: 70, unidad: '%' },
  muscleMassKg: { min: 1, max: 150, unidad: 'kg' },
  chestCm: { min: 10, max: 250, unidad: 'cm' },
  waistCm: { min: 10, max: 250, unidad: 'cm' },
  hipCm: { min: 10, max: 250, unidad: 'cm' },
  armCm: { min: 10, max: 250, unidad: 'cm' },
  thighCm: { min: 10, max: 250, unidad: 'cm' },
};

const rango = (campo: CampoNumerico): ValidatorFn[] => [
  Validators.min(RANGOS[campo].min),
  Validators.max(RANGOS[campo].max),
];

/**
 * Evaluacion fisica.
 *
 * Peso y estatura son obligatorios porque de ellos sale el IMC que el alumno
 * ve en su Inicio; el resto se llena cuando se tiene.
 */
@Component({
  selector: 'nq-assessment-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <div class="row-2">
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('weightKg')">Peso (kg) *</label>
          <div class="nq-field-input" [class.error]="errorOf('weightKg') !== null">
            <input
              [attr.id]="id('weightKg')"
              formControlName="weightKg"
              type="number"
              inputmode="decimal"
              [min]="rangos.weightKg.min"
              [max]="rangos.weightKg.max"
              step="0.1"
              [attr.aria-invalid]="errorOf('weightKg') !== null"
              [attr.aria-describedby]="errorOf('weightKg') ? id('weightKg') + '-error' : null"
            />
          </div>
          @if (errorOf('weightKg'); as error) {
            <span class="nq-field-error" [id]="id('weightKg') + '-error'">{{ error }}</span>
          }
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('heightCm')">Estatura (cm) *</label>
          <div class="nq-field-input" [class.error]="errorOf('heightCm') !== null">
            <input
              [attr.id]="id('heightCm')"
              formControlName="heightCm"
              type="number"
              inputmode="numeric"
              [min]="rangos.heightCm.min"
              [max]="rangos.heightCm.max"
              [attr.aria-invalid]="errorOf('heightCm') !== null"
              [attr.aria-describedby]="errorOf('heightCm') ? id('heightCm') + '-error' : null"
            />
          </div>
          @if (errorOf('heightCm'); as error) {
            <span class="nq-field-error" [id]="id('heightCm') + '-error'">{{ error }}</span>
          }
        </div>
      </div>

      @if (requiredError()) {
        <span class="nq-field-error" role="alert">
          Peso y estatura son obligatorios: de ellos sale el IMC del alumno.
        </span>
      }

      <div class="row-2">
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('bodyFatPct')">Grasa (%)</label>
          <div class="nq-field-input" [class.error]="errorOf('bodyFatPct') !== null">
            <input
              [attr.id]="id('bodyFatPct')"
              formControlName="bodyFatPct"
              type="number"
              inputmode="decimal"
              [min]="rangos.bodyFatPct.min"
              [max]="rangos.bodyFatPct.max"
              step="0.1"
              [attr.aria-invalid]="errorOf('bodyFatPct') !== null"
              [attr.aria-describedby]="errorOf('bodyFatPct') ? id('bodyFatPct') + '-error' : null"
            />
          </div>
          @if (errorOf('bodyFatPct'); as error) {
            <span class="nq-field-error" [id]="id('bodyFatPct') + '-error'">{{ error }}</span>
          }
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('muscleMassKg')">Masa muscular (kg)</label>
          <div class="nq-field-input" [class.error]="errorOf('muscleMassKg') !== null">
            <input
              [attr.id]="id('muscleMassKg')"
              formControlName="muscleMassKg"
              type="number"
              inputmode="decimal"
              [min]="rangos.muscleMassKg.min"
              [max]="rangos.muscleMassKg.max"
              step="0.1"
              [attr.aria-invalid]="errorOf('muscleMassKg') !== null"
              [attr.aria-describedby]="
                errorOf('muscleMassKg') ? id('muscleMassKg') + '-error' : null
              "
            />
          </div>
          @if (errorOf('muscleMassKg'); as error) {
            <span class="nq-field-error" [id]="id('muscleMassKg') + '-error'">{{ error }}</span>
          }
        </div>
      </div>

      <fieldset class="medidas">
        <legend class="nq-field-label">Medidas (cm)</legend>
        <div class="medidas-grid">
          @for (medida of medidas; track medida.control) {
            <div class="field">
              <label class="nq-field-label sm" [attr.for]="id(medida.control)">
                {{ medida.label }}
              </label>
              <div class="nq-field-input" [class.error]="errorOf(medida.control) !== null">
                <input
                  [attr.id]="id(medida.control)"
                  [formControlName]="medida.control"
                  type="number"
                  inputmode="decimal"
                  [min]="rangos[medida.control].min"
                  [max]="rangos[medida.control].max"
                  step="0.1"
                  [attr.aria-invalid]="errorOf(medida.control) !== null"
                  [attr.aria-describedby]="
                    errorOf(medida.control) ? id(medida.control) + '-error' : null
                  "
                />
              </div>
              @if (errorOf(medida.control); as error) {
                <span class="nq-field-error" [id]="id(medida.control) + '-error'">
                  {{ error }}
                </span>
              }
            </div>
          }
        </div>
      </fieldset>

      <div class="field">
        <label class="nq-field-label" [attr.for]="id('notas')">Notas</label>
        <div class="nq-field-input">
          <input
            [attr.id]="id('notas')"
            formControlName="notes"
            enterkeyhint="done"
            maxlength="1000"
          />
        </div>
      </div>

      @if (errorMessage(); as error) {
        <p class="nq-field-error submit-error" role="alert">{{ error }}</p>
      }

      <div class="form-actions nq-sheet-actions">
        <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelled.emit()">
          Cancelar
        </button>
        <button
          class="nq-btn nq-btn-primary"
          type="submit"
          [disabled]="busy()"
          [attr.aria-busy]="busy()"
        >
          {{ busy() ? 'Guardando…' : 'Registrar' }}
        </button>
      </div>
    </form>
  `,
  styleUrl: './assessment-form.component.scss',
})
export class AssessmentFormComponent {
  /** Estatura de la ficha, para no volver a medirla en cada evaluacion. */
  readonly defaultHeightCm = input<number | null>(null);
  readonly busy = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly submitted = output<Omit<Assessment, 'id' | 'studentId' | 'takenAt'>>();
  readonly cancelled = output<void>();

  readonly medidas = MEDIDAS;
  readonly rangos = RANGOS;

  readonly form = inject(FormBuilder).nonNullable.group({
    weightKg: [null as number | null, [Validators.required, ...rango('weightKg')]],
    heightCm: [null as number | null, [Validators.required, ...rango('heightCm')]],
    bodyFatPct: [null as number | null, rango('bodyFatPct')],
    muscleMassKg: [null as number | null, rango('muscleMassKg')],
    chestCm: [null as number | null, rango('chestCm')],
    waistCm: [null as number | null, rango('waistCm')],
    hipCm: [null as number | null, rango('hipCm')],
    armCm: [null as number | null, rango('armCm')],
    thighCm: [null as number | null, rango('thighCm')],
    notes: ['', Validators.maxLength(1000)],
  });

  /** Valores como senal: los errores se recalculan al corregir un campo. */
  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Solo el faltante de peso o estatura; los rangos van junto a su campo. */
  readonly requiredError = computed(() => {
    this.valores();
    const { weightKg, heightCm } = this.form.controls;
    return this.intentado() && (weightKg.hasError('required') || heightCm.hasError('required'));
  });

  private readonly intentado = signal(false);
  private readonly uid = `ev-${Math.random().toString(36).slice(2, 8)}`;

  id(campo: string): string {
    return `${this.uid}-${campo}`;
  }

  /** «Entre 20 y 300 kg.» cuando el valor esta fuera de rango, tras intentar guardar. */
  errorOf(campo: CampoNumerico): string | null {
    this.valores();
    const control = this.form.controls[campo];
    if (!this.intentado() || !(control.hasError('min') || control.hasError('max'))) {
      return null;
    }
    const { min, max, unidad } = RANGOS[campo];
    return `Entre ${min} y ${max} ${unidad}.`;
  }

  reset(): void {
    this.intentado.set(false);
    this.form.reset({ heightCm: this.defaultHeightCm(), notes: '' });
  }

  onSubmit(): void {
    this.intentado.set(true);
    if (this.form.invalid || this.busy()) {
      return;
    }

    const raw = this.form.getRawValue();
    // La fecha no viaja: la pone el backend con su reloj.
    this.submitted.emit({
      weightKg: raw.weightKg ?? 0,
      heightCm: raw.heightCm ?? 0,
      bodyFatPct: raw.bodyFatPct,
      muscleMassKg: raw.muscleMassKg,
      measurements: {
        chestCm: raw.chestCm,
        waistCm: raw.waistCm,
        hipCm: raw.hipCm,
        armCm: raw.armCm,
        thighCm: raw.thighCm,
      },
      notes: raw.notes.trim() === '' ? null : raw.notes.trim(),
    });
  }
}
