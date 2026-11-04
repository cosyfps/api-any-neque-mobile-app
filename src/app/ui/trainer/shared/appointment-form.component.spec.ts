import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CLOCK } from '@app/domain/shared/port/clock.port';

import { AppointmentFormComponent, AppointmentFormValue } from './appointment-form.component';

// Domingo 20 de septiembre de 2026, 10:00 local.
const AHORA = new Date(2026, 8, 20, 10, 0);

describe('AppointmentFormComponent', () => {
  let fixture: ComponentFixture<AppointmentFormComponent>;
  let form: AppointmentFormComponent;
  let emitido: AppointmentFormValue | null;

  beforeEach(() => {
    emitido = null;
    TestBed.configureTestingModule({
      imports: [AppointmentFormComponent],
      providers: [{ provide: CLOCK, useValue: { now: () => AHORA } }],
    });
    fixture = TestBed.createComponent(AppointmentFormComponent);
    form = fixture.componentInstance;
    form.submitted.subscribe(value => (emitido = value));
    fixture.detectChanges();
    form.reset();
  });

  const llenar = (date = '2026-09-22', time = '09:30'): void => {
    form.form.patchValue({ date, time });
  };

  it('no muestra errores antes del primer intento', () => {
    expect(form.whenError()).toBeNull();
  });

  it('exige fecha y hora', () => {
    form.onSubmit();

    expect(emitido).toBeNull();
    expect(form.whenError()).toBe('Elige la fecha y la hora de la cita.');
  });

  it('rechaza una hora que ya paso', () => {
    llenar('2026-09-20', '08:00');

    form.onSubmit();

    expect(emitido).toBeNull();
    expect(form.whenError()).toBe('Elige una fecha y hora futuras.');
  });

  it('emite inicio y fin segun la duracion, con el tipo como titulo por defecto', () => {
    llenar();
    form.form.patchValue({ kind: 'assessment', minutes: 45 });

    form.onSubmit();

    expect(emitido).toEqual({
      kind: 'assessment',
      title: 'Evaluación',
      startsAt: new Date(2026, 8, 22, 9, 30).toISOString(),
      endsAt: new Date(2026, 8, 22, 10, 15).toISOString(),
      location: null,
    });
  });

  it('respeta el titulo y el lugar escritos, sin espacios sobrantes', () => {
    llenar();
    form.form.patchValue({ title: '  Revisión de técnica ', location: ' Box 2 ' });

    form.onSubmit();

    expect(emitido?.title).toBe('Revisión de técnica');
    expect(emitido?.location).toBe('Box 2');
  });

  it('el placeholder del titulo sigue al tipo elegido', () => {
    form.form.patchValue({ kind: 'checkin' });

    expect(form.tituloPorDefecto()).toBe('Control');
  });

  it('no emite mientras guarda', () => {
    fixture.componentRef.setInput('busy', true);
    llenar();

    form.onSubmit();

    expect(emitido).toBeNull();
  });

  it('el minimo del selector de fecha es hoy', () => {
    expect(form.today()).toBe('2026-09-20');
  });

  it('reset limpia el intento y vuelve a los valores iniciales', () => {
    form.onSubmit();
    form.reset();

    expect(form.whenError()).toBeNull();
    expect(form.form.getRawValue().minutes).toBe(60);
  });

  it('con una cita precarga sus datos para reagendarla', () => {
    form.reset({
      id: 'cit-001',
      studentId: 'std-001',
      trainerId: 'trn-001',
      title: 'Control',
      startsAt: new Date(2026, 8, 25, 18, 30).toISOString(),
      endsAt: new Date(2026, 8, 25, 19, 20).toISOString(),
      location: null,
      kind: 'checkin',
      status: 'confirmed',
      workoutSessionId: null,
      cancellationReason: null,
      cancellationNote: null,
      cancelledAt: null,
    });

    expect(form.form.getRawValue()).toEqual({
      kind: 'checkin',
      title: 'Control',
      date: '2026-09-25',
      time: '18:30',
      // 50 minutos no esta en la lista: queda en la duracion mas cercana.
      minutes: 45,
      location: '',
    });
  });

  it('el boton usa la etiqueta recibida', () => {
    fixture.componentRef.setInput('submitLabel', 'Guardar cambios');
    fixture.detectChanges();

    const boton = (fixture.nativeElement as HTMLElement).querySelector('button[type=submit]');
    expect(boton?.textContent).toContain('Guardar cambios');
  });

  it('cancelar emite el evento', () => {
    let cancelado = false;
    form.cancelled.subscribe(() => (cancelado = true));

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[type=button]')
      ?.click();

    expect(cancelado).toBe(true);
  });
});
