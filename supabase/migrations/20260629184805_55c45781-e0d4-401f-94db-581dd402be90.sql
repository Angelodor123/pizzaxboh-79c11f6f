
-- Snapshot source enum
DO $$ BEGIN
  CREATE TYPE public.inventory_snapshot_source AS ENUM ('count', 'auto', 'tabit', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.inventory_daily_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  opening_stock NUMERIC NOT NULL DEFAULT 0,
  purchases_qty NUMERIC NOT NULL DEFAULT 0,
  usage_qty NUMERIC NOT NULL DEFAULT 0,
  counted_stock NUMERIC,
  expected_closing NUMERIC GENERATED ALWAYS AS (opening_stock + purchases_qty - usage_qty) STORED,
  variance NUMERIC GENERATED ALWAYS AS (
    CASE WHEN counted_stock IS NULL THEN NULL
    ELSE counted_stock - (opening_stock + purchases_qty - usage_qty) END
  ) STORED,
  unit_cost NUMERIC,
  total_value NUMERIC GENERATED ALWAYS AS (
    COALESCE(counted_stock, opening_stock + purchases_qty - usage_qty) * COALESCE(unit_cost, 0)
  ) STORED,
  source public.inventory_snapshot_source NOT NULL DEFAULT 'manual',
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, snapshot_date, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_snapshots_branch_date
  ON public.inventory_daily_snapshots (branch_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_inv_snapshots_item
  ON public.inventory_daily_snapshots (item_id, snapshot_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_daily_snapshots TO authenticated;
GRANT ALL ON public.inventory_daily_snapshots TO service_role;

ALTER TABLE public.inventory_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots: view branch"
ON public.inventory_daily_snapshots FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR branch_id = public.current_user_branch_id()
);

CREATE POLICY "snapshots: admin write"
ON public.inventory_daily_snapshots FOR INSERT TO authenticated
WITH CHECK (
  (public.is_super_admin(auth.uid()) OR public.current_user_role() = 'admin'::public.app_role)
  AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
);

CREATE POLICY "snapshots: admin update"
ON public.inventory_daily_snapshots FOR UPDATE TO authenticated
USING (
  (public.is_super_admin(auth.uid()) OR public.current_user_role() = 'admin'::public.app_role)
  AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
)
WITH CHECK (
  (public.is_super_admin(auth.uid()) OR public.current_user_role() = 'admin'::public.app_role)
  AND (public.is_super_admin(auth.uid()) OR branch_id = public.current_user_branch_id())
);

CREATE POLICY "snapshots: super admin delete"
ON public.inventory_daily_snapshots FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_inv_snapshots_updated_at
BEFORE UPDATE ON public.inventory_daily_snapshots
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Upsert helper. Reads previous closing as opening, then applies provided values.
CREATE OR REPLACE FUNCTION public.record_inventory_snapshot(
  _branch_id UUID,
  _item_id UUID,
  _snapshot_date DATE,
  _counted_stock NUMERIC DEFAULT NULL,
  _purchases_qty NUMERIC DEFAULT NULL,
  _usage_qty NUMERIC DEFAULT NULL,
  _unit_cost NUMERIC DEFAULT NULL,
  _source public.inventory_snapshot_source DEFAULT 'manual',
  _note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_closing NUMERIC;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT (public.is_super_admin(auth.uid()) OR public.current_user_role() = 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF NOT public.is_super_admin(auth.uid()) AND _branch_id <> public.current_user_branch_id() THEN
    RAISE EXCEPTION 'Branch mismatch';
  END IF;

  -- Opening = previous snapshot's counted (preferred) or expected closing, else current_stock
  SELECT COALESCE(counted_stock, expected_closing)
    INTO v_prev_closing
  FROM public.inventory_daily_snapshots
  WHERE branch_id = _branch_id AND item_id = _item_id AND snapshot_date < _snapshot_date
  ORDER BY snapshot_date DESC
  LIMIT 1;

  IF v_prev_closing IS NULL THEN
    SELECT current_stock INTO v_prev_closing
    FROM public.inventory_items WHERE id = _item_id;
  END IF;

  INSERT INTO public.inventory_daily_snapshots AS s (
    branch_id, item_id, snapshot_date,
    opening_stock, purchases_qty, usage_qty,
    counted_stock, unit_cost, source, note, created_by
  ) VALUES (
    _branch_id, _item_id, _snapshot_date,
    COALESCE(v_prev_closing, 0),
    COALESCE(_purchases_qty, 0),
    COALESCE(_usage_qty, 0),
    _counted_stock, _unit_cost, _source, _note, auth.uid()
  )
  ON CONFLICT (branch_id, snapshot_date, item_id) DO UPDATE SET
    counted_stock = COALESCE(EXCLUDED.counted_stock, s.counted_stock),
    purchases_qty = CASE WHEN _purchases_qty IS NOT NULL THEN EXCLUDED.purchases_qty ELSE s.purchases_qty END,
    usage_qty     = CASE WHEN _usage_qty IS NOT NULL THEN EXCLUDED.usage_qty ELSE s.usage_qty END,
    unit_cost     = COALESCE(EXCLUDED.unit_cost, s.unit_cost),
    source        = EXCLUDED.source,
    note          = COALESCE(EXCLUDED.note, s.note),
    updated_at    = now()
  RETURNING s.id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_inventory_snapshot(UUID, UUID, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, public.inventory_snapshot_source, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_inventory_snapshot(UUID, UUID, DATE, NUMERIC, NUMERIC, NUMERIC, NUMERIC, public.inventory_snapshot_source, TEXT) TO authenticated, service_role;

-- Daily food cost: (opening + purchases - closing) * unit_cost, summed
CREATE OR REPLACE FUNCTION public.get_daily_food_cost(_branch_id UUID, _date DATE)
RETURNS TABLE(
  total_opening_value NUMERIC,
  total_purchases_value NUMERIC,
  total_closing_value NUMERIC,
  total_usage_value NUMERIC,
  item_count INT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(opening_stock * COALESCE(unit_cost, 0)), 0)::NUMERIC,
    COALESCE(SUM(purchases_qty * COALESCE(unit_cost, 0)), 0)::NUMERIC,
    COALESCE(SUM(COALESCE(counted_stock, expected_closing) * COALESCE(unit_cost, 0)), 0)::NUMERIC,
    COALESCE(SUM(
      (opening_stock + purchases_qty - COALESCE(counted_stock, expected_closing)) * COALESCE(unit_cost, 0)
    ), 0)::NUMERIC,
    COUNT(*)::INT
  FROM public.inventory_daily_snapshots
  WHERE branch_id = _branch_id
    AND snapshot_date = _date
    AND (public.is_super_admin(auth.uid()) OR _branch_id = public.current_user_branch_id());
$$;

REVOKE EXECUTE ON FUNCTION public.get_daily_food_cost(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_food_cost(UUID, DATE) TO authenticated, service_role;
