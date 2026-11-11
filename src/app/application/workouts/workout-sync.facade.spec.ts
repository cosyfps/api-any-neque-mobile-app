import { signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { TestBed } from '@angular/core/testing';

import { WORKOUT_SYNC_PORT } from '@app/domain/workouts/port/workout-sync.port';

import { WorkoutSyncFacade } from './workout-sync.facade';

describe('WorkoutSyncFacade', () => {
  it('expone lo pendiente por sincronizar', () => {
    const pending = signal(0);
    TestBed.configureTestingModule({
      providers: [
        WorkoutSyncFacade,
        {
          provide: WORKOUT_SYNC_PORT,
          useFactory: () => ({ pending: () => toObservable(pending) }),
        },
      ],
    });
    const facade = TestBed.inject(WorkoutSyncFacade);
    TestBed.flushEffects();
    expect(facade.hasPending()).toBe(false);

    pending.set(2);
    TestBed.flushEffects();
    expect(facade.pending()).toBe(2);
    expect(facade.hasPending()).toBe(true);
  });
});
