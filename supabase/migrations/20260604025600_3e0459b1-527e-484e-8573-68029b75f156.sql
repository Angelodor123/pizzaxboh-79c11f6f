
CREATE TABLE public.personal_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_tasks TO authenticated;
GRANT ALL ON public.personal_tasks TO service_role;

ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own personal tasks"
  ON public.personal_tasks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins view all personal tasks"
  ON public.personal_tasks FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER personal_tasks_updated_at
  BEFORE UPDATE ON public.personal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX personal_tasks_user_idx ON public.personal_tasks(user_id, created_at DESC);
