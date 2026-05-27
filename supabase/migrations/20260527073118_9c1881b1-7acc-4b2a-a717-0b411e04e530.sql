ALTER TABLE public.tasks ALTER COLUMN group_id DROP NOT NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_shift_id ON public.tasks(shift_id);