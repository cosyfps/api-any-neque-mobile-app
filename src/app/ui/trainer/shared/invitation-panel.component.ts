import { Component, computed, inject, input, signal } from '@angular/core';
import { LucideCheck, LucideCopy, LucideQrCode, LucideShare2 } from '@lucide/angular';

import { TrainerInvitationFacade } from '@app/application/trainers/trainer-invitation.facade';
import { INVITATION_TTL_HOURS } from '@app/domain/auth/port/invitation.port';

/** Solo el tipo: la libreria se carga con import dinamico al pedir el QR. */
type QrCodeLib = typeof import('qrcode');

/** Etiqueta en espanol de cada estado de la invitacion. */
const ESTADO: Record<string, string> = {
  pending: 'Vigente',
  accepted: 'Ya utilizada',
  expired: 'Expirada',
  revoked: 'Revocada',
};

/**
 * Invitacion vigente de un alumno: enlace, vigencia, compartir y QR.
 *
 * Es un componente y no parte de una pantalla porque lo usan dos: el alta,
 * justo despues de crear al alumno, y su ficha.
 */
@Component({
  selector: 'nq-invitation-panel',
  standalone: true,
  imports: [LucideCopy, LucideShare2, LucideQrCode, LucideCheck],
  template: `
    @if (facade.invitation(); as invitation) {
      <div class="panel">
        <div class="row">
          <span class="nq-badge" [class]="badgeClass()">{{ estado() }}</span>
          @if (invitation.status === 'pending') {
            <span class="expiry" role="status">{{ vigencia() }}</span>
          }
        </div>

        <p class="link" aria-label="Enlace de invitación">{{ facade.link() }}</p>

        <div class="actions">
          <button class="nq-btn nq-btn-secondary action" type="button" (click)="copy()">
            @if (copied()) {
              <svg lucideCheck [size]="16" [strokeWidth]="2.5"></svg>
              Copiado
            } @else {
              <svg lucideCopy [size]="16" [strokeWidth]="2"></svg>
              Copiar
            }
          </button>

          <button class="nq-btn nq-btn-primary action" type="button" (click)="share()">
            <svg lucideShare2 [size]="16" [strokeWidth]="2"></svg>
            Compartir
          </button>
        </div>

        <button
          class="qr-toggle"
          type="button"
          [attr.aria-expanded]="showQr()"
          (click)="toggleQr()"
        >
          <svg lucideQrCode [size]="16" [strokeWidth]="2"></svg>
          {{ showQr() ? 'Ocultar código QR' : 'Ver código QR' }}
        </button>

        @if (showQr()) {
          <div class="qr" role="img" [attr.aria-label]="'Código QR del enlace de invitación'">
            @if (qrDataUrl() !== null) {
              <img [src]="qrDataUrl()" alt="" width="180" height="180" />
            } @else {
              <span class="qr-fallback">{{ qrError() ?? 'Generando…' }}</span>
            }
          </div>
        }

        <div class="secondary">
          <button class="text-btn" type="button" [disabled]="facade.busy()" (click)="reissue()">
            Reemitir
          </button>
          <button
            class="text-btn danger"
            type="button"
            [disabled]="facade.busy()"
            (click)="revoke()"
          >
            Revocar
          </button>
        </div>
      </div>
    } @else {
      <div class="panel empty">
        <p class="empty-text">
          Este alumno no tiene una invitación vigente. Emite una para que cree su acceso.
        </p>
        <button
          class="nq-btn nq-btn-primary"
          type="button"
          [disabled]="facade.busy()"
          (click)="reissue()"
        >
          Emitir invitación
        </button>
      </div>
    }
  `,
  styleUrl: './invitation-panel.component.scss',
})
export class InvitationPanelComponent {
  readonly facade = inject(TrainerInvitationFacade);

  readonly studentId = input.required<string>();

