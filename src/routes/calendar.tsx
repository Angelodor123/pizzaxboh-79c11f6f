import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, X, Trash2, Pencil, AlertTriangle, Truck, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireCurrentBranchId } from "@/lib/current-branch";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/confirm";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

// Event type catalog — color-coded tags for the calendar (overlays for the existing
// "delivery" | "event" base category). Each entry maps to a Tailwind dot color.
export const EVENT_TYPES = [
  { id: "maintenance",       label: "תחזוקה",          color: "#ef4444" }, // red
  { id: "inventory_delivery", label: "קבלת סחורה",      color: "#f97316" }, // orange
  { id: "team_meeting",      label: "פגישת צוות",      color: "#3b82f6" }, // blue
  { id: "special_event",     label: "אירוע מיוחד",     color: "#ec4899" }, // pink
] as const;
type EventTypeId = (typeof EVENT_TYPES)[number]["id"];
const eventTypeColor = (id?: string | null) =>
  EVENT_TYPES.find((t) => t.id === id)?.color ?? null;


type EventCategory = "delivery" | "event";

interface CalendarEvent {
  id: string;
  title: string;
  category: EventCategory;
  event_type?: string | null;
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
type EffectiveEvent = CalendarEvent & { _overrideId?: string; _isOverride?: boolean; _occurrenceDate?: string; _missingInvoice?: boolean };

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
  const [invoiceKeys, setInvoiceKeys] = useState<Set<string>>(new Set());
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
      const [ev, ov, inv] = await Promise.all([
        supabase.from("calendar_events").select("*").order("event_date", { ascending: true }),
        supabase.from("calendar_event_overrides").select("*"),
        supabase.from("invoices").select("supplier_id, document_date").eq("is_archived", false),
      ]);
      if (!mounted) return;
      if (ev.error || ov.error) {
        toast.error("שגיאה בטעינת לוח האירועים");
      } else {
        setEvents((ev.data as CalendarEvent[]) ?? []);
        setOverrides((ov.data as EventOverride[]) ?? []);
      }
      if (!inv.error && inv.data) {
        const keys = new Set<string>();
        for (const r of inv.data as Array<{ supplier_id: string | null; document_date: string }>) {
          if (r.supplier_id) keys.add(`${r.supplier_id}|${r.document_date}`);
        }
        setInvoiceKeys(keys);
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("calendar_events_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_event_overrides" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => load())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Get events for a given date (one-off + recurring weekly), with per-instance overrides applied.
  const todayIsoMemo = toIsoDate(new Date());
  const annotateMissing = (e: EffectiveEvent): EffectiveEvent => {
    if (
      e.category === "delivery" &&
      e.supplier_id &&
      e._occurrenceDate &&
      e._occurrenceDate <= todayIsoMemo &&
      !invoiceKeys.has(`${e.supplier_id}|${e._occurrenceDate}`)
    ) {
      return { ...e, _missingInvoice: true };
    }
    return e;
  };
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
        out.push(annotateMissing({ ...e, _occurrenceDate: isoDate }));
        continue;
      }
      if (ov.deleted) continue;
      out.push(annotateMissing({
        ...e,
        title: ov.title ?? e.title,
        start_time: ov.start_time ?? e.start_time,
        end_time: ov.end_time ?? e.end_time,
        notes: ov.notes ?? e.notes,
        high_priority: ov.high_priority ?? e.high_priority,
        _overrideId: ov.id,
        _isOverride: true,
        _occurrenceDate: isoDate,
      }));
    }
    return out;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-neon font-bold">
          BOH Calendar
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1 leading-tight">
          📅 לוח <span className="text-neon text-glow-neon">אירועים וסחורות</span>
        </h1>
        <p className="hidden sm:block text-muted-foreground mt-2 text-sm">
          לו״ז קבלת סחורה שבועי, אירועים מיוחדים והערות. סנכרון בזמן אמת.
        </p>
        {canEdit && (
          <div className="mt-3 flex items-center justify-center">
            <button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-neon text-primary-foreground font-bold glow-neon active:scale-95 transition"
            >
              <Plus className="h-4 w-4" />
              הוסף אירוע
            </button>
          </div>
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
          onInstanceEdit={(ev, date) => setInstanceEdit({ ev, date })}
        />
      )}

      {/* Weekly delivery schedule strip */}
      <WeeklyDeliveries
        events={events}
        canEdit={canEdit}
        onInstanceEdit={(ev, date) => setInstanceEdit({ ev, date })}
      />

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

      {instanceEdit && (
        <InstanceOverrideForm
          ev={instanceEdit.ev}
          date={instanceEdit.date}
          onClose={() => setInstanceEdit(null)}
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

      {/* Mobile: compact list */}
      <ul className="sm:hidden divide-y divide-border rounded-xl border border-border bg-card/60 overflow-hidden">
        {days.map((d, i) => {
          const iso = toIsoDate(d);
          const evs = eventsForDate(iso);
          const isToday = iso === todayIso;
          return (
            <li key={iso} className={isToday ? "bg-neon/5" : ""}>
              <details className="group">
                <summary className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer list-none active:bg-muted/40">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm font-bold ${isToday ? "text-neon" : "text-foreground"}`}>
                      {WEEKDAYS_HE[i]}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {d.getDate()}/{d.getMonth() + 1}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {evs.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/70">—</span>
                    ) : (
                      <span className="text-[11px] font-bold text-neon tabular-nums">
                        {evs.length} {evs.length === 1 ? "אירוע" : "אירועים"}
                      </span>
                    )}
                    <ChevronLeft className="h-4 w-4 text-muted-foreground transition group-open:-rotate-90" />
                  </span>
                </summary>
                {evs.length > 0 && (
                  <ul className="px-3 pb-3 space-y-1.5">
                    {evs.map((e) => (
                      <EventChip key={e.id + iso} ev={e} />
                    ))}
                  </ul>
                )}
              </details>
            </li>
          );
        })}
      </ul>

      {/* Desktop: 7-column grid */}
      <div className="hidden sm:grid grid-cols-7 gap-2">
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

function EventChip({ ev }: { ev: EffectiveEvent }) {
  const Icon = ev.category === "delivery" ? Truck : Sparkles;
  const isAuto = !!ev.is_auto;
  const missing = !!ev._missingInvoice;
  return (
    <li
      className={`rounded-md px-2 py-1.5 border text-[11px] leading-tight ${
        missing
          ? "border-destructive bg-destructive/15 animate-pulse"
          : ev.high_priority
          ? "border-destructive/60 bg-destructive/10"
          : isAuto
          ? "bg-success/5"
          : ev.category === "delivery"
          ? "border-neon/40 bg-neon/5"
          : "border-border bg-background/40"
      } ${isAuto && !missing ? "border-success/70" : ""}`}
      style={isAuto && !missing ? { borderInlineStartWidth: 3, borderInlineStartColor: "var(--success)" } : missing ? { borderInlineStartWidth: 3, borderInlineStartColor: "var(--destructive)" } : undefined}
    >
      <div className="flex items-center gap-1 font-bold">
        {(missing || ev.high_priority) && <AlertTriangle className={`h-3 w-3 ${missing ? "text-destructive" : "text-destructive"}`} />}
        <Icon className={`h-3 w-3 ${missing ? "text-destructive" : isAuto ? "text-success" : "text-neon"}`} />
        <span className="truncate">{ev.title}</span>
        {missing && (
          <span className="text-[9px] text-destructive border border-destructive/60 rounded px-1 shrink-0">⚠️ חסרה חשבונית</span>
        )}
        {ev._isOverride && (
          <span className="text-[9px] text-amber-brand border border-amber-brand/60 rounded px-1">שונה</span>
        )}
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
  onInstanceEdit,
}: {
  isoDate: string;
  events: EffectiveEvent[];
  canEdit: boolean;
  onEdit: (ev: CalendarEvent) => void;
  onInstanceEdit: (ev: EffectiveEvent, date: string) => void;
}) {
  const d = new Date(isoDate + "T00:00:00");
  const label = `${WEEKDAYS_HE[d.getDay()]}, ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;

  const handleDelete = async (id: string) => {
    if (!confirm("למחוק את האירוע?")) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) toast.error("שגיאה במחיקה");
    else toast.success("האירוע נמחק");
  };

  const cancelInstance = async (ev: EffectiveEvent, date: string) => {
    if (!confirm("לבטל את המופע ליום זה בלבד? פרופיל הספק לא ישתנה.")) return;
    const payload = { event_id: ev.id, override_date: date, deleted: true };
    const { error } = await supabase
      .from("calendar_event_overrides")
      .upsert(payload, { onConflict: "event_id,override_date" });
    if (error) toast.error("שגיאה בביטול המופע");
    else toast.success("המופע בוטל ליום זה בלבד");
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card/80 backdrop-blur p-4">
      <h2 className="font-display text-lg font-bold mb-3 text-right">{label}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">אין אירועים ביום זה</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => {
            const isRecurring = ev.recurring_weekday !== null;
            const isAuto = !!ev.is_auto;
            return (
              <li
                key={ev.id}
                className={`rounded-xl border p-3 ${
                  ev.high_priority
                    ? "border-destructive/60 bg-destructive/5"
                    : isAuto
                    ? "border-success/70 bg-success/5"
                    : "border-border bg-background/40"
                }`}
                style={isAuto ? { borderInlineStartWidth: 4, borderInlineStartColor: "var(--success)" } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-bold flex-wrap">
                      {ev.high_priority && <AlertTriangle className="h-4 w-4 text-destructive" />}
                      {ev.category === "delivery" ? (
                        <Truck className={`h-4 w-4 ${isAuto ? "text-success" : "text-neon"}`} />
                      ) : (
                        <Sparkles className="h-4 w-4 text-neon" />
                      )}
                      <span>{ev.title}</span>
                      {isRecurring && (
                        <span className="text-[10px] font-bold text-neon border border-neon/40 rounded px-1.5 py-0.5">
                          שבועי
                        </span>
                      )}
                      {isAuto && (
                        <span className="text-[10px] font-bold text-success border border-success/60 rounded px-1.5 py-0.5">
                          ספק
                        </span>
                      )}
                      {ev._isOverride && (
                        <span className="text-[10px] font-bold text-amber-brand border border-amber-brand/60 rounded px-1.5 py-0.5">
                          שונה ליום זה
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
                      {isRecurring ? (
                        <>
                          <button
                            onClick={() => onInstanceEdit(ev, isoDate)}
                            className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon hover:border-neon"
                            aria-label="ערוך מופע יחיד"
                            title="ערוך מופע ליום זה בלבד"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => cancelInstance(ev, isoDate)}
                            className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-destructive hover:border-destructive"
                            aria-label="בטל מופע יחיד"
                            title="בטל מופע ליום זה בלבד"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function WeeklyDeliveries({
  events,
  canEdit,
  onInstanceEdit,
}: {
  events: CalendarEvent[];
  canEdit: boolean;
  onInstanceEdit: (ev: EffectiveEvent, date: string) => void;
}) {
  const recurring = events.filter((e) => e.recurring_weekday !== null && e.category === "delivery");
  if (recurring.length === 0) return null;

  // For the "next occurrence" of each weekday from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDateForWeekday = (wd: number) => {
    const d = new Date(today);
    const diff = (wd - today.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    return toIsoDate(d);
  };

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
                      onClick={() => canEdit && onInstanceEdit(ev as EffectiveEvent, nextDateForWeekday(i))}
                      className="w-full text-right"
                    >
                      <EventChip ev={ev as EffectiveEvent} />
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

function InstanceOverrideForm({
  ev,
  date,
  onClose,
}: {
  ev: EffectiveEvent;
  date: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(ev.title);
  const [startTime, setStartTime] = useState(ev.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(ev.end_time?.slice(0, 5) ?? "");
  const [highPriority, setHighPriority] = useState(!!ev.high_priority);
  const [notes, setNotes] = useState(ev.notes ?? "");
  const [saving, setSaving] = useState(false);

  const d = new Date(date + "T00:00:00");
  const label = `${WEEKDAYS_HE[d.getDay()]}, ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      event_id: ev.id,
      override_date: date,
      deleted: false,
      title: title.trim().slice(0, 200) || null,
      start_time: startTime || null,
      end_time: endTime || null,
      high_priority: highPriority,
      notes: notes.trim().slice(0, 2000) || null,
    };
    const { error } = await supabase
      .from("calendar_event_overrides")
      .upsert(payload, { onConflict: "event_id,override_date" });
    setSaving(false);
    if (error) {
      toast.error("שמירה נכשלה: " + error.message);
      return;
    }
    toast.success("המופע עודכן ליום זה בלבד");
    onClose();
  };

  const clearOverride = async () => {
    if (!ev._overrideId) {
      onClose();
      return;
    }
    if (!confirm("לאפס את העריכה ולחזור לערכי המאסטר?")) return;
    const { error } = await supabase.from("calendar_event_overrides").delete().eq("id", ev._overrideId);
    if (error) toast.error("שגיאה");
    else {
      toast.success("העריכה אופסה");
      onClose();
    }
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
        className="w-full max-w-md bg-card border border-success/60 rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        style={{ borderInlineStartWidth: 4, borderInlineStartColor: "var(--success)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-bold">ערוך מופע ליום זה</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{label} · {ev.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 grid place-content-center rounded-md border border-border hover:text-neon"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] text-amber-brand bg-amber-brand/15 border border-amber-brand/60 rounded p-2">
          השינוי כאן יחול רק על {label}. פרופיל הספק / המאסטר לא ישתנה.
        </p>

        <Field label="כותרת">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" maxLength={200} dir="rtl" />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="משעה">
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" />
          </Field>
          <Field label="עד שעה">
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input" />
          </Field>
        </div>

        <label className="flex items-center justify-end gap-2 text-sm cursor-pointer">
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-destructive" /> דחיפות גבוהה
          </span>
          <input
            type="checkbox"
            checked={highPriority}
            onChange={(e) => setHighPriority(e.target.checked)}
            className="accent-[var(--destructive)]"
          />
        </label>

        <Field label="הערה ליום זה (לדוגמה: עיכוב באספקה)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input min-h-[80px]"
            maxLength={2000}
            dir="rtl"
          />
        </Field>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 h-11 rounded-md bg-neon text-primary-foreground font-bold glow-neon disabled:opacity-50"
          >
            {saving ? "שומר…" : "שמור ליום זה"}
          </button>
          {ev._overrideId && (
            <button
              type="button"
              onClick={clearOverride}
              className="h-11 px-3 rounded-md border border-border text-sm font-bold hover:text-destructive hover:border-destructive"
            >
              אפס
            </button>
          )}
        </div>
      </form>
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
    const basePayload = {
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

    let error;
    if (existing) {
      ({ error } = await supabase.from("calendar_events").update(basePayload).eq("id", existing.id));
    } else {
      const branchId = await requireCurrentBranchId();
      ({ error } = await supabase.from("calendar_events").insert({ ...basePayload, branch_id: branchId }));
    }

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
            className="accent-[var(--neon)]"
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
            className="accent-[var(--destructive)]"
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
          min-height: 2.5rem;
          background: var(--background);
          border: 1.5px solid var(--border);
          border-radius: 0.5rem;
          padding: 0.55rem 0.85rem;
          font-size: 0.95rem;
          color: var(--foreground);
          text-align: right;
          transition: border-color .15s, box-shadow .15s, background .15s;
        }
        .input::placeholder { color: color-mix(in oklab, var(--muted-foreground) 70%, transparent); }
        .input:hover { border-color: color-mix(in oklab, var(--neon) 50%, transparent); }
        .input:focus {
          outline: none;
          background: var(--card);
          border-color: var(--neon);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--neon) 25%, transparent);
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
