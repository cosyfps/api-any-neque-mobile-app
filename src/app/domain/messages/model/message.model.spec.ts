import { Message, messageError, unreadFrom } from './message.model';

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
});
