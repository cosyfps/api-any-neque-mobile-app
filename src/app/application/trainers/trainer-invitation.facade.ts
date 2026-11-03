import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { INVITATION_PORT, InvitationDetails } from '@app/domain/auth/port/invitation.port';
import { DomainError, toDomainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { PUBLIC_APP_URL } from '@app/domain/shared/port/public-url.port';

const MS_POR_HORA = 60 * 60 * 1000;

/**
 * Invitacion vigente de un alumno, desde la vista del entrenador.
 *
 * No usa `AsyncState`: la pantalla que la consume ya muestra la ficha del
 * alumno y aqui solo interesa "hay o no hay invitacion", no un ciclo
 * completo de loading/error/empty propio.
 */
// Scoped a la ruta /trainer: sus puertos viven en ese injector, no en el raiz.
@Injectable()
export class TrainerInvitationFacade {
  private readonly port = inject(INVITATION_PORT);
  private readonly clock = inject(CLOCK);
  private readonly publicUrl = inject(PUBLIC_APP_URL);

  private readonly _invitation = signal<InvitationDetails | null>(null);
  private readonly _busy = signal(false);
  private readonly _error = signal<DomainError | null>(null);

  readonly invitation: Signal<InvitationDetails | null> = this._invitation.asReadonly();
  readonly busy: Signal<boolean> = this._busy.asReadonly();
  readonly error: Signal<DomainError | null> = this._error.asReadonly();

  /**
   * Enlace que el entrenador comparte. Null si no hay invitacion vigente.
   *
   * `/i/` y no `/invite/`: mas corto en WhatsApp y un QR mas simple. La ruta
   * corta redirige a la larga, que sigue funcionando.
   */
  readonly link: Signal<string | null> = computed(() => {
    const value = this._invitation();
    return value === null ? null : `${this.publicUrl}/i/${value.token}`;
  });

  /**
   * Horas que le quedan de vida, redondeadas hacia arriba.
   *
   * Hacia arriba y no hacia abajo para que una invitacion recien emitida
   * diga 48 y no 47: el entrenador acaba de leer que duran 48 horas.
   */
  readonly hoursLeft: Signal<number> = computed(() => {
    const value = this._invitation();
    if (value === null) {
      return 0;
    }
    const restante = new Date(value.expiresAt).getTime() - this.clock.now().getTime();
    return Math.max(0, Math.ceil(restante / MS_POR_HORA));
  });

  load(studentId: string): void {
    this.run(this.port.getForStudent(studentId), value => this._invitation.set(value));
  }

  /** Emite una invitacion. Si habia una pendiente, queda revocada. */
  issue(studentId: string): void {
    this.run(this.port.create(studentId), value => this._invitation.set(value));
  }

  revoke(): void {
    const value = this._invitation();
    if (value === null) {
      return;
    }
    this.run(this.port.revoke(value.token), () => this._invitation.set(null));
  }

  private run<T>(source: Observable<T>, onNext: (value: T) => void): void {
    this._busy.set(true);
    this._error.set(null);
    source.subscribe({
      next: value => {
        onNext(value);
        this._busy.set(false);
      },
      error: (cause: unknown) => {
        this._error.set(toDomainError(cause));
        this._busy.set(false);
      },
    });
  }
}
