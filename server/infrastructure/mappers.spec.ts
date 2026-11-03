import {
  RoutineRow,
  StudentRow,
  WorkoutSessionRow,
  dateIn,
  dateOut,
  toAnamnesis,
  toRoutine,
  toStudent,
  toWorkoutSession,
} from './mappers';

const STUDENT_ROW: StudentRow = {
  id: 's1',
  user_id: 'u1',
  trainer_id: 't1',
  first_name: 'Alejandra',
  last_name: 'Acosta',
  phone: null,
  status: 'active',
  birth_date: '1995-04-20',
  height_cm: 165,
  goal: 'Ganar masa',
  joined_at: '2026-09-01T10:00:00.000Z',
  profile: { email: 'alejandra@neque.cl', avatar_path: null },
  trainer: { first_name: 'Kelvin', last_name: 'Moreno' },
};

describe('mappers', () => {
  it('las fechas sin hora salen a mediodia UTC y entran como YYYY-MM-DD', () => {
    expect(dateOut('2026-11-02')).toBe('2026-11-02T12:00:00.000Z');
    expect(dateOut(null)).toBeNull();
    expect(dateIn('2026-11-02T03:00:00.000Z')).toBe('2026-11-02');
    expect(dateIn(undefined)).toBeNull();
  });

  it('el alumno trae correo y nombre del entrenador por JOIN', () => {
    const student = toStudent(STUDENT_ROW, 'https://firmada');
    expect(student.email).toBe('alejandra@neque.cl');
    expect(student.trainerName).toBe('Kelvin Moreno');
    expect(student.birthDate).toBe('1995-04-20T12:00:00.000Z');
    expect(student.avatarUrl).toBe('https://firmada');
  });

  it('la rutina descarta dias, ejercicios y asignaciones dados de baja', () => {
    const row: RoutineRow = {
      id: 'r1',
      trainer_id: 't1',
      name: 'Hipertrofia',
      goal: 'Ganar masa',
      routine_days: [
        {
          id: 'd2',
          weekday: 3,
          title: 'Pierna',
          focus: 'legs',
          estimated_minutes: 50,
          deleted_at: null,
          routine_exercises: [
            {
              id: 'x2',
              exercise_id: 'e2',
              name: 'Prensa',
              position: 2,
              sets: 3,
              reps: 10,
              rest_seconds: 90,
              weight_kg: 80,
              notes: null,
              load: 'weight',
              measure: null,
              duration_seconds: null,
              deleted_at: null,
            },
            {
              id: 'x1',
              exercise_id: 'e1',
              name: 'Sentadilla',
              position: 1,
              sets: 4,
              reps: 8,
              rest_seconds: 120,
              weight_kg: 60,
              notes: null,
              load: null,
              measure: null,
              duration_seconds: null,
              deleted_at: null,
            },
            {
              id: 'x0',
              exercise_id: 'e0',
              name: 'Vieja',
              position: 0,
              sets: 1,
              reps: 1,
              rest_seconds: 0,
              weight_kg: null,
              notes: null,
              load: null,
              measure: null,
              duration_seconds: null,
              deleted_at: '2026-10-01T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'd1',
          weekday: 1,
          title: 'Borrado',
          focus: 'chest',
          estimated_minutes: 40,
          deleted_at: '2026-10-01T00:00:00.000Z',
          routine_exercises: [],
        },
      ],
      routine_assignments: [
        { student_id: 's1', start_date: '2026-11-01', end_date: null, ended_at: null },
        {
          student_id: 's2',
          start_date: '2026-09-01',
          end_date: null,
          ended_at: '2026-10-31T00:00:00.000Z',
        },
      ],
    };

    const routine = toRoutine(row);
    expect(routine.days.map(day => day.id)).toEqual(['d2']);
    expect(routine.days[0]?.exercises.map(exercise => exercise.name)).toEqual([
      'Sentadilla',
      'Prensa',
    ]);
    expect(routine.days[0]?.exercises[1]?.load).toBe('weight');
    expect(routine.assignments).toEqual([
      { studentId: 's1', startDate: '2026-11-01T12:00:00.000Z', endDate: null },
    ]);
  });

  it('la sesion ordena ejercicios y series', () => {
    const row: WorkoutSessionRow = {
      id: 'w1',
      student_id: 's1',
      routine_id: 'r1',
      routine_day_id: 'd1',
      title: 'Pierna',
      scheduled_for: '2026-11-02T12:00:00.000Z',
      started_at: null,
      completed_at: null,
      status: 'scheduled',
      duration_minutes: null,
      estimated_minutes: 45,
      workout_exercise_logs: [
        {
          routine_exercise_id: 'x2',
          exercise_id: 'e2',
          position: 2,
          name: 'Prensa',
          target_sets: 2,
          target_reps: 10,
          rest_seconds: 60,
          weight_kg: 80,
          load: null,
          measure: 'reps',
          duration_seconds: null,
          completed_sets: 2,
          done: true,
          skipped: false,
          skip_reason: null,
          workout_sets: [
            {
              id: 'b',
              set_number: 2,
              reps: 9,
              weight_kg: 80,
              duration_seconds: null,
              skipped: false,
              skip_reason: null,
              completed_at: '2026-11-02T13:05:00.000Z',
            },
            {
              id: 'a',
              set_number: 1,
              reps: 10,
              weight_kg: 80,
              duration_seconds: null,
              skipped: false,
              skip_reason: null,
              completed_at: '2026-11-02T13:00:00.000Z',
            },
          ],
        },
        {
          routine_exercise_id: 'x1',
          exercise_id: 'e1',
          position: 1,
          name: 'Sentadilla',
          target_sets: 1,
          target_reps: 8,
          rest_seconds: 90,
          weight_kg: 60,
          load: 'weight',
          measure: null,
          duration_seconds: null,
          completed_sets: 0,
          done: false,
          skipped: false,
          skip_reason: null,
          workout_sets: [],
        },
      ],
    };

    const session = toWorkoutSession(row);
    expect(session.exercises.map(exercise => exercise.name)).toEqual(['Sentadilla', 'Prensa']);
    expect(session.exercises[1]?.sets.map(set => set.setNumber)).toEqual([1, 2]);
    expect(session.exercises[1]?.measure).toBe('reps');
  });

  it('la anamnesis arma el contacto de emergencia solo si esta completo', () => {
    const base = {
      id: 'an1',
      student_id: 's1',
      medical_history: null,
      previous_injuries: null,
      surgeries: null,
      medications: null,
      allergies: null,
      previous_activity: null,
      declared_goal: 'Ganar masa',
      weekly_availability: [1, 3, 5] as const,
      updated_at: '2026-11-01T00:00:00.000Z',
    };
    expect(
      toAnamnesis({
        ...base,
        weekly_availability: [...base.weekly_availability],
        emergency_contact_name: 'Ana',
        emergency_contact_phone: '+569',
        emergency_contact_relation: null,
      }).emergencyContact,
    ).toEqual({ name: 'Ana', phone: '+569', relation: '' });
    expect(
      toAnamnesis({
        ...base,
        weekly_availability: [...base.weekly_availability],
        emergency_contact_name: null,
        emergency_contact_phone: null,
        emergency_contact_relation: null,
      }).emergencyContact,
    ).toBeNull();
  });
});
