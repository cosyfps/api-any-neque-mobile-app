import { Routes } from '@angular/router';

import { authGuard, publicOnlyGuard, roleGuard } from '@app/ui/shared/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [publicOnlyGuard],
    loadComponent: () => import('./ui/auth/start/start.page').then(m => m.StartPage),
  },
  {
    path: 'forgot-password',
    canMatch: [publicOnlyGuard],
    loadComponent: () =>
      import('./ui/auth/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage),
  },
  // Forma corta del enlace de invitacion, la que se comparte y va en el QR.
  { path: 'i/:token', redirectTo: 'invite/:token' },
  {
    path: 'invite/:token',
    // Con sesion activa la invitacion no se muestra: aceptarla sobrescribiria
    // la sesion del usuario que abrio el enlace.
    canMatch: [publicOnlyGuard],
    loadChildren: () => import('./ui/auth/invite/invite.routes').then(m => m.INVITE_ROUTES),
  },
  {
    path: 'trainer',
    canMatch: [authGuard, roleGuard('trainer')],
    loadChildren: () => import('./ui/trainer/trainer.routes').then(m => m.TRAINER_ROUTES),
  },
  {
    path: 'student',
    canMatch: [authGuard, roleGuard('student')],
    loadChildren: () => import('./ui/student/student.routes').then(m => m.STUDENT_ROUTES),
  },
  {
    path: '**',
    loadComponent: () => import('./ui/shared/pages/not-found.page').then(m => m.NotFoundPage),
  },
];
