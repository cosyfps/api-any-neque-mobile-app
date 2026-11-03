import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Assessment } from '@app/domain/students/model/assessment.model';

/** Las cinco medidas corporales, en el orden en que se toman. */
const MEDIDAS = [
  { control: 'chestCm', label: 'Pecho' },
  { control: 'waistCm', label: 'Cintura' },
  { control: 'hipCm', label: 'Cadera' },
  { control: 'armCm', label: 'Brazo' },
  { control: 'thighCm', label: 'Muslo' },
] as const;

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
          <label class="nq-field-label" [attr.for]="id('peso')">Peso (kg) *</label>
          <div class="nq-field-input">
            <input
              [attr.id]="id('peso')"
              formControlName="weightKg"
              type="number"
              inputmode="decimal"
              min="20"
              max="300"
              step="0.1"
            />
          </div>
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('estatura')">Estatura (cm) *</label>
          <div class="nq-field-input">
            <input
              [attr.id]="id('estatura')"
              formControlName="heightCm"
              type="number"
              inputmode="numeric"
              min="100"
              max="250"
            />
          </div>
        </div>
      </div>

      @if (requiredError()) {
        <span class="nq-field-error" role="alert">
          Peso y estatura son obligatorios: de ellos sale el IMC del alumno.
        </span>
      }

      <div class="row-2">
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('grasa')">Grasa (%)</label>
          <div class="nq-field-input">
            <input
              [attr.id]="id('grasa')"
              formControlName="bodyFatPct"
              type="number"
              inputmode="decimal"
              min="1"
              max="70"
              step="0.1"
            />
          </div>
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('musculo')">Masa muscular (kg)</label>
          <div class="nq-field-input">
            <input
              [attr.id]="id('musculo')"
              formControlName="muscleMassKg"
              type="number"
              inputmode="decimal"
              min="1"
              max="150"
              step="0.1"
            />
          </div>
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
              <div class="nq-field-input">
                <input
                  [attr.id]="id(medida.control)"
                  [formControlName]="medida.control"
                  type="number"
                  inputmode="decimal"
                  min="10"
                  max="250"
                  step="0.1"
                />
              </div>
            </div>
          }
        </div>
      </fieldset>

      <div class="field">
        <label class="nq-field-label" [attr.for]="id('notas')">Notas</label>
        <div class="nq-field-input">
          <input [attr.id]="id('notas')" formControlName="notes" enterkeyhint="done" />
        </div>
      </div>

      @if (errorMessage(); as error) {
        <p class="nq-field-error submit-error" role="alert">{{ error }}</p>
      }

      <div class="form-actions nq-sheet-actions">
        <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelled.emit()">
          Cancelar
        </button>
        <button class="nq-btn nq-btn-primary" type="submit" [disabled]="busy()">
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

  readonly form = inject(FormBuilder).nonNullable.group({
    weightKg: [null as number | null, Validators.required],
    heightCm: [null as number | null, Validators.required],
    bodyFatPct: [null as number | null],
    muscleMassKg: [null as number | null],
    chestCm: [null as number | null],
    waistCm: [null as number | null],
    hipCm: [null as number | null],
    armCm: [null as number | null],
    thighCm: [null as number | null],
    notes: [''],
  });

  readonly requiredError = computed(() => this.intentado() && this.form.invalid);

  private readonly intentado = signal(false);
  private readonly uid = `ev-${Math.random().toString(36).slice(2, 8)}`;

  id(campo: string): string {
    return `${this.uid}-${campo}`;
  }

  reset(): void {
    this.intentado.set(false);
    this.form.reset({ heightCm: this.defaultHeightCm(), notes: '' });
  }

  onSubmit(): void {
    this.intentado.set(true);
    if (this.form.invalid) {
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
