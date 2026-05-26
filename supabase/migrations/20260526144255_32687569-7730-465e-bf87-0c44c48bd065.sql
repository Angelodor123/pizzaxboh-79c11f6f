
-- Add requires_photo flag to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS requires_photo boolean NOT NULL DEFAULT false;

-- Add photo_url to daily_task_logs
ALTER TABLE public.daily_task_logs ADD COLUMN IF NOT EXISTS photo_url text;

-- Create task-photos storage bucket (public read for simplicity within authed app)
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Public read task photos" ON storage.objects;
CREATE POLICY "Public read task photos" ON storage.objects
FOR SELECT USING (bucket_id = 'task-photos');

DROP POLICY IF EXISTS "Authed upload task photos" ON storage.objects;
CREATE POLICY "Authed upload task photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-photos' AND (public.current_user_role() = ANY (ARRAY['admin'::app_role, 'viewer'::app_role])));

DROP POLICY IF EXISTS "Admins delete task photos" ON storage.objects;
CREATE POLICY "Admins delete task photos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'task-photos' AND public.current_user_role() = 'admin'::app_role);
