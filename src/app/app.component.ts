import { Component, NgZone, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { APP_SCHEME, deepLinkPath } from '@app/ui/shared/navigation/deep-link';
import { ThemeService } from '@app/ui/shared/theme/theme.service';

import { environment } from '@env/environment';

/**
 * Shell de la app.
 *
 * Usa el `router-outlet` de Angular y no `ion-router-outlet` a proposito:
 * el outlet de Ionic mantiene una pila de paginas pensada para push/pop, y
 * con el tab bar propio de Ñeque termina apilando todas las pestanas
 * visitadas y mostrandolas a la vez. Las transiciones visuales las aportan
 * las animaciones `nq-ani` del design system.
 *
 * Tampoco hay `ion-app`: de Ionic solo se usaba el contenedor con scroll, y
 * cargar `@ionic/core` entero para eso costaba 158 kB del bundle inicial.
 *
 * En la app nativa escucha los enlaces que la abren (`neque://i/<token>`
 * desde la pantalla "solo app" del navegador) y navega a su ruta.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: ` <router-outlet /> `,
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  constructor() {
    // Se instancia al arrancar para que aplique la apariencia guardada.
    inject(ThemeService);

    if (Capacitor.isNativePlatform()) {
      void App.addListener('appUrlOpen', ({ url }) => this.openDeepLink(url));
    }
  }

  /** Navega a la ruta del enlace; uno ajeno a Ñeque se ignora. */
  openDeepLink(url: string): void {
    const path = deepLinkPath(url, APP_SCHEME, new URL(environment.publicAppUrl).host);
    if (path !== null) {
      // El evento llega desde Capacitor, fuera de la zona de Angular.
      this.zone.run(() => void this.router.navigateByUrl(path));
    }
  }
}
