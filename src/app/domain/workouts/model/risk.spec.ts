import { toIsoDate } from '@app/domain/shared/model/date';

import { riskLabel, studentRisk } from './risk';
import { WorkoutSession, WorkoutStatus } from './workout-session.model';

// Domingo 27 de septiembre de 2026, mediodia.
const HOY = new Date(2026, 8, 27, 12);

const hace = (dias: number): Date => new Date(2026, 8, 27 - dias, 18);

const sesion = (fecha: Date, status: WorkoutStatus): WorkoutSession => ({
  id: `wks-${fecha.getTime()}`,
  studentId: 'std-001',
  routineId: 'rtn-001',
  routineDayId: 'day-1',
  title: 'Sesion',
  scheduledFor: toIsoDate(fecha),
  startedAt: null,
  completedAt: status === 'completed' ? toIsoDate(fecha) : null,
  status,
  durationMinutes: null,
  estimatedMinutes: 45,
  exercises: [],
});

describe('riskLabel()', () => {
  it('dice los dias sin entrenar o la adherencia', () => {
    expect(riskLabel({ kind: 'inactive', days: 12 })).toBe('12 días sin entrenar');
    expect(riskLabel({ kind: 'low_adherence', percent: 52 })).toBe('52% de adherencia');
  });
});

describe('studentRisk()', () => {
  it('sin sesiones no hay riesgo', () => {
    expect(studentRisk([], HOY)).toBeNull();
  });

  it('va bien si completa lo agendado', () => {
    const sesiones = [sesion(hace(2), 'completed'), sesion(hace(5), 'completed')];

    expect(studentRisk(sesiones, HOY)).toBeNull();
  });

  it('inactivo: sesiones agendadas en la semana y ninguna completada', () => {
    const sesiones = [
      sesion(hace(2), 'skipped'),
      sesion(hace(5), 'scheduled'),
      sesion(hace(12), 'completed'),
    ];

    expect(studentRisk(sesiones, HOY)).toEqual({ kind: 'inactive', days: 12 });
  });

  it('inactivo sin haber entrenado nunca cuenta el umbral', () => {
    expect(studentRisk([sesion(hace(3), 'skipped')], HOY)).toEqual({
      kind: 'inactive',
      days: 7,
    });
  });

  // Sin nada agendado en la semana no hay de que alarmarse.
  it('sin sesiones agendadas en la ventana no es inactivo', () => {
    const sesiones = [sesion(hace(20), 'completed'), sesion(hace(25), 'completed')];

    expect(studentRisk(sesiones, HOY)).toBeNull();
  });

  it('adherencia baja bajo el 60%', () => {
    const sesiones = [
      sesion(hace(1), 'completed'),
      sesion(hace(9), 'skipped'),
      sesion(hace(10), 'skipped'),
      sesion(hace(12), 'completed'),
      sesion(hace(15), 'skipped'),
    ];

    expect(studentRisk(sesiones, HOY)).toEqual({ kind: 'low_adherence', percent: 40 });
  });

  it('lo agendado para hoy o despues no cuenta', () => {
    const sesiones = [sesion(new Date(2026, 8, 27, 18), 'scheduled'), sesion(hace(2), 'completed')];

    expect(studentRisk(sesiones, HOY)).toBeNull();
  });
});
