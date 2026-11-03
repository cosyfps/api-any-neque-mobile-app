import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { TrainerInvitationFacade } from '@app/application/trainers/trainer-invitation.facade';
import {
  INVITATION_PORT,
  InvitationDetails,
  InvitationPort,
} from '@app/domain/auth/port/invitation.port';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { PUBLIC_APP_URL } from '@app/domain/shared/port/public-url.port';

import { fn } from '@testing/typed-mock';

import { InvitationPanelComponent } from './invitation-panel.component';

// Forma que tiene `qrcode` en el build de produccion: un modulo que solo
// exporta `default`. Con esta forma el QR fallaba en la IPA y no en `ng serve`.
const toDataURL = fn<(text: string) => Promise<string>>().mockResolvedValue(
  'data:image/png;base64,QR',
);
jest.mock('qrcode', () => ({ __esModule: true, default: { toDataURL } }));

const AHORA = new Date('2026-09-20T10:00:00.000Z');

const invitacion: InvitationDetails = {
  token: 'inv-abc',
  studentId: 'std-009',
  studentName: 'Alejandra Acosta',
  email: 'alejandra@neque.cl',
  trainerName: 'Kelvin Moreno',
  expiresAt: new Date(AHORA.getTime() + 48 * 60 * 60 * 1000).toISOString(),
  status: 'pending',
};

describe('InvitationPanelComponent — QR con el modulo del build de produccion', () => {
  it('genera el codigo aunque qrcode solo exporte default', async () => {
    TestBed.configureTestingModule({
      imports: [InvitationPanelComponent],
      providers: [
        TrainerInvitationFacade,
        { provide: PUBLIC_APP_URL, useValue: 'https://neque.vercel.app' },
        { provide: CLOCK, useValue: { now: () => AHORA } },
        {
          provide: INVITATION_PORT,
          useValue: {
            getForStudent: () => of(invitacion),
            create: fn<InvitationPort['create']>(),
            revoke: fn<InvitationPort['revoke']>(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(InvitationPanelComponent);
    fixture.componentRef.setInput('studentId', 'std-009');
    const panel = fixture.componentInstance;
    panel.facade.load('std-009');

    await panel.toggleQr();

    expect(toDataURL).toHaveBeenCalledWith('https://neque.vercel.app/i/inv-abc', {
      margin: 1,
      width: 360,
    });
    expect(panel.qrDataUrl()).toBe('data:image/png;base64,QR');
    expect(panel.qrError()).toBeNull();
  });
});
