-- Escrituras de varias filas en una sola transaccion.
--
-- Las llama solo el BFF con la clave secreta. Reciben el entrenador
-- autenticado como parametro y validan la propiedad dentro: ninguna confia en
-- que el llamador ya lo hizo. Un recurso ajeno se reporta como inexistente
-- (P0002), igual que un id que no existe.

-- Guarda cabecera, dias y ejercicios de una rutina.
--
-- Lo anterior se marca con deleted_at en vez de borrarse: las sesiones ya
-- entrenadas lo siguen referenciando. Las sesiones futuras que nadie empezo
-- se descartan y se vuelven a generar desde la rutina nueva al leerlas.
create function public.save_routine(p_trainer_id uuid, p_routine_id uuid, p_payload jsonb)
  returns uuid
  language plpgsql
  set search_path = ''
as $$
declare
  v_routine_id uuid := p_routine_id;
  v_day        jsonb;
  v_day_id     uuid;
  v_exercise   jsonb;
begin
  if v_routine_id is null then
    insert into public.routines (trainer_id, name, goal)
    values (p_trainer_id, p_payload ->> 'name', p_payload ->> 'goal')
    returning id into v_routine_id;
  else
    update public.routines
       set name = p_payload ->> 'name', goal = p_payload ->> 'goal'
     where id = v_routine_id and trainer_id = p_trainer_id and deleted_at is null;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;

    update public.routine_exercises
       set deleted_at = now()
     where deleted_at is null
       and routine_day_id in (select id from public.routine_days where routine_id = v_routine_id);
    update public.routine_days set deleted_at = now()
     where routine_id = v_routine_id and deleted_at is null;

    delete from public.workout_sessions s
     where s.routine_id = v_routine_id
       and s.status = 'scheduled'
       and s.started_at is null
       and s.scheduled_date >= current_date
       and not exists (
         select 1 from public.workout_sets ws
           join public.workout_exercise_logs l on l.id = ws.workout_exercise_log_id
          where l.workout_session_id = s.id);
  end if;

  for v_day in select * from jsonb_array_elements(coalesce(p_payload -> 'days', '[]'::jsonb)) loop
    insert into public.routine_days (routine_id, weekday, title, focus, estimated_minutes)
    values (
      v_routine_id,
      (v_day ->> 'weekday')::smallint,
      v_day ->> 'title',
      (v_day ->> 'focus')::public.muscle_group,
      (v_day ->> 'estimatedMinutes')::integer)
    returning id into v_day_id;

    for v_exercise in select * from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb)) loop
      insert into public.routine_exercises (
        routine_day_id, exercise_id, name, position, sets, reps, rest_seconds,
        weight_kg, notes, load, measure, duration_seconds)
      values (
        v_day_id,
        (v_exercise ->> 'exerciseId')::uuid,
        v_exercise ->> 'name',
        (v_exercise ->> 'order')::integer,
        (v_exercise ->> 'sets')::integer,
        (v_exercise ->> 'reps')::integer,
        (v_exercise ->> 'restSeconds')::integer,
        (v_exercise ->> 'weightKg')::numeric,
        v_exercise ->> 'notes',
        (v_exercise ->> 'load')::public.exercise_load,
        (v_exercise ->> 'measure')::public.exercise_measure,
        (v_exercise ->> 'durationSeconds')::integer);
    end loop;
  end loop;

  return v_routine_id;
end $$;

-- Reemplaza la lista de alumnos de una rutina.
--
-- Un alumno hace una sola rutina: el que llega desde otra sale de aquella en
-- la misma transaccion. En dos pasos el indice unico parcial rechazaria la
-- insercion, o el alumno quedaria un instante sin rutina.
create function public.set_routine_assignments(p_trainer_id uuid, p_routine_id uuid, p_assignments jsonb)
  returns void
  language plpgsql
  set search_path = ''
as $$
declare
  v_incoming uuid[];
  v_affected uuid[];
