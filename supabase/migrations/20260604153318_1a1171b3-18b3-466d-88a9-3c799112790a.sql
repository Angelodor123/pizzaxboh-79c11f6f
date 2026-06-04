
-- notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  link text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "authenticated can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- shift_feed table
CREATE TABLE public.shift_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  message text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_shift_feed_branch_created ON public.shift_feed(branch_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_feed TO authenticated;
GRANT ALL ON public.shift_feed TO service_role;

ALTER TABLE public.shift_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read shift feed"
  ON public.shift_feed FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated post to shift feed"
  ON public.shift_feed FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "author or admin delete shift feed"
  ON public.shift_feed FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_feed;
ALTER TABLE public.shift_feed REPLICA IDENTITY FULL;
