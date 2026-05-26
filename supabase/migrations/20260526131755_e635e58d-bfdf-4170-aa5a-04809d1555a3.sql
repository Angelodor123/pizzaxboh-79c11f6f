DELETE FROM public.calendar_events
WHERE event_type = 'sports_match'
  AND is_auto = true;

INSERT INTO public.calendar_events (
  branch_id,
  title,
  category,
  event_type,
  event_date,
  start_time,
  end_time,
  notes,
  high_priority,
  projector_broadcast,
  is_auto
)
SELECT
  b.id,
  'שידור משחק: PSG vs Arsenal',
  'event',
  'sports_match',
  DATE '2026-05-30',
  TIME '19:00',
  NULL,
  'גמר ליגת האלופות — אומת מול Google/צילום מסך ומול UEFA. לוודא מקרן וסאונד.',
  true,
  true,
  true
FROM public.branches b
WHERE b.active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.calendar_events ce
    WHERE ce.branch_id = b.id
      AND ce.event_type = 'sports_match'
      AND ce.event_date = DATE '2026-05-30'
      AND ce.title = 'שידור משחק: PSG vs Arsenal'
  );