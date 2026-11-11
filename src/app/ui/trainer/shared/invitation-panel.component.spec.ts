import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { TrainerInvitationFacade } from '@app/application/trainers/trainer-invitation.facade';
import {
  INVITATION_PORT,
  InvitationPort,
  InvitationDetails,
} from '@app/domain/auth/port/invitation.port';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { PUBLIC_APP_URL } from '@app/domain/shared/port/public-url.port';

import { fn, MockOf } from '@testing/typed-mock';

import { InvitationPanelComponent } from './invitation-panel.component';

const share = fn<(...args: unknown[]) => Promise<void>>();
jest.mock('@capacitor/share', () => ({ Share: { share: (...args: unknown[]) => share(...args) } }));

// QA-32: la libreria real tarda bajo carga y el test fallaba por tiempo. Aqui
// se prueba el panel, no el contenido del QR.
const toDataURL = fn<(text: string) => Promise<string>>().mockResolvedValue(
  'data:image/png;base64,QR',
);
jest.mock('qrcode', () => ({
  __esModule: true,
  toDataURL: (text: string) => toDataURL(text),
}));

const AHORA = new Date('2026-09-20T10:00:00.000Z');

const invitacion = (
  horas = 48,
  status: InvitationDetails['status'] = 'pending',
): InvitationDetails => ({
  token: 'inv-abc',
  studentId: 'std-009',
  studentName: 'Alejandra Acosta',
  email: 'alejandra@neque.cl',
  trainerName: 'Kelvin Moreno',
  expiresAt: new Date(AHORA.getTime() + horas * 60 * 60 * 1000).toISOString(),
  status,
});

