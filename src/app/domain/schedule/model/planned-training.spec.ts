import { Routine } from '@app/domain/routines/model/routine.model';
import { toIsoDate } from '@app/domain/shared/model/date';
import { WorkoutSession, WorkoutStatus } from '@app/domain/workouts/model/workout-session.model';

import { TRAINING_STATUS_LABEL, plannedTrainingOn } from './planned-training';

// Martes 3 de noviembre de 2026.
const HOY = new Date(2026, 10, 3, 10, 0);

const RUTINA: Routine = {
  id: 'rtn-001',
  trainerId: 'trn-001',
  name: 'Torso / Pierna',
  goal: 'Fuerza',
  days: [
    { id: 'd1', weekday: 1, title: 'Torso A', focus: 'chest', estimatedMinutes: 60, exercises: [] },
    { id: 'd2', weekday: 2, title: 'Pierna A', focus: 'legs', estimatedMinutes: 55, exercises: [] },
  ],
  assignments: [{ studentId: 'std-001', startDate: '2026-11-02', endDate: '2026-11-30' }],
};

const sesion = (dia: string, fecha: Date, status: WorkoutStatus): WorkoutSession => ({
  id: `s-${dia}`,
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: dia,
  title: 'x',
  scheduledFor: toIsoDate(fecha),
  startedAt: null,
  completedAt: null,
  status,
  durationMinutes: null,
  estimatedMinutes: 60,
  exercises: [],
});

describe('plannedTrainingOn()', () => {
  it('sin rutina no hay entrenamiento', () => {
    expect(plannedTrainingOn(null, 'std-001', new Date(2026, 10, 9), [], HOY)).toBeNull();
  });

  // El caso del reporte: el lunes 9 no tiene sesion generada todavia.
  it('un dia futuro de la rutina aparece planificado aunque no tenga sesion', () => {
    const plan = plannedTrainingOn(RUTINA, 'std-001', new Date(2026, 10, 9), [], HOY);

    expect(plan?.day.title).toBe('Torso A');
    expect(plan?.status).toBe('planned');
  });

  it('hoy sin completar sigue planificado', () => {
    expect(plannedTrainingOn(RUTINA, 'std-001', HOY, [], HOY)?.status).toBe('planned');
  });

  it('un dia sin entrenamiento en la rutina no muestra nada', () => {
    expect(plannedTrainingOn(RUTINA, 'std-001', new Date(2026, 10, 4), [], HOY)).toBeNull();
  });

  it('respeta el inicio y el fin de la asignacion', () => {
    expect(plannedTrainingOn(RUTINA, 'std-001', new Date(2026, 9, 26), [], HOY)).toBeNull();
    expect(plannedTrainingOn(RUTINA, 'std-001', new Date(2026, 11, 7), [], HOY)).toBeNull();
  });

  it('otro alumno no ve la rutina', () => {
    expect(plannedTrainingOn(RUTINA, 'std-999', new Date(2026, 10, 9), [], HOY)).toBeNull();
  });

  it('una sesion completada marca el dia como completado', () => {
    const lunes = new Date(2026, 10, 2, 9);
    const plan = plannedTrainingOn(
      RUTINA,
      'std-001',
      lunes,
      [sesion('d1', lunes, 'completed')],
      HOY,
    );

    expect(plan?.status).toBe('done');
  });

  it('un dia pasado sin completar queda como no realizado', () => {
    expect(plannedTrainingOn(RUTINA, 'std-001', new Date(2026, 10, 2), [], HOY)?.status).toBe(
      'missed',
    );
  });

  it('una sesion omitida tambien es no realizado', () => {
    const martes = new Date(2026, 10, 3, 9);
    const plan = plannedTrainingOn(
      RUTINA,
      'std-001',
      martes,
      [sesion('d2', martes, 'skipped')],
      HOY,
    );

    expect(plan?.status).toBe('missed');
  });

  it('acepta fechas de asignacion en ISO completo y sin fin', () => {
    const rutina: Routine = {
      ...RUTINA,
      assignments: [{ studentId: 'std-001', startDate: '2026-11-02T00:00:00.000Z', endDate: null }],
    };

    expect(plannedTrainingOn(rutina, 'std-001', new Date(2027, 0, 4), [], HOY)?.status).toBe(
      'planned',
    );
  });

  it('tiene etiqueta para cada estado', () => {
    expect(TRAINING_STATUS_LABEL.done).toBe('Completado');
    expect(TRAINING_STATUS_LABEL.missed).toBe('No realizado');
  });
});
