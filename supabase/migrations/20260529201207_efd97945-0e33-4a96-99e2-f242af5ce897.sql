
ALTER TABLE public.calendar_event_overrides
  ADD COLUMN IF NOT EXISTS expected_items jsonb;

-- Allow viewers (not just admins) to upsert overrides for delivery check-off
DROP POLICY IF EXISTS "Authed insert overrides for daily check" ON public.calendar_event_overrides;
CREATE POLICY "Authed insert overrides for daily check"
ON public.calendar_event_overrides FOR INSERT TO authenticated
WITH CHECK (
  (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]))
  AND EXISTS (
    SELECT 1 FROM public.calendar_events e
    WHERE e.id = calendar_event_overrides.event_id
      AND (is_super_admin(auth.uid()) OR e.branch_id = current_user_branch_id())
  )
);

DROP POLICY IF EXISTS "Authed update overrides for daily check" ON public.calendar_event_overrides;
CREATE POLICY "Authed update overrides for daily check"
ON public.calendar_event_overrides FOR UPDATE TO authenticated
USING (
  (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]))
  AND EXISTS (
    SELECT 1 FROM public.calendar_events e
    WHERE e.id = calendar_event_overrides.event_id
      AND (is_super_admin(auth.uid()) OR e.branch_id = current_user_branch_id())
  )
)
WITH CHECK (
  (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]))
  AND EXISTS (
    SELECT 1 FROM public.calendar_events e
    WHERE e.id = calendar_event_overrides.event_id
      AND (is_super_admin(auth.uid()) OR e.branch_id = current_user_branch_id())
  )
);
