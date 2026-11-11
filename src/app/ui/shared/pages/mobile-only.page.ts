import { DOCUMENT } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LucideSmartphone } from '@lucide/angular';

import { APP_SCHEME } from '@app/ui/shared/navigation/deep-link';

/**
 * Lo que ve un navegador: Ñeque solo se usa desde la app instalada.
 *
 * Reemplaza a TODAS las rutas en la build web de produccion (ver
 * `routesFor`), asi que ningun modulo, formulario ni llamada a la API se
 * carga en el navegador. No es un control de seguridad: los datos los
 * protege el BFF, que exige token y rol en cada peticion.
 *
 * Si la URL trae una invitacion (`/i/:token`), ofrece abrirla en la app con
 * el esquema `neque://`. El intento se hace al tocar el boton y no al cargar:
 * sin la app instalada, Safari muestra un error al abrir un esquema
 * desconocido sin que el usuario lo haya pedido.
 */
@Component({
  selector: 'app-mobile-only',
  standalone: true,
  imports: [LucideSmartphone],
  template: `
    <div class="nq-screen">
      <div class="wrap">
        <div class="nq-state nq-ani">
          <div class="nq-state-icon">
            <svg lucideSmartphone [size]="24" [strokeWidth]="1.5"></svg>
          </div>
          <h1 class="nq-state-title">Ñeque está disponible solo en la app</h1>
          @if (appLink !== null) {
            <span class="nq-state-desc">
              Esta invitación se abre en la app Ñeque de tu teléfono.
            </span>
            <a class="nq-btn nq-btn-primary open-btn" [href]="appLink">Abrir en la app</a>
            <span class="nq-state-desc hint">
              ¿No tienes la app? Abre este enlace desde tu teléfono: ahí crearás tu contraseña y
              podrás agregar Ñeque a tu pantalla de inicio.
            </span>
          } @else {
            <span class="nq-state-desc">
              Abre Ñeque desde tu teléfono. En iPhone, en Safari toca Compartir → Agregar a inicio;
              en Android, en Chrome abre el menú ⋮ → Instalar app.
            </span>
          }
        </div>
      </div>
    </div>
  `,
  // `.nq-screen` se estira contra el ancestro posicionado que aporta esta
  // clase; sin ella el contenedor no tiene contra que medir su alto.
  host: { class: 'nq-page-host' },
  styleUrl: './mobile-only.page.scss',
})
export class MobileOnlyPage {
  /** `neque://i/<token>` si la URL es una invitacion; null en cualquier otra. */
  readonly appLink = appLinkFor(inject(ActivatedRoute).snapshot.paramMap.get('token'));

  constructor() {
    // Se ve en escritorio, que es horizontal: sin esto el aviso "rota tu
    // dispositivo" de styles.scss tapaba el mensaje.
    inject(DOCUMENT).body.classList.add('nq-any-orientation');
  }
}

/** Enlace a la app instalada para un token de invitacion. */
export function appLinkFor(token: string | null): string | null {
  return token === null || token === '' ? null : `${APP_SCHEME}://i/${encodeURIComponent(token)}`;
}