  readonly copied = signal(false);
  readonly showQr = signal(false);
  readonly qrDataUrl = signal<string | null>(null);
  readonly qrError = signal<string | null>(null);

  readonly estado = computed(() => {
    const value = this.facade.invitation();
    return value === null ? '' : (ESTADO[value.status] ?? value.status);
  });

  readonly badgeClass = computed(() => {
    const value = this.facade.invitation();
    if (value === null || value.status === 'pending') {
      return 'nq-badge-success';
    }
    return value.status === 'accepted' ? 'nq-badge-primary' : 'nq-badge-warning';
  });

  /**
   * Cuanto le queda, en la unidad que se lee de un vistazo.
   *
   * Pasa a dias sobre las 48 h porque una invitacion reemitida por el BFF
   * puede traer una vigencia mayor, y "Vence en 2354 horas" no dice nada.
   */
  readonly vigencia = computed(() => {
    const horas = this.facade.hoursLeft();
    if (horas === 0) {
      return 'Vence en menos de una hora';
    }
    if (horas === 1) {
      return 'Vence en 1 hora';
    }
    if (horas <= INVITATION_TTL_HOURS) {
      return `Vence en ${horas} horas`;
    }
    // Redondeo normal, no hacia arriba: las horas ya vienen redondeadas y
    // encadenar dos techos convierte 49 horas en tres dias.
    return `Vence en ${Math.round(horas / 24)} días`;
  });

  /** Vigencia total, para el texto del alta. */
  readonly ttlHours = INVITATION_TTL_HOURS;

  async copy(): Promise<void> {
    const link = this.facade.link();
    if (link === null) {
      return;
    }
    await navigator.clipboard.writeText(link);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  /**
   * Comparte con la hoja nativa, o cae a copiar.
   *
   * En web `navigator.share` puede no existir o el usuario puede cancelarla;
   * en ambos casos el enlace tiene que terminar en el portapapeles igual.
   */
  async share(): Promise<void> {
    const link = this.facade.link();
    const invitation = this.facade.invitation();
    if (link === null || invitation === null) {
      return;
    }

    const datos = {
      title: 'Tu invitación a Ñeque',
      text: `${invitation.studentName}, crea tu acceso a Ñeque con este enlace.`,
      url: link,
    };

    try {
      const { Share } = await import('@capacitor/share');
      await Share.share(datos);
    } catch {
      await this.copy();
    }
  }

  async toggleQr(): Promise<void> {
    const abierto = !this.showQr();
    this.showQr.set(abierto);
    if (abierto && this.qrDataUrl() === null) {
      await this.renderQr();
    }
  }

  reissue(): void {
    this.reset();
    this.facade.issue(this.studentId());
  }

  revoke(): void {
    this.reset();
    this.facade.revoke();
  }

  /**
   * Genera el QR con import dinamico.
   *
   * La libreria pesa mas que la pantalla entera y solo la necesita quien
   * toca "Ver código QR": estatica viajaria en el chunk de `/trainer`.
   */
  private async renderQr(): Promise<void> {
    const link = this.facade.link();
    if (link === null) {
      return;
    }
    try {
      // `qrcode` es CommonJS: en el build de produccion su chunk solo exporta
      // `default`, y leer `toDataURL` del modulo daba undefined. En `ng serve`
      // la interop lo expone suelto, por eso solo fallaba en la IPA.
      const modulo = (await import('qrcode')) as QrCodeLib & { default?: QrCodeLib };
      const QRCode = modulo.default ?? modulo;
      this.qrDataUrl.set(await QRCode.toDataURL(link, { margin: 1, width: 360 }));
    } catch {
      this.qrError.set('No pudimos generar el código.');
    }
  }

  /** Un enlace nuevo invalida el QR y el aviso de copiado del anterior. */
  private reset(): void {
    this.qrDataUrl.set(null);
    this.qrError.set(null);
    this.showQr.set(false);
    this.copied.set(false);
  }
}
