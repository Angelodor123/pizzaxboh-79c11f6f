
-- 1. Suppliers table
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'כללי',
  delivery_weekdays smallint[] NOT NULL DEFAULT '{}',
  default_start_time time,
  default_end_time time,
  contact text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated with role can read suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admins insert suppliers" ON public.suppliers
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update suppliers" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete suppliers" ON public.suppliers
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Add columns to calendar_events for auto-generation linkage
ALTER TABLE public.calendar_events
  ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  ADD COLUMN is_auto boolean NOT NULL DEFAULT false;

CREATE INDEX idx_calendar_events_supplier_id ON public.calendar_events(supplier_id);

-- 3. Calendar event overrides (per-instance edits of recurring events)
CREATE TABLE public.calendar_event_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  title text,
  start_time time,
  end_time time,
  notes text,
  high_priority boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (event_id, override_date)
);

ALTER TABLE public.calendar_event_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated with role can read overrides" ON public.calendar_event_overrides
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admins insert overrides" ON public.calendar_event_overrides
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update overrides" ON public.calendar_event_overrides
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete overrides" ON public.calendar_event_overrides
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER overrides_updated_at
  BEFORE UPDATE ON public.calendar_event_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Function + trigger: regenerate auto calendar_events from suppliers
CREATE OR REPLACE FUNCTION public.sync_supplier_calendar_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wd smallint;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.calendar_events WHERE supplier_id = OLD.id AND is_auto = true;
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE: wipe existing auto events for this supplier and recreate
  DELETE FROM public.calendar_events WHERE supplier_id = NEW.id AND is_auto = true;

  IF NEW.active THEN
    FOREACH wd IN ARRAY NEW.delivery_weekdays LOOP
      INSERT INTO public.calendar_events (
        title, category, recurring_weekday, start_time, end_time,
        supplier, supplier_id, is_auto, notes, high_priority, created_by
      ) VALUES (
        'הגעת סחורה: ' || NEW.name || ' (' || NEW.category || ')',
        'delivery', wd, NEW.default_start_time, NEW.default_end_time,
        NEW.name, NEW.id, true, NEW.notes, false, NEW.created_by
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_supplier_calendar_events() FROM anon, authenticated;

CREATE TRIGGER suppliers_sync_calendar
  AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.sync_supplier_calendar_events();

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_event_overrides;
