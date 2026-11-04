import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SessionFacade } from '@app/application/auth/session.facade';
import { ConversationFacade } from '@app/application/messages/conversation.facade';
import { MESSAGES_PORT, MessagesPort } from '@app/domain/messages/port/messages.port';

import { fn, MockOf } from '@testing/typed-mock';

import { StudentMessagesPage } from './student-messages.page';

describe('StudentMessagesPage', () => {
  let list: MockOf<MessagesPort['list']>;
  let router: Router;

  const crear = (profileId: string | null): StudentMessagesPage => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ConversationFacade,
        { provide: SessionFacade, useValue: { profileId: () => profileId } },
        { provide: MESSAGES_PORT, useValue: { list, send: fn<MessagesPort['send']>() } },
      ],
    });
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() => new StudentMessagesPage());
  };

  beforeEach(() => {
    list = fn<MessagesPort['list']>().mockReturnValue(of([]));
  });

  it('carga la conversacion del alumno de la sesion', () => {
    crear('std-1');

    expect(list).toHaveBeenCalledWith('std-1');
  });

  it('sin sesion no carga', () => {
    crear(null);

    expect(list).not.toHaveBeenCalled();
  });

  it('volver sin historial lleva al perfil', () => {
    const page = crear('std-1');
    jest.spyOn(TestBed.inject(Location), 'getState').mockReturnValue(null);

    page.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/student/profile']);
  });
});
