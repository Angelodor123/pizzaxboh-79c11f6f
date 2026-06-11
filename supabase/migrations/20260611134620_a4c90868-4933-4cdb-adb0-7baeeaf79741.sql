
-- Reactions
CREATE TABLE public.shift_feed_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.shift_feed(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, emoji)
);
CREATE INDEX shift_feed_reactions_post_idx ON public.shift_feed_reactions(post_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_feed_reactions TO authenticated;
GRANT ALL ON public.shift_feed_reactions TO service_role;

ALTER TABLE public.shift_feed_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions read by branch members"
ON public.shift_feed_reactions FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.shift_feed sf
    WHERE sf.id = shift_feed_reactions.post_id
      AND sf.branch_id = public.current_user_branch_id()
  )
);
CREATE POLICY "reactions insert own"
ON public.shift_feed_reactions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions delete own"
ON public.shift_feed_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- Comments
CREATE TABLE public.shift_feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.shift_feed(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shift_feed_comments_post_idx ON public.shift_feed_comments(post_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_feed_comments TO authenticated;
GRANT ALL ON public.shift_feed_comments TO service_role;

ALTER TABLE public.shift_feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments read by branch members"
ON public.shift_feed_comments FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.shift_feed sf
    WHERE sf.id = shift_feed_comments.post_id
      AND sf.branch_id = public.current_user_branch_id()
  )
);
CREATE POLICY "comments insert own"
ON public.shift_feed_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments update own"
ON public.shift_feed_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments delete own or admin"
ON public.shift_feed_comments FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER shift_feed_comments_updated_at
BEFORE UPDATE ON public.shift_feed_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_feed_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_feed_comments;
