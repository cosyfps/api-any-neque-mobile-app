import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject } from '@angular/core';

/** Clase en `<html>` mientras el teclado en pantalla esta abierto. */
export const KEYBOARD_OPEN_CLASS = 'nq-keyboard-open';

/** Clase en `<html>` en pantallas sin tab bar (el chat, como en Instagram). */
export const NO_TAB_BAR_CLASS = 'nq-no-tab-bar';

/** Menos que esto no es un teclado: barras del navegador que aparecen o se van. */
const MIN_KEYBOARD_PX = 80;

/**
 * Hace que una pantalla quede sobre el teclado, como en Instagram.
 *
 * En iOS (Safari y el WKWebView de la app) el teclado se dibuja ENCIMA de la
 * pagina y WebKit desplaza la ventana para mostrar el campo: la cabecera se
 * iba de la pantalla y los mensajes quedaban tapados. Aqui se mide el teclado
 * con `visualViewport`, se publica su alto en `--nq-kb` y la clase
 * `nq-keyboard-open` en `<html>`, y se devuelve la ventana arriba: la
 * pantalla se achica en vez de desplazarse.
 *
 * El alto de referencia es el del layout (`documentElement.clientHeight`),
 * que no cambia con el teclado. `window.innerHeight` no sirve: en iOS se
 * achica junto con el teclado y la resta daba 0, asi que nunca se detectaba.
 *
 * Se llama en contexto de inyeccion; sin `visualViewport` no hace nada.
 * `onChange` recibe el alto del teclado (0 al cerrarse).
 */
export function useKeyboardInset(onChange?: (keyboardPx: number) => void): void {
  const doc = inject(DOCUMENT);
  const win = doc.defaultView;
  const viewport = win?.visualViewport;
  if (win === null || viewport === undefined || viewport === null) {
    return;
  }
  const root = doc.documentElement;
  let ultimo = -1;

  const actualizar = (): void => {
    const base = root.clientHeight || win.innerHeight;
    const medido = Math.round(base - viewport.height);
    const teclado = medido > MIN_KEYBOARD_PX ? medido : 0;
    root.style.setProperty('--nq-kb', `${teclado}px`);
    root.classList.toggle(KEYBOARD_OPEN_CLASS, teclado > 0);
    if (teclado > 0 && (win.scrollY !== 0 || viewport.offsetTop !== 0)) {
      win.scrollTo(0, 0);
    }
    if (teclado !== ultimo) {
      ultimo = teclado;
      onChange?.(teclado);
    }
  };

  viewport.addEventListener('resize', actualizar);
  viewport.addEventListener('scroll', actualizar);
  inject(DestroyRef).onDestroy(() => {
    viewport.removeEventListener('resize', actualizar);
    viewport.removeEventListener('scroll', actualizar);
    root.style.removeProperty('--nq-kb');
    root.classList.remove(KEYBOARD_OPEN_CLASS);
  });
  actualizar();
}

/**
 * La pantalla se ve sin tab bar mientras esta abierta (como el chat de
 * Instagram): mas espacio para los mensajes y el campo pegado abajo.
 */
export function useHiddenTabBar(): void {
  const root = inject(DOCUMENT).documentElement;
  root.classList.add(NO_TAB_BAR_CLASS);
  inject(DestroyRef).onDestroy(() => root.classList.remove(NO_TAB_BAR_CLASS));
}
