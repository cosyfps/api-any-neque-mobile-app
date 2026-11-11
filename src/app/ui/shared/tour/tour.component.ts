import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { TourService } from './tour.service';

/** Caja del elemento resaltado, en coordenadas de la ventana. */
interface Hole {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** Aire alrededor del elemento resaltado. */
const PADDING = 8;
/** Separacion entre el resaltado y la tarjeta. */
const GAP = 14;
/** Alto aproximado de la tarjeta, para decidir si cabe debajo. */
const CARD_HEIGHT = 230;
/** Cuanto se espera a que el elemento aparezca (la pantalla puede cargar). */
const WAIT_MS = 2000;

/**
 * Tutorial de primer ingreso: oscurece la pantalla, deja a la vista el
 * elemento del paso y muestra una tarjeta con «Omitir» y «Siguiente».
 *
 * Vive en el layout de cada rol, encima del contenido. Bloquea los toques
 * mientras esta activo: el recorrido se avanza con sus botones o se cierra
 * con «Omitir» / `Escape`.
 */
@Component({
  selector: 'nq-tour',
  standalone: true,
  template: `
    @if (tour.step(); as step) {
      <div class="blocker" (click)="$event.stopPropagation()"></div>
      @if (hole(); as h) {
        <div
          class="hole"
          aria-hidden="true"
          [style.top.px]="h.top"
          [style.left.px]="h.left"
          [style.width.px]="h.width"
          [style.height.px]="h.height"
        ></div>
      } @else {
        <div class="dim" aria-hidden="true"></div>
      }

      <div
        class="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        [class.centered]="hole() === null"
        [style.top.px]="cardTop()"
        [style.bottom.px]="cardBottom()"
        (keydown.escape)="tour.finish()"
      >
        <div class="card-head">
          <span class="chip">Guía</span>
          <span class="count">{{ tour.index() + 1 }} de {{ tour.steps().length }}</span>
        </div>
        <h2 class="title" id="tour-title">{{ step.title }}</h2>
        <p class="text" id="tour-text">{{ step.text }}</p>
        <div class="actions">
          @if (!tour.isLast()) {
            <button class="skip" type="button" (click)="tour.finish()">Omitir</button>
          }
          <button #primary class="next" type="button" (click)="tour.next()">
            {{ tour.isLast() ? 'Entendido' : 'Siguiente' }}
          </button>
        </div>
      </div>
    }
  `,
  styleUrl: './tour.component.scss',
})
export class TourComponent {
  readonly tour = inject(TourService);

  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly primary = viewChild<ElementRef<HTMLButtonElement>>('primary');

  /** Elemento resaltado del paso actual; null si no tiene o no aparecio. */
  private target: HTMLElement | null = null;
  private search: ReturnType<typeof setTimeout> | null = null;

  readonly hole = signal<Hole | null>(null);

  /** La tarjeta va debajo del resaltado si cabe; si no, encima. */
  private readonly below = computed(() => {
    const h = this.hole();
    return h !== null && h.top + h.height + GAP + CARD_HEIGHT < this.viewportHeight();
  });

  readonly cardTop = computed(() => {
    const h = this.hole();
    return h !== null && this.below() ? h.top + h.height + GAP : null;
  });

  readonly cardBottom = computed(() => {
    const h = this.hole();
    return h !== null && !this.below() ? this.viewportHeight() - h.top + GAP : null;
  });

  private readonly viewportHeight = signal(this.document.defaultView?.innerHeight ?? 800);

  constructor() {
    // Cada paso: ir a su pantalla, buscar su elemento y enfocar el boton.
    effect(() => {
      const step = this.tour.step();
      untracked(() => this.show(step));
    });

    const view = this.document.defaultView;
    const remeasure = (): void => this.measure();
    view?.addEventListener('resize', remeasure);
    // `true`: el scroll ocurre en el contenedor de la pagina, no en window.
    this.document.addEventListener('scroll', remeasure, true);
    inject(DestroyRef).onDestroy(() => {
      view?.removeEventListener('resize', remeasure);
      this.document.removeEventListener('scroll', remeasure, true);
      this.stopSearch();
    });
  }

  private show(step: ReturnType<TourService['step']>): void {
    this.stopSearch();
    this.target = null;
    this.hole.set(null);
    if (step === null) {
      return;
    }
    if (step.route !== undefined && !this.router.url.startsWith(step.route)) {
      void this.router.navigate([step.route]);
    }
    if (step.target !== undefined) {
      this.find(step.target, Date.now());
    }
    this.focusPrimary();
  }

  /** Espera a que el elemento exista: la pantalla del paso puede estar cargando. */
  private find(name: string, since: number): void {
    const el = this.document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
    if (el !== null && el.getClientRects().length > 0) {
      this.target = el;
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      this.measure();
      return;
    }
    if (Date.now() - since < WAIT_MS) {
      this.search = setTimeout(() => this.find(name, since), 100);
    }
  }

  private measure(): void {
    this.viewportHeight.set(this.document.defaultView?.innerHeight ?? 800);
    if (this.target === null) {
      return;
    }
    const box = this.target.getBoundingClientRect();
    this.hole.set({
      top: box.top - PADDING,
      left: box.left - PADDING,
      width: box.width + PADDING * 2,
      height: box.height + PADDING * 2,
    });
  }

  /**
   * Lleva el foco al boton principal para que el lector de pantalla y el
   * teclado sigan el paso. Sin anillo de foco: se mueve solo, el usuario no
   * llego ahi con Tab, y el anillo sobre el borde se veia como un doble trazo.
   */
  private focusPrimary(): void {
    setTimeout(
      () => this.primary()?.nativeElement.focus({ focusVisible: false } as FocusOptions),
      0,
    );
  }

  private stopSearch(): void {
    if (this.search !== null) {
      clearTimeout(this.search);
      this.search = null;
    }
  }
}
