import { Student, fullName, initials } from './student.model';

const student: Student = {
  id: 'std-001',
  trainerId: 'trn-001',
  trainerName: 'Kelvin Moreno',
  firstName: 'Alejandra',
  lastName: 'Acosta',
  email: 'alejandra@neque.cl',
  phone: null,
  avatarUrl: null,
  status: 'active',
  birthDate: null,
  heightCm: 165,
  goal: null,
  joinedAt: '2026-03-02T00:00:00.000Z',
};

describe('student model', () => {
  describe('fullName()', () => {
    it('une nombre y apellido', () => {
      expect(fullName(student)).toBe('Alejandra Acosta');
    });

    it('no deja espacios sobrantes sin apellido', () => {
      expect(fullName({ ...student, lastName: '' })).toBe('Alejandra');
    });
  });

  describe('initials()', () => {
    it('toma la inicial de cada campo en mayuscula', () => {
      expect(initials(student)).toBe('AA');
    });

    it('devuelve una sola letra sin apellido', () => {
      expect(initials({ ...student, lastName: '' })).toBe('A');
    });

    it('devuelve vacio sin nombre ni apellido', () => {
      expect(initials({ ...student, firstName: '', lastName: '' })).toBe('');
    });
  });
});
