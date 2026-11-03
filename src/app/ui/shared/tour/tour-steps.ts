import { TourStep } from './tour.service';

/** Recorrido del alumno: una parada por pestana y lo que puede tocar en ella. */
export const STUDENT_TOUR: readonly TourStep[] = [
  {
    title: 'Te damos la bienvenida a Ñeque',
    text: 'En un minuto te mostramos lo que puedes hacer en la app.',
    route: '/student/home',
  },
  {
    title: 'Tu día de un vistazo',
    text: 'En Inicio ves tu entrenamiento de hoy, tu avance de la semana y tus métricas.',
    route: '/student/home',
    target: 'tab-home',
  },
  {
    title: 'Notificaciones',
    text: 'Aquí te avisamos de rutinas nuevas, citas y mensajes de tu entrenador.',
    route: '/student/home',
    target: 'bell',
  },
  {
    title: 'Mi rutina',
    text: 'Revisa los ejercicios de cada día y empieza tu sesión con el temporizador de descanso.',
    route: '/student/routine',
    target: 'tab-routine',
  },
  {
    title: 'Tu progreso',
    text: 'Sigue tu peso e IMC, sube fotos de progreso y compáralas en el tiempo.',
    route: '/student/progress',
    target: 'tab-progress',
  },
  {
    title: 'Tu perfil',
    text: 'Tu agenda con tu entrenador, tus datos y tu contraseña. Desde aquí puedes volver a ver esta guía.',
    route: '/student/profile',
    target: 'tab-profile',
  },
];

/** Recorrido del entrenador: una parada por pestana y sus acciones principales. */
export const TRAINER_TOUR: readonly TourStep[] = [
  {
    title: 'Te damos la bienvenida a Ñeque',
    text: 'En un minuto te mostramos cómo gestionar a tus alumnos y sus rutinas.',
    route: '/trainer/home',
  },
  {
    title: 'Tu resumen',
    text: 'Alumnos activos, adherencia promedio y sesiones de la semana. Toca los alumnos para ir a la lista.',
    route: '/trainer/home',
    target: 'kpis',
  },
  {
    title: 'Notificaciones',
    text: 'Te avisamos cuando tus alumnos entrenan, saltan una sesión o necesitan atención.',
    route: '/trainer/home',
    target: 'bell',
  },
  {
    title: 'Tus alumnos',
    text: 'Busca y filtra tu cartera. En cada alumno registras su anamnesis y sus evaluaciones.',
    route: '/trainer/students',
    target: 'tab-students',
  },
  {
    title: 'Registra e invita',
    text: 'Con este botón das de alta a un alumno y le compartes su invitación por enlace o QR.',
    route: '/trainer/students',
    target: 'fab',
  },
  {
    title: 'Rutinas y ejercicios',
    text: 'Crea rutinas por días, suma ejercicios propios al catálogo y asígnalas a tus alumnos.',
    route: '/trainer/routines',
    target: 'tab-routines',
  },
  {
    title: 'Tu perfil',
    text: 'Tus datos, especialidad y contraseña. Desde aquí puedes volver a ver esta guía.',
    route: '/trainer/profile',
    target: 'tab-profile',
  },
];
