
-- Drop FK and the duplicate tables/function
ALTER TABLE public.shortage_items DROP CONSTRAINT IF EXISTS shortage_items_catalog_item_id_fkey;
DROP FUNCTION IF EXISTS public.find_catalog_match(UUID, UUID, TEXT);
DROP TABLE IF EXISTS public.supplier_catalog_aliases CASCADE;
DROP TABLE IF EXISTS public.supplier_catalog CASCADE;

-- Add trigram index to existing supplier_products
CREATE INDEX IF NOT EXISTS idx_supplier_products_name_trgm
  ON public.supplier_products USING GIN (name gin_trgm_ops);

-- Re-point shortage_items.catalog_item_id to supplier_products
ALTER TABLE public.shortage_items
  ADD CONSTRAINT shortage_items_catalog_item_id_fkey
  FOREIGN KEY (catalog_item_id) REFERENCES public.supplier_products(id) ON DELETE SET NULL;

-- ============================================
-- ALIASES TABLE (linked to supplier_products)
-- ============================================
CREATE TABLE public.supplier_product_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL,
  alias TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(product_id, alias)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_product_aliases TO authenticated;
GRANT ALL ON public.supplier_product_aliases TO service_role;

ALTER TABLE public.supplier_product_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read product aliases of own branch"
  ON public.supplier_product_aliases FOR SELECT TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Authed insert product aliases of own branch"
  ON public.supplier_product_aliases FOR INSERT TO authenticated
  WITH CHECK (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Authed update product aliases of own branch"
  ON public.supplier_product_aliases FOR UPDATE TO authenticated
  USING (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  )
  WITH CHECK (
    current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE POLICY "Admins delete product aliases of own branch"
  ON public.supplier_product_aliases FOR DELETE TO authenticated
  USING (
    current_user_role() = 'admin'::app_role
    AND (is_super_admin(auth.uid()) OR branch_id = current_user_branch_id())
  );

CREATE INDEX idx_product_aliases_product ON public.supplier_product_aliases(product_id);
CREATE INDEX idx_product_aliases_alias_trgm ON public.supplier_product_aliases USING GIN (alias gin_trgm_ops);

-- ============================================
-- SMART MATCH FUNCTION (uses supplier_products + aliases)
-- ============================================
CREATE OR REPLACE FUNCTION public.find_catalog_match(
  _branch_id UUID,
  _supplier_id UUID,
  _query TEXT
)
RETURNS TABLE (
  product_id UUID,
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
    SELECT sp.id, sp.name, 1.0::real AS sim, 'exact'::text AS mt
    FROM public.supplier_products sp, normalized n
    WHERE sp.branch_id = _branch_id
      AND (sp.supplier_id = _supplier_id OR _supplier_id IS NULL)
      AND sp.active = true
      AND lower(trim(sp.name)) = n.q
    LIMIT 5
  ),
  alias_match AS (
    SELECT sp.id, sp.name, 0.95::real AS sim, 'alias'::text AS mt
    FROM public.supplier_products sp
    JOIN public.supplier_product_aliases spa ON spa.product_id = sp.id
    CROSS JOIN normalized n
    WHERE sp.branch_id = _branch_id
      AND (sp.supplier_id = _supplier_id OR _supplier_id IS NULL)
      AND sp.active = true
      AND lower(trim(spa.alias)) = n.q
      AND NOT EXISTS (SELECT 1 FROM exact_match em WHERE em.id = sp.id)
    LIMIT 5
  ),
  fuzzy_match AS (
    SELECT sp.id, sp.name,
      similarity(lower(sp.name), n.q) AS sim,
      'fuzzy'::text AS mt
    FROM public.supplier_products sp, normalized n
    WHERE sp.branch_id = _branch_id
      AND (sp.supplier_id = _supplier_id OR _supplier_id IS NULL)
      AND sp.active = true
      AND similarity(lower(sp.name), n.q) > 0.3
      AND NOT EXISTS (SELECT 1 FROM exact_match em WHERE em.id = sp.id)
      AND NOT EXISTS (SELECT 1 FROM alias_match am WHERE am.id = sp.id)
    ORDER BY sim DESC
    LIMIT 5
  )
  SELECT id, name, sim, mt FROM exact_match
  UNION ALL
  SELECT id, name, sim, mt FROM alias_match
  UNION ALL
  SELECT id, name, sim, mt FROM fuzzy_match
  ORDER BY sim DESC
  LIMIT 5;
$$;

REVOKE EXECUTE ON FUNCTION public.find_catalog_match(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_catalog_match(UUID, UUID, TEXT) TO authenticated;
