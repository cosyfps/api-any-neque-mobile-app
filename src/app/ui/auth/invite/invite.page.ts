import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideCheck, LucideEye, LucideEyeOff, LucideLoaderCircle } from '@lucide/angular';

import { InvitationFacade } from '@app/application/auth/invitation.facade';
import { isPasswordValid, passwordRules } from '@app/ui/shared/validators/password-rules';

import { PageStateComponent } from '@shared/components/page-state.component';

@Component({
  selector: 'app-invite',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageStateComponent,
    LucideCheck,
    LucideEye,
    LucideEyeOff,
    LucideLoaderCircle,
  ],
  template: `
    <div class="nq-screen">
      <div class="invite">
        @switch (facade.viewState()) {
          @case ('loading') {
            <nq-page-state type="loading" />
          }
          @case ('error') {
            <!-- Solo un enlace rechazado es "no valido": con la red o el
                 servicio caidos el enlace puede estar bien y se reintenta. -->
            <nq-page-state
              type="error"
              [title]="
                facade.linkRejected() ? 'Invitación no válida' : 'No pudimos cargar la invitación'
              "
              [message]="facade.errorMessage() ?? ''"
              [showRetry]="!facade.linkRejected()"
              [retry]="retryLoad"
            />
            <button class="nq-btn nq-btn-secondary go-login" type="button" (click)="goToLogin()">
              Ir a ingresar
            </button>
          }
          @case ('empty') {
            <nq-page-state type="error" title="Invitación no válida" [showRetry]="false" />
          }
          @case ('success') {
            <div class="invite-head nq-ani">
              <h1 class="nq-h1">Hola, {{ facade.studentName() }}</h1>
              <p class="invite-desc">
                {{ facade.trainerName() }} te invitó a entrenar en Ñeque.<br />
                Crea tu contraseña para entrar.
              </p>
            </div>

            <form
              class="invite-form nq-ani nq-d1"
              [formGroup]="form"
              (ngSubmit)="onSubmit()"
              novalidate
            >
              <div class="field">
                <label class="nq-field-label" for="invite-password">Contraseña</label>
                <div class="nq-field-input">
                  <input
                    id="invite-password"
                    formControlName="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    autocomplete="new-password"
                    enterkeyhint="next"
                    placeholder="Tu nueva contraseña"
                    aria-describedby="invite-pwd-rules"
                  />
                  <button
                    class="toggle-visibility"
                    type="button"
                    [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                    (click)="togglePassword()"
                  >
                    @if (showPassword()) {
                      <svg lucideEyeOff [size]="18" [strokeWidth]="1.8"></svg>
                    } @else {
                      <svg lucideEye [size]="18" [strokeWidth]="1.8"></svg>
                    }
                  </button>
                </div>
              </div>

              <ul class="pwd-rules" id="invite-pwd-rules">
                @for (rule of rules(); track rule.label) {
                  <li class="pwd-rule" [class.met]="rule.met">
                    <span class="pwd-rule-dot">
                      @if (rule.met) {
                        <svg lucideCheck [size]="12" [strokeWidth]="3"></svg>
                      }
                    </span>
                    {{ rule.label }}
                  </li>
                }
              </ul>

              <div class="field" [class.has-error]="confirmError() !== null">
                <label class="nq-field-label" for="invite-confirm">Repite la contraseña</label>
                <div class="nq-field-input">
                  <input
                    id="invite-confirm"
                    formControlName="confirm"
                    [type]="showConfirm() ? 'text' : 'password'"
                    autocomplete="new-password"
                    enterkeyhint="done"
                    placeholder="Confírmala"
                    [attr.aria-describedby]="confirmError() ? 'invite-confirm-error' : null"
                    (blur)="markConfirmTouched()"
                  />
                  <button
                    class="toggle-visibility"
                    type="button"
                    [attr.aria-label]="
                      showConfirm() ? 'Ocultar la confirmación' : 'Mostrar la confirmación'
                    "
                    (click)="toggleConfirm()"
                  >
                    @if (showConfirm()) {
                      <svg lucideEyeOff [size]="18" [strokeWidth]="1.8"></svg>
                    } @else {
                      <svg lucideEye [size]="18" [strokeWidth]="1.8"></svg>
                    }
                  </button>
                </div>
                @if (confirmError(); as error) {
                  <span class="nq-field-error" id="invite-confirm-error">{{ error }}</span>
                }
              </div>

              @if (facade.submitError(); as error) {
                <p class="nq-field-error submit-error" role="alert">{{ error }}</p>
              }

              <button
                class="nq-btn nq-btn-primary"
                type="submit"
                [disabled]="!formValid() || facade.submitting()"
              >
                @if (facade.submitting()) {
                  <svg class="btn-spinner" lucideLoaderCircle [size]="20" [strokeWidth]="2"></svg>
                } @else {
                  Crear mi acceso
                }
              </button>
            </form>
          }
        }
      </div>
    </div>
  `,
  // `.nq-screen` se estira contra el ancestro posicionado que aporta esta
  // clase; sin ella el contenedor no tiene contra que medir su alto.
  host: { class: 'nq-page-host' },
  styleUrl: './invite.page.scss',
})
export class InvitePage {
  readonly facade = inject(InvitationFacade);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = new FormBuilder();

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  readonly showPassword = signal(false);
  /** Cada campo tiene su ojo: mostrar uno no revela el otro. */
  readonly showConfirm = signal(false);
  readonly confirmTouched = signal(false);

  private readonly _password = signal('');
  private readonly _confirm = signal('');

  readonly rules = computed(() => passwordRules(this._password()));
  readonly passwordValid = computed(() => isPasswordValid(this._password()));
  readonly confirmsMatch = computed(() => this._password() === this._confirm());
  readonly formValid = computed(() => this.passwordValid() && this.confirmsMatch());

  readonly confirmError = computed((): string | null => {
    if (!this.confirmTouched() || this._confirm() === '') {
      return null;
    }
    return this.confirmsMatch() ? null : 'Las contraseñas no coinciden';
  });

  constructor() {
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this._password.set(value);
        this.facade.clearSubmitError();
      });
    this.form.controls.confirm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this._confirm.set(value);
        this.facade.clearSubmitError();
      });

    this.facade.load(this.route.snapshot.paramMap.get('token') ?? '');
  }

  readonly retryLoad = (): void => this.facade.reload();

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  toggleConfirm(): void {
    this.showConfirm.update(value => !value);
  }

  markConfirmTouched(): void {
    this.confirmTouched.set(true);
  }

  goToLogin(): void {
    this.router.navigate(['/']);
  }

  async onSubmit(): Promise<void> {
    if (!this.formValid() || this.facade.submitting()) {
      return;
    }

    const route = await this.facade.accept(this.form.controls.password.value);

    if (route !== null) {
      await this.router.navigate([route]);
    }
  }
}
