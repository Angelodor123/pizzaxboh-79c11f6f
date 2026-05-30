DO $$
DECLARE
  v_branch uuid := '83434483-06d0-4cf1-9f6b-8bc8192b1c09';
  v_shift  uuid := '7fbc00f4-c62b-441d-9ade-48abe6af4d4a';
  v_group  uuid;
  v_vehicle text;
  v_sort int := 50;
  v_task_sort int;
  v_task text;
BEGIN
  FOREACH v_vehicle IN ARRAY ARRAY['BYD','Kona','Leapmotor'] LOOP
    -- skip if already exists
    SELECT id INTO v_group FROM public.task_groups
      WHERE shift_id = v_shift AND name = 'סגירת רכב ' || v_vehicle;
    IF v_group IS NULL THEN
      INSERT INTO public.task_groups (branch_id, shift_id, name, sort_order, active)
      VALUES (v_branch, v_shift, 'סגירת רכב ' || v_vehicle, v_sort, true)
      RETURNING id INTO v_group;
    END IF;

    v_task_sort := 1;
    FOREACH v_task IN ARRAY ARRAY['לנקות זבל וחשבוניות','אחורה','קדימה','שמאל','ימין'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE group_id = v_group AND name = v_task
      ) THEN
        INSERT INTO public.tasks (
          branch_id, group_id, shift_id, name, sort_order,
          active, requires_photo, recurrence_type
        )
        VALUES (
          v_branch, v_group, v_shift, v_task, v_task_sort,
          true, true, 'daily'::task_recurrence_type
        );
      END IF;
      v_task_sort := v_task_sort + 1;
    END LOOP;

    v_sort := v_sort + 1;
  END LOOP;
END $$;