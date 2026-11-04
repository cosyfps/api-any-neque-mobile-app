import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LucideSend } from '@lucide/angular';

import { ConversationFacade } from '@app/application/messages/conversation.facade';
import {
  MESSAGE_MAX_LENGTH,
  Message,
  MessageSender,
  endsGroup,
  messageError,
} from '@app/domain/messages/model/message.model';

import { useKeyboardInset } from '../navigation/keyboard-inset';

import { PageStateComponent } from './page-state.component';

/** Cada cuanto se buscan mensajes nuevos mientras la pantalla esta abierta. */
export const REFRESH_MS = 20_000;

const HORA = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const DIA = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Conversacion entre un alumno y su entrenador (A-4). La comparten las dos
 * pantallas de mensajes; `me` dice de que lado se pintan las burbujas.
 * La facade la provee la pagina que la contiene.
 */
@Component({
  selector: 'nq-conversation',
  standalone: true,
  imports: [PageStateComponent, LucideSend],
  template: `
    @switch (facade.viewState()) {
      @case ('loading') {
        <nq-page-state type="loading" loadingLabel="Cargando los mensajes" />
      }
      @case ('error') {
        <nq-page-state type="error" message="No pudimos cargar los mensajes." [retry]="reload" />
      }
      @default {
        <div class="thread" #thread role="log" aria-live="polite" aria-label="Mensajes">
          @for (mensaje of facade.messages.data() ?? []; track mensaje.id; let i = $index) {
            @if (nuevoDia(i)) {
              <p class="day-sep">{{ dia(mensaje.createdAt) }}</p>
            }
            <!-- La hora va debajo de la burbuja y solo al cerrar un grupo: mensajes
                 seguidos de la misma persona con menos de 30 min muestran una sola. -->
            <div
              class="bubble-row"
              [class.mine]="mensaje.senderRole === me()"
              [class.grouped]="!cierraGrupo(i)"
            >
              <p class="bubble">{{ mensaje.body }}</p>
              @if (cierraGrupo(i)) {
                <span class="bubble-time">{{ meta(mensaje) }}</span>
              }
            </div>
          } @empty {
            <p class="nq-empty-inline">{{ emptyText() }}</p>
          }
        </div>

        <form class="composer" (submit)="$event.preventDefault(); enviar()">
          <div class="composer-field">
            <label class="nq-visually-hidden" for="mensaje-texto">Mensaje</label>
            <textarea
              id="mensaje-texto"
              rows="1"
              [attr.maxlength]="maxLength"
              placeholder="Escribe un mensaje"
              [value]="texto()"
              [attr.aria-invalid]="error() !== null"
              [attr.aria-describedby]="error() ? 'mensaje-error' : null"
              (input)="escribir($event)"
              (focus)="alFinal()"
              (keydown.enter)="alEnter($event)"
            ></textarea>
          </div>
          <button
            class="send-btn"
            type="submit"
            aria-label="Enviar mensaje"
            [disabled]="facade.sending()"
          >
            <svg lucideSend [size]="18" [strokeWidth]="2"></svg>
          </button>
        </form>
        @if (error(); as mensaje) {
          <p class="nq-field-error" id="mensaje-error" role="alert">{{ mensaje }}</p>
        }
      }
    }
  `,
  styleUrl: './conversation.component.scss',
})
export class ConversationComponent {
  readonly facade = inject(ConversationFacade);

  /** El lado de quien mira: sus mensajes van a la derecha. */
  readonly me = input.required<MessageSender>();
  /** Texto para una conversacion vacia. */
  readonly emptyText = input('Todavía no hay mensajes. Escribe el primero.');

  readonly maxLength = MESSAGE_MAX_LENGTH;
  readonly texto = signal('');
  private readonly intentado = signal(false);

  readonly error = computed(() => {
    const envio = this.facade.sendError();
    if (envio !== null) {
      return envio.message;
    }
    return this.intentado() ? messageError(this.texto()) : null;
  });

  readonly reload = (): void => this.facade.reload();

  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  constructor() {
    // Con el teclado abierto la pantalla se achica (no se desplaza) y la
    // conversacion baja al ultimo mensaje, como en Instagram.
    useKeyboardInset(() => this.alFinal());

    const timer = setInterval(() => this.facade.refresh(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // Al llegar mensajes, la lista baja al ultimo: es lo que se acaba de leer o escribir.
    effect(() => {
      const total = this.facade.messages.data()?.length ?? 0;
      const el = this.thread()?.nativeElement;
      if (el !== undefined && total > 0) {
        untracked(() => el.scrollTo({ top: el.scrollHeight }));
      }
    });
  }

  /** Baja la conversacion al ultimo mensaje, despues de que el layout se acomoda. */
  alFinal(): void {
    requestAnimationFrame(() => {
      const el = this.thread()?.nativeElement;
      el?.scrollTo({ top: el.scrollHeight });
    });
  }

  escribir(event: Event): void {
    this.texto.set((event.target as HTMLTextAreaElement).value);
  }

  /** Enter envia; Shift+Enter hace un salto de linea. */
  alEnter(event: Event): void {
    if ((event as KeyboardEvent).shiftKey) {
      return;
    }
    event.preventDefault();
    void this.enviar();
  }

  async enviar(): Promise<void> {
    this.intentado.set(true);
    if (messageError(this.texto()) !== null) {
      return;
    }
    if (await this.facade.send(this.texto().trim())) {
      this.texto.set('');
      this.intentado.set(false);
    }
  }

  /** Separador de dia antes del primer mensaje de cada fecha. */
  nuevoDia(index: number): boolean {
    const lista: readonly Message[] = this.facade.messages.data() ?? [];
    const actual = lista[index];
    const anterior = lista[index - 1];
    if (actual === undefined) {
      return false;
    }
    return (
      anterior === undefined ||
      new Date(anterior.createdAt).toDateString() !== new Date(actual.createdAt).toDateString()
    );
  }

  cierraGrupo(index: number): boolean {
    return endsGroup(this.facade.messages.data() ?? [], index);
  }

  /** "09:30" o "09:30 · Leído" para los propios ya leidos. */
  meta(mensaje: Message): string {
    const hora = this.hora(mensaje.createdAt);
    return mensaje.senderRole === this.me() && mensaje.readAt !== null ? `${hora} · Leído` : hora;
  }

  hora(iso: string): string {
    return HORA.format(new Date(iso));
  }

  dia(iso: string): string {
    const texto = DIA.format(new Date(iso));
    return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;
  }
}
