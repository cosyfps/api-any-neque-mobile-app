import { localDay, mondayOfDay, rescheduleError, rescheduleOptions } from './reschedule-rules';

const AGENDADA = { status: 'scheduled' as const, startedAt: null };

describe('reschedule-rules', () => {
  it('localDay usa la fecha local', () => {
    expect(localDay(new Date(2026, 10, 4, 23, 30))).toBe('2026-11-04');
  });

  it('mondayOfDay devuelve el lunes de la semana', () => {
    expect(mondayOfDay('2026-11-04')).toBe('2026-11-02');
    expect(mondayOfDay('2026-11-08')).toBe('2026-11-02');
    expect(mondayOfDay('2026-11-02')).toBe('2026-11-02');
  });

  describe('rescheduleOptions()', () => {
    it('ofrece de hoy al domingo, sin el dia actual', () => {
      expect(rescheduleOptions('2026-11-06', '2026-11-06', '2026-11-04')).toEqual([
        '2026-11-04',
        '2026-11-05',
        '2026-11-07',
        '2026-11-08',
      ]);
    });

    it('si la semana aun no empieza, desde su lunes', () => {
      expect(rescheduleOptions('2026-11-10', '2026-11-10', '2026-11-04')[0]).toBe('2026-11-09');
    });

    it('no ofrece dias que ya tienen otro entrenamiento', () => {
      expect(
        rescheduleOptions('2026-11-06', '2026-11-06', '2026-11-04', ['2026-11-05', '2026-11-07']),
      ).toEqual(['2026-11-04', '2026-11-08']);
    });

    it('una semana ya pasada no ofrece dias', () => {
      expect(rescheduleOptions('2026-10-28', '2026-10-28', '2026-11-04')).toEqual([]);
    });
  });

  describe('rescheduleError()', () => {
    it('acepta otro dia de la semana desde hoy', () => {
      expect(
        rescheduleError(AGENDADA, '2026-11-06', '2026-11-06', '2026-11-07', '2026-11-04'),
      ).toBeNull();
    });

    it('rechaza un entrenamiento empezado o completado', () => {
      const mensaje = 'Solo puedes mover un entrenamiento que todavía no empiezas.';
      expect(
        rescheduleError(
          { status: 'in_progress', startedAt: '2026-11-04T10:00:00.000Z' },
          '2026-11-06',
          '2026-11-06',
          '2026-11-07',
          '2026-11-04',
        ),
      ).toBe(mensaje);
      expect(
        rescheduleError(
          { status: 'completed', startedAt: null },
          '2026-11-06',
          '2026-11-06',
          '2026-11-07',
          '2026-11-04',
        ),
      ).toBe(mensaje);
    });

    it('rechaza un dia que ya tiene otro entrenamiento', () => {
      expect(
        rescheduleError(AGENDADA, '2026-11-06', '2026-11-06', '2026-11-07', '2026-11-04', [
          '2026-11-07',
        ]),
      ).toBe('Ese día ya tiene un entrenamiento. Elige un día libre.');
    });

    it('rechaza un dia mal formado', () => {
      expect(rescheduleError(AGENDADA, '2026-11-06', '2026-11-06', 'jueves', '2026-11-04')).toBe(
        'Elige un día válido.',
      );
    });

    it('rechaza otra semana, un dia pasado o el mismo dia', () => {
      const mensaje = 'Puedes moverlo a otro día de esta misma semana, desde hoy.';
      expect(
        rescheduleError(AGENDADA, '2026-11-06', '2026-11-06', '2026-11-10', '2026-11-04'),
      ).toBe(mensaje);
      expect(
        rescheduleError(AGENDADA, '2026-11-06', '2026-11-06', '2026-11-03', '2026-11-04'),
      ).toBe(mensaje);
      expect(
        rescheduleError(AGENDADA, '2026-11-06', '2026-11-06', '2026-11-06', '2026-11-04'),
      ).toBe(mensaje);
    });
  });
});
