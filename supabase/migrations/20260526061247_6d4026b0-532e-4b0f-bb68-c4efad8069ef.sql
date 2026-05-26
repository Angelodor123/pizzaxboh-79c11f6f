
-- EQUIPMENT TYPES
CREATE TABLE public.equipment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authed read equipment" ON public.equipment_types
  FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));

CREATE POLICY "Admins insert equipment" ON public.equipment_types
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'admin'::app_role);

CREATE POLICY "Admins update equipment" ON public.equipment_types
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin'::app_role)
  WITH CHECK (current_user_role() = 'admin'::app_role);

CREATE POLICY "Admins delete equipment" ON public.equipment_types
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin'::app_role);

CREATE TRIGGER set_equipment_types_updated_at
  BEFORE UPDATE ON public.equipment_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.equipment_types (name) VALUES
  ('צ׳יפסר'),
  ('טאבון'),
  ('מקרר'),
  ('פריזר'),
  ('מקסר'),
  ('מדיח כלים'),
  ('מיקסר בצק'),
  ('מתקן סודה'),
  ('קופה / POS'),
  ('מזגן'),
  ('תאורה'),
  ('אינסטלציה'),
  ('אחר')
ON CONFLICT (name) DO NOTHING;

-- MAINTENANCE TICKETS
CREATE TABLE public.maintenance_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  branch_id uuid,
  equipment_type_id uuid REFERENCES public.equipment_types(id) ON DELETE SET NULL,
  urgency text NOT NULL CHECK (urgency IN ('קריטי - משבית עבודה','דחוף - מפריע לעבודה','רגיל')),
  description text NOT NULL,
  photo_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  is_read_by_admin boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid
);
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tickets_unread ON public.maintenance_tickets (is_read_by_admin, status, urgency);
CREATE INDEX idx_tickets_user ON public.maintenance_tickets (user_id);

CREATE POLICY "Users read own tickets" ON public.maintenance_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR current_user_role() = 'admin'::app_role);

CREATE POLICY "Authed insert own tickets" ON public.maintenance_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()
    AND current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role]));

CREATE POLICY "Admins update tickets" ON public.maintenance_tickets
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin'::app_role)
  WITH CHECK (current_user_role() = 'admin'::app_role);

CREATE POLICY "Admins delete tickets" ON public.maintenance_tickets
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin'::app_role);

CREATE TRIGGER set_maintenance_tickets_updated_at
  BEFORE UPDATE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_tickets;
ALTER TABLE public.maintenance_tickets REPLICA IDENTITY FULL;

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authed read ticket attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ticket-attachments');

CREATE POLICY "Users upload own ticket attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins delete ticket attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ticket-attachments' AND current_user_role() = 'admin'::app_role);
