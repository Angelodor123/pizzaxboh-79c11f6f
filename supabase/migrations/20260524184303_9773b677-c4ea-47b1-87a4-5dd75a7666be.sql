-- Fix sync_supplier_calendar_events trigger to include branch_id (calendar_events.branch_id is NOT NULL)
CREATE OR REPLACE FUNCTION public.sync_supplier_calendar_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  wd smallint;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.calendar_events WHERE supplier_id = OLD.id AND is_auto = true;
    RETURN OLD;
  END IF;

  DELETE FROM public.calendar_events WHERE supplier_id = NEW.id AND is_auto = true;

  IF NEW.active AND COALESCE(NEW.is_archived, false) = false THEN
    FOREACH wd IN ARRAY NEW.delivery_weekdays LOOP
      INSERT INTO public.calendar_events (
        branch_id, title, category, recurring_weekday, start_time, end_time,
        supplier, supplier_id, is_auto, notes, high_priority, created_by
      ) VALUES (
        NEW.branch_id,
        'הגעת סחורה: ' || NEW.name || ' (' || NEW.category || ')',
        'delivery', wd, NEW.default_start_time, NEW.default_end_time,
        NEW.name, NEW.id, true, NEW.notes, false, NEW.created_by
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_sync_supplier_calendar_events ON public.suppliers;
CREATE TRIGGER trg_sync_supplier_calendar_events
AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.sync_supplier_calendar_events();