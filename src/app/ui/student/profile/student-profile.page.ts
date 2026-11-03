import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideBell,
  LucideCalendarDays,
  LucideChevronRight,
  LucideFlame,
  LucideImage,
  LucideKeyRound,
  LucideLogOut,
  LucideUserPen,
} from '@lucide/angular';

import { SessionFacade } from '@app/application/auth/session.facade';
import { NotificationsFacade } from '@app/application/notifications/notifications.facade';
import { StudentProfileFacade } from '@app/application/students/student-profile.facade';

import {
  ChangePasswordFormComponent,
  PasswordChange,
} from '@shared/components/change-password-form.component';
import { PageStateComponent } from '@shared/components/page-state.component';
import { ProfileHeroComponent } from '@shared/components/profile-hero.component';
import { SheetTrapDirective } from '@shared/directives/sheet-trap.directive';

const DATE_FORMAT = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' });

/** Telefono opcional: digitos y espacios, con + inicial, 8 a 16 caracteres. */
const TELEFONO = /^\+?[0-9 ]{8,16}$/;

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageStateComponent,
    ProfileHeroComponent,
    ChangePasswordFormComponent,
    SheetTrapDirective,
    LucideBell,
    LucideCalendarDays,
    LucideChevronRight,
    LucideFlame,
    LucideImage,
    LucideKeyRound,
    LucideLogOut,
    LucideUserPen,
  ],
  template: `
    <div class="page">
      @switch (facade.viewState()) {
        @case ('loading') {
          <h1 class="nq-visually-hidden">Mi perfil</h1>
          <nq-page-state type="loading" />
        }
        @case ('error') {
          <h1 class="nq-visually-hidden">Mi perfil</h1>
          <nq-page-state type="error" [retry]="reload" />
        }
        @case ('empty') {
          <h1 class="nq-visually-hidden">Mi perfil</h1>
          <nq-page-state type="empty" title="Sin datos de perfil" />
        }
        @case ('success') {
          @if (facade.student.data(); as student) {
            <nq-profile-hero
              [name]="facade.displayName()"
              [initials]="facade.avatarInitials()"
              [tag]="student.goal"
              [photoUrl]="student.avatarUrl"
              [busy]="savingPhoto()"
              (photo)="onPhoto($event)"
              (photoError)="photoError.set($event)"
            />

            <div class="nq-hero-stats nq-ani">
              <div class="nq-hero-stat">
                <span class="nq-hero-stat-value">{{ decimal(facade.weightKg()) }}</span>
                <span class="nq-hero-stat-label">kg</span>
              </div>
              <div class="nq-hero-stat">
                <span class="nq-hero-stat-value">{{ facade.heightCm() ?? '—' }}</span>
                <span class="nq-hero-stat-label">cm</span>
              </div>
              <div class="nq-hero-stat">
                <span class="nq-hero-stat-value accent">{{
                  decimal(facade.bmi()?.value ?? null)
                }}</span>
                <span class="nq-hero-stat-label">IMC</span>
              </div>
            </div>

            @if (photoError(); as error) {
              <p class="nq-field-error photo-error" role="alert">{{ error }}</p>
            }

            <div class="streak nq-ani nq-d1" role="status">
              <span class="streak-icon">
                <svg lucideFlame [size]="22" [strokeWidth]="2"></svg>
              </span>
              <span class="streak-text">
                <span class="streak-title">{{ streakTitle() }}</span>
                <span class="streak-desc">{{ streakDesc() }}</span>
              </span>
            </div>

            <section class="nq-section nq-ani nq-d2">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Tu actividad</h2>
              </div>
              <div class="nq-menu">
                <button class="nq-list-item" type="button" (click)="go('/student/schedule')">
                  <svg lucideCalendarDays [size]="19" [strokeWidth]="1.8"></svg>
                  <span class="nq-menu-label">Mi agenda</span>
                  <svg lucideChevronRight [size]="18" [strokeWidth]="2"></svg>
                </button>
                <button class="nq-list-item" type="button" (click)="go('/student/notifications')">
                  <svg lucideBell [size]="19" [strokeWidth]="1.8"></svg>
                  <span class="nq-menu-label">Notificaciones</span>
                  @if (notifications.hasUnread()) {
                    <span class="nq-badge nq-badge-primary">{{ notifications.unreadCount() }}</span>
                  }
                  <svg lucideChevronRight [size]="18" [strokeWidth]="2"></svg>
                </button>
                <button class="nq-list-item" type="button" (click)="go('/student/progress')">
                  <svg lucideImage [size]="19" [strokeWidth]="1.8"></svg>
                  <span class="nq-menu-label">Fotos de progreso</span>
                  <svg lucideChevronRight [size]="18" [strokeWidth]="2"></svg>
                </button>
              </div>
            </section>

            <section class="nq-section nq-ani nq-d3">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Cuenta</h2>
              </div>
              <div class="nq-menu">
                <button class="nq-list-item" type="button" (click)="openEdit()">
                  <svg lucideUserPen [size]="19" [strokeWidth]="1.8"></svg>
                  <span class="nq-menu-label">Editar mis datos</span>
                  <svg lucideChevronRight [size]="18" [strokeWidth]="2"></svg>
                </button>
                <button class="nq-list-item" type="button" (click)="openPassword()">
                  <svg lucideKeyRound [size]="19" [strokeWidth]="1.8"></svg>
                  <span class="nq-menu-label">Cambiar contraseña</span>
                  <svg lucideChevronRight [size]="18" [strokeWidth]="2"></svg>
                </button>
              </div>
              <!-- Junto a donde se toco, no flotante: un fixed dentro del
                   contenedor con scroll se desplaza con la lista en iOS. -->
              <p class="toast" role="status">{{ toast() ?? '' }}</p>
            </section>

            @if (student.trainerName) {
              <p class="trainer-line">
                Entrenas con {{ student.trainerName }} desde {{ formatDate(student.joinedAt) }}
              </p>
            }

            <button class="nq-btn nq-btn-ghost logout" type="button" (click)="askSignOut()">
              <svg lucideLogOut [size]="18" [strokeWidth]="1.8"></svg>
              Cerrar sesión
            </button>
          }
        }
      }
    </div>

    <!-- Editar mis datos. Estatura y objetivo no: los define el entrenador. -->
    <div class="nq-overlay" [class.open]="editing()" (click)="closeEdit()">
      <div
        class="nq-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        [nqSheetTrap]="editing()"
        (dismissed)="closeEdit()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="edit-title">Editar mis datos</h2>

        <form class="edit-form" [formGroup]="form" (ngSubmit)="saveEdit()" novalidate>
          <div class="field">
            <label class="nq-field-label" for="sp-nombre">Nombre</label>
            <div class="nq-field-input">
              <input
                id="sp-nombre"
                formControlName="firstName"
                autocomplete="given-name"
                enterkeyhint="next"
                maxlength="40"
              />
            </div>
          </div>
          <div class="field">
            <label class="nq-field-label" for="sp-apellido">Apellido</label>
            <div class="nq-field-input">
              <input
                id="sp-apellido"
                formControlName="lastName"
                autocomplete="family-name"
                enterkeyhint="next"
                maxlength="40"
              />
            </div>
          </div>
          <div class="field">
            <label class="nq-field-label" for="sp-telefono">Teléfono</label>
            <div class="nq-field-input">
              <input
                id="sp-telefono"
                type="tel"
                inputmode="tel"
                formControlName="phone"
                autocomplete="tel"
                enterkeyhint="done"
                placeholder="+56 9 1234 5678"
                maxlength="16"
              />
            </div>
          </div>

          @if (editError(); as error) {
            <p class="nq-field-error" role="alert">{{ error }}</p>
          }

          <div class="sheet-actions nq-sheet-actions">
            <button class="nq-btn nq-btn-secondary" type="button" (click)="closeEdit()">
              Cancelar
            </button>
            <button class="nq-btn nq-btn-primary" type="submit" [disabled]="facade.busy()">
              {{ facade.busy() ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div class="nq-overlay" [class.open]="changingPassword()" (click)="closePassword()">
      <div
        class="nq-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-title"
        [nqSheetTrap]="changingPassword()"
        (dismissed)="closePassword()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="password-title">Cambiar contraseña</h2>
        <nq-change-password-form
          #passwordForm
          [busy]="facade.busy()"
          [errorMessage]="changingPassword() ? (facade.actionError()?.message ?? null) : null"
          (submitted)="savePassword($event)"
          (cancelled)="closePassword()"
        />
      </div>
    </div>

    <!-- El overlay vive siempre en el DOM y solo conmuta la clase open, que
         es como el design system lo anima: sin ella queda invisible. -->
    <div class="nq-overlay" [class.open]="confirmingSignOut()" (click)="cancelSignOut()">
      <div
        class="nq-sheet confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signout-title"
        [nqSheetTrap]="confirmingSignOut()"
        (dismissed)="cancelSignOut()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="signout-title">¿Cerrar sesión?</h2>
        <p class="confirm-desc">Tendrás que ingresar de nuevo con tu correo y contraseña.</p>

        <div class="confirm-actions">
          <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelSignOut()">
            Cancelar
          </button>
          <button
            class="nq-btn nq-btn-primary"
            type="button"
            [disabled]="signingOut()"
            (click)="confirmSignOut()"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './student-profile.page.scss',
})
export class StudentProfilePage {
  readonly facade = inject(StudentProfileFacade);
  readonly notifications = inject(NotificationsFacade);

  private readonly session = inject(SessionFacade);
  private readonly router = inject(Router);
  private readonly passwordForm = viewChild<ChangePasswordFormComponent>('passwordForm');

  readonly confirmingSignOut = signal(false);
  readonly signingOut = signal(false);
  readonly editing = signal(false);
  readonly changingPassword = signal(false);
  readonly savingPhoto = signal(false);
  readonly photoError = signal<string | null>(null);
  /** Aviso breve de exito: "Datos guardados", "Contraseña cambiada". */
  readonly toast = signal<string | null>(null);
  private readonly intentado = signal(false);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(40)]],
    lastName: ['', [Validators.required, Validators.maxLength(40)]],
    phone: ['', [Validators.pattern(TELEFONO)]],
  });

  readonly streakTitle = computed(() => {
    const semanas = this.facade.streakWeeks();
    if (semanas === 0) {
      return 'Empieza tu racha';
    }
    return semanas === 1 ? '1 semana de racha' : `${semanas} semanas de racha`;
  });

  readonly streakDesc = computed(() =>
    this.facade.streakWeeks() === 0
      ? 'Cumple tu agenda de esta semana para sumar la primera.'
      : 'Cumpliendo toda tu agenda. Sigue así.',
  );

  readonly reload = (): void => this.facade.reload();

  constructor() {
    this.facade.load();
    this.notifications.load();
  }

  /** "58,9" con coma decimal, o un guion sin dato. */
  decimal(value: number | null): string {
    return value === null ? '—' : value.toLocaleString('es-CL', { maximumFractionDigits: 1 });
  }

  formatDate(iso: string): string {
    return DATE_FORMAT.format(new Date(iso));
  }

  go(path: string): void {
    this.router.navigate([path]);
  }

  async onPhoto(dataUrl: string): Promise<void> {
    this.photoError.set(null);
    this.savingPhoto.set(true);
    const ok = await this.facade.setAvatar(dataUrl);
    this.savingPhoto.set(false);
    if (!ok) {
      this.photoError.set('No pudimos guardar la foto. Intenta de nuevo.');
    }
  }

  openEdit(): void {
    const student = this.facade.student.data();
    this.facade.clearActionError();
    this.intentado.set(false);
    this.form.reset({
      firstName: student?.firstName ?? '',
      lastName: student?.lastName ?? '',
      phone: student?.phone ?? '',
    });
    this.editing.set(true);
  }

  closeEdit(): void {
    this.editing.set(false);
  }

  /** El error de validacion va primero; el del backend, despues. */
  editError(): string | null {
    if (this.intentado()) {
      const { firstName, lastName, phone } = this.form.controls;
      if (firstName.invalid || lastName.invalid) {
        return 'Escribe tu nombre y apellido.';
      }
      if (phone.invalid) {
        return 'Revisa el teléfono: solo números, entre 8 y 16.';
      }
    }
    return this.editing() ? (this.facade.actionError()?.message ?? null) : null;
  }

  async saveEdit(): Promise<void> {
    this.intentado.set(true);
    const raw = this.form.getRawValue();
    // Recortados antes de validar: "  " no es un nombre.
    this.form.patchValue({ firstName: raw.firstName.trim(), lastName: raw.lastName.trim() });
    if (this.form.invalid) {
      return;
    }
    const phone = raw.phone.trim();
    const ok = await this.facade.saveProfile({
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      phone: phone === '' ? null : phone,
    });
    if (ok) {
      this.editing.set(false);
      this.showToast('Datos guardados');
    }
  }

  openPassword(): void {
    this.facade.clearActionError();
    this.passwordForm()?.reset();
    this.changingPassword.set(true);
  }

  closePassword(): void {
    this.changingPassword.set(false);
  }

  async savePassword(change: PasswordChange): Promise<void> {
    if (await this.facade.changePassword(change.currentPassword, change.newPassword)) {
      this.changingPassword.set(false);
      this.showToast('Contraseña cambiada');
    }
  }

  askSignOut(): void {
    this.confirmingSignOut.set(true);
  }

  cancelSignOut(): void {
    this.confirmingSignOut.set(false);
  }

  async confirmSignOut(): Promise<void> {
    if (this.signingOut()) {
      return;
    }
    this.signingOut.set(true);
    await this.session.signOut();
    this.signingOut.set(false);
    this.confirmingSignOut.set(false);
    await this.router.navigate(['/']);
  }

  private showToast(mensaje: string): void {
    this.toast.set(mensaje);
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => this.toast.set(null), 2500);
  }
}
