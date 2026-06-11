
ALTER TABLE public.shift_feed
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.shift_feed
  DROP CONSTRAINT IF EXISTS shift_feed_category_check;
ALTER TABLE public.shift_feed
  ADD CONSTRAINT shift_feed_category_check
  CHECK (category IN ('general','urgent','shift','fix','celebration'));

CREATE INDEX IF NOT EXISTS idx_shift_feed_branch_pinned
  ON public.shift_feed(branch_id, pinned_at DESC NULLS LAST, created_at DESC);

DROP TRIGGER IF EXISTS shift_feed_updated_at ON public.shift_feed;
CREATE TRIGGER shift_feed_updated_at
BEFORE UPDATE ON public.shift_feed
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "shift_feed update own or admin" ON public.shift_feed;
CREATE POLICY "shift_feed update own or admin"
ON public.shift_feed FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.shift_feed_reads (
  post_id uuid NOT NULL REFERENCES public.shift_feed(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS shift_feed_reads_post_idx ON public.shift_feed_reads(post_id);

GRANT SELECT, INSERT, DELETE ON public.shift_feed_reads TO authenticated;
GRANT ALL ON public.shift_feed_reads TO service_role;

ALTER TABLE public.shift_feed_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reads read by branch members"
ON public.shift_feed_reads FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.shift_feed sf
    WHERE sf.id = shift_feed_reads.post_id
      AND sf.branch_id = public.current_user_branch_id()
  )
);
CREATE POLICY "reads insert own"
ON public.shift_feed_reads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "reads delete own"
ON public.shift_feed_reads FOR DELETE TO authenticated
USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_feed_reads;
