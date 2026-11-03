import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LucideSearch, LucideX } from '@lucide/angular';

import { TrainerInvitationFacade } from '@app/application/trainers/trainer-invitation.facade';
import {
  StudentsFilter,
  TrainerStudentsFacade,
} from '@app/application/trainers/trainer-students.facade';
import { INVITATION_TTL_HOURS } from '@app/domain/auth/port/invitation.port';
import { Student, fullName, initials } from '@app/domain/students/model/student.model';

import { PageStateComponent } from '@shared/components/page-state.component';
import { SheetTrapDirective } from '@shared/directives/sheet-trap.directive';
import { useFab } from '@shared/navigation/fab';

import { InvitationPanelComponent } from '../shared/invitation-panel.component';
import { StudentFormComponent, StudentFormValue } from '../shared/student-form.component';

@Component({
  selector: 'app-trainer-students',
  standalone: true,
  imports: [
    PageStateComponent,
    SheetTrapDirective,
    InvitationPanelComponent,
    StudentFormComponent,
    LucideSearch,
    LucideX,
  ],
  providers: [TrainerStudentsFacade, TrainerInvitationFacade],
  template: `
    <div class="page">
      <header class="head">
        <h1 class="nq-h2">Alumnos</h1>
        <p class="nq-caption">{{ resumen() }}</p>
      </header>

      <div class="search">
        <svg class="search-icon" lucideSearch [size]="18" [strokeWidth]="1.8"></svg>
        <input
          class="search-input"
          type="search"
          autocomplete="off"
          enterkeyhint="search"
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar alumno por nombre o correo"
          [value]="facade.query()"
          (input)="search($event)"
        />
        @if (facade.query() !== '') {
          <button
            class="search-clear"
            type="button"
            aria-label="Limpiar búsqueda"
            (click)="clear()"
          >
            <svg lucideX [size]="16" [strokeWidth]="2"></svg>
          </button>
        }
      </div>

      <div class="nq-tabs" role="tablist" aria-label="Estado de los alumnos">
        @for (tab of tabs; track tab.value) {
          <button
            class="nq-tab"
            type="button"
            role="tab"
            [class.active]="facade.filter() === tab.value"
            [attr.aria-selected]="facade.filter() === tab.value"
            (click)="facade.selectFilter(tab.value)"
          >
            {{ tab.label }} ({{
              tab.value === 'active' ? facade.activeCount() : facade.suspendedCount()
            }})
          </button>
        }
      </div>

      @switch (facade.viewState()) {
        @case ('loading') {
          <nq-page-state type="loading" loadingLabel="Cargando alumnos" />
        }
        @case ('error') {
          <nq-page-state type="error" message="No pudimos cargar tu cartera." [retry]="reload" />
        }
        @case ('empty') {
          <nq-page-state
            type="empty"
            [title]="vacioTitulo()"
            [message]="vacioMensaje()"
            [showRetry]="false"
          />
        }
        @default {
          <ul class="list" role="list">
            @for (student of facade.visible(); track student.id) {
              <li>
                <button class="nq-list-item item" type="button" (click)="open(student.id)">
                  <span class="nq-avatar" aria-hidden="true">
                    @if (student.avatarUrl !== null) {
                      <img [src]="student.avatarUrl" alt="" />
                    } @else {
                      {{ initialsOf(student) }}
                    }
                  </span>

                  <span class="item-body">
                    <span class="item-name">{{ nameOf(student) }}</span>
                    <span class="item-goal">{{ student.goal ?? 'Sin objetivo registrado' }}</span>
                  </span>

                  @if (student.status === 'suspended') {
                    <span class="nq-badge nq-badge-warning">Suspendido</span>
                  }
                </button>
              </li>
            }
          </ul>
        }
      }
    </div>

    <!-- El overlay vive siempre en el DOM y solo conmuta la clase open: es
         como el design system lo anima, y cerrado no deja nada tabulable. -->
    <div class="nq-overlay" [class.open]="sheetOpen()" (click)="closeForm()">
      <div
        class="nq-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alta-title"
        [nqSheetTrap]="sheetOpen()"
        (dismissed)="closeForm()"
        (click)="$event.stopPropagation()"
      >
        <div class="nq-sheet-handle"></div>

        @if (created() === null) {
          <h2 class="nq-sheet-title" id="alta-title">Nuevo alumno</h2>

          <nq-student-form
            #formulario
            mode="create"
            submitLabel="Guardar e invitar"
            [busy]="facade.saving()"
            [errorMessage]="facade.saveError()?.message ?? null"
            [hint]="altaHint"
            (submitted)="submit($event)"
            (cancelled)="closeForm()"
          />
        } @else {
          <h2 class="nq-sheet-title" id="alta-title">Invitación lista</h2>
          <p class="hint">Compártela con {{ created() }} para que cree su acceso.</p>

          <nq-invitation-panel [studentId]="createdId()!" />

          <div class="form-actions single">
            <button class="nq-btn nq-btn-secondary" type="button" (click)="closeForm()">
              Listo
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './trainer-students.page.scss',
})
export class TrainerStudentsPage {
  readonly facade = inject(TrainerStudentsFacade);
  readonly invitation = inject(TrainerInvitationFacade);

  readonly tabs: readonly { value: StudentsFilter; label: string }[] = [
    { value: 'active', label: 'Activos' },
    { value: 'suspended', label: 'Suspendidos' },
  ];

  readonly resumen = computed(() => {
    const total = this.facade.activeCount();
    return total === 1 ? '1 alumno activo' : `${total} alumnos activos`;
  });

  readonly vacioTitulo = computed(() =>
    this.facade.emptyBySearch() ? 'Sin coincidencias' : 'Aún no hay alumnos',
  );

  readonly vacioMensaje = computed(() => {
    if (this.facade.emptyBySearch()) {
      return 'Prueba con otro nombre o correo.';
    }
    return this.facade.filter() === 'suspended'
      ? 'No tienes alumnos suspendidos.'
      : 'Da de alta a tu primer alumno para empezar.';
  });

  readonly reload = (): void => this.facade.reload();

  readonly sheetOpen = signal(false);
  /** Nombre del alumno recien creado; null mientras se llena el formulario. */
  readonly created = signal<string | null>(null);
  readonly createdId = signal<string | null>(null);

  readonly altaHint =
    `Al guardar emitimos una invitación que vence en ${INVITATION_TTL_HOURS} horas. ` +
    'El alumno crea su propia contraseña.';

  private readonly formulario = viewChild<StudentFormComponent>('formulario');
  private readonly router = inject(Router);

  constructor() {
    this.facade.load();
    useFab(
      () => 'Dar de alta un alumno',
      () => this.openForm(),
    );
  }

  openForm(): void {
    this.created.set(null);
    this.createdId.set(null);
    this.facade.clearSaveError();
    this.sheetOpen.set(true);
    this.formulario()?.reset();
  }

  closeForm(): void {
    this.sheetOpen.set(false);
  }

  /**
   * Crea al alumno y emite su invitacion en el mismo gesto.
   *
   * Son dos llamadas al backend pero un solo paso para el entrenador: dar de
   * alta sin invitar deja una ficha que nadie puede usar.
   */
  async submit(value: StudentFormValue): Promise<void> {
    const studentId = await this.facade.create(value);
    if (studentId === null) {
      return;
    }

    this.createdId.set(studentId);
    this.created.set(`${value.firstName} ${value.lastName}`.trim());
    this.invitation.issue(studentId);
  }

  nameOf(student: Student): string {
    return fullName(student);
  }

  initialsOf(student: Student): string {
    return initials(student);
  }

  search(event: Event): void {
    this.facade.search((event.target as HTMLInputElement).value);
  }

  clear(): void {
    this.facade.search('');
  }

  open(studentId: string): void {
    void this.router.navigate(['/trainer/students', studentId]);
  }
}
