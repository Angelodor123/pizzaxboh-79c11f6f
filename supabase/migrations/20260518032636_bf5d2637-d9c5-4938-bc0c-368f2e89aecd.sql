-- Calendar events table for BOH operations
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('delivery', 'event')),
  event_date date,
  start_time time,
  end_time time,
  supplier text,
  high_priority boolean NOT NULL DEFAULT false,
  notes text,
  -- For recurring weekly deliveries: 0=Sunday..6=Saturday; null = one-off
  recurring_weekday smallint CHECK (recurring_weekday BETWEEN 0 AND 6),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_date IS NOT NULL OR recurring_weekday IS NOT NULL)
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated with role can read events"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'viewer'::app_role));

CREATE POLICY "Admins insert events"
  ON public.calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update events"
  ON public.calendar_events FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete events"
  ON public.calendar_events FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER calendar_events_set_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_calendar_events_date ON public.calendar_events(event_date);
CREATE INDEX idx_calendar_events_weekday ON public.calendar_events(recurring_weekday);

ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;