
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_task_id);

-- Create parent task that groups the 3 sweeping subtasks
WITH src AS (
  SELECT branch_id, group_id, sort_order FROM public.tasks WHERE id = '2dcf15d4-478d-437c-95ec-ca05913e3e8a'
), ins AS (
  INSERT INTO public.tasks (branch_id, group_id, name, sort_order, active, is_purchased_good, requires_photo)
  SELECT branch_id, group_id, 'לטאטא את האזור של יורי, יניב ויעקב', sort_order, true, false, false FROM src
  RETURNING id
)
UPDATE public.tasks t
SET parent_task_id = (SELECT id FROM ins),
    name = CASE t.id
      WHEN '2dcf15d4-478d-437c-95ec-ca05913e3e8a' THEN 'יורי'
      WHEN 'daca4a62-96dd-4c86-962a-14e4059d958e' THEN 'יניב'
      WHEN 'bb4c9557-8baf-4512-8b81-8f757e930551' THEN 'יעקב'
    END
WHERE t.id IN (
  '2dcf15d4-478d-437c-95ec-ca05913e3e8a',
  'daca4a62-96dd-4c86-962a-14e4059d958e',
  'bb4c9557-8baf-4512-8b81-8f757e930551'
);
