import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { TrainerInvitationFacade } from '@app/application/trainers/trainer-invitation.facade';
import { TrainerStudentsFacade } from '@app/application/trainers/trainer-students.facade';
import { INVITATION_PORT, InvitationPort } from '@app/domain/auth/port/invitation.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { CLOCK } from '@app/domain/shared/port/clock.port';
import { PUBLIC_APP_URL } from '@app/domain/shared/port/public-url.port';
import { Student } from '@app/domain/students/model/student.model';
import { STUDENTS_PORT, StudentsPort } from '@app/domain/students/port/students.port';

import { fn, MockOf } from '@testing/typed-mock';

import { TrainerStudentsPage } from './trainer-students.page';

const alumno = (
  id: string,
  firstName: string,
  status: Student['status'] = 'active',
  goal: string | null = 'Ganar masa',
): Student => ({
  id,
  trainerId: 'trn-001',
  trainerName: 'Kelvin Moreno',
  firstName,
  lastName: 'Acosta',
  email: `${firstName.toLowerCase()}@neque.cl`,
  phone: null,
  avatarUrl: null,
  status,
  birthDate: null,
  heightCm: null,
  goal,
  joinedAt: '2026-01-10T00:00:00.000Z',
});

const CARTERA = [alumno('std-001', 'Alejandra'), alumno('std-003', 'Diego', 'suspended')];

const AHORA = new Date('2026-09-20T10:00:00.000Z');

const INVITACION = {
  token: 'inv-nueva',
  studentId: 'std-009',
  studentName: 'Nueva Alumna',
  email: 'nueva@neque.cl',
  trainerName: 'Kelvin Moreno',
  expiresAt: new Date(AHORA.getTime() + 48 * 60 * 60 * 1000).toISOString(),
  status: 'pending' as const,
};

describe('TrainerStudentsPage', () => {
  let page: TrainerStudentsPage;
  let router: Router;
  let create: MockOf<StudentsPort['create']>;
  let issue: MockOf<InvitationPort['create']>;

  const createPage = (cartera: Student[] = CARTERA): TrainerStudentsPage => {
    create = fn<StudentsPort['create']>().mockReturnValue(of(alumno('std-009', 'Nueva')));
    issue = fn<InvitationPort['create']>().mockReturnValue(of(INVITACION));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // La pagina las declara en sus `providers`; aqui hay que darlas a mano.
        TrainerStudentsFacade,
        TrainerInvitationFacade,
        { provide: PUBLIC_APP_URL, useValue: 'https://neque.vercel.app' },
        { provide: SessionFacade, useValue: { profileId: () => 'trn-001' } },
        { provide: CLOCK, useValue: { now: () => AHORA } },
        { provide: STUDENTS_PORT, useValue: { listByTrainer: () => of(cartera), create } },
        {
          provide: INVITATION_PORT,
          useValue: {
            getForStudent: () => of(null),
            create: issue,
            revoke: () => of(undefined),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new TrainerStudentsPage());
  };

  beforeEach(() => {
    page = createPage();
  });

  describe('carga inicial', () => {
    it('pide la cartera al construirse', () => {
      expect(page.facade.viewState()).toBe('success');
      expect(page.facade.visible()).toHaveLength(1);
    });
  });

  describe('resumen()', () => {
    it('usa el singular con un solo alumno', () => {
      expect(page.resumen()).toBe('1 alumno activo');
    });

    it('usa el plural con varios', () => {
      page = createPage([alumno('std-001', 'Alejandra'), alumno('std-002', 'Camila')]);

      expect(page.resumen()).toBe('2 alumnos activos');
    });
  });

  describe('search()', () => {
    const evento = (value: string): Event => ({ target: { value } }) as unknown as Event;

    it('filtra con lo que se escribe', () => {
      page.search(evento('alejandra'));

      expect(page.facade.query()).toBe('alejandra');
      expect(page.facade.visible()).toHaveLength(1);
    });

    it('limpiar devuelve la lista completa', () => {
      page.search(evento('zzz'));

      page.clear();

      expect(page.facade.query()).toBe('');
      expect(page.facade.visible()).toHaveLength(1);
    });
  });

  describe('mensajes de vacio', () => {
    it('distingue el vacio por busqueda', () => {
      page.search({ target: { value: 'zzz' } } as unknown as Event);

      expect(page.vacioTitulo()).toBe('Sin coincidencias');
      expect(page.vacioMensaje()).toContain('otro nombre');
    });

    it('explica la pestana de suspendidos vacia', () => {
      page = createPage([alumno('std-001', 'Alejandra')]);
      page.facade.selectFilter('suspended');

      expect(page.vacioMensaje()).toContain('suspendidos');
    });

    it('invita al alta con la cartera vacia', () => {
      page = createPage([]);

      expect(page.vacioTitulo()).toBe('Aún no hay alumnos');
      expect(page.vacioMensaje()).toContain('primer alumno');
    });
  });

  describe('open()', () => {
    it('navega a la ficha del alumno', () => {
      page.open('std-001');

      expect(router.navigate).toHaveBeenCalledWith(['/trainer/students', 'std-001']);
    });
  });

  describe('helpers de plantilla', () => {
    it('arma el nombre completo y las iniciales', () => {
      const student = alumno('std-001', 'Alejandra');

      expect(page.nameOf(student)).toBe('Alejandra Acosta');
      expect(page.initialsOf(student)).toBe('AA');
    });
  });

  describe('alta de alumno', () => {
    const VALORES = {
      firstName: 'Nueva',
      lastName: 'Alumna',
      email: 'nueva@neque.cl',
      phone: null,
      birthDate: null,
      heightCm: null,
      goal: null,
    };

    it('el sheet nace cerrado', () => {
      expect(page.sheetOpen()).toBe(false);
    });

    it('abrir limpia lo que quedo del alta anterior', async () => {
      await page.submit(VALORES);

      page.openForm();

      expect(page.sheetOpen()).toBe(true);
      expect(page.created()).toBeNull();
      expect(page.createdId()).toBeNull();
    });

    it('manda al puerto lo que entrego el formulario', async () => {
      await page.submit(VALORES);

      expect(create).toHaveBeenCalledWith(expect.objectContaining(VALORES));
    });

    // Dar de alta sin invitar deja una ficha que nadie puede usar.
    it('emite la invitacion en el mismo gesto', async () => {
      await page.submit(VALORES);

      expect(issue).toHaveBeenCalledWith('std-009');
      expect(page.created()).toBe('Nueva Alumna');
      expect(page.createdId()).toBe('std-009');
    });

    it('un correo duplicado deja el formulario abierto con el error', async () => {
      create.mockReturnValue(throwError(() => domainError('conflict')));

      await page.submit(VALORES);

      expect(page.created()).toBeNull();
      expect(page.facade.saveError()?.code).toBe('conflict');
      expect(issue).not.toHaveBeenCalled();
    });

    it('explica la vigencia de la invitacion antes de guardar', () => {
      expect(page.altaHint).toContain('48 horas');
    });

    it('cerrar oculta el sheet', () => {
      page.openForm();

      page.closeForm();

      expect(page.sheetOpen()).toBe(false);
    });
  });

  describe('reload', () => {
    it('es un campo arrow para poder pasarlo a [retry]', () => {
      expect(() => page.reload()).not.toThrow();
    });
  });
});
