import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ConversationFacade } from '@app/application/messages/conversation.facade';
import { Message } from '@app/domain/messages/model/message.model';
import { MESSAGES_PORT, MessagesPort } from '@app/domain/messages/port/messages.port';
import { domainError } from '@app/domain/shared/model/app-error';

import { fn, MockOf } from '@testing/typed-mock';

import { ConversationComponent, REFRESH_MS } from './conversation.component';

const mensaje = (
  id: string,
  sender: Message['senderRole'],
  createdAt: string,
  readAt: string | null = null,
): Message => ({
  id,
  studentId: 'std-1',
  senderRole: sender,
  body: `Texto ${id}`,
  createdAt,
  readAt,
});

describe('ConversationComponent', () => {
  let fixture: ComponentFixture<ConversationComponent>;
  let cmp: ConversationComponent;
  let list: MockOf<MessagesPort['list']>;
  let send: MockOf<MessagesPort['send']>;

  const crear = (): void => {
    fixture = TestBed.createComponent(ConversationComponent);
    fixture.componentRef.setInput('me', 'trainer');
    cmp = fixture.componentInstance;
    TestBed.inject(ConversationFacade).load('std-1');
    fixture.detectChanges();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    list = fn<MessagesPort['list']>().mockReturnValue(
      of([
        mensaje('m1', 'student', '2026-11-03T12:00:00.000Z'),
        mensaje('m2', 'trainer', '2026-11-04T12:00:00.000Z', '2026-11-04T12:01:00.000Z'),
        mensaje('m3', 'trainer', '2026-11-04T12:05:00.000Z'),
      ]),
    );
    send = fn<MessagesPort['send']>().mockImplementation((_id, body) =>
      of({ ...mensaje('m4', 'trainer', '2026-11-04T13:00:00.000Z'), body }),
    );
    TestBed.configureTestingModule({
      imports: [ConversationComponent],
      providers: [ConversationFacade, { provide: MESSAGES_PORT, useValue: { list, send } }],
    });
    crear();
  });

  afterEach(() => jest.useRealTimers());

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('pinta las burbujas y marca las propias a la derecha', () => {
    expect(el().querySelectorAll('.bubble')).toHaveLength(3);
    expect(el().querySelectorAll('.bubble-row.mine')).toHaveLength(2);
    expect(el().textContent).toContain('Leído');
  });

  it('separa por dia', () => {
    expect(cmp.nuevoDia(0)).toBe(true);
    expect(cmp.nuevoDia(1)).toBe(true);
    expect(cmp.nuevoDia(2)).toBe(false);
    expect(cmp.nuevoDia(9)).toBe(false);
    expect(el().querySelectorAll('.day-sep')).toHaveLength(2);
  });

  it('formatea hora y dia', () => {
    expect(cmp.hora(new Date(2026, 10, 4, 9, 5).toISOString())).toBe('09:05');
    expect(cmp.dia(new Date(2026, 10, 4, 9, 5).toISOString())).toBe('Miércoles, 4 de noviembre');
  });

  it('no envia texto vacio y lo explica', async () => {
    await cmp.enviar();

    expect(send).not.toHaveBeenCalled();
    expect(cmp.error()).toBe('Escribe un mensaje.');
  });

  it('envia, limpia el campo y agrega el mensaje', async () => {
    cmp.escribir({ target: { value: '  Nos vemos el jueves  ' } } as unknown as Event);

    await cmp.enviar();

    expect(send).toHaveBeenCalledWith('std-1', 'Nos vemos el jueves');
    expect(cmp.texto()).toBe('');
    expect(cmp.error()).toBeNull();
  });

  it('un rechazo del envio se muestra', async () => {
    send.mockReturnValue(throwError(() => domainError('network')));
    cmp.escribir({ target: { value: 'Hola' } } as unknown as Event);

    await cmp.enviar();

    expect(cmp.error()).toBe('No pudimos conectarnos. Revisa tu conexión.');
  });

  it('Enter envia y Shift+Enter no', () => {
    const enviar = jest.spyOn(cmp, 'enviar').mockResolvedValue();
    const shift = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
    const enter = new KeyboardEvent('keydown', { key: 'Enter' });
    const prevenir = jest.spyOn(enter, 'preventDefault');

    cmp.alEnter(shift);
    expect(enviar).not.toHaveBeenCalled();

    cmp.alEnter(enter);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(prevenir).toHaveBeenCalled();
  });

  it('busca mensajes nuevos cada cierto tiempo y deja de hacerlo al salir', () => {
    list.mockClear();

    jest.advanceTimersByTime(REFRESH_MS);
    expect(list).toHaveBeenCalledTimes(1);

    fixture.destroy();
    jest.advanceTimersByTime(REFRESH_MS * 2);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('reload es un campo arrow invocable', () => {
    expect(() => cmp.reload()).not.toThrow();
  });
});