begin
  if not exists (
    select 1 from public.routines
     where id = p_routine_id and trainer_id = p_trainer_id and deleted_at is null
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg((a ->> 'studentId')::uuid), '{}')
    into v_incoming
    from jsonb_array_elements(p_assignments) a;

  if exists (
    select 1 from unnest(v_incoming) sid
     where not exists (
       select 1 from public.students s where s.id = sid and s.trainer_id = p_trainer_id)
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct student_id), '{}')
    into v_affected
    from public.routine_assignments
   where ended_at is null
     and (routine_id = p_routine_id or student_id = any (v_incoming));
  v_affected := v_affected || v_incoming;

  update public.routine_assignments
     set ended_at = now()
   where ended_at is null
     and (routine_id = p_routine_id or student_id = any (v_incoming));

  insert into public.routine_assignments (routine_id, student_id, start_date, end_date)
  select p_routine_id,
         (a ->> 'studentId')::uuid,
         (a ->> 'startDate')::date,
         (a ->> 'endDate')::date
    from jsonb_array_elements(p_assignments) a;

  -- Las sesiones futuras sin tocar de los alumnos afectados se regeneran al
  -- leerlas, desde la rutina que les toca ahora.
  delete from public.workout_sessions s
   where s.student_id = any (v_affected)
     and s.status = 'scheduled'
     and s.started_at is null
     and s.scheduled_date >= current_date
     and not exists (
       select 1 from public.workout_sets ws
         join public.workout_exercise_logs l on l.id = ws.workout_exercise_log_id
        where l.workout_session_id = s.id);
end $$;

-- Persiste una sesion de entrenamiento ya mutada por el BFF.
--
-- El BFF aplica las reglas del dominio (las mismas funciones puras que usa
-- el front) y entrega la sesion completa; aqui solo se escribe, todo o nada.
create function public.save_workout_session(p_session jsonb, p_note text)
  returns void
  language plpgsql
  set search_path = ''
as $$
declare
  v_session_id uuid := (p_session ->> 'id')::uuid;
  v_exercise   jsonb;
  v_log_id     uuid;
  v_set        jsonb;
begin
  update public.workout_sessions
     set status           = (p_session ->> 'status')::public.workout_status,
         started_at       = (p_session ->> 'startedAt')::timestamptz,
         completed_at     = (p_session ->> 'completedAt')::timestamptz,
         duration_minutes = (p_session ->> 'durationMinutes')::integer,
         completion_note  = coalesce(p_note, completion_note)
   where id = v_session_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  for v_exercise in select * from jsonb_array_elements(p_session -> 'exercises') loop
    update public.workout_exercise_logs
       set completed_sets = (v_exercise ->> 'completedSets')::integer,
           done           = (v_exercise ->> 'done')::boolean,
           skipped        = coalesce((v_exercise ->> 'skipped')::boolean, false),
           skip_reason    = (v_exercise ->> 'skipReason')::public.skip_reason
     where workout_session_id = v_session_id
       and routine_exercise_id = (v_exercise ->> 'routineExerciseId')::uuid
    returning id into v_log_id;

    if v_log_id is null then
      continue;
    end if;

    delete from public.workout_sets where workout_exercise_log_id = v_log_id;

    for v_set in select * from jsonb_array_elements(coalesce(v_exercise -> 'sets', '[]'::jsonb)) loop
      insert into public.workout_sets (
        workout_exercise_log_id, set_number, reps, weight_kg, duration_seconds,
        skipped, skip_reason, completed_at)
      values (
        v_log_id,
        (v_set ->> 'setNumber')::smallint,
        (v_set ->> 'reps')::integer,
        (v_set ->> 'weightKg')::numeric,
        (v_set ->> 'durationSeconds')::integer,
        coalesce((v_set ->> 'skipped')::boolean, false),
        (v_set ->> 'skipReason')::public.skip_reason,
        (v_set ->> 'completedAt')::timestamptz);
    end loop;
  end loop;
end $$;

-- PostgREST expone las funciones de `public` a cualquiera por defecto.
revoke execute on function public.save_routine(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.set_routine_assignments(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.save_workout_session(jsonb, text) from public, anon, authenticated;
grant execute on function public.save_routine(uuid, uuid, jsonb) to service_role;
grant execute on function public.set_routine_assignments(uuid, uuid, jsonb) to service_role;
grant execute on function public.save_workout_session(jsonb, text) to service_role;
