import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideChevronRight,
  LucideKeyRound,
  LucideLogOut,
  LucideMail,
  LucidePhone,
  LucideQuote,
  LucideUserPen,
} from '@lucide/angular';

import { TrainerProfileFacade } from '@app/application/trainers/trainer-profile.facade';

import {
  ChangePasswordFormComponent,
  PasswordChange,
} from '@shared/components/change-password-form.component';
import { PageStateComponent } from '@shared/components/page-state.component';
import { ProfileHeroComponent } from '@shared/components/profile-hero.component';
import { SheetTrapDirective } from '@shared/directives/sheet-trap.directive';

/** Telefono opcional: digitos y espacios, con + inicial, 8 a 16 caracteres. */
const TELEFONO = /^\+?[0-9 ]{8,16}$/;

@Component({
  selector: 'app-trainer-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageStateComponent,
    ProfileHeroComponent,
    ChangePasswordFormComponent,
    SheetTrapDirective,
    LucideChevronRight,
    LucideKeyRound,
    LucideLogOut,
    LucideMail,
    LucidePhone,
    LucideQuote,
    LucideUserPen,
  ],
  providers: [TrainerProfileFacade],
  template: `
    <div class="page">
      @switch (facade.viewState()) {
        @case ('loading') {
          <h1 class="nq-visually-hidden">Perfil</h1>
          <nq-page-state type="loading" loadingLabel="Cargando tu perfil" />
        }
        @case ('error') {
          <h1 class="nq-visually-hidden">Perfil</h1>
          <nq-page-state type="error" message="No pudimos cargar tu perfil." [retry]="reload" />
        }
        @default {
          @if (facade.trainer.data(); as trainer) {
            <nq-profile-hero
              [name]="facade.displayName()"
              [initials]="facade.avatarInitials()"
              [tag]="trainer.specialty"
              [photoUrl]="trainer.avatarUrl"
              [busy]="savingPhoto()"
              (photo)="onPhoto($event)"
              (photoError)="photoError.set($event)"
            />

            <div class="nq-hero-stats nq-ani">
              <div class="nq-hero-stat">
                <span class="nq-hero-stat-value">{{ facade.activeCount() }}</span>
                <span class="nq-hero-stat-label">{{
                  facade.activeCount() === 1 ? 'alumno' : 'alumnos'
                }}</span>
              </div>
              <div class="nq-hero-stat">
                <span class="nq-hero-stat-value">{{ facade.routinesCount.data() ?? 0 }}</span>
                <span class="nq-hero-stat-label">{{
                  facade.routinesCount.data() === 1 ? 'rutina' : 'rutinas'
                }}</span>
              </div>
              <div class="nq-hero-stat">
                <span class="nq-hero-stat-value accent">{{ adherenceLabel() }}</span>
                <span class="nq-hero-stat-label">adherencia</span>
              </div>
            </div>

            @if (photoError(); as error) {
              <p class="nq-field-error photo-error" role="alert">{{ error }}</p>
            }

            <section class="nq-section nq-ani nq-d1">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Especialidad</h2>
              </div>
              @if (chips().length > 0) {
                <ul class="chips" role="list">
                  @for (chip of chips(); track chip) {
                    <li class="chip">{{ chip }}</li>
                  }
                </ul>
              } @else {
                <p class="nq-empty-inline">
                  Agrega tu especialidad y certificaciones desde Editar mis datos.
                </p>
              }
            </section>

            <section class="nq-section nq-ani nq-d2">
              <div class="nq-section-header">
                <h2 class="nq-section-title">Contacto</h2>
              </div>
              <ul class="contact" role="list">
                <li class="contact-row">
                  <svg lucidePhone [size]="18" [strokeWidth]="1.8"></svg>
                  <span>{{ trainer.phone ?? 'Sin teléfono registrado' }}</span>
                </li>
                <li class="contact-row">
                  <svg lucideMail [size]="18" [strokeWidth]="1.8"></svg>
                  <span class="ellipsis">{{ trainer.email }}</span>
                </li>
                @if (trainer.bio !== null) {
                  <li class="contact-row bio">
                    <svg lucideQuote [size]="18" [strokeWidth]="1.8"></svg>
                    <span>{{ trainer.bio }}</span>
                  </li>
                }
              </ul>
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

            <p class="since">Entrenador en Ñeque desde {{ desde(trainer.joinedAt) }}</p>

            <button class="nq-btn nq-btn-ghost signout" type="button" (click)="askSignOut()">
              <svg lucideLogOut [size]="18" [strokeWidth]="1.8"></svg>
              Cerrar sesión
            </button>
          }
        }
      }
    </div>

    <div class="nq-overlay" [class.open]="editing()" (click)="closeEdit()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-edit-title"
        [nqSheetTrap]="editing()"
        (dismissed)="closeEdit()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="tp-edit-title">Editar mis datos</h2>

        <form class="edit-form" [formGroup]="form" (ngSubmit)="saveEdit()" novalidate>
          <div class="row-2">
            <div class="field">
              <label class="nq-field-label" for="tp-nombre">Nombre</label>
              <div class="nq-field-input">
                <input
                  id="tp-nombre"
                  formControlName="firstName"
                  autocomplete="given-name"
                  enterkeyhint="next"
                  maxlength="40"
                />
              </div>
            </div>
            <div class="field">
              <label class="nq-field-label" for="tp-apellido">Apellido</label>
              <div class="nq-field-input">
                <input
                  id="tp-apellido"
                  formControlName="lastName"
                  autocomplete="family-name"
                  enterkeyhint="next"
                  maxlength="40"
                />
              </div>
            </div>
          </div>
          <div class="field">
            <label class="nq-field-label" for="tp-telefono">Teléfono</label>
            <div class="nq-field-input">
              <input
                id="tp-telefono"
                type="tel"
                inputmode="tel"
                formControlName="phone"
                autocomplete="tel"
                enterkeyhint="next"
                placeholder="+56 9 1234 5678"
                maxlength="16"
              />
            </div>
          </div>
          <div class="field">
            <label class="nq-field-label" for="tp-especialidad">Especialidad</label>
            <div class="nq-field-input">
              <input
                id="tp-especialidad"
                formControlName="specialty"
                enterkeyhint="next"
                placeholder="Hipertrofia y recomposición"
                maxlength="60"
              />
            </div>
          </div>
          <div class="field">
            <label class="nq-field-label" for="tp-certs">Certificaciones</label>
            <div class="nq-field-input">
              <input
                id="tp-certs"
                formControlName="certifications"
                enterkeyhint="next"
                placeholder="Entrenador certificado, Fuerza"
                maxlength="200"
                aria-describedby="tp-certs-hint"
              />
            </div>
            <span class="hint" id="tp-certs-hint">Sepáralas con coma.</span>
          </div>
          <div class="field">
            <label class="nq-field-label" for="tp-bio">Sobre ti</label>
            <div class="nq-field-input tall">
              <textarea
                id="tp-bio"
                formControlName="bio"
                rows="3"
                maxlength="280"
                placeholder="A quién entrenas y cómo trabajas."
              ></textarea>
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
        aria-labelledby="tp-password-title"
        [nqSheetTrap]="changingPassword()"
        (dismissed)="closePassword()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>
        <h2 class="nq-sheet-title" id="tp-password-title">Cambiar contraseña</h2>
        <nq-change-password-form
          #passwordForm
          [busy]="facade.busy()"
          [errorMessage]="changingPassword() ? (facade.actionError()?.message ?? null) : null"
          (submitted)="savePassword($event)"
          (cancelled)="closePassword()"
        />
      </div>
    </div>

    <!-- El overlay vive siempre en el DOM y solo conmuta la clase open: es
         como el design system lo anima, y cerrado no deja nada tabulable. -->
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
  styleUrl: './trainer-profile.page.scss',
})
export class TrainerProfilePage {
  readonly facade = inject(TrainerProfileFacade);

  private readonly router = inject(Router);
  private readonly passwordForm = viewChild<ChangePasswordFormComponent>('passwordForm');

  readonly confirmingSignOut = signal(false);
  /** Bloquea el doble toque: sin esto se dispara dos veces el cierre. */
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
    specialty: ['', [Validators.maxLength(60)]],
    certifications: ['', [Validators.maxLength(200)]],
    bio: ['', [Validators.maxLength(280)]],
  });

  /** "87%", o un guion si ningun alumno tiene sesiones resueltas. */
  readonly adherenceLabel = computed(() => {
    const valor = this.facade.adherence.data();
    return valor === null || valor === undefined ? '—' : `${valor}%`;
  });

  /** Especialidad primero y despues las certificaciones, sin repetir. */
  readonly chips = computed(() => {
    const trainer = this.facade.trainer.data();
    if (trainer === null) {
      return [];
    }
    const todas = [trainer.specialty, ...trainer.certifications].filter(
      (item): item is string => item !== null && item.trim() !== '',
    );
    return [...new Set(todas)];
  });

  readonly reload = (): void => this.facade.reload();

  constructor() {
    this.facade.load();
  }

  desde(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
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
    const trainer = this.facade.trainer.data();
    this.facade.clearActionError();
    this.intentado.set(false);
    this.form.reset({
      firstName: trainer?.firstName ?? '',
      lastName: trainer?.lastName ?? '',
      phone: trainer?.phone ?? '',
      specialty: trainer?.specialty ?? '',
      certifications: trainer?.certifications.join(', ') ?? '',
      bio: trainer?.bio ?? '',
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
    const opcional = (texto: string): string | null => (texto.trim() === '' ? null : texto.trim());
    const ok = await this.facade.saveProfile({
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      phone: opcional(raw.phone),
      specialty: opcional(raw.specialty),
      certifications: raw.certifications
        .split(',')
        .map(item => item.trim())
        .filter(item => item !== ''),
      bio: opcional(raw.bio),
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
    try {
      await this.facade.signOut();
      await this.router.navigate(['/']);
    } finally {
      this.signingOut.set(false);
      this.confirmingSignOut.set(false);
    }
  }

  private showToast(mensaje: string): void {
    this.toast.set(mensaje);
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => this.toast.set(null), 2500);
  }
}
