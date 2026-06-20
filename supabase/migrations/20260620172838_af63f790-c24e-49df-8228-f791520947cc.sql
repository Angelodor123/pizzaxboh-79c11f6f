-- 1) Fix shift_feed INSERT policy to require branch match and active role
DROP POLICY IF EXISTS "authenticated post to shift feed" ON public.shift_feed;

CREATE POLICY "authenticated post to shift feed"
  ON public.shift_feed FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND branch_id = public.current_user_branch_id()
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
  );

-- 2) Fix shift_feed_comments INSERT policy to require same branch as post
DROP POLICY IF EXISTS "authenticated insert comments" ON public.shift_feed_comments;

CREATE POLICY "authenticated insert comments"
  ON public.shift_feed_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND EXISTS (
      SELECT 1 FROM public.shift_feed sf
      WHERE sf.id = shift_feed_comments.post_id
        AND sf.branch_id = public.current_user_branch_id()
    )
  );

-- 3) Fix shift_feed_reactions INSERT policy to require same branch as post
DROP POLICY IF EXISTS "authenticated insert reactions" ON public.shift_feed_reactions;

CREATE POLICY "authenticated insert reactions"
  ON public.shift_feed_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND EXISTS (
      SELECT 1 FROM public.shift_feed sf
      WHERE sf.id = shift_feed_reactions.post_id
        AND sf.branch_id = public.current_user_branch_id()
    )
  );

-- 4) Fix shift_feed_reads INSERT policy to require same branch as post
DROP POLICY IF EXISTS "authenticated insert reads" ON public.shift_feed_reads;

CREATE POLICY "authenticated insert reads"
  ON public.shift_feed_reads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND EXISTS (
      SELECT 1 FROM public.shift_feed sf
      WHERE sf.id = shift_feed_reads.post_id
        AND sf.branch_id = public.current_user_branch_id()
    )
  );

-- 5) Fix notifications INSERT policy to add role gate
DROP POLICY IF EXISTS "authenticated insert notifications" ON public.notifications;

CREATE POLICY "authenticated insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
  );

-- 6) Fix supplier_standards SELECT policy to require a role
DROP POLICY IF EXISTS "users view standards of own branch" ON public.supplier_standards;

CREATE POLICY "users view standards of own branch"
  ON public.supplier_standards FOR SELECT TO authenticated
  USING (
    public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
    AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
  );

-- 7) Fix current_user_branch_id() to be deterministic when user has multiple roles
CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT assigned_branch_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND COALESCE(is_active, true) = true
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- 8) Add SELECT policy for supplier-logos bucket
CREATE POLICY "Authed view supplier logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'supplier-logos'
    AND public.current_user_role() = ANY (ARRAY['admin'::public.app_role, 'viewer'::public.app_role])
  );