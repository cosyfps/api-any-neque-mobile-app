import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StepperComponent, StepperFormat } from './stepper.component';

describe('StepperComponent', () => {
  let fixture: ComponentFixture<StepperComponent>;
  let emitidos: number[];

  const crear = (
    value: number,
    opciones: { min?: number; max?: number; step?: number; format?: StepperFormat } = {},
  ): void => {
    fixture = TestBed.createComponent(StepperComponent);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('label', 'repeticiones');
    for (const [clave, valor] of Object.entries(opciones)) {
      fixture.componentRef.setInput(clave, valor);
    }
    emitidos = [];
    fixture.componentInstance.valueChange.subscribe(v => emitidos.push(v));
    fixture.detectChanges();
  };

  const campo = (): HTMLInputElement =>
    (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  const botones = (): HTMLButtonElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

  const escribir = (texto: string): void => {
    campo().value = texto;
    campo().dispatchEvent(new Event('blur'));
  };

  describe('botones', () => {
    it('suman y restan de a step', () => {
      crear(8, { step: 1, max: 99 });

      botones()[1]?.click();
      botones()[0]?.click();

      expect(emitidos).toEqual([9, 7]);
    });

    it('no bajan del minimo ni pasan el maximo', () => {
      crear(1, { min: 1, max: 1 });

      expect(botones()[0]?.disabled).toBe(true);
      expect(botones()[1]?.disabled).toBe(true);
    });

    it('nombran la accion para el lector de pantalla', () => {
      crear(8);

      expect(botones()[0]?.getAttribute('aria-label')).toBe('Menos repeticiones');
      expect(botones()[1]?.getAttribute('aria-label')).toBe('Más repeticiones');
    });
  });

  describe('escribir', () => {
    it('confirma al salir del campo', () => {
      crear(8, { max: 99 });

      escribir('12');

      expect(emitidos).toEqual([12]);
    });

    it('vacio vuelve al valor anterior sin emitir', () => {
      crear(8);

      escribir('');

      expect(emitidos).toEqual([]);
      expect(campo().value).toBe('8');
    });

    it('ilegible vuelve al valor anterior', () => {
      crear(8);

      escribir('abc');

      expect(emitidos).toEqual([]);
      expect(campo().value).toBe('8');
    });

    it('fuera de rango se ajusta al limite', () => {
      crear(8, { min: 1, max: 99 });

      escribir('-5');

      expect(emitidos).toEqual([1]);
      expect(campo().value).toBe('1');
    });

    // El teclado decimal de iOS en espanol trae coma.
    it('acepta coma decimal y la muestra con coma', () => {
      crear(30, { format: 'decimal', max: 500 });

      escribir('32,5');

      expect(emitidos).toEqual([32.5]);
      expect(campo().value).toBe('32,5');
    });

    it('en enteros redondea', () => {
      crear(8, { max: 99 });

      escribir('8.6');

      expect(emitidos).toEqual([9]);
    });
  });

  describe('tiempo', () => {
    it('muestra minutos y segundos, y no se escribe', () => {
      crear(900, { format: 'time', max: 7200 });

      expect(campo().value).toBe('15:00');
      expect(campo().readOnly).toBe(true);
    });

    it('los botones cambian de a step segundos', () => {
      crear(45, { format: 'time', step: 15, max: 600 });

      botones()[1]?.click();

      expect(emitidos).toEqual([60]);
    });
  });
});
