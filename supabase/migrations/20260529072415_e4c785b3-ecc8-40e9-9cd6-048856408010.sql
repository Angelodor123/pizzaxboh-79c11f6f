-- 1. Add is_urgent + manual_order_index to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_order_index integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_urgent_order
  ON public.tasks (branch_id, is_urgent DESC, manual_order_index ASC, sort_order ASC);

-- 2. AI learning dictionary
CREATE TABLE IF NOT EXISTS public.ai_learning_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  branch_id uuid,
  user_input text NOT NULL,
  ai_suggestion jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_intent jsonb NOT NULL DEFAULT '{}'::jsonb,
  context text NOT NULL DEFAULT 'general',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_branch_created
  ON public.ai_learning_dictionary (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_learning_context
  ON public.ai_learning_dictionary (context);

GRANT SELECT, INSERT ON public.ai_learning_dictionary TO authenticated;
GRANT ALL ON public.ai_learning_dictionary TO service_role;

ALTER TABLE public.ai_learning_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read ai dictionary of own branch"
ON public.ai_learning_dictionary
FOR SELECT
TO authenticated
USING (
  current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
  AND (is_super_admin(auth.uid()) OR branch_id IS NULL OR branch_id = current_user_branch_id())
);

CREATE POLICY "Authed insert ai dictionary of own branch"
ON public.ai_learning_dictionary
FOR INSERT
TO authenticated
WITH CHECK (
  current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
  AND (is_super_admin(auth.uid()) OR branch_id IS NULL OR branch_id = current_user_branch_id())
);