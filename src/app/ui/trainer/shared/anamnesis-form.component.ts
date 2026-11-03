import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Weekday } from '@app/domain/shared/model/date';
import { Anamnesis, AnamnesisInput } from '@app/domain/students/model/anamnesis.model';

/** Etiquetas de los dias ISO, en el orden en que se muestran. */
const DIAS: readonly { value: Weekday; label: string }[] = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

/** Los cinco campos clinicos, en el orden del cuestionario. */
const CLINICOS = [
  { control: 'medicalHistory', label: 'Antecedentes médicos' },
  { control: 'previousInjuries', label: 'Lesiones previas' },
  { control: 'surgeries', label: 'Cirugías' },
  { control: 'medications', label: 'Medicamentos' },
  { control: 'allergies', label: 'Alergias' },
] as const;

/**
 * Anamnesis del alumno.
 *
 * Todo es opcional salvo el objetivo declarado y la disponibilidad: sin esos
 * dos no se puede planificar una rutina, y el formulario no deja guardarla.
 */
@Component({
  selector: 'nq-anamnesis-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <div class="field">
        <label class="nq-field-label" [attr.for]="id('objetivo')">Objetivo declarado *</label>
        <div class="nq-field-input">
          <input
            [attr.id]="id('objetivo')"
            formControlName="declaredGoal"
            enterkeyhint="next"
            placeholder="Lo que el alumno quiere lograr"
            [attr.aria-describedby]="goalError() ? id('objetivo') + '-error' : null"
          />
        </div>
        @if (goalError(); as error) {
          <span class="nq-field-error" [attr.id]="id('objetivo') + '-error'">{{ error }}</span>
        }
      </div>

      <fieldset class="days">
        <legend class="nq-field-label">Disponibilidad semanal *</legend>
        <div class="days-row">
          @for (day of dias; track day.value) {
            <button
              class="day"
              type="button"
              [class.on]="isOn(day.value)"
              [attr.aria-pressed]="isOn(day.value)"
              [attr.aria-label]="day.label"
              (click)="toggleDay(day.value)"
            >
              {{ day.label }}
            </button>
          }
        </div>
        @if (daysError()) {
          <span class="nq-field-error">Marca al menos un día.</span>
        }
      </fieldset>

      @for (campo of clinicos; track campo.control) {
        <div class="field">
          <label class="nq-field-label" [attr.for]="id(campo.control)">{{ campo.label }}</label>
          <div class="nq-field-input">
            <input [attr.id]="id(campo.control)" [formControlName]="campo.control" />
          </div>
        </div>
      }

      <div class="field">
        <label class="nq-field-label" [attr.for]="id('actividad')">Actividad previa</label>
        <div class="nq-field-input">
          <input [attr.id]="id('actividad')" formControlName="previousActivity" />
        </div>
      </div>

      <fieldset class="contact">
        <legend class="nq-field-label">Contacto de urgencia</legend>
        <div class="field">
          <div class="nq-field-input">
            <input
              [attr.id]="id('contacto-nombre')"
              formControlName="contactName"
              placeholder="Nombre"
              aria-label="Nombre del contacto de urgencia"
            />
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <div class="nq-field-input">
              <input
                [attr.id]="id('contacto-telefono')"
                formControlName="contactPhone"
                type="tel"
                inputmode="tel"
                placeholder="Teléfono"
                aria-label="Teléfono del contacto de urgencia"
              />
            </div>
          </div>
          <div class="field">
            <div class="nq-field-input">
              <input
                [attr.id]="id('contacto-parentesco')"
                formControlName="contactRelation"
                placeholder="Parentesco"
                aria-label="Parentesco del contacto de urgencia"
              />
            </div>
          </div>
        </div>
        @if (contactError()) {
          <span class="nq-field-error">
            Para marcar a alguien hacen falta su nombre y su teléfono.
          </span>
        }
      </fieldset>

      @if (errorMessage(); as error) {
        <p class="nq-field-error submit-error" role="alert">{{ error }}</p>
      }

      <div class="form-actions nq-sheet-actions">
        <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelled.emit()">
          Cancelar
        </button>
        <button class="nq-btn nq-btn-primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </form>
  `,
  styleUrl: './anamnesis-form.component.scss',
})
export class AnamnesisFormComponent {
  readonly anamnesis = input<Anamnesis | null>(null);
  readonly busy = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly submitted = output<Omit<AnamnesisInput, 'studentId'>>();
  readonly cancelled = output<void>();

  readonly dias = DIAS;
  readonly clinicos = CLINICOS;

  readonly form = inject(FormBuilder).nonNullable.group({
    declaredGoal: ['', [Validators.required, Validators.maxLength(200)]],
    medicalHistory: [''],
    previousInjuries: [''],
    surgeries: [''],
    medications: [''],
    allergies: [''],
    previousActivity: [''],
    contactName: [''],
    contactPhone: [''],
    contactRelation: [''],
  });

  readonly selectedDays = signal<readonly Weekday[]>([]);

  readonly goalError = computed(() => {
    if (!this.intentado() || this.form.controls.declaredGoal.valid) {
      return null;
    }
    return 'Sin objetivo no se puede planificar una rutina.';
  });

  readonly daysError = computed(() => this.intentado() && this.selectedDays().length === 0);

  /** Un contacto a medias no sirve: o va completo o no va. */
  readonly contactError = computed(() => {
    if (!this.intentado()) {
      return false;
    }
    const { contactName, contactPhone } = this.form.getRawValue();
    const parcial = contactName.trim() !== '' || contactPhone.trim() !== '';
    return parcial && (contactName.trim() === '' || contactPhone.trim() === '');
  });

  private readonly intentado = signal(false);
  private readonly uid = `af-${Math.random().toString(36).slice(2, 8)}`;

  id(campo: string): string {
    return `${this.uid}-${campo}`;
  }

  isOn(day: Weekday): boolean {
    return this.selectedDays().includes(day);
  }

  toggleDay(day: Weekday): void {
    this.selectedDays.update(actual =>
      actual.includes(day)
        ? actual.filter(item => item !== day)
        : [...actual, day].sort((a, b) => a - b),
    );
  }

  /** Precarga con la anamnesis registrada, o la vacia si no hay. */
  reset(): void {
    const value = this.anamnesis();
    this.intentado.set(false);
    this.selectedDays.set(value?.weeklyAvailability ?? []);
    this.form.reset({
      declaredGoal: value?.declaredGoal ?? '',
      medicalHistory: value?.medicalHistory ?? '',
      previousInjuries: value?.previousInjuries ?? '',
      surgeries: value?.surgeries ?? '',
      medications: value?.medications ?? '',
      allergies: value?.allergies ?? '',
      previousActivity: value?.previousActivity ?? '',
      contactName: value?.emergencyContact?.name ?? '',
      contactPhone: value?.emergencyContact?.phone ?? '',
      contactRelation: value?.emergencyContact?.relation ?? '',
    });
  }

  onSubmit(): void {
    this.intentado.set(true);
    if (this.form.controls.declaredGoal.invalid || this.daysError() || this.contactError()) {
      return;
    }

    const raw = this.form.getRawValue();
    this.submitted.emit({
      declaredGoal: raw.declaredGoal.trim(),
      weeklyAvailability: this.selectedDays(),
      medicalHistory: this.texto(raw.medicalHistory),
      previousInjuries: this.texto(raw.previousInjuries),
      surgeries: this.texto(raw.surgeries),
      medications: this.texto(raw.medications),
      allergies: this.texto(raw.allergies),
      previousActivity: this.texto(raw.previousActivity),
      emergencyContact:
        raw.contactName.trim() === ''
          ? null
          : {
              name: raw.contactName.trim(),
              phone: raw.contactPhone.trim(),
              relation: this.texto(raw.contactRelation) ?? 'Sin especificar',
            },
    });
  }

  private texto(value: string): string | null {
    const limpio = value.trim();
    return limpio === '' ? null : limpio;
  }
}
