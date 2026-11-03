import { notificationRoute } from './notification-target';

describe('notificationRoute()', () => {
  it('lleva la sesion a su runner con el id', () => {
    expect(notificationRoute('session', 'wks-001')).toEqual(['/student/workout', 'wks-001']);
  });

  it.each([
    ['routine' as const, ['/student/routine']],
    ['assessment' as const, ['/student/schedule']],
    ['photo' as const, ['/student/progress']],
  ])('lleva %s a su pantalla', (targetType, esperada) => {
    expect(notificationRoute(targetType, 'x-001')).toEqual(esperada);
  });

  // Una notificacion informativa no abre nada.
  it('devuelve null sin destino', () => {
    expect(notificationRoute(null, null)).toBeNull();
  });

  it('devuelve null si falta el id', () => {
    expect(notificationRoute('session', null)).toBeNull();
  });

  describe('entrenador', () => {
    it('lleva un alumno a su ficha', () => {
      expect(notificationRoute('student', 'std-002', 'trainer')).toEqual([
        '/trainer/students',
        'std-002',
      ]);
    });

    // Un destino del alumno no abre nada en la app del entrenador.
    it('devuelve null con un destino que no le corresponde', () => {
      expect(notificationRoute('session', 'wks-001', 'trainer')).toBeNull();
    });
  });

  it('el alumno no abre destinos del entrenador', () => {
    expect(notificationRoute('student', 'std-002')).toBeNull();
  });
});
