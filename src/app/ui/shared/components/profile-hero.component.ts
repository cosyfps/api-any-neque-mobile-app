import { Component, input, output } from '@angular/core';
import { LucideCamera, LucideLoaderCircle } from '@lucide/angular';

/** Tope de la foto de perfil: una foto de camara pesa 3-5 MB, esto sobra. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Cabecera teal del perfil, compartida por alumno y entrenador.
 *
 * Lleva la foto con un boton de camara encima: el input de archivo abre la
 * camara o la galeria en el telefono. La lectura del archivo vive aqui y la
 * pagina recibe la foto ya como data-URL, lista para el puerto.
 */
@Component({
  selector: 'nq-profile-hero',
  standalone: true,
  imports: [LucideCamera, LucideLoaderCircle],
  template: `
    <header class="hero">
      <div class="avatar-wrap">
        <div class="avatar">
          @if (photoUrl(); as url) {
            <img [src]="url" alt="" />
          } @else {
            <span aria-hidden="true">{{ initials() }}</span>
          }
        </div>
        <label class="camera" [class.busy]="busy()">
          @if (busy()) {
            <svg class="spin" lucideLoaderCircle [size]="16" [strokeWidth]="2.2"></svg>
          } @else {
            <svg lucideCamera [size]="16" [strokeWidth]="2.2"></svg>
          }
          <!-- Oculto pero enfocable: con display none el teclado no lo alcanza. -->
          <input
            type="file"
            accept="image/*"
            aria-label="Cambiar foto de perfil"
            [disabled]="busy()"
            (change)="onFile($event)"
          />
        </label>
      </div>

      <h1 class="name">{{ name() }}</h1>
      @if (tag(); as texto) {
        <span class="tag">{{ texto }}</span>
      }
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      /* Sangra hasta los bordes de la pagina: el padding lateral y superior
         de .page se compensa con margenes negativos. */
      .hero {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: calc(-1 * var(--nq-page-pt)) calc(-1 * var(--nq-page-px)) 0;
        padding: 24px var(--nq-page-px) 48px;
        color: var(--nq-text-inverse);
        text-align: center;
        background: linear-gradient(
          160deg,
          var(--nq-gradient-strong-start),
          var(--nq-gradient-strong-end)
        );
        border-radius: 0 0 var(--nq-radius-xl) var(--nq-radius-xl);
      }
      .avatar-wrap {
        position: relative;
      }
      .avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 88px;
        height: 88px;
        overflow: hidden;
        font-size: 28px;
        font-weight: 700;
        color: var(--nq-primary-strong);
        background: var(--nq-bg);
        border: 3px solid rgba(255, 255, 255, 0.55);
        border-radius: var(--nq-radius-full);
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      /* Circulo de 32px a la vista; el halo lo lleva a 48px de toque. */
      .camera {
        position: absolute;
        right: -4px;
        bottom: -4px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        color: var(--nq-text-inverse);
        cursor: pointer;
        background: var(--nq-primary-strong);
        border: 3px solid var(--nq-bg);
        border-radius: var(--nq-radius-full);
        -webkit-tap-highlight-color: transparent;
      }
      .camera::before {
        position: absolute;
        inset: -8px;
        content: '';
      }
      .camera:focus-within {
        outline: 2px solid var(--nq-text-inverse);
        outline-offset: 2px;
      }
      .camera.busy {
        cursor: progress;
      }
      .camera input {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      .spin {
        animation: nq-spin 0.8s linear infinite;
      }
      .name {
        margin: 12px 0 0;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.25;
      }
      .tag {
        max-width: 100%;
        margin-top: 8px;
        padding: 4px 12px;
        overflow: hidden;
        font-size: 12px;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
        background: rgba(255, 255, 255, 0.18);
        border-radius: var(--nq-radius-full);
      }
    `,
  ],
})
export class ProfileHeroComponent {
  readonly name = input.required<string>();
  readonly initials = input.required<string>();
  readonly tag = input<string | null>(null);
  readonly photoUrl = input<string | null>(null);
  readonly busy = input(false);

  /** Foto elegida, ya leida como data-URL. */
  readonly photo = output<string>();
  /** La foto no se pudo usar: mensaje listo para mostrar. */
  readonly photoError = output<string>();

  onFile(event: Event): void {
    const campo = event.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    // Se limpia siempre: elegir la misma foto otra vez tiene que disparar change.
    campo.value = '';
    if (archivo === undefined) {
      return;
    }
    if (!archivo.type.startsWith('image/')) {
      this.photoError.emit('Elige una imagen.');
      return;
    }
    if (archivo.size > MAX_BYTES) {
      this.photoError.emit('La foto pesa más de 8 MB. Elige otra.');
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      if (typeof lector.result === 'string') {
        this.photo.emit(lector.result);
      } else {
        this.photoError.emit('No pudimos leer la foto. Intenta con otra.');
      }
    };
    lector.onerror = () => this.photoError.emit('No pudimos leer la foto. Intenta con otra.');
    lector.readAsDataURL(archivo);
  }
}
