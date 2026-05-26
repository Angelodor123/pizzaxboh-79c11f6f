-- ============ ev_vehicles ============
DROP POLICY IF EXISTS "Authed with role can read ev" ON public.ev_vehicles;
DROP POLICY IF EXISTS "Authed with role can update ev" ON public.ev_vehicles;
DROP POLICY IF EXISTS "Admins insert ev" ON public.ev_vehicles;
DROP POLICY IF EXISTS "Admins delete ev" ON public.ev_vehicles;

CREATE POLICY "Authed read ev of own branch" ON public.ev_vehicles
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Authed update ev of own branch" ON public.ev_vehicles
  FOR UPDATE TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()))
  WITH CHECK (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Admins insert ev of own branch" ON public.ev_vehicles
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Admins delete ev of own branch" ON public.ev_vehicles
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

-- ============ prep_items ============
DROP POLICY IF EXISTS "read prep items" ON public.prep_items;
DROP POLICY IF EXISTS "admins write prep items" ON public.prep_items;

CREATE POLICY "read prep items of own branch" ON public.prep_items
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "admins write prep items of own branch" ON public.prep_items
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()))
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

-- ============ restock_items ============
DROP POLICY IF EXISTS "read restock items" ON public.restock_items;
DROP POLICY IF EXISTS "admins write restock items" ON public.restock_items;

CREATE POLICY "read restock items of own branch" ON public.restock_items
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "admins write restock items of own branch" ON public.restock_items
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()))
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

-- ============ prep_log (scope via parent prep_items.branch_id) ============
DROP POLICY IF EXISTS "read prep log" ON public.prep_log;
DROP POLICY IF EXISTS "roles write prep log" ON public.prep_log;

CREATE POLICY "read prep log of own branch" ON public.prep_log
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND EXISTS (
           SELECT 1 FROM public.prep_items pi
           WHERE pi.id = prep_log.prep_item_id
             AND (is_super_admin(auth.uid()) OR pi.branch_id = current_user_branch_id())
         ));

CREATE POLICY "roles write prep log of own branch" ON public.prep_log
  FOR ALL TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND EXISTS (
           SELECT 1 FROM public.prep_items pi
           WHERE pi.id = prep_log.prep_item_id
             AND (is_super_admin(auth.uid()) OR pi.branch_id = current_user_branch_id())
         ))
  WITH CHECK (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND EXISTS (
           SELECT 1 FROM public.prep_items pi
           WHERE pi.id = prep_log.prep_item_id
             AND (is_super_admin(auth.uid()) OR pi.branch_id = current_user_branch_id())
         ));

-- ============ restock_log (scope via parent restock_items.branch_id) ============
DROP POLICY IF EXISTS "read restock log" ON public.restock_log;
DROP POLICY IF EXISTS "roles write restock log" ON public.restock_log;

CREATE POLICY "read restock log of own branch" ON public.restock_log
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND EXISTS (
           SELECT 1 FROM public.restock_items ri
           WHERE ri.id = restock_log.restock_item_id
             AND (is_super_admin(auth.uid()) OR ri.branch_id = current_user_branch_id())
         ));

CREATE POLICY "roles write restock log of own branch" ON public.restock_log
  FOR ALL TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND EXISTS (
           SELECT 1 FROM public.restock_items ri
           WHERE ri.id = restock_log.restock_item_id
             AND (is_super_admin(auth.uid()) OR ri.branch_id = current_user_branch_id())
         ))
  WITH CHECK (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND EXISTS (
           SELECT 1 FROM public.restock_items ri
           WHERE ri.id = restock_log.restock_item_id
             AND (is_super_admin(auth.uid()) OR ri.branch_id = current_user_branch_id())
         ));

-- ============ notebook_items (already has branch_id) ============
DROP POLICY IF EXISTS "Authenticated users with role can read notebook" ON public.notebook_items;
DROP POLICY IF EXISTS "Authenticated users with role can insert notebook" ON public.notebook_items;
DROP POLICY IF EXISTS "Authenticated users with role can update notebook" ON public.notebook_items;
DROP POLICY IF EXISTS "Authenticated users with role can delete notebook" ON public.notebook_items;

CREATE POLICY "Authed read notebook of own branch" ON public.notebook_items
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Authed insert notebook of own branch" ON public.notebook_items
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND created_by = auth.uid()
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Authed update notebook of own branch" ON public.notebook_items
  FOR UPDATE TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()))
  WITH CHECK (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Authed delete notebook of own branch" ON public.notebook_items
  FOR DELETE TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

-- ============ notebook_snapshots: add branch_id, scope policy, update reset fn ============
ALTER TABLE public.notebook_snapshots ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE public.notebook_snapshots DROP CONSTRAINT IF EXISTS notebook_snapshots_snapshot_date_list_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS notebook_snapshots_uniq
  ON public.notebook_snapshots (snapshot_date, list_key, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

DROP POLICY IF EXISTS "Authed with role can read snapshots" ON public.notebook_snapshots;
CREATE POLICY "Authed read snapshots of own branch" ON public.notebook_snapshots
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role,'viewer'::app_role])
         AND (is_super_admin(auth.uid()) OR branch_id IS NULL OR branch_id = current_user_branch_id()));

