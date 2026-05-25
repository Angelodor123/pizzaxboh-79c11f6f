
-- Order status enum
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('draft', 'sent', 'received', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  status public.order_status NOT NULL DEFAULT 'sent',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz,
  invoice_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_branch_supplier_sent ON public.orders (branch_id, supplier_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read orders of own branch" ON public.orders FOR SELECT TO authenticated
  USING ((current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));
CREATE POLICY "Admins insert orders of own branch" ON public.orders FOR INSERT TO authenticated
  WITH CHECK ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));
CREATE POLICY "Admins update orders of own branch" ON public.orders FOR UPDATE TO authenticated
  USING ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())))
  WITH CHECK ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));
CREATE POLICY "Admins delete orders of own branch" ON public.orders FOR DELETE TO authenticated
  USING ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));

CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INVENTORY ITEMS
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  current_stock numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_items_branch_name ON public.inventory_items (branch_id, name);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read inventory of own branch" ON public.inventory_items FOR SELECT TO authenticated
  USING ((current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));
CREATE POLICY "Admins insert inventory of own branch" ON public.inventory_items FOR INSERT TO authenticated
  WITH CHECK ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));
CREATE POLICY "Admins update inventory of own branch" ON public.inventory_items FOR UPDATE TO authenticated
  USING ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())))
  WITH CHECK ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));
CREATE POLICY "Admins delete inventory of own branch" ON public.inventory_items FOR DELETE TO authenticated
  USING ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));

CREATE TRIGGER trg_inv_items_updated_at BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- INVENTORY MOVEMENTS
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  qty_delta numeric NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  order_id uuid,
  invoice_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_mov_branch_created ON public.inventory_movements (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_order ON public.inventory_movements (order_id);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read movements of own branch" ON public.inventory_movements FOR SELECT TO authenticated
  USING ((current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));
CREATE POLICY "Admins insert movements of own branch" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));
CREATE POLICY "Admins delete movements of own branch" ON public.inventory_movements FOR DELETE TO authenticated
  USING ((current_user_role() = 'admin'::app_role) AND (is_super_admin(auth.uid()) OR (branch_id = current_user_branch_id())));

-- INVOICES additions
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_image_url text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS order_id uuid;
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices (order_id);
