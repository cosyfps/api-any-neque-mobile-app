-- Hora de inicio por dia de rutina.
--
-- Hasta ahora las sesiones se generaban a mediodia UTC (09:00 u 08:00 en
-- Chile) sin que nadie lo eligiera. Con `start_time` el entrenador fija la
-- hora de cada dia; sin ella (null) se mantiene el comportamiento anterior.
-- Es hora local de Chile: el BFF la convierte al generar cada sesion.
alter table public.routine_days add column start_time time;

-- `save_routine` vuelve a crearse para guardar la hora que llega en el payload.
create or replace function public.save_routine(p_trainer_id uuid, p_routine_id uuid, p_payload jsonb)
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
    insert into public.routine_days (routine_id, weekday, title, focus, estimated_minutes, start_time)
    values (
      v_routine_id,
      (v_day ->> 'weekday')::smallint,
      v_day ->> 'title',
      (v_day ->> 'focus')::public.muscle_group,
      (v_day ->> 'estimatedMinutes')::integer,
      nullif(v_day ->> 'startTime', '')::time)
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

-- `create or replace` conserva los permisos; se repiten por claridad.
revoke execute on function public.save_routine(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_routine(uuid, uuid, jsonb) to service_role;