CREATE OR REPLACE FUNCTION public.notebook_daily_reset()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  snap_date DATE := (now() AT TIME ZONE 'Asia/Jerusalem')::date - INTERVAL '1 day';
BEGIN
  INSERT INTO public.notebook_snapshots (snapshot_date, list_key, branch_id, items)
  SELECT snap_date::date, list_key, branch_id, jsonb_agg(jsonb_build_object(
    'id', id, 'text', text, 'done', done, 'priority', priority, 'created_at', created_at
  ) ORDER BY created_at)
  FROM public.notebook_items
  WHERE archived_at IS NULL
  GROUP BY list_key, branch_id;

  UPDATE public.notebook_items SET archived_at = now() WHERE archived_at IS NULL;

  DELETE FROM public.notebook_snapshots WHERE snapshot_date < (now() AT TIME ZONE 'Asia/Jerusalem')::date - INTERVAL '14 days';
END;
$function$;

-- ============ recipes: tighten write policies (read stays global) ============
DROP POLICY IF EXISTS "Admins can insert recipes" ON public.recipes;
DROP POLICY IF EXISTS "Admins can update recipes" ON public.recipes;
DROP POLICY IF EXISTS "Admins can delete recipes" ON public.recipes;

CREATE POLICY "Admins insert recipes of own branch" ON public.recipes
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Admins update recipes of own branch" ON public.recipes
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()))
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Admins delete recipes of own branch" ON public.recipes
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

-- ============ suppliers: tighten write policies (read stays global) ============
DROP POLICY IF EXISTS "Admins insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins delete suppliers" ON public.suppliers;

CREATE POLICY "Admins insert suppliers of own branch" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Admins update suppliers of own branch" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()))
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Admins delete suppliers of own branch" ON public.suppliers
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

-- ============ calendar_events: scope write by branch ============
DROP POLICY IF EXISTS "Admins insert events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins update events" ON public.calendar_events;
DROP POLICY IF EXISTS "Admins delete events" ON public.calendar_events;

CREATE POLICY "Admins insert events of own branch" ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Admins update events of own branch" ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()))
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Admins delete events of own branch" ON public.calendar_events
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

-- ============ calendar_event_overrides: scope write via parent event branch ============
DROP POLICY IF EXISTS "Admins insert overrides" ON public.calendar_event_overrides;
DROP POLICY IF EXISTS "Admins update overrides" ON public.calendar_event_overrides;
DROP POLICY IF EXISTS "Admins delete overrides" ON public.calendar_event_overrides;

CREATE POLICY "Admins insert overrides of own branch" ON public.calendar_event_overrides
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND EXISTS (
           SELECT 1 FROM public.calendar_events e
           WHERE e.id = calendar_event_overrides.event_id
             AND (is_super_admin(auth.uid()) OR e.branch_id = current_user_branch_id())
         ));

CREATE POLICY "Admins update overrides of own branch" ON public.calendar_event_overrides
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND EXISTS (
           SELECT 1 FROM public.calendar_events e
           WHERE e.id = calendar_event_overrides.event_id
             AND (is_super_admin(auth.uid()) OR e.branch_id = current_user_branch_id())
         ))
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND EXISTS (
           SELECT 1 FROM public.calendar_events e
           WHERE e.id = calendar_event_overrides.event_id
             AND (is_super_admin(auth.uid()) OR e.branch_id = current_user_branch_id())
         ));

CREATE POLICY "Admins delete overrides of own branch" ON public.calendar_event_overrides
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND EXISTS (
           SELECT 1 FROM public.calendar_events e
           WHERE e.id = calendar_event_overrides.event_id
             AND (is_super_admin(auth.uid()) OR e.branch_id = current_user_branch_id())
         ));

-- ============ maintenance_tickets: scope admin reads and updates by branch ============
DROP POLICY IF EXISTS "Users read own tickets" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "Admins update tickets" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "Admins delete tickets" ON public.maintenance_tickets;

CREATE POLICY "Users and branch admins read tickets" ON public.maintenance_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR (current_user_role() = 'admin'::app_role
             AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())));

CREATE POLICY "Branch admins update tickets" ON public.maintenance_tickets
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()))
  WITH CHECK (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

CREATE POLICY "Branch admins delete tickets" ON public.maintenance_tickets
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin'::app_role
         AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id()));

-- ============ storage: ticket-attachments — restrict SELECT to owner / branch admin ============
DROP POLICY IF EXISTS "Authed read ticket attachments" ON storage.objects;

CREATE POLICY "Owner or branch admin read ticket attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        current_user_role() = 'admin'::app_role
        AND EXISTS (
          SELECT 1 FROM public.maintenance_tickets mt
          WHERE mt.photo_url LIKE '%' || storage.objects.name || '%'
            AND (is_super_admin(auth.uid()) OR mt.branch_id = current_user_branch_id())
        )
      )
    )
  );

-- ============ Revoke EXECUTE from public on internal trigger function ============
REVOKE EXECUTE ON FUNCTION public.notify_dough_threshold() FROM PUBLIC;