import { Routes } from '@angular/router';

import { provideTrainerData } from '@app/infrastructure/trainer-providers';

/**
 * Rutas del entrenador.
 *
 * Los providers van en UNA sola ruta contenedora, igual que en el alumno:
 * dos `providers` hermanos crearian dos injectores y por tanto dos juegos de
 * adapters, asi que un alta hecha en la cartera no se veria en el Inicio.
 */
export const TRAINER_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTrainerData()],
    children: [
      {
        path: '',
        loadComponent: () => import('./trainer-layout.page').then(m => m.TrainerLayoutPage),
        children: [
          { path: '', redirectTo: 'home', pathMatch: 'full' },
          {
            path: 'home',
            loadComponent: () => import('./home/trainer-home.page').then(m => m.TrainerHomePage),
          },
          {
            path: 'students',
            loadComponent: () =>
              import('./students/trainer-students.page').then(m => m.TrainerStudentsPage),
          },
          {
            // Fuera de la lista pero dentro del shell: la pestana Alumnos
            // sigue encendida mientras se lee una ficha.
            path: 'students/:studentId',
            loadComponent: () =>
              import('./students/detail/student-detail.page').then(m => m.StudentDetailPage),
          },
          {
            path: 'routines',
            loadComponent: () =>
              import('./routines/trainer-routines.page').then(m => m.TrainerRoutinesPage),
          },
          {
            // Fuera de las pestanas pero dentro del shell, como en el alumno.
            path: 'notifications',
            loadComponent: () =>
              import('../shared/pages/notifications/notifications.page').then(
                m => m.NotificationsPage,
              ),
          },
          {
            path: 'profile',
            loadComponent: () =>
              import('./profile/trainer-profile.page').then(m => m.TrainerProfilePage),
          },
        ],
      },
    ],
  },
];
