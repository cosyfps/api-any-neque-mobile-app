import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { Message } from '@app/domain/messages/model/message.model';
import { MESSAGES_PORT, MessagesPort } from '@app/domain/messages/port/messages.port';
import { domainError } from '@app/domain/shared/model/app-error';
import { Student } from '@app/domain/students/model/student.model';
import { STUDENTS_PORT } from '@app/domain/students/port/students.port';
import { Trainer } from '@app/domain/trainers/model/trainer.model';
import { TRAINERS_PORT } from '@app/domain/trainers/port/trainers.port';

import { fn, MockOf } from '@testing/typed-mock';

import { ConversationFacade } from './conversation.facade';

const mensaje = (id: string, body = 'Hola'): Message => ({
  id,
  studentId: 'std-1',
  senderRole: 'student',
  body,
  createdAt: '2026-11-04T12:00:00.000Z',
  readAt: null,
});

const ALUMNO = { id: 'std-1', trainerId: 'trn-1', firstName: 'Ana', lastName: 'Pérez' } as Student;
const ENTRENADOR = { id: 'trn-1', firstName: 'Kelvin', lastName: 'Moreno' } as Trainer;
let alumno$: Observable<Student> = of(ALUMNO);

describe('ConversationFacade', () => {
  let list: MockOf<MessagesPort['list']>;
  let send: MockOf<MessagesPort['send']>;
  let facade: ConversationFacade;

  beforeEach(() => {
    list = fn<MessagesPort['list']>().mockReturnValue(of([mensaje('m1')]));
    send = fn<MessagesPort['send']>().mockImplementation((_id, body) => of(mensaje('m2', body)));
    TestBed.configureTestingModule({
      providers: [
        ConversationFacade,
        { provide: MESSAGES_PORT, useValue: { list, send } },
        { provide: STUDENTS_PORT, useValue: { getById: () => alumno$ } },
        { provide: TRAINERS_PORT, useValue: { getById: () => of(ENTRENADOR) } },
      ],
    });
    facade = TestBed.inject(ConversationFacade);
  });

  it('carga la conversacion del alumno; vacia sigue siendo exito', () => {
    list.mockReturnValue(of([]));
    facade.load('std-1', 'trainer');

    expect(list).toHaveBeenCalledWith('std-1');
    expect(facade.viewState()).toBe('success');
  });

  it('enviar agrega el mensaje al final sin releer', async () => {
    facade.load('std-1', 'trainer');
    list.mockClear();

    expect(await facade.send('Nos vemos')).toBe(true);

    expect(send).toHaveBeenCalledWith('std-1', 'Nos vemos');
    expect(facade.messages.data()?.map(item => item.id)).toEqual(['m1', 'm2']);
    expect(list).not.toHaveBeenCalled();
    expect(facade.sending()).toBe(false);
  });

  it('un rechazo queda en sendError', async () => {
    send.mockReturnValue(throwError(() => domainError('network')));
    facade.load('std-1', 'trainer');

    expect(await facade.send('Hola')).toBe(false);
    expect(facade.sendError()?.code).toBe('network');
  });

  it('sin conversacion cargada no envia ni refresca', async () => {
    expect(await facade.send('Hola')).toBe(false);
    facade.refresh();

    expect(send).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('refresh trae lo nuevo y un fallo no borra lo que se ve', () => {
    facade.load('std-1', 'trainer');
    list.mockReturnValue(of([mensaje('m1'), mensaje('m3')]));
    facade.refresh();
    expect(facade.messages.data()?.map(item => item.id)).toEqual(['m1', 'm3']);

    list.mockReturnValue(throwError(() => domainError('network')));
    facade.refresh();
    expect(facade.messages.data()?.map(item => item.id)).toEqual(['m1', 'm3']);
  });

  it('con el entrenador mirando, el nombre es el del alumno', () => {
    facade.load('std-1', 'trainer');

    expect(facade.peerName()).toBe('Ana Pérez');
  });

  it('con el alumno mirando, el nombre es el de su entrenador', () => {
    facade.load('std-1', 'student');

    expect(facade.peerName()).toBe('Kelvin Moreno');
  });

  it('si no se puede leer el nombre, queda sin nombre', () => {
    alumno$ = throwError(() => domainError('network'));
    facade.load('std-1', 'trainer');
    alumno$ = of(ALUMNO);

    expect(facade.peerName()).toBeNull();
  });

  it('reload vuelve a pedir la conversacion', () => {
    facade.load('std-1', 'trainer');
    facade.reload();

    expect(list).toHaveBeenCalledTimes(2);
  });
});
