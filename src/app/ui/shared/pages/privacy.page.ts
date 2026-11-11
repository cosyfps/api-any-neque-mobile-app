import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideArrowLeft } from '@lucide/angular';

/**
 * Correo donde se ejercen los derechos sobre los datos. Null mientras no se
 * defina: la pagina deriva entonces la solicitud al entrenador.
 */
export const PRIVACY_CONTACT_EMAIL: string | null = null;

/** Fecha de la ultima revision del texto, visible al pie. */
export const PRIVACY_UPDATED_AT = '10 de noviembre de 2026';

/**
 * Politica de privacidad y seguridad de Neque, segun la normativa chilena.
 *
 * Es publica: se abre con o sin sesion, desde el login, el Perfil y el pie
 * del correo de invitacion.
 */
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [LucideArrowLeft],
  template: `
    <div class="nq-screen">
      <div class="wrap">
        <header class="header">
          <button class="back" type="button" aria-label="Volver" (click)="back()">
            <svg lucideArrowLeft [size]="20" [strokeWidth]="2"></svg>
          </button>
          <h1 class="title">Privacidad y seguridad</h1>
        </header>

        <p class="lead">
          Ñeque guarda datos de tu entrenamiento y de tu salud. Aquí te contamos qué datos tratamos,
          para qué, cómo los protegemos y qué derechos tienes según la ley chilena.
        </p>

        <section class="block" aria-labelledby="pv-datos">
          <h2 id="pv-datos">Qué datos tratamos y para qué</h2>
          <ul>
            <li><strong>Cuenta:</strong> nombre, correo y teléfono, para que puedas ingresar.</li>
            <li>
              <strong>Ficha y anamnesis:</strong> objetivo, antecedentes médicos, lesiones y
              medicación, para que tu entrenador prescriba con seguridad.
            </li>
            <li>
              <strong>Evaluaciones y fotos de progreso:</strong> peso, medidas y fotos, para mostrar
              tu evolución.
            </li>
            <li><strong>Entrenamientos:</strong> series, cargas y repeticiones que registras.</li>
            <li><strong>Mensajes</strong> con tu entrenador, cifrados en la base de datos.</li>
          </ul>
          <p>
            Solo tu entrenador y tú ven tus datos. No los vendemos ni los usamos para publicidad. El
            responsable del tratamiento es Kelvin A. Moreno, desarrollador de Ñeque.
          </p>
        </section>

        <section class="block" aria-labelledby="pv-21719">
          <h2 id="pv-21719">Ley 21.719 · Protección de datos personales</h2>
          <p>
            Tus antecedentes de salud son <strong>datos sensibles</strong>: los tratamos solo con tu
            consentimiento expreso y únicamente para tu entrenamiento.
          </p>
          <p>Tienes derecho a:</p>
          <ul>
            <li><strong>Acceso:</strong> saber qué datos tuyos guardamos.</li>
            <li><strong>Rectificación:</strong> corregir los que estén mal.</li>
            <li><strong>Supresión:</strong> pedir que se borren.</li>
            <li><strong>Oposición:</strong> negarte a un uso determinado.</li>
            <li><strong>Portabilidad:</strong> recibirlos en un formato que puedas llevarte.</li>
            <li><strong>Bloqueo:</strong> suspender su uso mientras se resuelve una solicitud.</li>
          </ul>
          <p>
            @if (contact) {
              Para ejercerlos, escríbenos a <a [href]="'mailto:' + contact">{{ contact }}</a
              >.
            } @else {
              Para ejercerlos, pídeselo a tu entrenador: él lo deriva al responsable de Ñeque.
            }
            Si no recibes respuesta, puedes reclamar ante la Agencia de Protección de Datos
            Personales. La ley rige plenamente desde el 1 de diciembre de 2026.
          </p>
        </section>

        <section class="block" aria-labelledby="pv-21663">
          <h2 id="pv-21663">Ley 21.663 · Marco de ciberseguridad</h2>
          <p>
            Ñeque no es un servicio esencial ni un operador de importancia vital, pero adopta
            voluntariamente los principios de la ley: prevenimos incidentes, los gestionamos si
            ocurren y te avisaremos si alguno afecta tus datos, junto con las medidas tomadas.
          </p>
        </section>

        <section class="block" aria-labelledby="pv-27001">
          <h2 id="pv-27001">ISO/IEC 27001 · Seguridad de la información</h2>
          <p>
            Ñeque está <strong>alineado</strong> con los controles de esta norma, aunque no cuenta
            con certificación. En la práctica:
          </p>
          <ul>
            <li>Cada persona ve solo lo que su rol le permite.</li>
            <li>Toda conexión va cifrada (HTTPS con HSTS).</li>
            <li>Los mensajes se guardan cifrados con AES-256-GCM.</li>
            <li>La base de datos aplica seguridad por fila (Row Level Security).</li>
            <li>Las claves de acceso al servidor tienen el mínimo privilegio necesario.</li>
            <li>Hay respaldos de la información y registro de los cambios.</li>
          </ul>
        </section>

        <section class="block" aria-labelledby="pv-terceros">
          <h2 id="pv-terceros">Retención y proveedores</h2>
          <p>
            Guardamos tus datos mientras tu cuenta esté activa o suspendida por tu entrenador. Si
            pides su supresión, se eliminan salvo lo que la ley obligue a conservar.
          </p>
          <p>
            Usamos proveedores que tratan datos por encargo nuestro: Supabase (base de datos y
            archivos), Vercel (servidor de la aplicación) y Brevo (envío de correos).
          </p>
        </section>

        <p class="note">
          Este texto es informativo y está en revisión con asesoría legal. Última actualización:
          {{ updatedAt }}.
        </p>
      </div>
    </div>
  `,
  host: { class: 'nq-page-host' },
  styleUrl: './privacy.page.scss',
})
export class PrivacyPage {
  private readonly router = inject(Router);

  readonly contact = PRIVACY_CONTACT_EMAIL;
  readonly updatedAt = PRIVACY_UPDATED_AT;

  /** Vuelve a donde estaba; si se abrio directo, al inicio. */
  back(): void {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    this.router.navigate(['/']);
  }
}
