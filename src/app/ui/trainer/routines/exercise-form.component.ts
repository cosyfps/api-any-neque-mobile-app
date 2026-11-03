import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  ExerciseInput,
  MUSCLE_GROUP_LABEL,
  MuscleGroup,
} from '@app/domain/routines/model/exercise.model';

import { notBlank } from '@shared/validators/field-rules';

const GRUPOS = Object.entries(MUSCLE_GROUP_LABEL).map(([value, label]) => ({
  value: value as MuscleGroup,
  label,
}));

/** Limites del backend para las instrucciones. */
const MAX_PASOS = 20;
const MAX_LARGO_PASO = 500;

/**
 * Alta de un ejercicio propio.
 *
 * Queda privado del entrenador que lo crea: el puerto le pone su
 * `ownerTrainerId` y nadie mas lo ve en su catalogo.
 */
@Component({
  selector: 'nq-exercise-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <div class="field">
        <label class="nq-field-label" [attr.for]="id('nombre')">Nombre *</label>
        <div class="nq-field-input">
          <input
            [attr.id]="id('nombre')"
            formControlName="name"
            enterkeyhint="next"
            maxlength="80"
            placeholder="Sentadilla búlgara"
            [attr.aria-invalid]="nameError()"
            [attr.aria-describedby]="nameError() ? id('nombre') + '-error' : null"
          />
        </div>
        @if (nameError()) {
          <span class="nq-field-error" [attr.id]="id('nombre') + '-error'">
            Ponle un nombre para poder encontrarlo.
          </span>
        }
      </div>

      <div class="field">
        <label class="nq-field-label" [attr.for]="id('grupo')">Grupo muscular *</label>
        <div class="nq-field-input">
          <select [attr.id]="id('grupo')" formControlName="muscleGroup">
            @for (grupo of grupos; track grupo.value) {
              <option [value]="grupo.value">{{ grupo.label }}</option>
            }
          </select>
        </div>
      </div>

      <div class="field">
        <label class="nq-field-label" [attr.for]="id('equipo')">Equipamiento</label>
        <div class="nq-field-input">
          <input
            [attr.id]="id('equipo')"
            formControlName="equipment"
            enterkeyhint="next"
            maxlength="120"
            placeholder="Mancuernas"
          />
        </div>
      </div>

      <div class="field">
        <label class="nq-field-label" [attr.for]="id('instrucciones')">
          Instrucciones (una por línea)
        </label>
        <div class="nq-field-input tall">
          <textarea
            [attr.id]="id('instrucciones')"
            formControlName="instructions"
            rows="4"
            placeholder="Apoya el pie trasero en el banco&#10;Baja hasta 90 grados"
            [attr.aria-invalid]="instructionsError() !== null"
            [attr.aria-describedby]="instructionsError() ? id('instrucciones') + '-error' : null"
          ></textarea>
        </div>
        @if (instructionsError(); as error) {
          <span class="nq-field-error" [attr.id]="id('instrucciones') + '-error'">
            {{ error }}
          </span>
        }
      </div>

      @if (errorMessage(); as error) {
        <p class="nq-field-error submit-error" role="alert">{{ error }}</p>
      }

      <p class="hint">Solo tú verás este ejercicio en tu catálogo.</p>

      <div class="form-actions nq-sheet-actions">
        <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelled.emit()">
          Cancelar
        </button>
        <button class="nq-btn nq-btn-primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Guardando…' : 'Crear ejercicio' }}
        </button>
      </div>
    </form>
  `,
  styleUrl: './exercise-form.component.scss',
})
export class ExerciseFormComponent {
  readonly busy = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly submitted = output<Omit<ExerciseInput, 'ownerTrainerId'>>();
  readonly cancelled = output<void>();

  readonly grupos = GRUPOS;

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [notBlank, Validators.maxLength(80)]],
    muscleGroup: ['fullbody' as MuscleGroup, Validators.required],
    equipment: ['', Validators.maxLength(120)],
    instructions: [''],
  });

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly nameError = computed(() => {
    this.valores();
    return this.intentado() && this.form.controls.name.invalid;
  });

  /** El backend guarda hasta 20 pasos de 500 caracteres cada uno. */
  readonly instructionsError = computed(() => {
    if (!this.intentado()) {
      return null;
    }
    const pasos = this.pasos(this.valores().instructions ?? '');
    if (pasos.length > MAX_PASOS) {
      return `Hasta ${MAX_PASOS} pasos; ahora hay ${pasos.length}.`;
    }
    return pasos.some(paso => paso.length > MAX_LARGO_PASO)
      ? `Cada paso puede tener hasta ${MAX_LARGO_PASO} caracteres.`
      : null;
  });

  private readonly intentado = signal(false);
  private readonly uid = `ex-${Math.random().toString(36).slice(2, 8)}`;

  id(campo: string): string {
    return `${this.uid}-${campo}`;
  }

  reset(): void {
    this.intentado.set(false);
    this.form.reset({ name: '', muscleGroup: 'fullbody', equipment: '', instructions: '' });
  }

  onSubmit(): void {
    this.intentado.set(true);
    if (this.form.invalid || this.instructionsError() !== null || this.busy()) {
      return;
    }

    const raw = this.form.getRawValue();
    this.submitted.emit({
      name: raw.name.trim(),
      muscleGroup: raw.muscleGroup,
      equipment: raw.equipment.trim() === '' ? null : raw.equipment.trim(),
      thumbnailUrl: null,
      // Una linea por paso: es como los renderiza la ficha del ejercicio.
      instructions: this.pasos(raw.instructions),
    });
  }

  private pasos(texto: string): string[] {
    return texto
      .split('\n')
      .map(linea => linea.trim())
      .filter(linea => linea !== '');
  }
}
