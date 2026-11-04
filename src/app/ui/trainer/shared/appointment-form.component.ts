import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  SESSION_KIND_LABEL,
  ScheduledSession,
  ScheduledSessionInput,
  SessionKind,
  appointmentError,
} from '@app/domain/schedule/model/scheduled-session.model';
import { CLOCK } from '@app/domain/shared/port/clock.port';

import { localIsoDay } from '@shared/validators/field-rules';

const TIPOS = Object.entries(SESSION_KIND_LABEL).map(([value, label]) => ({
  value: value as SessionKind,
  label,
}));

/** Duraciones habituales; el BFF acepta de 15 minutos a 4 horas. */
const DURACIONES = [30, 45, 60, 90, 120] as const;

export type AppointmentFormValue = Omit<ScheduledSessionInput, 'studentId'>;

/**
 * Cita con un alumno.
 *
 * El titulo es opcional: sin el, la cita se llama como su tipo
 * ("Evaluación"). La fecha y la hora se validan con la misma regla que usa
 * el BFF (`appointmentError`).
 */
@Component({
  selector: 'nq-appointment-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="form" [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <div class="field">
        <label class="nq-field-label" [attr.for]="id('tipo')">Tipo de cita *</label>
        <div class="nq-field-input">
          <select [attr.id]="id('tipo')" formControlName="kind">
            @for (tipo of tipos; track tipo.value) {
              <option [value]="tipo.value">{{ tipo.label }}</option>
            }
          </select>
        </div>
      </div>

      <div class="field">
        <label class="nq-field-label" [attr.for]="id('titulo')">Título</label>
        <div class="nq-field-input">
          <input
            [attr.id]="id('titulo')"
            formControlName="title"
            enterkeyhint="next"
            maxlength="120"
            [placeholder]="tituloPorDefecto()"
          />
        </div>
      </div>

      <div class="row-2">
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('fecha')">Fecha *</label>
          <div class="nq-field-input" [class.error]="whenError() !== null">
            <input
              [attr.id]="id('fecha')"
              formControlName="date"
              type="date"
              [min]="today()"
              [attr.aria-invalid]="whenError() !== null"
              [attr.aria-describedby]="whenError() ? id('cuando') + '-error' : null"
            />
          </div>
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('hora')">Hora *</label>
          <div class="nq-field-input" [class.error]="whenError() !== null">
            <input
              [attr.id]="id('hora')"
              formControlName="time"
              type="time"
              step="300"
              [attr.aria-invalid]="whenError() !== null"
              [attr.aria-describedby]="whenError() ? id('cuando') + '-error' : null"
            />
          </div>
        </div>
      </div>
      @if (whenError(); as error) {
        <span class="nq-field-error when-error" [id]="id('cuando') + '-error'">{{ error }}</span>
      }

      <div class="row-2">
        <div class="field">
          <label class="nq-field-label" [attr.for]="id('duracion')">Duración *</label>
          <div class="nq-field-input">
            <select [attr.id]="id('duracion')" formControlName="minutes">
              @for (minutos of duraciones; track minutos) {
                <option [ngValue]="minutos">{{ minutos }} min</option>
              }
            </select>
          </div>
        </div>

        <div class="field">
          <label class="nq-field-label" [attr.for]="id('lugar')">Lugar</label>
          <div class="nq-field-input">
            <input
              [attr.id]="id('lugar')"
              formControlName="location"
              enterkeyhint="done"
              maxlength="120"
              placeholder="Gimnasio"
            />
          </div>
        </div>
      </div>

      @if (errorMessage(); as error) {
        <p class="nq-field-error submit-error" role="alert">{{ error }}</p>
      }

      <p class="hint">El alumno recibe un aviso y la confirma desde su agenda.</p>

      <div class="form-actions nq-sheet-actions">
        <button class="nq-btn nq-btn-secondary" type="button" (click)="cancelled.emit()">
          Cancelar
        </button>
        <button class="nq-btn nq-btn-primary" type="submit" [disabled]="busy()">
          {{ busy() ? 'Guardando…' : submitLabel() }}
        </button>
      </div>
    </form>
  `,
  styleUrl: './appointment-form.component.scss',
})
export class AppointmentFormComponent {
  readonly busy = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitLabel = input('Agendar cita');

  readonly submitted = output<AppointmentFormValue>();
  readonly cancelled = output<void>();

  readonly tipos = TIPOS;
  readonly duraciones = DURACIONES;

  private readonly clock = inject(CLOCK);

  readonly form = inject(FormBuilder).nonNullable.group({
    kind: ['training' as SessionKind, Validators.required],
    title: ['', Validators.maxLength(120)],
    date: ['', Validators.required],
    time: ['', Validators.required],
    minutes: [60 as number, Validators.required],
    location: ['', Validators.maxLength(120)],
  });

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  private readonly intentado = signal(false);
  private readonly uid = `ap-${Math.random().toString(36).slice(2, 8)}`;

  /** `min` del selector de fecha, en `yyyy-MM-dd` local. */
  readonly today = computed(() => localIsoDay(this.clock.now()));

  readonly tituloPorDefecto = computed(() => SESSION_KIND_LABEL[this.valores().kind ?? 'training']);

  /** Fecha y hora juntas: faltantes, pasadas o fuera de rango. */
  readonly whenError = computed(() => {
    if (!this.intentado()) {
      return null;
    }
    const { date, time, minutes } = this.valores();
    if (!date || !time) {
      return 'Elige la fecha y la hora de la cita.';
    }
    const inicio = this.inicio(date, time);
    return appointmentError(inicio, this.fin(inicio, minutes ?? 60), this.clock.now());
  });

  id(campo: string): string {
    return `${this.uid}-${campo}`;
  }

  /** Vacio para agendar; con una cita, precargado para reagendarla. */
  reset(cita: ScheduledSession | null = null): void {
    this.intentado.set(false);
    if (cita === null) {
      this.form.reset({
        kind: 'training',
        title: '',
        date: '',
        time: '',
        minutes: 60,
        location: '',
      });
      return;
    }
    const inicio = new Date(cita.startsAt);
    const minutos = Math.round((new Date(cita.endsAt).getTime() - inicio.getTime()) / 60_000);
    const dos = (n: number): string => String(n).padStart(2, '0');
    this.form.reset({
      kind: cita.kind,
      title: cita.title,
      date: localIsoDay(inicio),
      time: `${dos(inicio.getHours())}:${dos(inicio.getMinutes())}`,
      // Una duracion que no esta en la lista queda en la mas cercana.
      minutes: DURACIONES.reduce((mejor, opcion) =>
        Math.abs(opcion - minutos) < Math.abs(mejor - minutos) ? opcion : mejor,
      ),
      location: cita.location ?? '',
    });
  }

  onSubmit(): void {
    this.intentado.set(true);
    if (this.form.invalid || this.whenError() !== null || this.busy()) {
      return;
    }
    const raw = this.form.getRawValue();
    const inicio = this.inicio(raw.date, raw.time);
    const titulo = raw.title.trim();
    const lugar = raw.location.trim();
    this.submitted.emit({
      kind: raw.kind,
      title: titulo === '' ? SESSION_KIND_LABEL[raw.kind] : titulo,
      startsAt: inicio.toISOString(),
      endsAt: this.fin(inicio, raw.minutes).toISOString(),
      location: lugar === '' ? null : lugar,
    });
  }

  /** `yyyy-MM-dd` + `HH:mm` en hora local del dispositivo. */
  private inicio(date: string, time: string): Date {
    const [anio, mes, dia] = date.split('-').map(Number);
    const [hora, minuto] = time.split(':').map(Number);
    return new Date(anio ?? 0, (mes ?? 1) - 1, dia ?? 1, hora ?? 0, minuto ?? 0);
  }

  private fin(inicio: Date, minutos: number): Date {
    return new Date(inicio.getTime() + minutos * 60_000);
  }
}
