import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import {
  INVITATION_PORT,
  InvitationPort,
  InvitationDetails,
} from '@app/domain/auth/port/invitation.port';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { PUBLIC_APP_URL } from '@app/domain/shared/port/public-url.port';

import { fn, MockOf } from '@testing/typed-mock';

import { TrainerInvitationFacade } from './trainer-invitation.facade';

const AHORA = new Date('2026-09-20T10:00:00.000Z');

const invitacion = (
  horas: number,
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

describe('TrainerInvitationFacade', () => {
  let facade: TrainerInvitationFacade;
  let port: {
    getForStudent: MockOf<InvitationPort['getForStudent']>;
    create: MockOf<InvitationPort['create']>;
    revoke: MockOf<InvitationPort['revoke']>;
  };

  const createFacade = (
    vigente: InvitationDetails | null = invitacion(48),
  ): TrainerInvitationFacade => {
    port = {
      getForStudent: fn<InvitationPort['getForStudent']>().mockReturnValue(of(vigente)),
      create: fn<InvitationPort['create']>().mockReturnValue(of(invitacion(48))),
      revoke: fn<InvitationPort['revoke']>().mockReturnValue(of(undefined)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TrainerInvitationFacade,
        { provide: PUBLIC_APP_URL, useValue: 'https://neque.vercel.app' },
        { provide: INVITATION_PORT, useValue: port },
        { provide: CLOCK, useValue: { now: () => AHORA } },
      ],
    });
    return TestBed.inject(TrainerInvitationFacade);
  };

  beforeEach(() => {
    facade = createFacade();
  });

  describe('load()', () => {
    it('trae la invitacion vigente del alumno', () => {
      facade.load('std-009');

      expect(port.getForStudent).toHaveBeenCalledWith('std-009');
      expect(facade.invitation()?.token).toBe('inv-abc');
    });

    it('deja null cuando el alumno no tiene una', () => {
      const sinInvitacion = createFacade(null);

      sinInvitacion.load('std-009');

      expect(sinInvitacion.invitation()).toBeNull();
      expect(sinInvitacion.link()).toBeNull();
    });

    it('expone el error del puerto', () => {
      port.getForStudent.mockReturnValue(throwError(() => new Error('boom')));

      facade.load('std-009');

      expect(facade.error()).not.toBeNull();
      expect(facade.busy()).toBe(false);
    });
  });

  describe('link()', () => {
    it('arma la ruta publica de la invitacion', () => {
      facade.load('std-009');

      expect(facade.link()).toBe('https://neque.vercel.app/i/inv-abc');
    });
  });

  describe('hoursLeft()', () => {
    it('redondea hacia arriba para no decir 47 recien emitida', () => {
      port.getForStudent.mockReturnValue(of(invitacion(47.5)));
      facade.load('std-009');

      expect(facade.hoursLeft()).toBe(48);
    });

    it('no baja de cero con una invitacion vencida', () => {
      port.getForStudent.mockReturnValue(of(invitacion(-5)));
      facade.load('std-009');

      expect(facade.hoursLeft()).toBe(0);
    });

    it('es cero sin invitacion', () => {
      expect(facade.hoursLeft()).toBe(0);
    });
  });

  describe('issue()', () => {
    it('emite una invitacion nueva', () => {
      facade.issue('std-009');

      expect(port.create).toHaveBeenCalledWith('std-009');
      expect(facade.invitation()?.token).toBe('inv-abc');
    });
  });

  describe('revoke()', () => {
    it('deja al alumno sin invitacion', () => {
      facade.load('std-009');

      facade.revoke();

      expect(port.revoke).toHaveBeenCalledWith('inv-abc');
      expect(facade.invitation()).toBeNull();
    });

    // Sin invitacion cargada no hay token que revocar.
    it('no llama al puerto sin invitacion', () => {
      facade.revoke();

      expect(port.revoke).not.toHaveBeenCalled();
    });
  });
});
