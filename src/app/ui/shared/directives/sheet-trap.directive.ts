import {
  DestroyRef,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';

/** Arrastre a partir del cual soltar cierra el sheet. */
const UMBRAL_CIERRE_PX = 96;

/** Unicas zonas desde las que el dedo arrastra el sheet en vez de desplazarlo. */
const ZONA_ARRASTRE = '.nq-sheet-handle, .nq-sheet-title';

/** Lo que el navegador considera enfocable dentro del sheet. */
const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Convierte un `.nq-sheet` en un dialogo modal usable con teclado.
 *
 * Hace cuatro cosas que el CSS solo no puede: lleva el foco dentro al abrir,
 * lo mantiene dentro mientras esta abierto, cierra con `Escape` y permite
 * arrastrarlo hacia abajo para descartarlo. Sin lo primero, `Escape` nunca
 * llega porque el foco sigue en la pagina de atras.
 *
 * El arrastre existe porque `.nq-sheet-handle` dibuja un asa que prometia un
 * gesto inexistente: se veia arrastrable y no lo era.
 *
 * El sheet cerrado ya queda fuera del orden de tabulacion por el
 * `visibility: hidden` de `.nq-overlay`, asi que aqui no hace falta `inert`.
 */
@Directive({
  selector: '[nqSheetTrap]',
  standalone: true,
  host: {
    '(keydown)': 'onKeydown($event)',
    '(touchstart)': 'alEmpezar($event)',
    '(touchmove)': 'alMover($event)',
    '(touchend)': 'alSoltar()',
    '(touchcancel)': 'cancelarArrastre()',
    '[style.transform]': 'arrastre() > 0 ? "translateY(" + arrastre() + "px)" : null',
    '[style.transition]': 'arrastrando() ? "none" : null',
  },
})
export class SheetTrapDirective {
  /** Avisa que el usuario pidio cerrar con `Escape`. */
  @Output() readonly dismissed = new EventEmitter<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private focusTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly _arrastre = signal(0);
  private inicioY: number | null = null;

  /** Desplazamiento vertical actual del sheet, en pixeles. */
  readonly arrastre = this._arrastre.asReadonly();
  /** Verdadero mientras el dedo esta abajo: desactiva la transicion. */
  readonly arrastrando = signal(false);

  constructor() {
    // Enfocable por codigo pero fuera del orden de tabulacion: al abrir, el
    // foco cae en el sheet y no en su primer control.
    this.host.nativeElement.tabIndex = -1;
    inject(DestroyRef).onDestroy(() => this.clearFocusTimer());
  }

  @Input({ required: true })
  set nqSheetTrap(open: boolean) {
    this.clearFocusTimer();
    if (!open) {
      return;
    }
    // `setTimeout` y no un microtask: el foco no entra en un elemento que
    // todavia esta en `visibility: hidden`, y la clase `.open` se aplica al
    // pintar, despues de este setter.
    //
    // El foco va al sheet y no a su primer campo: en un movil enfocar un
    // input abre el teclado, que tapa el formulario antes de que se vea.
    // `Tab` desde aqui entra al primer control igual.
    this.focusTimer = setTimeout(() => this.host.nativeElement.focus(), 0);
  }

  alEmpezar(event: TouchEvent): void {
    const toque = event.touches[0];
    // Solo desde el asa o el titulo, y con el sheet arriba del todo. Antes
    // arrancaba desde cualquier punto que no fuera un control: al desplazar
    // un formulario largo hacia arriba el gesto se leia como "cerrar" y el
    // formulario se perdia con lo escrito.
    const origen = event.target as HTMLElement | null;
    if (
      toque === undefined ||
      origen === null ||
      origen.closest(ZONA_ARRASTRE) === null ||
      this.host.nativeElement.scrollTop > 0
    ) {
      this.inicioY = null;
      return;
    }
    this.inicioY = toque.clientY;
    this.arrastrando.set(true);
  }

  alMover(event: TouchEvent): void {
    const toque = event.touches[0];
    if (this.inicioY === null || toque === undefined) {
      return;
    }
    // Solo hacia abajo: hacia arriba el sheet no se estira.
    this._arrastre.set(Math.max(0, toque.clientY - this.inicioY));
  }

  alSoltar(): void {
    const supero = this._arrastre() >= UMBRAL_CIERRE_PX;
    this.cancelarArrastre();
    if (supero) {
      this.dismissed.emit();
    }
  }

  cancelarArrastre(): void {
    this.inicioY = null;
    this.arrastrando.set(false);
    this._arrastre.set(0);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismissed.emit();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const items = this.focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (first === undefined || last === undefined) {
      return;
    }

    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === this.host.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusables(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE));
  }

  private clearFocusTimer(): void {
    if (this.focusTimer !== null) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
  }
}
