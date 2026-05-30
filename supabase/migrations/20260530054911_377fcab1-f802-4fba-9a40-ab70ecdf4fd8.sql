
-- Enable trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 1. SUPPLIER CATALOG
-- ============================================
CREATE TABLE public.supplier_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  sku TEXT,
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'יחידה',
  pack_size NUMERIC NOT NULL DEFAULT 1,
  default_price NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  image_url TEXT,
  barcode TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_catalog TO authenticated;
GRANT ALL ON public.supplier_catalog TO service_role;

ALTER TABLE public.supplier_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read catalog of own branch"
  ON public.supplier_catalog FOR SELECT TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Admins insert catalog of own branch"
  ON public.supplier_catalog FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Admins update catalog of own branch"
  ON public.supplier_catalog FOR UPDATE TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  )
  WITH CHECK (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Admins delete catalog of own branch"
  ON public.supplier_catalog FOR DELETE TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE INDEX idx_supplier_catalog_supplier ON public.supplier_catalog(supplier_id);
CREATE INDEX idx_supplier_catalog_branch ON public.supplier_catalog(branch_id);
CREATE INDEX idx_supplier_catalog_category ON public.supplier_catalog(category);
CREATE INDEX idx_supplier_catalog_active ON public.supplier_catalog(active);
CREATE INDEX idx_supplier_catalog_name_trgm ON public.supplier_catalog USING GIN (product_name gin_trgm_ops);

CREATE TRIGGER set_supplier_catalog_updated_at
  BEFORE UPDATE ON public.supplier_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- 2. SUPPLIER CATALOG ALIASES (alternative names)
-- ============================================
CREATE TABLE public.supplier_catalog_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalog_item_id UUID NOT NULL REFERENCES public.supplier_catalog(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  alias TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(catalog_item_id, alias)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_catalog_aliases TO authenticated;
GRANT ALL ON public.supplier_catalog_aliases TO service_role;

ALTER TABLE public.supplier_catalog_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read aliases of own branch"
  ON public.supplier_catalog_aliases FOR SELECT TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Authed insert aliases of own branch"
  ON public.supplier_catalog_aliases FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Authed update aliases of own branch"
  ON public.supplier_catalog_aliases FOR UPDATE TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  )
  WITH CHECK (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Admins delete aliases of own branch"
  ON public.supplier_catalog_aliases FOR DELETE TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE INDEX idx_catalog_aliases_item ON public.supplier_catalog_aliases(catalog_item_id);
CREATE INDEX idx_catalog_aliases_alias_trgm ON public.supplier_catalog_aliases USING GIN (alias gin_trgm_ops);

-- ============================================
-- 3. LINK shortage_items TO CATALOG
-- ============================================
ALTER TABLE public.shortage_items
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.supplier_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';

CREATE INDEX IF NOT EXISTS idx_shortage_items_catalog ON public.shortage_items(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_shortage_items_status ON public.shortage_items(status);

-- ============================================
-- 4. SMART MATCH FUNCTION - finds catalog item by free text
-- ============================================
CREATE OR REPLACE FUNCTION public.find_catalog_match(
  _branch_id UUID,
  _supplier_id UUID,
  _query TEXT
)
RETURNS TABLE (
  catalog_item_id UUID,
  product_name TEXT,
  similarity REAL,
  match_type TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT trim(lower(_query)) AS q
  ),
  exact_match AS (
    SELECT sc.id, sc.product_name, 1.0::real AS sim, 'exact'::text AS mt
    FROM public.supplier_catalog sc, normalized n
    WHERE sc.branch_id = _branch_id
      AND (sc.supplier_id = _supplier_id OR _supplier_id IS NULL)
      AND sc.active = true
      AND lower(trim(sc.product_name)) = n.q
    LIMIT 5
  ),
  alias_match AS (
    SELECT sc.id, sc.product_name, 0.95::real AS sim, 'alias'::text AS mt
    FROM public.supplier_catalog sc
    JOIN public.supplier_catalog_aliases sca ON sca.catalog_item_id = sc.id
    CROSS JOIN normalized n
    WHERE sc.branch_id = _branch_id
      AND (sc.supplier_id = _supplier_id OR _supplier_id IS NULL)
      AND sc.active = true
      AND lower(trim(sca.alias)) = n.q
      AND NOT EXISTS (SELECT 1 FROM exact_match em WHERE em.id = sc.id)
    LIMIT 5
  ),
  fuzzy_match AS (
    SELECT sc.id, sc.product_name,
      similarity(lower(sc.product_name), n.q) AS sim,
      'fuzzy'::text AS mt
    FROM public.supplier_catalog sc, normalized n
    WHERE sc.branch_id = _branch_id
      AND (sc.supplier_id = _supplier_id OR _supplier_id IS NULL)
      AND sc.active = true
      AND similarity(lower(sc.product_name), n.q) > 0.3
      AND NOT EXISTS (SELECT 1 FROM exact_match em WHERE em.id = sc.id)
      AND NOT EXISTS (SELECT 1 FROM alias_match am WHERE am.id = sc.id)
    ORDER BY sim DESC
    LIMIT 5
  )
  SELECT id, product_name, sim, mt FROM exact_match
  UNION ALL
  SELECT id, product_name, sim, mt FROM alias_match
  UNION ALL
  SELECT id, product_name, sim, mt FROM fuzzy_match
  ORDER BY sim DESC
  LIMIT 5;
$$;

REVOKE EXECUTE ON FUNCTION public.find_catalog_match(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_catalog_match(UUID, UUID, TEXT) TO authenticated;
