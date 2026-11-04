import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideArrowLeft } from '@lucide/angular';

import { SessionFacade } from '@app/application/auth/session.facade';
import { ConversationFacade } from '@app/application/messages/conversation.facade';

import { ConversationComponent } from '@shared/components/conversation.component';

/** Mensajes del alumno con su entrenador (A-4). */
@Component({
  selector: 'app-student-messages',
  standalone: true,
  imports: [ConversationComponent, LucideArrowLeft],
  providers: [ConversationFacade],
  template: `
    <div class="page">
      <header class="head">
        <button class="nav-back" type="button" aria-label="Volver" (click)="goBack()">
          <svg lucideArrowLeft [size]="22" [strokeWidth]="1.8"></svg>
        </button>
        <div>
          <h1 class="head-title">Mensajes</h1>
          <p class="head-sub">Con tu entrenador</p>
        </div>
      </header>

      <nq-conversation
        me="student"
        emptyText="Escríbele a tu entrenador: dudas de la rutina, molestias o cambios de horario."
      />
    </div>
  `,
  styleUrl: '../../shared/pages/messages/messages-page.scss',
})
export class StudentMessagesPage {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly conversation = inject(ConversationFacade);

  constructor() {
    const studentId = inject(SessionFacade).profileId();
    if (studentId !== null) {
      this.conversation.load(studentId);
    }
  }

  goBack(): void {
    if (this.location.getState() !== null && history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/student/profile']);
  }
}
