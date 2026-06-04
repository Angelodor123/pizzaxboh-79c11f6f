ALTER TABLE public.personal_tasks
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS personal_tasks_user_sort_idx
  ON public.personal_tasks (user_id, sort_order);