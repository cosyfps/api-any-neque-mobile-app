import { Component, computed, input, output, signal } from '@angular/core';

import { AssignmentOption } from '@app/application/trainers/trainer-routines.facade';
import { RoutineAssignment } from '@app/domain/routines/model/routine.model';
import { fullName } from '@app/domain/students/model/student.model';

/** Fechas de un alumno marcado, tal como las maneja `<input type="date">`. */
interface Fechas {
  readonly start: string;
  readonly end: string;
}

/**
 * Hoja para repartir una rutina entre alumnos.
 *
 * Cada alumno marcado lleva sus propias fechas: la misma plantilla la
 * empiezan alumnos distintos en semanas distintas.
 */
@Component({
  selector: 'nq-routine-assign',
  standalone: true,
  template: `
    <!-- Sin FormsModule no hay ngSubmit: sin el preventDefault el submit
         nativo recarga la pagina. -->
    <form class="form" (submit)="$event.preventDefault(); onSubmit()" novalidate>
      @if (options().length === 0) {
        <p class="nq-empty-inline">Todavía no tienes alumnos activos a quienes asignarla.</p>
      } @else {
        <p class="hint">Los alumnos con un objetivo parecido aparecen primero.</p>
      }

      <ul class="list" role="list">
        @for (option of options(); track option.student.id) {
          <li class="row" [class.checked]="seleccion()[option.student.id] !== undefined">
            <label class="check">
              <input
                type="checkbox"
                [checked]="seleccion()[option.student.id] !== undefined"
                (change)="toggle(option)"
              />
              <span class="who">
                <span class="name">{{ nombreDe(option) }}</span>
                <span class="meta">{{ option.student.goal ?? 'Sin objetivo registrado' }}</span>
                @if (option.otherRoutine !== null) {
                  <span class="move">Hoy hace «{{ option.otherRoutine }}»; pasará a esta.</span>
                }
              </span>
              @if (option.sameGoal) {
                <span class="nq-badge goal-badge">Mismo objetivo</span>
              }
            </label>

            @if (seleccion()[option.student.id]; as fechas) {
              <div class="row-2">
                <div class="field">
                  <label class="nq-field-label" [attr.for]="id(option, 'inicio')">Inicio *</label>
                  <div class="nq-field-input">
                    <input
                      [attr.id]="id(option, 'inicio')"
                      type="date"
                      [value]="fechas.start"
                      (change)="setFecha(option, 'start', $event)"
                    />
                  </div>
                </div>
                <div class="field">
                  <label class="nq-field-label" [attr.for]="id(option, 'fin')">Fin</label>
                  <div class="nq-field-input">
                    <input
                      [attr.id]="id(option, 'fin')"
                      type="date"
                      [value]="fechas.end"
                      (change)="setFecha(option, 'end', $event)"
                    />
                  </div>
                </div>
              </div>
            }
          </li>
        }
      </ul>

      @if (validationError() ?? errorMessage(); as mensaje) {
        <p class="nq-field-error submit-error" role="alert">{{ mensaje }}</p>
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
  styleUrl: './routine-assign.component.scss',
})
export class RoutineAssignComponent {
  readonly options = input<readonly AssignmentOption[]>([]);
  /** Fecha de inicio que se propone al marcar a un alumno, en `yyyy-MM-dd`. */
  readonly today = input('');
  readonly busy = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly submitted = output<RoutineAssignment[]>();
  readonly cancelled = output<void>();

  /** Alumnos marcados y sus fechas, por id. */
  readonly seleccion = signal<Readonly<Record<string, Fechas>>>({});

  readonly validationError = computed(() => {
    if (!this.intentado()) {
      return null;
    }
    const fechas = Object.values(this.seleccion());
    if (fechas.some(item => item.start === '')) {
      return 'Cada alumno marcado necesita fecha de inicio.';
    }
    // `yyyy-MM-dd` se ordena igual como texto que como fecha.
    if (fechas.some(item => item.end !== '' && item.end < item.start)) {
      return 'La fecha de fin no puede ser anterior a la de inicio.';
    }
    return null;
  });

  private readonly intentado = signal(false);
  private readonly uid = `ra-${Math.random().toString(36).slice(2, 8)}`;

  id(option: AssignmentOption, campo: string): string {
    return `${this.uid}-${option.student.id}-${campo}`;
  }

  nombreDe(option: AssignmentOption): string {
    return fullName(option.student);
  }

  /** Marca a quienes ya hacen la rutina, con las fechas que tienen. */
  reset(options: readonly AssignmentOption[] = this.options()): void {
    this.intentado.set(false);
    const inicial: Record<string, Fechas> = {};
    for (const option of options) {
      if (option.assignment !== null) {
        inicial[option.student.id] = {
          start: this.soloFecha(option.assignment.startDate),
          end: this.soloFecha(option.assignment.endDate ?? ''),
        };
      }
    }
    this.seleccion.set(inicial);
  }

  toggle(option: AssignmentOption): void {
    const id = option.student.id;
    this.seleccion.update(actual => {
      if (actual[id] !== undefined) {
        return Object.fromEntries(Object.entries(actual).filter(([clave]) => clave !== id));
      }
      return { ...actual, [id]: { start: this.today(), end: '' } };
    });
  }

  setFecha(option: AssignmentOption, campo: keyof Fechas, event: Event): void {
    const id = option.student.id;
    const value = (event.target as HTMLInputElement).value;
    this.seleccion.update(actual => {
      const fechas = actual[id];
      return fechas === undefined ? actual : { ...actual, [id]: { ...fechas, [campo]: value } };
    });
  }

  onSubmit(): void {
    this.intentado.set(true);
    if (this.validationError() !== null) {
      return;
    }

    this.submitted.emit(
      Object.entries(this.seleccion()).map(([studentId, fechas]) => ({
        studentId,
        startDate: this.aIso(fechas.start),
        endDate: fechas.end === '' ? null : this.aIso(fechas.end),
      })),
    );
  }

  private aIso(fecha: string): string {
    return new Date(`${fecha}T00:00:00`).toISOString();
  }

  /** `<input type="date">` solo entiende `yyyy-MM-dd`. */
  private soloFecha(iso: string): string {
    return iso === '' ? '' : (iso.split('T')[0] ?? '');
  }
}
