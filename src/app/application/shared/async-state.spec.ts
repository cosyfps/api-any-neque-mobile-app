import { Subject, of, throwError } from 'rxjs';

import { DomainError, domainError } from '@app/domain/shared/model/app-error';

import { AsyncState, asyncState } from './async-state';

describe('AsyncState', () => {
  it('arranca en loading sin datos ni error', () => {
    const state = asyncState<string[]>();
    expect(state.viewState()).toBe('loading');
    expect(state.data()).toBeNull();
    expect(state.error()).toBeNull();
    expect(state.loading()).toBe(false);
  });

  describe('load()', () => {
    it('pasa a success con datos', () => {
      const state = asyncState<string[]>();
      state.load(() => of(['a', 'b']));
      expect(state.viewState()).toBe('success');
      expect(state.data()).toEqual(['a', 'b']);
      expect(state.loading()).toBe(false);
    });

    it('pasa a empty con un arreglo vacio', () => {
      const state = asyncState<string[]>();
      state.load(() => of([]));
      expect(state.viewState()).toBe('empty');
    });

    it('pasa a error y normaliza la causa', () => {
      const state = asyncState<string[]>();
      state.load(() => throwError(() => domainError('network')));
      expect(state.viewState()).toBe('error');
      expect(state.error()).toBeInstanceOf(DomainError);
      expect(state.error()?.code).toBe('network');
      expect(state.loading()).toBe(false);
    });

    it('envuelve como unknown una causa que no es de dominio', () => {
      const state = asyncState<string[]>();
      state.load(() => throwError(() => new Error('boom')));
      expect(state.error()?.code).toBe('unknown');
    });

    it('marca loading mientras la fuente no emite', () => {
      const subject = new Subject<string[]>();
      const state = asyncState<string[]>();
      state.load(() => subject);

      expect(state.loading()).toBe(true);
      expect(state.viewState()).toBe('loading');

      subject.next(['x']);
      expect(state.loading()).toBe(false);
      expect(state.viewState()).toBe('success');
    });

    it('cancela la lectura anterior al iniciar una nueva', () => {
      const first = new Subject<string[]>();
      const state = asyncState<string[]>();
      state.load(() => first);
      state.load(() => of(['segunda']));

      first.next(['primera']);

      expect(state.data()).toEqual(['segunda']);
    });

    it('limpia el error previo al recargar', () => {
      const state = asyncState<string[]>();
      state.load(() => throwError(() => domainError('network')));
      expect(state.viewState()).toBe('error');

      state.load(() => of(['ok']));
      expect(state.error()).toBeNull();
      expect(state.viewState()).toBe('success');
    });
  });

  describe('reload()', () => {
    it('repite la ultima fuente registrada', () => {
      let calls = 0;
      const state = asyncState<number[]>();
      state.load(() => {
        calls += 1;
        return of([calls]);
      });

      state.reload();

      expect(calls).toBe(2);
      expect(state.data()).toEqual([2]);
    });

    it('no hace nada si nunca se llamo a load()', () => {
      const state = asyncState<number[]>();
      state.reload();
      expect(state.viewState()).toBe('loading');
      expect(state.loading()).toBe(false);
    });
  });

  describe('set()', () => {
    it('publica un valor y limpia el error', () => {
      const state = asyncState<string[]>();
      state.load(() => throwError(() => domainError('network')));
      state.set(['nuevo']);

      expect(state.viewState()).toBe('success');
      expect(state.data()).toEqual(['nuevo']);
      expect(state.error()).toBeNull();
    });

    it('descarta la emision de una lectura en curso', () => {
      const subject = new Subject<string[]>();
      const state = asyncState<string[]>();
      state.load(() => subject);
      state.set(['mutacion']);

      subject.next(['tardia']);

      expect(state.data()).toEqual(['mutacion']);
    });
  });

  describe('fail()', () => {
    it('publica un error sin pasar por la fuente', () => {
      const state = asyncState<string[]>();
      state.fail(domainError('conflict'));
      expect(state.viewState()).toBe('error');
      expect(state.error()?.code).toBe('conflict');
    });
  });

  describe('reset()', () => {
    it('vuelve al estado inicial', () => {
      const state = asyncState<string[]>();
      state.load(() => of(['a']));
      state.reset();

      expect(state.data()).toBeNull();
      expect(state.error()).toBeNull();
      expect(state.viewState()).toBe('loading');
    });
  });

  describe('destroy()', () => {
    it('corta la suscripcion viva', () => {
      const subject = new Subject<string[]>();
      const state = asyncState<string[]>();
      state.load(() => subject);

      state.destroy();
      subject.next(['tardia']);

      expect(state.data()).toBeNull();
      expect(subject.observed).toBe(false);
    });
  });

  describe('isEmpty personalizado', () => {
    it('respeta el predicado recibido', () => {
      const state = new AsyncState<{ total: number }>({ isEmpty: value => value.total === 0 });
      state.load(() => of({ total: 0 }));
      expect(state.viewState()).toBe('empty');

      state.load(() => of({ total: 3 }));
      expect(state.viewState()).toBe('success');
    });
  });

  describe('heuristica por defecto de vacio', () => {
    it('trata un objeto con length 0 como vacio', () => {
      const state = asyncState<{ length: number }>();
      state.load(() => of({ length: 0 }));
      expect(state.viewState()).toBe('empty');
    });

    it('trata un objeto sin length como lleno', () => {
      const state = asyncState<{ nombre: string }>();
      state.load(() => of({ nombre: 'Alejandra' }));
      expect(state.viewState()).toBe('success');
    });

    it('trata un escalar como lleno', () => {
      const state = asyncState<number>();
      state.load(() => of(42));
      expect(state.viewState()).toBe('success');
    });

    it('trata undefined como vacio', () => {
      const state = asyncState<string | undefined>();
      state.load(() => of(undefined));
      expect(state.viewState()).toBe('empty');
    });
  });

  // Un alumno sin rutina asignada llega como null: es un empty legitimo,
  // no un loading eterno.
  describe('valor nulo recibido', () => {
    it('un null emitido es empty, no loading', () => {
      const state = asyncState<string[] | null>();
      state.load(() => of(null));
      expect(state.viewState()).toBe('empty');
    });

    it('sigue en loading mientras no llega nada', () => {
      const state = asyncState<string[] | null>();
      state.load(() => new Subject<string[] | null>());
      expect(state.viewState()).toBe('loading');
    });

    it('set(null) tambien cuenta como recibido', () => {
      const state = asyncState<string[] | null>();
      state.set(null);
      expect(state.viewState()).toBe('empty');
    });

    it('reset() vuelve a loading', () => {
      const state = asyncState<string[] | null>();
      state.load(() => of(null));
      state.reset();
      expect(state.viewState()).toBe('loading');
    });

    it('respeta un isEmpty propio sobre el valor nulo', () => {
      const state = asyncState<string[] | null>({ isEmpty: value => value === null });
      state.load(() => of(null));
      expect(state.viewState()).toBe('empty');
    });
  });
});
