import { Component, computed, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideCheck, LucideEye, LucideEyeOff } from '@lucide/angular';

import { isPasswordValid, passwordRules } from '@shared/validators/password-rules';

/** Lo que el formulario entrega al confirmar. */
export interface PasswordChange {
  readonly currentPassword: string;
  readonly newPassword: string;
}

/**
 * Cambio de contrasena desde el perfil, para alumno y entrenador.
 *
 * Pide la actual y aplica las mismas cuatro reglas que el login y la
 * invitacion. Los errores se muestran al intentar guardar, no mientras se
 * escribe; la lista de reglas si se actualiza en vivo.
 */
@Component({
  selector: 'nq-change-password-form',
  standalone: true,
  imports: [ReactiveFormsModule, LucideCheck, LucideEye, LucideEyeOff],
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <div class="field">
        <!-- El toggle comparte linea con la primera etiqueta: suelto encima
             del formulario quedaba descuadrado respecto del titulo del sheet. -->
        <div class="label-row">
          <label class="nq-field-label" [attr.for]="uid + '-actual'">Contraseña actual</label>
          <button
            class="toggle"
            type="button"
            [attr.aria-label]="visible() ? 'Ocultar contraseñas' : 'Mostrar contraseñas'"
            [attr.aria-pressed]="visible()"
            (click)="visible.set(!visible())"
          >
            @if (visible()) {
              <svg lucideEyeOff [size]="16" [strokeWidth]="2"></svg>
              Ocultar
            } @else {
              <svg lucideEye [size]="16" [strokeWidth]="2"></svg>
              Mostrar
            }
          </button>
        </div>
        <div class="nq-field-input" [class.error]="currentError() !== null">
          <input
            [id]="uid + '-actual'"
            formControlName="current"
            [type]="visible() ? 'text' : 'password'"
            autocomplete="current-password"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
            maxlength="128"
            [attr.aria-invalid]="currentError() !== null"
            [attr.aria-describedby]="currentError() ? uid + '-actual-error' : null"
          />
        </div>
        @if (currentError(); as error) {
          <span class="nq-field-error" role="alert" [id]="uid + '-actual-error'">{{ error }}</span>
        }
      </div>

      <div class="field">
        <label class="nq-field-label" [attr.for]="uid + '-nueva'">Contraseña nueva</label>
        <div class="nq-field-input" [class.error]="newError() !== null">
          <input
            [id]="uid + '-nueva'"
            formControlName="next"
            [type]="visible() ? 'text' : 'password'"
            autocomplete="new-password"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
            maxlength="128"
            [attr.aria-describedby]="
              newError() ? uid + '-reglas ' + uid + '-nueva-error' : uid + '-reglas'
            "
            [attr.aria-invalid]="newError() !== null"
          />
        </div>
        <ul class="rules" [id]="uid + '-reglas'">
          @for (rule of rules(); track rule.label) {
            <li [class.met]="rule.met">
              <span class="dot">
                @if (rule.met) {
                  <svg lucideCheck [size]="11" [strokeWidth]="3"></svg>
                }
              </span>
              {{ rule.label }}
            </li>
          }
        </ul>
        @if (newError(); as error) {
          <span class="nq-field-error" role="alert" [id]="uid + '-nueva-error'">{{ error }}</span>
        }
      </div>

      <div class="field">
        <label class="nq-field-label" [attr.for]="uid + '-repite'">Repite la nueva</label>
        <div class="nq-field-input" [class.error]="confirmError() !== null">
          <input
            [id]="uid + '-repite'"
            formControlName="confirm"
            [type]="visible() ? 'text' : 'password'"
            autocomplete="new-password"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="done"
            maxlength="128"
            [attr.aria-invalid]="confirmError() !== null"
            [attr.aria-describedby]="confirmError() ? uid + '-repite-error' : null"
          />
        </div>
        @if (confirmError(); as error) {
          <span class="nq-field-error" role="alert" [id]="uid + '-repite-error'">{{ error }}</span>
        }
      </div>

      @if (errorMessage(); as error) {
        <p class="nq-field-error" role="alert">{{ error }}</p>
      }

      <div class="actions nq-sheet-actions">
        <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelled.emit()">
          Cancelar
        </button>
        <button class="nq-btn nq-btn-primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Guardando…' : 'Cambiar' }}
        </button>
      </div>
    </form>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .field {
        min-width: 0;
      }
      .nq-field-input.error {
        border-color: var(--nq-danger);
      }
      .label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .label-row .nq-field-label {
        margin-bottom: 0;
      }
      /* 44px de toque sin agrandar la fila: los margenes negativos lo
         dejan alineado con la etiqueta. */
      .toggle {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        min-height: 44px;
        margin: -12px -8px -12px 0;
        padding: 0 8px;
        font-family: var(--nq-font-family);
        font-size: 13px;
        font-weight: 600;
        color: var(--nq-primary-strong);
        cursor: pointer;
        background: none;
        border: none;
      }
      .toggle:focus-visible {
        outline: 2px solid var(--nq-primary-strong);
        outline-offset: 2px;
      }
      .rules {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 12px;
        margin: 8px 0 0;
        padding: 0;
        list-style: none;
      }
      .rules li {
        display: flex;
        gap: 8px;
        align-items: center;
        font-size: 12px;
        color: var(--nq-text-muted);
      }
      .rules li.met {
        color: var(--nq-primary-strong);
      }
      .dot {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        color: var(--nq-text-inverse);
        background: var(--nq-surface-2);
        border-radius: var(--nq-radius-full);
      }
      .met .dot {
        background: var(--nq-primary-strong);
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 8px;
      }
    `,
  ],
})
export class ChangePasswordFormComponent {
  readonly busy = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly submitted = output<PasswordChange>();
  readonly cancelled = output<void>();

  readonly uid = `pwd-${Math.random().toString(36).slice(2, 8)}`;
  readonly visible = signal(false);

  readonly form = new FormGroup({
    current: new FormControl('', { nonNullable: true }),
    next: new FormControl('', { nonNullable: true }),
    confirm: new FormControl('', { nonNullable: true }),
  });

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  private readonly intentado = signal(false);

  readonly rules = computed(() => passwordRules(this.valores().next ?? ''));

  readonly currentError = computed(() =>
    this.intentado() && (this.valores().current ?? '') === ''
      ? 'Escribe tu contraseña actual.'
      : null,
  );

  readonly newError = computed(() => {
    if (!this.intentado()) {
      return null;
    }
    const { current = '', next = '' } = this.valores();
    if (!isPasswordValid(next)) {
      return 'La nueva no cumple las cuatro reglas.';
    }
    return next === current ? 'La nueva tiene que ser distinta de la actual.' : null;
  });

  readonly confirmError = computed(() => {
    if (!this.intentado()) {
      return null;
    }
    const { next = '', confirm = '' } = this.valores();
    return confirm !== next ? 'No coincide con la contraseña nueva.' : null;
  });

  /** Deja el formulario limpio para la proxima vez que se abra. */
  reset(): void {
    this.form.reset();
    this.intentado.set(false);
    this.visible.set(false);
  }

  onSubmit(): void {
    this.intentado.set(true);
    if (
      this.currentError() !== null ||
      this.newError() !== null ||
      this.confirmError() !== null ||
      this.busy()
    ) {
      return;
    }
    const { current, next } = this.form.getRawValue();
    this.submitted.emit({ currentPassword: current, newPassword: next });
  }
}
