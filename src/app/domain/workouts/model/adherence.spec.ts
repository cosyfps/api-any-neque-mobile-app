import { adherencePercent, averagePercent } from './adherence';
import { WorkoutSession, WorkoutStatus } from './workout-session.model';

const sesion = (status: WorkoutStatus): WorkoutSession => ({
  id: 'wks',
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-1',
  title: 'Sesion',
  scheduledFor: '2026-09-21T18:00:00.000Z',
  startedAt: null,
  completedAt: null,
  status,
  durationMinutes: null,
  estimatedMinutes: 45,
  exercises: [],
});

describe('adherence', () => {
  describe('adherencePercent()', () => {
    it('es null sin nada resuelto', () => {
      expect(adherencePercent([sesion('scheduled')])).toBeNull();
    });

    it('divide completadas por resueltas, sin contar lo programado', () => {
      const sesiones = [
        sesion('completed'),
        sesion('completed'),
        sesion('skipped'),
        sesion('scheduled'),
      ];

      expect(adherencePercent(sesiones)).toBe(67);
    });
  });

  describe('averagePercent()', () => {
    it('promedia ignorando los null', () => {
      expect(averagePercent([80, null, 90])).toBe(85);
    });

    it('es null sin ningun dato', () => {
      expect(averagePercent([null, null])).toBeNull();
    });
  });
});
