CREATE OR REPLACE FUNCTION public.rollover_daily_operations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := public.operational_today();
  v_yest  date := v_today - INTERVAL '1 day';
  v_dow   int  := EXTRACT(DOW FROM v_today)::int;
BEGIN
  -- TASKS snapshot
  INSERT INTO public.daily_operational_history (branch_id, snapshot_date, kind, payload)
  SELECT
    t.branch_id, v_yest, 'tasks',
    COALESCE(jsonb_agg(jsonb_build_object(
      'task_id', t.id, 'task_name', t.name, 'group_id', t.group_id,
      'completed', COALESCE(l.completed, false),
      'completed_at', l.completed_at, 'completed_by', l.completed_by,
      'comments', l.comments
    )), '[]'::jsonb)
  FROM public.tasks t
  LEFT JOIN public.daily_task_logs l ON l.task_id = t.id AND l.log_date = v_yest
  WHERE t.active = true
  GROUP BY t.branch_id
  ON CONFLICT (snapshot_date, kind, branch_id) DO UPDATE SET payload = EXCLUDED.payload;

  -- PREP snapshot
  INSERT INTO public.daily_operational_history (branch_id, snapshot_date, kind, payload)
  SELECT
    p.branch_id, v_yest, 'prep',
    COALESCE(jsonb_agg(jsonb_build_object(
      'prep_item_id', p.id, 'name', p.name, 'unit', p.unit,
      'target', CASE EXTRACT(DOW FROM v_yest)::int
        WHEN 0 THEN p.target_sun WHEN 1 THEN p.target_mon WHEN 2 THEN p.target_tue
        WHEN 3 THEN p.target_wed WHEN 4 THEN p.target_thu WHEN 5 THEN p.target_fri
        WHEN 6 THEN p.target_sat END,
      'current_stock', COALESCE(pl.current_stock, 0),
      'completed', COALESCE(pl.completed, false)
    )), '[]'::jsonb)
  FROM public.prep_items p
  LEFT JOIN public.prep_log pl ON pl.prep_item_id = p.id AND pl.log_date = v_yest
  WHERE p.active = true
  GROUP BY p.branch_id
  ON CONFLICT (snapshot_date, kind, branch_id) DO UPDATE SET payload = EXCLUDED.payload;

  -- RESTOCK snapshot
  INSERT INTO public.daily_operational_history (branch_id, snapshot_date, kind, payload)
  SELECT
    r.branch_id, v_yest, 'restock',
    COALESCE(jsonb_agg(jsonb_build_object(
      'restock_item_id', r.id, 'name', r.name, 'unit', r.unit,
      'target', CASE EXTRACT(DOW FROM v_yest)::int
        WHEN 0 THEN r.target_sun WHEN 1 THEN r.target_mon WHEN 2 THEN r.target_tue
        WHEN 3 THEN r.target_wed WHEN 4 THEN r.target_thu WHEN 5 THEN r.target_fri
        WHEN 6 THEN r.target_sat END,
      'current_stock', COALESCE(rl.current_stock, 0),
      'completed', COALESCE(rl.completed, false)
    )), '[]'::jsonb)
  FROM public.restock_items r
  LEFT JOIN public.restock_log rl ON rl.restock_item_id = r.id AND rl.log_date = v_yest
  WHERE r.active = true
  GROUP BY r.branch_id
  ON CONFLICT (snapshot_date, kind, branch_id) DO UPDATE SET payload = EXCLUDED.payload;

  -- SHORTAGES snapshot (state at end of yesterday)
  INSERT INTO public.daily_operational_history (branch_id, snapshot_date, kind, payload)
  SELECT
    s.branch_id, v_yest, 'shortages',
    COALESCE(jsonb_agg(jsonb_build_object(
      'shortage_id', s.id, 'name', s.name, 'quantity', s.quantity,
      'unit', s.unit, 'notes', s.notes, 'completed', s.completed,
      'completed_at', s.completed_at, 'created_at', s.created_at
    )), '[]'::jsonb)
  FROM public.shortage_items s
  WHERE s.created_at < (v_today::timestamp AT TIME ZONE 'Asia/Jerusalem')
  GROUP BY s.branch_id
  ON CONFLICT (snapshot_date, kind, branch_id) DO UPDATE SET payload = EXCLUDED.payload;

  -- ORDERS snapshot (supplier orders sent yesterday)
  INSERT INTO public.daily_operational_history (branch_id, snapshot_date, kind, payload)
  SELECT
    o.branch_id, v_yest, 'orders',
    COALESCE(jsonb_agg(jsonb_build_object(
      'order_id', o.id, 'supplier_id', o.supplier_id,
      'status', o.status, 'items', o.items, 'notes', o.notes,
      'sent_at', o.sent_at, 'received_at', o.received_at
    ) ORDER BY o.sent_at), '[]'::jsonb)
  FROM public.orders o
  WHERE (o.sent_at AT TIME ZONE 'Asia/Jerusalem')::date = v_yest
  GROUP BY o.branch_id
  ON CONFLICT (snapshot_date, kind, branch_id) DO UPDATE SET payload = EXCLUDED.payload;

  -- Carry forward PREP
  INSERT INTO public.prep_log (prep_item_id, log_date, current_stock, completed)
  SELECT p.id, v_today, COALESCE(pl.current_stock, 0), false
  FROM public.prep_items p
  LEFT JOIN public.prep_log pl ON pl.prep_item_id = p.id AND pl.log_date = v_yest
  WHERE p.active = true
    AND COALESCE(pl.current_stock, 0) < CASE v_dow
        WHEN 0 THEN p.target_sun WHEN 1 THEN p.target_mon WHEN 2 THEN p.target_tue
        WHEN 3 THEN p.target_wed WHEN 4 THEN p.target_thu WHEN 5 THEN p.target_fri
        WHEN 6 THEN p.target_sat END
  ON CONFLICT DO NOTHING;

  -- Carry forward RESTOCK
  INSERT INTO public.restock_log (restock_item_id, log_date, current_stock, completed)
  SELECT r.id, v_today, COALESCE(rl.current_stock, 0), false
  FROM public.restock_items r
  LEFT JOIN public.restock_log rl ON rl.restock_item_id = r.id AND rl.log_date = v_yest
  WHERE r.active = true
    AND COALESCE(rl.current_stock, 0) < CASE v_dow
        WHEN 0 THEN r.target_sun WHEN 1 THEN r.target_mon WHEN 2 THEN r.target_tue
        WHEN 3 THEN r.target_wed WHEN 4 THEN r.target_thu WHEN 5 THEN r.target_fri
        WHEN 6 THEN r.target_sat END
  ON CONFLICT DO NOTHING;

  -- Carry forward TASKS
  INSERT INTO public.daily_task_logs (task_id, branch_id, log_date, completed)
  SELECT t.id, t.branch_id, v_today, false
  FROM public.tasks t
  LEFT JOIN public.daily_task_logs l_old
    ON l_old.task_id = t.id AND l_old.log_date = v_yest AND l_old.completed = true
  WHERE t.active = true
    AND l_old.id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.daily_task_logs l_today
      WHERE l_today.task_id = t.id AND l_today.log_date = v_today
    )
  ON CONFLICT DO NOTHING;

  -- Carry forward SHORTAGES: archive completed ones (>1 day old); uncompleted stay live
  DELETE FROM public.shortage_items
  WHERE completed = true
    AND COALESCE(completed_at, updated_at) < (v_today - INTERVAL '1 day');

  -- NOTEBOOK: archive completed items only (uncompleted always carry over)
  UPDATE public.notebook_items
  SET archived_at = now()
  WHERE done = true
    AND archived_at IS NULL
    AND updated_at < (v_today::timestamp AT TIME ZONE 'Asia/Jerusalem');

  -- Purge logs older than 14 days
  DELETE FROM public.daily_task_logs WHERE log_date < v_today - INTERVAL '14 days';
  DELETE FROM public.prep_log        WHERE log_date < v_today - INTERVAL '14 days';
  DELETE FROM public.restock_log     WHERE log_date < v_today - INTERVAL '14 days';

  -- Purge history older than 14 days
  DELETE FROM public.daily_operational_history
  WHERE snapshot_date < v_today - INTERVAL '14 days';

  -- Purge archived notebook items older than 14 days
  DELETE FROM public.notebook_items
  WHERE archived_at IS NOT NULL
    AND archived_at < (now() - INTERVAL '14 days');
END;
$function$;