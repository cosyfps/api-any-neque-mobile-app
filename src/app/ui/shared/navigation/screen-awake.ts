import { DOCUMENT } from '@angular/common';
import { DestroyRef, Signal, effect, inject } from '@angular/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

/**
 * Mantiene la pantalla encendida mientras `active` sea true, y cada vez que
 * la app vuelve a primer plano llama a `onVisible`.
 *
 * En la app de iOS el plugin desactiva el bloqueo automatico; en el navegador
 * usa la Screen Wake Lock API, que el sistema suelta al ocultar la pagina:
 * por eso se vuelve a pedir al regresar. El usuario siempre puede apagar la
 * pantalla con el boton lateral. Al destruirse, la pantalla vuelve a poder
 * apagarse sola.
 *
 * Se llama en contexto de inyeccion. Los errores del plugin se ignoran: sin
 * soporte, la pantalla solo se comporta como antes.
 */
export function useScreenAwake(active: Signal<boolean>, onVisible?: () => void): void {
  const doc = inject(DOCUMENT);
  let encendida = false;

  const aplicar = (quiere: boolean, forzar = false): void => {
    if (quiere === encendida && !forzar) {
      return;
    }
    encendida = quiere;
    const pedido = quiere ? KeepAwake.keepAwake() : KeepAwake.allowSleep();
    pedido.catch(() => undefined);
  };

  effect(() => aplicar(active()));

  const alVolver = (): void => {
    if (doc.visibilityState !== 'visible') {
      return;
    }
    onVisible?.();
    if (active()) {
      aplicar(true, true);
    }
  };
  doc.addEventListener('visibilitychange', alVolver);

  inject(DestroyRef).onDestroy(() => {
    doc.removeEventListener('visibilitychange', alVolver);
    if (encendida) {
      KeepAwake.allowSleep().catch(() => undefined);
    }
  });
}
