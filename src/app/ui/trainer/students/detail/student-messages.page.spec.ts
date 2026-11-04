import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ConversationFacade } from '@app/application/messages/conversation.facade';
import { MESSAGES_PORT, MessagesPort } from '@app/domain/messages/port/messages.port';

import { fn, MockOf } from '@testing/typed-mock';

import { TrainerStudentMessagesPage } from './student-messages.page';

describe('TrainerStudentMessagesPage', () => {
  let list: MockOf<MessagesPort['list']>;
  let router: Router;
  let page: TrainerStudentMessagesPage;

  beforeEach(() => {
    list = fn<MessagesPort['list']>().mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ConversationFacade,
        { provide: MESSAGES_PORT, useValue: { list, send: fn<MessagesPort['send']>() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'std-9' } } },
        },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    page = TestBed.runInInjectionContext(() => new TrainerStudentMessagesPage());
  });

  it('carga la conversacion del alumno de la ruta', () => {
    expect(list).toHaveBeenCalledWith('std-9');
  });

  it('volver lleva a la ficha', () => {
    page.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/trainer/students', 'std-9']);
  });
});
