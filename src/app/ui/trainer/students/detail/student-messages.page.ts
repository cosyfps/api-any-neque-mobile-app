import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideArrowLeft } from '@lucide/angular';

import { ConversationFacade } from '@app/application/messages/conversation.facade';

import { ConversationComponent } from '@shared/components/conversation.component';

/** Mensajes del entrenador con un alumno, abiertos desde su ficha (A-4). */
@Component({
  selector: 'app-trainer-student-messages',
  standalone: true,
  imports: [ConversationComponent, LucideArrowLeft],
  providers: [ConversationFacade],
  template: `
    <div class="page">
      <header class="head">
        <button class="nav-back" type="button" aria-label="Volver a la ficha" (click)="goBack()">
          <svg lucideArrowLeft [size]="22" [strokeWidth]="1.8"></svg>
        </button>
        <div>
          <h1 class="head-title">{{ conversation.peerName() ?? 'Tu alumno' }}</h1>
          <p class="head-sub">Mensajes</p>
        </div>
      </header>

      <nq-conversation me="trainer" />
    </div>
  `,
  styleUrl: '../../../shared/pages/messages/messages-page.scss',
})
export class TrainerStudentMessagesPage {
  readonly conversation = inject(ConversationFacade);
  private readonly router = inject(Router);
  private readonly studentId: string;

  constructor() {
    this.studentId = inject(ActivatedRoute).snapshot.paramMap.get('studentId') ?? '';
    this.conversation.load(this.studentId, 'trainer');
  }

  goBack(): void {
    void this.router.navigate(['/trainer/students', this.studentId]);
  }
}
