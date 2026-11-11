import {
  Component,
  computed,
  signal,
  DestroyRef,
  inject,
  ViewChildren,
  QueryList,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideCircleAlert,
  LucideLoaderCircle,
  LucideArrowLeft,
  LucideCheck,
  LucideEye,
  LucideEyeOff,
} from '@lucide/angular';

import { SessionFacade } from '@app/application/auth/session.facade';
import { PasswordResetTicket } from '@app/domain/auth/model/auth-user.model';
import { AUTH_PORT } from '@app/domain/auth/port/auth.port';
import { toDomainError } from '@app/domain/shared/model/app-error';
import { isPasswordValid, passwordRules } from '@app/ui/shared/validators/password-rules';

const OTP_LENGTH = 6;

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    LucideCircleAlert,
    LucideLoaderCircle,
    LucideArrowLeft,
    LucideCheck,
    LucideEye,
    LucideEyeOff,
  ],
  template: `
    <div class="nq-screen">
      <div class="fp-container">
        <!-- Step 1: Email -->
        <div
          class="step"
          [class.active]="step() === 'email'"
          [class.exit-left]="step() !== 'email'"
          [attr.inert]="step() === 'email' ? null : ''"
        >
          <div class="step-inner">
            <button class="nav-back" (click)="goBack()" aria-label="Volver">
              <svg lucideArrowLeft [size]="22" [strokeWidth]="1.8"></svg>
            </button>

            <div class="illustration">
              <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="80" r="60" fill="rgba(var(--nq-primary-rgb),0.08)" />
                <circle cx="100" cy="80" r="40" fill="rgba(var(--nq-primary-rgb),0.12)" />
                <rect
                  x="78"
                  y="62"
                  width="44"
                  height="30"
                  rx="4"
                  fill="none"
                  stroke="var(--nq-primary)"
                  stroke-width="2"
                />
                <path
                  d="M78 66l22 14 22-14"
                  fill="none"
                  stroke="var(--nq-primary)"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle cx="100" cy="105" r="4" fill="var(--nq-primary)" opacity="0.4" />
                <circle cx="90" cy="112" r="2.5" fill="var(--nq-primary)" opacity="0.25" />
                <circle cx="112" cy="110" r="3" fill="var(--nq-primary)" opacity="0.3" />
              </svg>
            </div>

            <h1 class="step-title">Recuperar contraseña</h1>
            <p class="step-desc">
              Ingresa tu correo y te enviaremos un código<br />
              para crear una contraseña nueva.
            </p>

            <form [formGroup]="emailForm" (ngSubmit)="onSendCode()" novalidate class="email-form">
              <div class="field" [class.has-error]="emailTouched() && emailError()">
                <label class="nq-field-label" for="fp-email">Correo</label>
                <div class="nq-field-input">
                  <svg class="nq-field-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="2"
                      y="4"
                      width="20"
                      height="16"
                      rx="3"
                      stroke="currentColor"
                      stroke-width="1.5"
                    />
                    <path
                      d="M2 7l10 6 10-6"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <input
                    id="fp-email"
                    type="email"
                    formControlName="email"
                    placeholder="tu.correo&#64;ejemplo.com"
                    autocomplete="email"
                    autocapitalize="none"
                    spellcheck="false"
                    inputmode="email"
                    enterkeyhint="send"
                    maxlength="254"
                    [attr.aria-invalid]="emailError() !== null"
                    [attr.aria-describedby]="
                      emailTouched() && emailError() ? 'fp-email-error' : null
                    "
                    (blur)="markEmailTouched()"
                  />
                  @if (emailTouched() && emailError()) {
                    <svg
                      class="nq-field-error-icon"
                      lucideCircleAlert
                      [size]="18"
                      [strokeWidth]="1.8"
                    ></svg>
                  }
                </div>
                @if (emailTouched() && emailError()) {
                  <span class="nq-field-error" id="fp-email-error">{{ emailError() }}</span>
                }
              </div>

              @if (requestError(); as error) {
                <p class="nq-field-error request-error" role="alert">{{ error }}</p>
              }

              <button
                class="btn-submit"
                type="submit"
                [class.disabled]="!emailValid() || isSending()"
                [disabled]="!emailValid() || isSending()"
              >
                @if (isSending()) {
                  <svg class="btn-spinner" lucideLoaderCircle [size]="20" [strokeWidth]="2"></svg>
                } @else {
                  Enviar código
                }
              </button>
            </form>
          </div>
        </div>

        <!-- Step 2: OTP Verification -->
        <div
          class="step"
          [class.active]="step() === 'otp'"
          [class.exit-left]="step() === 'password'"
          [attr.inert]="step() === 'otp' ? null : ''"
        >
          <div class="step-inner">
            <button class="nav-back" (click)="backToEmail()" aria-label="Volver">
              <svg lucideArrowLeft [size]="22" [strokeWidth]="1.8"></svg>
            </button>

            <div class="illustration">
              <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="80" r="60" fill="rgba(var(--nq-primary-rgb),0.08)" />
                <circle cx="100" cy="80" r="40" fill="rgba(var(--nq-primary-rgb),0.12)" />
                <rect
                  x="75"
                  y="60"
                  width="50"
                  height="36"
                  rx="5"
                  fill="none"
                  stroke="var(--nq-primary)"
                  stroke-width="2"
                />
                <path
                  d="M85 80h6M95 80h6M105 80h6"
                  stroke="var(--nq-primary)"
                  stroke-width="3"
                  stroke-linecap="round"
                />
                <path d="M100 55l-3-6h6l-3 6z" fill="var(--nq-primary)" opacity="0.5" />
              </svg>
            </div>

            <h1 class="step-title">Código de verificación</h1>
            <p class="step-desc">
              Enviamos un código a<br />
              <strong>{{ maskedEmail() }}</strong>
            </p>

            <div class="otp-group" [class.locked]="isVerifying()">
              @for (digit of otpDigits; track $index) {
                <input
                  #otpInput
                  class="otp-cell"
                  type="text"
                  inputmode="numeric"
                  maxlength="1"
                  [attr.autocomplete]="$first ? 'one-time-code' : 'off'"
                  [attr.aria-label]="'Dígito ' + ($index + 1)"
                  [value]="otpValues()[$index]"
                  (input)="onOtpInput($index, $event)"
                  (keydown)="onOtpKeydown($index, $event)"
                  (paste)="onOtpPaste($event)"
                  (focus)="onOtpFocus($index)"
                  [class.filled]="otpValues()[$index] !== ''"
                  [disabled]="isVerifying()"
                />
              }
            </div>

            @if (requestError(); as error) {
              <p class="nq-field-error request-error" role="alert">{{ error }}</p>
            }

            <div class="resend-row">
              <span class="resend-label">¿No te llegó?</span>
              @if (canResend()) {
                <button class="resend-btn" (click)="resendCode()">Reenviar código</button>
              } @else {
                <span class="resend-timer">{{ resendCountdown() }}s</span>
              }
            </div>

            <button class="change-email-link" (click)="backToEmail()">Cambiar de correo</button>

            <button
              class="btn-submit"
              (click)="onVerifyOtp()"
              [class.disabled]="!otpComplete() || isVerifying()"
              [disabled]="!otpComplete() || isVerifying()"
            >
              @if (isVerifying()) {
                <svg class="btn-spinner" lucideLoaderCircle [size]="20" [strokeWidth]="2"></svg>
              } @else {
                Verificar código
              }
            </button>
          </div>
        </div>

        <!-- Step 3: New password. Verificar el codigo no abre sesion: recien
             aqui, con la contrasena cambiada, el backend devuelve una. -->
        <div
          class="step"
          [class.active]="step() === 'password'"
          [attr.inert]="step() === 'password' ? null : ''"
        >
          <div class="step-inner">
            <button class="nav-back" (click)="backToOtp()" aria-label="Volver">
              <svg lucideArrowLeft [size]="22" [strokeWidth]="1.8"></svg>
            </button>

            <div class="illustration">
              <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="80" r="60" fill="rgba(var(--nq-primary-rgb),0.08)" />
                <circle cx="100" cy="80" r="40" fill="rgba(var(--nq-primary-rgb),0.12)" />
                <rect
                  x="80"
                  y="76"
                  width="40"
                  height="28"
                  rx="4"
                  fill="none"
                  stroke="var(--nq-primary-strong)"
                  stroke-width="2"
                />
                <path
                  d="M88 76v-8a12 12 0 0124 0v8"
                  fill="none"
                  stroke="var(--nq-primary-strong)"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <circle cx="100" cy="90" r="3.5" fill="var(--nq-primary-strong)" />
              </svg>
            </div>

            <h1 class="step-title">Contraseña nueva</h1>
            <p class="step-desc">
              Elige una contraseña nueva para <strong>{{ maskedEmail() }}</strong>
            </p>

            <form
              class="email-form"
              [formGroup]="passwordForm"
              (ngSubmit)="onSetPassword()"
              novalidate
            >
              <div class="field">
                <label class="nq-field-label" for="fp-password">Contraseña nueva</label>
                <div class="nq-field-input">
                  <input
                    id="fp-password"
                    formControlName="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    autocomplete="new-password"
                    autocapitalize="none"
                    spellcheck="false"
                    enterkeyhint="next"
                    maxlength="128"
                    placeholder="Tu contraseña nueva"
                    aria-describedby="fp-pwd-rules"
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

              <ul class="pwd-rules" id="fp-pwd-rules">
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
                <label class="nq-field-label" for="fp-confirm">Repite la contraseña</label>
                <div class="nq-field-input">
                  <input
                    id="fp-confirm"
                    formControlName="confirm"
                    [type]="showConfirm() ? 'text' : 'password'"
                    autocomplete="new-password"
                    autocapitalize="none"
                    spellcheck="false"
                    enterkeyhint="done"
                    maxlength="128"
                    placeholder="Confírmala"
                    [attr.aria-describedby]="confirmError() ? 'fp-confirm-error' : null"
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
                  <span class="nq-field-error" id="fp-confirm-error">{{ error }}</span>
                }
              </div>

              @if (requestError(); as error) {
                <p class="nq-field-error request-error" role="alert">{{ error }}</p>
              }

              <button
                class="btn-submit"
                type="submit"
                [class.disabled]="!passwordValid() || isSaving()"
                [disabled]="!passwordValid() || isSaving()"
              >
                @if (isSaving()) {
                  <svg class="btn-spinner" lucideLoaderCircle [size]="20" [strokeWidth]="2"></svg>
                } @else {
                  Guardar contraseña
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
  // `.nq-screen` se estira contra el ancestro posicionado que aporta esta
  // clase; sin ella el contenedor no tiene contra que medir su alto.
  host: { class: 'nq-page-host' },
  styleUrl: './forgot-password.page.scss',
})
export class ForgotPasswordPage implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = new FormBuilder();
  private readonly router = inject(Router);

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  readonly otpLength = OTP_LENGTH;
  readonly otpDigits = Array.from({ length: OTP_LENGTH });

  readonly step = signal<'email' | 'otp' | 'password'>('email');
  readonly emailTouched = signal(false);
  readonly isSending = signal(false);
  readonly isVerifying = signal(false);
  readonly canResend = signal(false);
  readonly isSaving = signal(false);
  readonly showPassword = signal(false);
  /** Cada campo tiene su ojo: mostrar uno no revela el otro. */
  readonly showConfirm = signal(false);
  readonly confirmTouched = signal(false);
  readonly resendCountdown = signal(60);
  readonly otpValues = signal<string[]>(Array(OTP_LENGTH).fill(''));

  private resendTimer: ReturnType<typeof setInterval> | null = null;

  readonly emailForm = this.fb.nonNullable.group({
    email: [
      '',
      [
        Validators.required,
        // Igual que el login: tolera el espacio final que agrega el teclado
        // de iOS; el correo se envia recortado.
        Validators.pattern(/^\s*[a-zA-Z0-9._+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\s*$/),
      ],
    ],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', [Validators.required]],
  });

  private readonly _email = signal('');
  private readonly _password = signal('');
  private readonly _confirm = signal('');
  private readonly _ticket = signal<PasswordResetTicket | null>(null);
  private readonly auth = inject(AUTH_PORT);
  private readonly session = inject(SessionFacade);

  /** Error del backend en cualquiera de los dos pasos. */
  readonly requestError = signal<string | null>(null);

  readonly emailError = computed((): string | null => {
    this._email();
    if (!this.emailTouched()) return null;
    const ctrl = this.emailForm.controls.email;
    if (ctrl.hasError('required')) return 'El correo es obligatorio';
    if (ctrl.hasError('pattern')) return 'Ingresa un correo válido';
    return null;
  });

  readonly emailValid = computed(() => {
    this._email();
    return this.emailForm.controls.email.valid;
  });

  readonly maskedEmail = computed(() => {
    const email = this._email();
    const atIdx = email.indexOf('@');
    if (atIdx < 0) return email;
    const user = email.slice(0, atIdx);
    const domain = email.slice(atIdx + 1);
    if (user.length <= 2) return `${user}@${domain}`;
    return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}@${domain}`;
  });

  readonly otpComplete = computed(() => this.otpValues().every(d => d !== ''));

  readonly rules = computed(() => passwordRules(this._password()));
  readonly confirmsMatch = computed(() => this._password() === this._confirm());
  readonly passwordValid = computed(
    () => isPasswordValid(this._password()) && this.confirmsMatch(),
  );

  readonly confirmError = computed((): string | null => {
    if (!this.confirmTouched() || this._confirm() === '') {
      return null;
    }
    return this.confirmsMatch() ? null : 'Las contraseñas no coinciden';
  });

  constructor() {
    this.emailForm.controls.email.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => {
        this._email.set(v);
        // Un error del envio anterior ya no aplica al correo corregido.
        this.requestError.set(null);
      });

    this.passwordForm.controls.password.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => {
        this._password.set(v);
        this.requestError.set(null);
      });
    this.passwordForm.controls.confirm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(v => {
        this._confirm.set(v);
        this.requestError.set(null);
      });

    this.destroyRef.onDestroy(() => {
      this.clearResendTimer();
    });
  }

  ngAfterViewInit(): void {
    this.otpInputs.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.step() === 'otp') {
        setTimeout(() => this.otpInputs.first?.nativeElement.focus(), 100);
      }
    });
  }

  markEmailTouched(): void {
    this.emailTouched.set(true);
    const ctrl = this.emailForm.controls.email;
    const trimmed = ctrl.value.trim();
    if (trimmed !== ctrl.value) ctrl.setValue(trimmed);
  }

  /** El correo como lo guarda el backend: sin espacios y en minuscula. */
  private normalizedEmail(): string {
    return this.emailForm.controls.email.value.trim().toLowerCase();
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  onSendCode(): void {
    this.emailTouched.set(true);
    if (!this.emailValid() || this.isSending()) return;

    this.isSending.set(true);
    this.requestError.set(null);

    this.auth
      .requestPasswordReset(this.normalizedEmail())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSending.set(false);
          this.step.set('otp');
          this.startResendTimer();
        },
        error: (cause: unknown) => {
          this.isSending.set(false);
          this.requestError.set(toDomainError(cause).message);
        },
      });
  }

  backToEmail(): void {
    this.step.set('email');
    this.otpValues.set(Array(this.otpLength).fill(''));
    this.isVerifying.set(false);
    this._ticket.set(null);
    this.clearResendTimer();
  }

  /**
   * El codigo ya se consumio al verificarlo: volver con el puesto dejaba un
   * codigo inservible y el contador de reenvio detenido. Se limpia y se
   * habilita pedir uno nuevo.
   */
  backToOtp(): void {
    this.step.set('otp');
    this.requestError.set(null);
    this.otpValues.set(Array(this.otpLength).fill(''));
    this._ticket.set(null);
    this.clearResendTimer();
    this.canResend.set(true);
  }

  togglePassword(): void {
    this.showPassword.update(value => !value);
  }

  toggleConfirm(): void {
    this.showConfirm.update(value => !value);
  }

  markConfirmTouched(): void {
    this.confirmTouched.set(true);
  }

  // ── OTP input handling ──

  onOtpInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    const vals = [...this.otpValues()];
    vals[index] = value ? value.charAt(0) : '';
    this.otpValues.set(vals);

    if (value && index < this.otpLength - 1) {
      const inputs = this.otpInputs.toArray();
      inputs[index + 1]?.nativeElement.focus();
    }
  }

  onOtpKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.otpValues()[index] && index > 0) {
      const inputs = this.otpInputs.toArray();
      const vals = [...this.otpValues()];
      vals[index - 1] = '';
      this.otpValues.set(vals);
      inputs[index - 1]?.nativeElement.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') || '').replace(/\D/g, '');
    if (!pasted) return;

    const inputs = this.otpInputs.toArray();
    const focusedIdx = inputs.findIndex(el => el.nativeElement === document.activeElement);
    const startIdx = focusedIdx >= 0 ? focusedIdx : 0;

    const vals = [...this.otpValues()];
    for (let i = 0; i < pasted.length && startIdx + i < this.otpLength; i++) {
      vals[startIdx + i] = pasted.charAt(i);
    }
    this.otpValues.set(vals);

    const focusTarget = Math.min(startIdx + pasted.length, this.otpLength - 1);
    inputs[focusTarget]?.nativeElement.focus();
  }

  onOtpFocus(index: number): void {
    const inputs = this.otpInputs.toArray();
    inputs[index]?.nativeElement.select();
  }

  onVerifyOtp(): void {
    if (!this.otpComplete() || this.isVerifying()) return;

    this.isVerifying.set(true);
    this.requestError.set(null);

    this.auth
      .verifyOtp(this.normalizedEmail(), this.otpValues().join(''))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ticket => {
          this.isVerifying.set(false);
          // Verificar el codigo ya no abre sesion: habilita el paso 3.
          this._ticket.set(ticket);
          this.step.set('password');
          this.clearResendTimer();
        },
        error: (cause: unknown) => {
          this.isVerifying.set(false);
          this.requestError.set(toDomainError(cause).message);
        },
      });
  }

  onSetPassword(): void {
    const ticket = this._ticket();
    if (ticket === null || !this.passwordValid() || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.requestError.set(null);

    this.auth
      .resetPassword(ticket, this.passwordForm.controls.password.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: session => {
          this.isSaving.set(false);
          this.router.navigate([this.session.adopt(session)], { replaceUrl: true });
        },
        error: (cause: unknown) => {
          this.isSaving.set(false);
          this.requestError.set(toDomainError(cause).message);
        },
      });
  }

  resendCode(): void {
    if (!this.canResend()) return;

    this.canResend.set(false);
    this.requestError.set(null);
    this.startResendTimer();

    this.auth
      .requestPasswordReset(this.normalizedEmail())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: (cause: unknown) => this.requestError.set(toDomainError(cause).message),
      });
  }

  private startResendTimer(): void {
    this.clearResendTimer();
    this.resendCountdown.set(60);
    this.canResend.set(false);

    this.resendTimer = setInterval(() => {
      const next = this.resendCountdown() - 1;
      this.resendCountdown.set(next);
      if (next <= 0) {
        this.canResend.set(true);
        this.clearResendTimer();
      }
    }, 1000);
  }

  private clearResendTimer(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }
}
