import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Student } from '@app/domain/students/model/student.model';

/** Lo que el formulario entrega, ya normalizado. */
export interface StudentFormValue {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly birthDate: string | null;
  readonly heightCm: number | null;
  readonly goal: string | null;
}

/**
 * Formulario de alta y de edicion de un alumno.
 *
 * Es el mismo en los dos casos salvo el correo, que en la edicion no se
 * toca: cambiarlo dejaria invitaciones emitidas apuntando a otra persona.
 */
@Component({
  selector: 'nq-student-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <div class="row-2">
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('nombre')">Nombre</label>
          <div class="nq-field-input">
            <input [id]="id('nombre')" formControlName="firstName" enterkeyhint="next" />
          </div>
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('apellido')">Apellido</label>
          <div class="nq-field-input">
            <input [id]="id('apellido')" formControlName="lastName" enterkeyhint="next" />
          </div>
        </div>
      </div>

      @if (mode() === 'create') {
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('correo')">Correo</label>
          <div class="nq-field-input">
            <input
              [id]="id('correo')"
              formControlName="email"
              type="email"
              inputmode="email"
              autocomplete="off"
              enterkeyhint="next"
              placeholder="alumno@correo.cl"
              [attr.aria-describedby]="emailError() ? id('correo') + '-error' : null"
            />
          </div>
          @if (emailError(); as error) {
            <span class="nq-field-error" [id]="id('correo') + '-error'">{{ error }}</span>
          }
        </div>
      }

      <div class="row-2">
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('telefono')">Teléfono</label>
          <div class="nq-field-input">
            <input
              [id]="id('telefono')"
              formControlName="phone"
              type="tel"
              inputmode="tel"
              enterkeyhint="next"
              placeholder="+56 9 ..."
            />
          </div>
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('nacimiento')">Nacimiento</label>
          <div class="nq-field-input">
            <input [id]="id('nacimiento')" formControlName="birthDate" type="date" />
          </div>
        </div>
      </div>

      <div class="row-2">
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('estatura')">Estatura (cm)</label>
          <div class="nq-field-input">
            <input
              [id]="id('estatura')"
              formControlName="heightCm"
              type="number"
              inputmode="numeric"
              min="100"
              max="250"
              enterkeyhint="next"
            />
          </div>
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('objetivo')">Objetivo</label>
          <div class="nq-field-input">
            <input
              [id]="id('objetivo')"
              formControlName="goal"
              enterkeyhint="done"
              placeholder="Ganar masa"
            />
          </div>
        </div>
      </div>

      @if (errorMessage(); as error) {
        <p class="nq-field-error submit-error" role="alert">{{ error }}</p>
      }

      @if (hint() !== '') {
        <p class="hint">{{ hint() }}</p>
      }

      <div class="form-actions nq-sheet-actions">
        <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelled.emit()">
          Cancelar
        </button>
        <button class="nq-btn nq-btn-primary" type="submit" [disabled]="form.invalid || busy()">
          {{ busy() ? 'Guardando…' : submitLabel() }}
        </button>
      </div>
    </form>
  `,
  styleUrl: './student-form.component.scss',
})
export class StudentFormComponent {
  readonly mode = input<'create' | 'edit'>('create');
  readonly student = input<Student | null>(null);
  readonly busy = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly hint = input('');
  readonly submitLabel = input('Guardar');

  readonly submitted = output<StudentFormValue>();
  readonly cancelled = output<void>();

  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    birthDate: [''],
    // `type=number` usa NumberValueAccessor: el control recibe number, no
    // string. Declararlo como texto revienta al normalizarlo.
    heightCm: [null as number | null],
    goal: [''],
  });

  readonly emailError = computed(() => {
    const control = this.form.controls.email;
    if (!this.emailTouched() || control.valid) {
      return null;
    }
    return control.hasError('required') ? 'Ingresa un correo.' : 'Ese correo no es válido.';
  });

  private readonly emailTouched = signal(false);
  private readonly uid = `sf-${Math.random().toString(36).slice(2, 8)}`;

  /** Ids unicos por instancia: el alta y la edicion pueden convivir en el DOM. */
  id(campo: string): string {
    return `${this.uid}-${campo}`;
  }

  /** Vacia el formulario o lo precarga con el alumno recibido. */
  reset(): void {
    const student = this.student();
    this.emailTouched.set(false);
    this.form.reset({
      firstName: student?.firstName ?? '',
      lastName: student?.lastName ?? '',
      email: student?.email ?? '',
      phone: student?.phone ?? '',
      birthDate: student?.birthDate ?? '',
      heightCm: student?.heightCm ?? null,
      goal: student?.goal ?? '',
    });
  }

  onSubmit(): void {
    // Se normaliza ANTES de validar: un correo pegado con espacios al final
    // es valido para cualquiera menos para `Validators.email`.
    this.form.controls.email.setValue(this.form.controls.email.value.trim().toLowerCase());
    this.emailTouched.set(true);

    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    this.submitted.emit({
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      email: raw.email,
      phone: this.texto(raw.phone),
      birthDate: this.texto(raw.birthDate),
      heightCm: raw.heightCm,
      goal: this.texto(raw.goal),
    });
  }

  /** Un campo opcional vacio es null, no cadena vacia. */
  private texto(value: string): string | null {
    const limpio = value.trim();
    return limpio === '' ? null : limpio;
  }
}
