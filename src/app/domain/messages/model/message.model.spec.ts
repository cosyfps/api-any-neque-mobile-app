import { Message, endsGroup, messageError, unreadFrom } from './message.model';

const mensaje = (sender: Message['senderRole'], leido: boolean): Message => ({
  id: `${sender}-${leido}`,
  studentId: 'std-1',
  senderRole: sender,
  body: 'Hola',
  createdAt: '2026-11-04T12:00:00.000Z',
  readAt: leido ? '2026-11-04T12:05:00.000Z' : null,
});

describe('message.model', () => {
  it('messageError exige texto y respeta el largo maximo', () => {
    expect(messageError('   ')).toBe('Escribe un mensaje.');
    expect(messageError('x'.repeat(1001))).toBe('El mensaje puede tener hasta 1000 caracteres.');
    expect(messageError(' Hola ')).toBeNull();
  });

  it('unreadFrom cuenta solo lo no leido de la otra parte', () => {
    const lista = [mensaje('trainer', false), mensaje('trainer', true), mensaje('student', false)];

    expect(unreadFrom(lista, 'student')).toBe(1);
    expect(unreadFrom(lista, 'trainer')).toBe(1);
  });

  describe('endsGroup()', () => {
    const en = (sender: Message['senderRole'], iso: string): Message => ({
      ...mensaje(sender, false),
      id: iso,
      createdAt: iso,
    });
    const lista = [
      en('trainer', '2026-11-04T12:00:00.000Z'),
      en('trainer', '2026-11-04T12:10:00.000Z'),
      en('trainer', '2026-11-04T12:50:00.000Z'),
      en('student', '2026-11-04T12:51:00.000Z'),
      en('student', '2026-11-05T12:52:00.000Z'),
    ];

    it('seguidos en menos de 30 min forman un grupo con una sola hora', () => {
      expect(endsGroup(lista, 0)).toBe(false);
    });

    it('mas de 30 min hasta el siguiente cierra el grupo', () => {
      expect(endsGroup(lista, 1)).toBe(true);
    });

    it('cambiar de persona o de dia cierra el grupo, y el ultimo siempre lo cierra', () => {
      expect(endsGroup(lista, 2)).toBe(true);
      expect(endsGroup(lista, 3)).toBe(true);
      expect(endsGroup(lista, 4)).toBe(true);
    });

    it('un indice fuera de la lista no cierra nada', () => {
      expect(endsGroup(lista, 9)).toBe(false);
    });
  });
});