describe('InvitationPanelComponent', () => {
  let fixture: ComponentFixture<InvitationPanelComponent>;
  let panel: InvitationPanelComponent;
  let revoke: MockOf<InvitationPort['revoke']>;
  let create: MockOf<InvitationPort['create']>;

  // Los `input()` senal no se pueden asignar sobre una instancia suelta:
  // este componente se prueba renderizado, como el resto de ui/shared.
  const crear = (vigente: InvitationDetails | null = invitacion()): void => {
    revoke = fn<InvitationPort['revoke']>().mockReturnValue(of(undefined));
    create = fn<InvitationPort['create']>().mockReturnValue(of(invitacion()));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [InvitationPanelComponent],
      providers: [
        TrainerInvitationFacade,
        { provide: PUBLIC_APP_URL, useValue: 'https://neque.vercel.app' },
        { provide: CLOCK, useValue: { now: () => AHORA } },
        {
          provide: INVITATION_PORT,
          useValue: { getForStudent: () => of(vigente), create, revoke },
        },
      ],
    });

    fixture = TestBed.createComponent(InvitationPanelComponent);
    fixture.componentRef.setInput('studentId', 'std-009');
    panel = fixture.componentInstance;
    panel.facade.load('std-009');
    fixture.detectChanges();
  };

  beforeEach(() => crear());

  describe('aviso del correo', () => {
    const aviso = (): string =>
      (fixture.nativeElement as HTMLElement).querySelector('.email-notice')?.textContent?.trim() ??
      '';

    it('al emitir avisa a que correo se envio', () => {
      create.mockReturnValue(of({ ...invitacion(), emailSent: true }));
      panel.facade.issue('std-009');
      fixture.detectChanges();

      expect(aviso()).toBe('Le enviamos la invitación a alejandra@neque.cl.');
    });

    it('si el correo no salio, pide compartir el enlace', () => {
      create.mockReturnValue(of({ ...invitacion(), emailSent: false }));
      panel.facade.issue('std-009');
      fixture.detectChanges();

      expect(aviso()).toBe('No pudimos enviar el correo; comparte el enlace.');
    });

    it('al solo consultar la invitacion no muestra aviso', () => {
      expect(aviso()).toBe('');
    });
  });

  describe('con invitacion vigente', () => {
    it('muestra el enlace', () => {
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(texto).toContain('https://neque.vercel.app/i/inv-abc');
    });

    it('anuncia la vigencia en horas', () => {
      expect(panel.vigencia()).toBe('Vence en 48 horas');
    });

    it('usa el singular con una hora', () => {
      crear(invitacion(0.5));

      expect(panel.vigencia()).toBe('Vence en 1 hora');
    });

    // Una vigencia larga en horas no se lee: "Vence en 2354 horas".
    it('pasa a dias cuando supera el TTL', () => {
      crear(invitacion(72));

      expect(panel.vigencia()).toBe('Vence en 3 días');
    });

    // Encadenar dos redondeos hacia arriba convertia 49 horas en tres dias.
    it('no infla los dias al convertir', () => {
      crear(invitacion(49));

      expect(panel.vigencia()).toBe('Vence en 2 días');
    });

    it('avisa cuando ya vencio', () => {
      crear(invitacion(-1));

      expect(panel.vigencia()).toBe('Vence en menos de una hora');
    });

    it('etiqueta el estado en espanol', () => {
      expect(panel.estado()).toBe('Vigente');
      expect(panel.badgeClass()).toBe('nq-badge-success');
    });

    it('distingue una invitacion ya utilizada', () => {
      crear(invitacion(48, 'accepted'));

      expect(panel.estado()).toBe('Ya utilizada');
      expect(panel.badgeClass()).toBe('nq-badge-primary');
    });

    it('distingue una revocada', () => {
      crear(invitacion(48, 'revoked'));

      expect(panel.estado()).toBe('Revocada');
      expect(panel.badgeClass()).toBe('nq-badge-warning');
    });
  });

  describe('sin invitacion', () => {
    beforeEach(() => crear(null));

    it('invita a emitir una', () => {
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(texto).toContain('Emitir invitación');
    });

    it('emitir llama al puerto con el alumno del input', () => {
      panel.reissue();

      expect(create).toHaveBeenCalledWith('std-009');
    });
  });

  describe('revoke()', () => {
    it('revoca la invitacion cargada', () => {
      panel.revoke();

      expect(revoke).toHaveBeenCalledWith('inv-abc');
    });
  });

  describe('copy()', () => {
    it('deja el enlace en el portapapeles y avisa', async () => {
      const writeText = fn<Clipboard['writeText']>().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

      await panel.copy();

      expect(writeText).toHaveBeenCalledWith('https://neque.vercel.app/i/inv-abc');
      expect(panel.copied()).toBe(true);
    });
  });

  describe('share()', () => {
    let writeText: MockOf<Clipboard['writeText']>;

    beforeEach(() => {
      share.mockReset().mockResolvedValue(undefined);
      writeText = fn<Clipboard['writeText']>().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    });

    it('abre la hoja nativa con el enlace', async () => {
      await panel.share();

      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://neque.vercel.app/i/inv-abc' }),
      );
    });

    it('nombra al alumno en el mensaje', async () => {
      await panel.share();

      const options = share.mock.calls[0]?.[0] as { text?: string } | undefined;
      expect(options?.text).toContain('Alejandra Acosta');
    });

    // En web la hoja puede no existir o el usuario puede cancelarla: el
    // enlace tiene que terminar en el portapapeles igual.
    it('cae a copiar cuando la hoja falla', async () => {
      share.mockRejectedValue(new Error('sin soporte'));

      await panel.share();

      expect(writeText).toHaveBeenCalled();
      expect(panel.copied()).toBe(true);
    });

    it('no hace nada sin invitacion', async () => {
      crear(null);

      await panel.share();
      await panel.copy();

      expect(share).not.toHaveBeenCalled();
      expect(writeText).not.toHaveBeenCalled();
    });
  });

  describe('toggleQr()', () => {
    it('empieza oculto', () => {
      expect(panel.showQr()).toBe(false);
    });

    it('abrir genera el codigo', async () => {
      await panel.toggleQr();

      expect(panel.showQr()).toBe(true);
      expect(panel.qrDataUrl()).toMatch(/^data:image/);
    });

    it('cerrar no borra lo ya generado', async () => {
      await panel.toggleQr();

      await panel.toggleQr();

      expect(panel.showQr()).toBe(false);
      expect(panel.qrDataUrl()).not.toBeNull();
    });

    it('no genera codigo sin invitacion', async () => {
      crear(null);

      await panel.toggleQr();

      expect(panel.qrDataUrl()).toBeNull();
    });

    // Un enlace nuevo invalida el QR del anterior.
    it('reemitir descarta el codigo anterior', async () => {
      await panel.toggleQr();

      panel.reissue();

      expect(panel.qrDataUrl()).toBeNull();
      expect(panel.showQr()).toBe(false);
    });
  });
});
