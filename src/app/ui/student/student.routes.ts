import { Routes } from '@angular/router';

import { provideStudentData } from '@app/infrastructure/student-providers';

/**
 * Rutas del alumno.
 *
 * Los providers viven aqui y no en `app.config.ts` a proposito: asi los
 * puertos, adapters y facades del alumno viajan en este chunk lazy
 * y no engordan el bundle inicial.
 *
 * Van en UNA sola ruta contenedora, no repetidos por pantalla: dos
 * `providers` hermanos crean dos injectores y por tanto dos juegos de
 * adapters. El runner cerraria la sesion en su propia copia en memoria y el
 * shell nunca veria el cambio.
 */
export const STUDENT_ROUTES: Routes = [
  {
    path: '',
    providers: [provideStudentData()],
    children: [
      {
        path: '',
        loadComponent: () => import('./student-layout.page').then(m => m.StudentLayoutPage),
        children: [
          { path: '', redirectTo: 'home', pathMatch: 'full' },
          {
            path: 'home',
            loadComponent: () => import('./home/student-home.page').then(m => m.StudentHomePage),
          },
          {
            path: 'routine',
            loadComponent: () =>
              import('./routine/student-routine.page').then(m => m.StudentRoutinePage),
          },
          {
            path: 'progress',
            loadComponent: () =>
              import('./progress/student-progress.page').then(m => m.StudentProgressPage),
          },
          {
            path: 'profile',
            loadComponent: () =>
              import('./profile/student-profile.page').then(m => m.StudentProfilePage),
          },
          {
            path: 'notifications',
            loadComponent: () =>
              import('../shared/pages/notifications/notifications.page').then(
                m => m.NotificationsPage,
              ),
          },
          {
            path: 'schedule',
            loadComponent: () =>
              import('./schedule/student-schedule.page').then(m => m.StudentSchedulePage),
          },
        ],
      },
      {
        // Pantalla completa: fuera del shell de tabs para no competir con la
        // barra inferior mientras el alumno entrena.
        path: 'workout/:sessionId',
        loadComponent: () => import('./workout/workout-runner.page').then(m => m.WorkoutRunnerPage),
      },
    ],
  },
];
