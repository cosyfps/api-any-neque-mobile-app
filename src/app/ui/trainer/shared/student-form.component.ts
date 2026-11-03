import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { CLOCK } from '@app/domain/shared/port/clock.port';
import { Student } from '@app/domain/students/model/student.model';

import { PHONE_PATTERN, dateBetween, localIsoDay, notBlank } from '@shared/validators/field-rules';

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

/** Estatura admitida, la misma que anuncian los `min`/`max` del input. */
const ESTATURA_MIN = 100;
const ESTATURA_MAX = 250;

/** Nadie nacido antes de esto entrena: es un error de tipeo del año. */
const NACIMIENTO_MIN = '1900-01-01';

type Campo = 'firstName' | 'lastName' | 'email' | 'phone' | 'birthDate' | 'heightCm';

/**
 * Formulario de alta y de edicion de un alumno.
 *
 * Es el mismo en los dos casos salvo el correo, que en la edicion no se
 * toca: cambiarlo dejaria invitaciones emitidas apuntando a otra persona.
 *
 * El boton queda habilitado y los errores se muestran junto a cada campo al
 * salir de el o al intentar guardar: con el boton deshabilitado, un correo
 * con un espacio al final lo bloqueaba sin decir por que.
 */
@Component({
  selector: 'nq-student-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <div class="row-2">
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('nombre')">Nombre *</label>
          <div class="nq-field-input" [class.error]="errorOf('firstName') !== null">
            <input
              [id]="id('nombre')"
              formControlName="firstName"
              autocomplete="off"
              enterkeyhint="next"
              maxlength="60"
              [attr.aria-invalid]="errorOf('firstName') !== null"
              [attr.aria-describedby]="errorOf('firstName') ? id('nombre') + '-error' : null"
              (blur)="touch('firstName')"
            />
          </div>
          @if (errorOf('firstName'); as error) {
            <span class="nq-field-error" [id]="id('nombre') + '-error'">{{ error }}</span>
          }
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('apellido')">Apellido *</label>
          <div class="nq-field-input" [class.error]="errorOf('lastName') !== null">
            <input
              [id]="id('apellido')"
              formControlName="lastName"
              autocomplete="off"
              enterkeyhint="next"
              maxlength="60"
              [attr.aria-invalid]="errorOf('lastName') !== null"
              [attr.aria-describedby]="errorOf('lastName') ? id('apellido') + '-error' : null"
              (blur)="touch('lastName')"
            />
          </div>
          @if (errorOf('lastName'); as error) {
            <span class="nq-field-error" [id]="id('apellido') + '-error'">{{ error }}</span>
          }
        </div>
      </div>

      @if (mode() === 'create') {
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('correo')">Correo *</label>
          <div class="nq-field-input" [class.error]="emailError() !== null">
            <input
              [id]="id('correo')"
              formControlName="email"
              type="email"
              inputmode="email"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              enterkeyhint="next"
              maxlength="254"
              placeholder="alumno@correo.cl"
              [attr.aria-invalid]="emailError() !== null"
              [attr.aria-describedby]="emailError() ? id('correo') + '-error' : null"
              (blur)="touchEmail()"
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
          <div class="nq-field-input" [class.error]="errorOf('phone') !== null">
            <input
              [id]="id('telefono')"
              formControlName="phone"
              type="tel"
              inputmode="tel"
              autocomplete="off"
              enterkeyhint="next"
              maxlength="16"
              placeholder="+56 9 ..."
              [attr.aria-invalid]="errorOf('phone') !== null"
              [attr.aria-describedby]="errorOf('phone') ? id('telefono') + '-error' : null"
              (blur)="touch('phone')"
            />
          </div>
          @if (errorOf('phone'); as error) {
            <span class="nq-field-error" [id]="id('telefono') + '-error'">{{ error }}</span>
          }
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('nacimiento')">Nacimiento</label>
          <div class="nq-field-input" [class.error]="errorOf('birthDate') !== null">
            <input
              [id]="id('nacimiento')"
              formControlName="birthDate"
              type="date"
              [min]="nacimientoMin"
              [max]="hoy()"
              [attr.aria-invalid]="errorOf('birthDate') !== null"
              [attr.aria-describedby]="errorOf('birthDate') ? id('nacimiento') + '-error' : null"
              (blur)="touch('birthDate')"
            />
          </div>
          @if (errorOf('birthDate'); as error) {
            <span class="nq-field-error" [id]="id('nacimiento') + '-error'">{{ error }}</span>
          }
        </div>
      </div>

      <div class="row-2">
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('estatura')">Estatura (cm)</label>
          <div class="nq-field-input" [class.error]="errorOf('heightCm') !== null">
            <input
              [id]="id('estatura')"
              formControlName="heightCm"
              type="number"
              inputmode="numeric"
              [min]="estaturaMin"
              [max]="estaturaMax"
              step="1"
              enterkeyhint="next"
              [attr.aria-invalid]="errorOf('heightCm') !== null"
              [attr.aria-describedby]="errorOf('heightCm') ? id('estatura') + '-error' : null"
              (blur)="touch('heightCm')"
            />
          </div>
          @if (errorOf('heightCm'); as error) {
            <span class="nq-field-error" [id]="id('estatura') + '-error'">{{ error }}</span>
          }
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('objetivo')">Objetivo</label>
          <div class="nq-field-input">
            <input
              [id]="id('objetivo')"
              formControlName="goal"
              enterkeyhint="done"
              maxlength="500"
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
        <button
          class="nq-btn nq-btn-primary"
          type="submit"
          [disabled]="busy()"
          [attr.aria-busy]="busy()"
        >
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

  readonly estaturaMin = ESTATURA_MIN;
  readonly estaturaMax = ESTATURA_MAX;
  readonly nacimientoMin = NACIMIENTO_MIN;

  private readonly clock = inject(CLOCK);
  /** Hoy en `yyyy-MM-dd`: el tope de la fecha de nacimiento. */
  readonly hoy = (): string => localIsoDay(this.clock.now());

  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [notBlank, Validators.maxLength(60)]],
    lastName: ['', [notBlank, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.pattern(PHONE_PATTERN)]],
    birthDate: ['', [dateBetween(() => NACIMIENTO_MIN, this.hoy)]],
    // `type=number` usa NumberValueAccessor: el control recibe number, no
    // string. Declararlo como texto revienta al normalizarlo.
    heightCm: [null as number | null, [Validators.min(ESTATURA_MIN), Validators.max(ESTATURA_MAX)]],
    goal: ['', [Validators.maxLength(500)]],
  });

  /** Valores y estado como senal: los errores se recalculan al escribir. */
  private readonly estado = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  private readonly tocados = signal<ReadonlySet<Campo>>(new Set());

  readonly emailError = computed(() => this.errorOf('email'));

  private readonly uid = `sf-${Math.random().toString(36).slice(2, 8)}`;

  /** Ids unicos por instancia: el alta y la edicion pueden convivir en el DOM. */
  id(campo: string): string {
    return `${this.uid}-${campo}`;
  }

  /** Mensaje del campo, solo si ya se salio de el o se intento guardar. */
  errorOf(campo: Campo): string | null {
    this.estado();
    if (!this.tocados().has(campo)) {
      return null;
    }
    const control = this.form.controls[campo];
    if (control.valid) {
      return null;
    }
    switch (campo) {
      case 'firstName':
        return 'Escribe el nombre.';
      case 'lastName':
        return 'Escribe el apellido.';
      case 'email':
        return control.hasError('required') ? 'Ingresa un correo.' : 'Ese correo no es válido.';
      case 'phone':
        return 'Solo números y espacios, entre 8 y 16.';
      case 'birthDate':
        return 'La fecha no puede ser futura ni anterior a 1900.';
      case 'heightCm':
        return `Entre ${ESTATURA_MIN} y ${ESTATURA_MAX} cm.`;
    }
  }

  touch(campo: Campo): void {
    this.tocados.update(actual => new Set([...actual, campo]));
  }

  /**
   * Al salir del correo se recorta y pasa a minuscula: el autocompletado de
   * iOS agrega un espacio al final que `Validators.email` no acepta.
   */
  touchEmail(): void {
    this.normalizarCorreo();
    this.touch('email');
  }

  /** Vacia el formulario o lo precarga con el alumno recibido. */
  reset(): void {
    const student = this.student();
    this.tocados.set(new Set());
    this.form.reset({
      firstName: student?.firstName ?? '',
      lastName: student?.lastName ?? '',
      email: student?.email ?? '',
      phone: student?.phone ?? '',
      birthDate: student?.birthDate?.slice(0, 10) ?? '',
      heightCm: student?.heightCm ?? null,
      goal: student?.goal ?? '',
    });
  }

  onSubmit(): void {
    // Se normaliza ANTES de validar: un correo pegado con espacios al final
    // es valido para cualquiera menos para `Validators.email`.
    this.normalizarCorreo();
    this.tocados.set(new Set(['firstName', 'lastName', 'email', 'phone', 'birthDate', 'heightCm']));

    if (this.form.invalid || this.busy()) {
      return;
    }

    const raw = this.form.getRawValue();
    this.submitted.emit({
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      email: raw.email,
      phone: this.texto(raw.phone),
      birthDate: this.texto(raw.birthDate),
      heightCm: raw.heightCm === null ? null : Math.round(raw.heightCm),
      goal: this.texto(raw.goal),
    });
  }

  private normalizarCorreo(): void {
    const control = this.form.controls.email;
    const limpio = control.value.trim().toLowerCase();
    if (limpio !== control.value) {
      control.setValue(limpio);
    }
  }

  /** Un campo opcional vacio es null, no cadena vacia. */
  private texto(value: string): string | null {
    const limpio = value.trim();
    return limpio === '' ? null : limpio;
  }
}
