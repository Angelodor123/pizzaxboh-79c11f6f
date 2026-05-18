import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, X, Trash2, Pencil, AlertTriangle, Truck, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

type EventCategory = "delivery" | "event";

interface CalendarEvent {
  id: string;
  title: string;
  category: EventCategory;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  supplier: string | null;
  high_priority: boolean;
  notes: string | null;
  recurring_weekday: number | null;
  supplier_id?: string | null;
  is_auto?: boolean;
}

interface EventOverride {
  id: string;
  event_id: string;
  override_date: string;
  deleted: boolean;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  high_priority: boolean | null;
}

// Effective event = base event + per-instance override fields for that date.
// Returns null if the instance is canceled.
type EffectiveEvent = CalendarEvent & { _overrideId?: string; _isOverride?: boolean; _occurrenceDate?: string };

const WEEKDAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTHS_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CalendarPage() {
  const { role } = useAuth();
  const canEdit = role === "admin";
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [overrides, setOverrides] = useState<EventOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<string>(toIsoDate(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [instanceEdit, setInstanceEdit] = useState<{ ev: EffectiveEvent; date: string } | null>(null);

  // Load events + overrides
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [ev, ov] = await Promise.all([
        supabase.from("calendar_events").select("*").order("event_date", { ascending: true }),
        supabase.from("calendar_event_overrides").select("*"),
      ]);
      if (!mounted) return;
      if (ev.error || ov.error) {
        toast.error("שגיאה בטעינת לוח האירועים");
      } else {
        setEvents((ev.data as CalendarEvent[]) ?? []);
        setOverrides((ov.data as EventOverride[]) ?? []);
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("calendar_events_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_event_overrides" }, () => load())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Get events for a given date (one-off + recurring weekly), with per-instance overrides applied.
  const eventsForDate = (isoDate: string): EffectiveEvent[] => {
    const d = new Date(isoDate + "T00:00:00");
    const wd = d.getDay();
    const matched = events.filter(
      (e) => e.event_date === isoDate || (e.recurring_weekday !== null && e.recurring_weekday === wd),
    );
    const out: EffectiveEvent[] = [];
    for (const e of matched) {
      const ov = overrides.find((o) => o.event_id === e.id && o.override_date === isoDate);
      if (!ov) {
        out.push({ ...e, _occurrenceDate: isoDate });
        continue;
      }
      if (ov.deleted) continue;
      out.push({
        ...e,
        title: ov.title ?? e.title,
        start_time: ov.start_time ?? e.start_time,
        end_time: ov.end_time ?? e.end_time,
        notes: ov.notes ?? e.notes,
        high_priority: ov.high_priority ?? e.high_priority,
        _overrideId: ov.id,
        _isOverride: true,
        _occurrenceDate: isoDate,
      });
    }
    return out;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
            BOH Calendar
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
            📅 לוח <span className="text-neon text-glow-neon">אירועים וסחורות</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            לו״ז קבלת סחורה שבועי, אירועים מיוחדים והערות. סנכרון בזמן אמת.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="shrink-0 inline-flex items-center gap-2 h-10 px-3 rounded-md bg-neon text-primary-foreground font-bold glow-neon"
          >
            <Plus className="h-4 w-4" />
            הוסף
          </button>
        )}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setView("month")}
            className={`px-3 py-1.5 text-sm font-bold transition ${
              view === "month" ? "bg-neon text-primary-foreground" : "text-foreground hover:text-neon"
            }`}
          >
            חודש
          </button>
          <button
            onClick={() => setView("week")}
            className={`px-3 py-1.5 text-sm font-bold transition border-r border-border ${
              view === "week" ? "bg-neon text-primary-foreground" : "text-foreground hover:text-neon"
            }`}
          >
            שבוע
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">טוען…</div>
      ) : view === "month" ? (
        <MonthView
          cursor={cursor}
          setCursor={setCursor}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          eventsForDate={eventsForDate}
        />
      ) : (
        <WeekView cursor={cursor} setCursor={setCursor} eventsForDate={eventsForDate} />
      )}

      {/* Selected day details (month view) */}
      {view === "month" && (
        <DayDetails
          isoDate={selectedDate}
          events={eventsForDate(selectedDate)}
          canEdit={canEdit}
          onEdit={(ev) => {
            setEditing(ev);
            setFormOpen(true);
          }}
        />
      )}

      {/* Weekly delivery schedule strip */}
      <WeeklyDeliveries events={events} canEdit={canEdit} onEdit={(ev) => { setEditing(ev); setFormOpen(true); }} />

      {formOpen && (
        <EventForm
          existing={editing}
          defaultDate={selectedDate}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MonthView({
  cursor,
  setCursor,
  selectedDate,
  setSelectedDate,
  eventsForDate,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  selectedDate: string;
  setSelectedDate: (s: string) => void;
  eventsForDate: (iso: string) => CalendarEvent[];
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayIso = toIsoDate(new Date());

  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startWd = first.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date; iso: string; inMonth: boolean }[] = [];
    // leading
    for (let i = startWd; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      cells.push({ date: d, iso: toIsoDate(d), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      cells.push({ date: dt, iso: toIsoDate(dt), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, iso: toIsoDate(d), inMonth: false });
    }
    return cells;
  }, [year, month]);

  return (
    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="h-9 w-9 grid place-content-center rounded-md border border-border hover:text-neon hover:border-neon"
          aria-label="חודש הבא"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="font-display text-lg font-bold">
          {MONTHS_HE[month]} {year}
        </div>
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="h-9 w-9 grid place-content-center rounded-md border border-border hover:text-neon hover:border-neon"
          aria-label="חודש קודם"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-xs text-muted-foreground font-bold mb-1">
        {WEEKDAYS_HE.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((c) => {
          const dayEvents = eventsForDate(c.iso);
          const isToday = c.iso === todayIso;
          const isSelected = c.iso === selectedDate;
          const hasPriority = dayEvents.some((e) => e.high_priority);
          return (
            <button
              key={c.iso + (c.inMonth ? "" : "-o")}
              onClick={() => setSelectedDate(c.iso)}
              className={`relative aspect-square rounded-md text-right p-1 sm:p-1.5 text-xs sm:text-sm border transition ${
                isSelected
                  ? "border-neon bg-neon/15 text-neon glow-neon"
                  : isToday
                  ? "border-neon/60 text-foreground"
                  : "border-border/60 hover:border-neon/40"
              } ${c.inMonth ? "" : "opacity-30"}`}
            >
              <div className="font-bold tabular-nums">{c.date.getDate()}</div>
              {dayEvents.length > 0 && (
                <div className="absolute bottom-1 left-1 right-1 flex items-center gap-0.5 justify-start">
                  {hasPriority && (
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  )}
                  <span className="h-1.5 w-1.5 rounded-full bg-neon" />
                  {dayEvents.length > 1 && (
                    <span className="text-[9px] text-muted-foreground tabular-nums">×{dayEvents.length}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  cursor,
  setCursor,
  eventsForDate,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  eventsForDate: (iso: string) => CalendarEvent[];
}) {
  // Week starts Sunday
  const start = useMemo(() => {
    const d = new Date(cursor);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cursor]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const todayIso = toIsoDate(new Date());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            const d = new Date(start);
            d.setDate(d.getDate() + 7);
            setCursor(d);
          }}
          className="h-9 px-3 grid place-content-center rounded-md border border-border hover:text-neon hover:border-neon text-sm font-bold"
        >
          שבוע הבא
        </button>
        <div className="font-display font-bold text-sm">
          {days[0].getDate()} {MONTHS_HE[days[0].getMonth()]} – {days[6].getDate()} {MONTHS_HE[days[6].getMonth()]}
        </div>
        <button
          onClick={() => {
            const d = new Date(start);
            d.setDate(d.getDate() - 7);
            setCursor(d);
          }}
          className="h-9 px-3 grid place-content-center rounded-md border border-border hover:text-neon hover:border-neon text-sm font-bold"
        >
          שבוע קודם
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {days.map((d, i) => {
          const iso = toIsoDate(d);
          const evs = eventsForDate(iso);
          const isToday = iso === todayIso;
          return (
            <div
              key={iso}
              className={`rounded-xl border p-2.5 min-h-[110px] bg-card/60 ${
                isToday ? "border-neon glow-neon" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground tabular-nums">{d.getDate()}/{d.getMonth() + 1}</span>
                <span className={`text-xs font-bold ${isToday ? "text-neon" : "text-foreground"}`}>
                  {WEEKDAYS_HE[i]}
                </span>
              </div>
              {evs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">אין אירועים</p>
              ) : (
                <ul className="space-y-1.5">
                  {evs.map((e) => (
                    <EventChip key={e.id + iso} ev={e} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventChip({ ev }: { ev: CalendarEvent }) {
  const Icon = ev.category === "delivery" ? Truck : Sparkles;
  return (
    <li
      className={`rounded-md px-2 py-1.5 border text-[11px] leading-tight ${
        ev.high_priority
          ? "border-destructive/60 bg-destructive/10"
          : ev.category === "delivery"
          ? "border-neon/40 bg-neon/5"
          : "border-border bg-background/40"
      }`}
    >
      <div className="flex items-center gap-1 font-bold">
        {ev.high_priority && <AlertTriangle className="h-3 w-3 text-destructive" />}
        <Icon className="h-3 w-3 text-neon" />
        <span className="truncate">{ev.title}</span>
      </div>
      {(ev.start_time || ev.supplier) && (
        <div className="text-muted-foreground mt-0.5 truncate">
          {ev.start_time?.slice(0, 5)}{ev.end_time ? `–${ev.end_time.slice(0, 5)}` : ""}
          {ev.supplier ? ` · ${ev.supplier}` : ""}
        </div>
      )}
    </li>
  );
}

function DayDetails({
  isoDate,
  events,
  canEdit,
  onEdit,
}: {
  isoDate: string;
  events: CalendarEvent[];
  canEdit: boolean;
  onEdit: (ev: CalendarEvent) => void;
}) {
  const d = new Date(isoDate + "T00:00:00");
  const label = `${WEEKDAYS_HE[d.getDay()]}, ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק את האירוע?")) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) toast.error("שגיאה במחיקה");
    else toast.success("האירוע נמחק");
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card/80 backdrop-blur p-4">
      <h2 className="font-display text-lg font-bold mb-3 text-right">{label}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">אין אירועים ביום זה</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className={`rounded-xl border p-3 ${
                ev.high_priority
                  ? "border-destructive/60 bg-destructive/5"
                  : "border-border bg-background/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-bold">
                    {ev.high_priority && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {ev.category === "delivery" ? (
                      <Truck className="h-4 w-4 text-neon" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-neon" />
                    )}
                    <span>{ev.title}</span>
                    {ev.recurring_weekday !== null && (
                      <span className="text-[10px] font-bold text-neon border border-neon/40 rounded px-1.5 py-0.5">
                        שבועי
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                    {ev.start_time?.slice(0, 5) || "—"}
                    {ev.end_time ? ` – ${ev.end_time.slice(0, 5)}` : ""}
                    {ev.supplier ? ` · ${ev.supplier}` : ""}
                  </div>
                  {ev.notes && (
                    <p className="text-sm mt-2 whitespace-pre-wrap text-foreground/90">{ev.notes}</p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => onEdit(ev)}
                      className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon hover:border-neon"
                      aria-label="ערוך"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-destructive hover:border-destructive"
                      aria-label="מחק"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WeeklyDeliveries({
  events,
  canEdit,
  onEdit,
}: {
  events: CalendarEvent[];
  canEdit: boolean;
  onEdit: (ev: CalendarEvent) => void;
}) {
  const recurring = events.filter((e) => e.recurring_weekday !== null && e.category === "delivery");
  if (recurring.length === 0) return null;

  const byDay = WEEKDAYS_HE.map((_, i) => recurring.filter((e) => e.recurring_weekday === i));

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card/80 backdrop-blur p-4">
      <h2 className="font-display text-lg font-bold mb-3 text-right">
        🚚 לו״ז קבלת סחורה שבועי
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {byDay.map((list, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-2">
            <div className="text-xs font-bold text-neon mb-2 text-center">{WEEKDAYS_HE[i]}</div>
            {list.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center">—</p>
            ) : (
              <ul className="space-y-1.5">
                {list.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => canEdit && onEdit(ev)}
                      className="w-full text-right"
                    >
                      <EventChip ev={ev} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EventForm({
  existing,
  defaultDate,
  onClose,
}: {
  existing: CalendarEvent | null;
  defaultDate: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState<EventCategory>(existing?.category ?? "delivery");
  const [isRecurring, setIsRecurring] = useState(existing?.recurring_weekday !== null && existing?.recurring_weekday !== undefined);
  const [date, setDate] = useState(existing?.event_date ?? defaultDate);
  const [weekday, setWeekday] = useState<number>(existing?.recurring_weekday ?? 0);
  const [startTime, setStartTime] = useState(existing?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(existing?.end_time?.slice(0, 5) ?? "");
  const [supplier, setSupplier] = useState(existing?.supplier ?? "");
  const [highPriority, setHighPriority] = useState(existing?.high_priority ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("חובה להזין כותרת");
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      category,
      event_date: isRecurring ? null : date,
      recurring_weekday: isRecurring ? weekday : null,
      start_time: startTime || null,
      end_time: endTime || null,
      supplier: supplier.trim() || null,
      high_priority: highPriority,
      notes: notes.trim() || null,
    };

    const { error } = existing
      ? await supabase.from("calendar_events").update(payload).eq("id", existing.id)
      : await supabase.from("calendar_events").insert(payload);

    setSaving(false);
    if (error) {
      toast.error("שמירה נכשלה: " + error.message);
      return;
    }
    toast.success(existing ? "האירוע עודכן" : "האירוע נוסף");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">
            {existing ? "ערוך אירוע" : "אירוע חדש"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Field label="כותרת">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="לדוגמה: ירקות מספק X"
            dir="rtl"
            maxLength={120}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCategory("delivery")}
            className={`py-2 rounded-md border font-bold text-sm flex items-center justify-center gap-1.5 ${
              category === "delivery" ? "border-neon text-neon bg-neon/10" : "border-border text-foreground"
            }`}
          >
            <Truck className="h-4 w-4" /> סחורה
          </button>
          <button
            type="button"
            onClick={() => setCategory("event")}
            className={`py-2 rounded-md border font-bold text-sm flex items-center justify-center gap-1.5 ${
              category === "event" ? "border-neon text-neon bg-neon/10" : "border-border text-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4" /> אירוע
          </button>
        </div>

        <label className="flex items-center justify-end gap-2 text-sm cursor-pointer">
          <span>חוזר שבועי</span>
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="accent-[hsl(var(--neon))]"
          />
        </label>

        {isRecurring ? (
          <Field label="יום בשבוע">
            <select
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className="input"
            >
              {WEEKDAYS_HE.map((w, i) => (
                <option key={i} value={i}>{w}</option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="תאריך">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="משעה">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
          </Field>
          <Field label="עד שעה">
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
          </Field>
        </div>

        <Field label="ספק / איש קשר">
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="input"
            placeholder="שם הספק"
            dir="rtl"
            maxLength={120}
          />
        </Field>

        <label className="flex items-center justify-end gap-2 text-sm cursor-pointer">
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-destructive" /> דחיפות גבוהה
          </span>
          <input
            type="checkbox"
            checked={highPriority}
            onChange={(e) => setHighPriority(e.target.checked)}
            className="accent-[hsl(var(--destructive))]"
          />
        </label>

        <Field label="הערות / הוראות הכנה">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input min-h-[100px]"
            placeholder="פרטים, כמויות, אזהרות…"
            dir="rtl"
            maxLength={2000}
          />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="w-full h-11 rounded-md bg-neon text-primary-foreground font-bold glow-neon disabled:opacity-50"
        >
          {saving ? "שומר…" : existing ? "עדכן" : "הוסף"}
        </button>
      </form>

      <style>{`
        .input {
          width: 100%;
          background: hsl(var(--input));
          border: 1px solid hsl(var(--border));
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          text-align: right;
        }
        .input:focus {
          outline: none;
          border-color: hsl(var(--neon, var(--primary)));
          box-shadow: 0 0 0 2px hsl(var(--neon, var(--primary)) / 0.4);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-muted-foreground mb-1 text-right">{label}</span>
      {children}
    </label>
  );
}
