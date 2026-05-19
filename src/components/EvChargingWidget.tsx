import { useEffect, useMemo, useRef, useState } from "react";
import { BatteryCharging, Plug, Car, Bell, AlertTriangle, X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playBeep, playPop } from "@/lib/audio";
import { notify } from "@/lib/notifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type EvStatus = "ממתין" | "בטעינה" | "בשימוש";

interface EvVehicle {
  id: string;
  name: string;
  battery_pct: number;
  status: EvStatus;
  swap_at: string | null;
  sort_order: number;
  issue_note: string | null;
}

const STATUS_OPTIONS: EvStatus[] = ["ממתין", "בטעינה", "בשימוש"];

function statusClasses(s: EvStatus) {
  if (s === "בטעינה") return "bg-amber-brand/15 text-amber-brand border-amber-brand/40";
  if (s === "בשימוש") return "bg-jungle/15 text-jungle border-jungle/40";
  return "bg-foreground/5 text-foreground/70 border-border";
}

function fmtCountdown(targetIso: string | null): { text: string; expired: boolean } {
  if (!targetIso) return { text: "—", expired: false };
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return { text: "עכשיו!", expired: true };
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return { text: `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, expired: false };
  return { text: `${m}:${String(s).padStart(2, "0")}`, expired: false };
}

export function EvChargingWidget() {
  const [vehicles, setVehicles] = useState<EvVehicle[]>([]);
  const [, setTick] = useState(0);
  const alarmedIdsRef = useRef<Set<string>>(new Set());

  // Custom-time dialog state
  const [timeDialogId, setTimeDialogId] = useState<string | null>(null);
  const [hoursInput, setHoursInput] = useState("2");
  const [minutesInput, setMinutesInput] = useState("0");

  // Issue dialog state
  const [issueDialogId, setIssueDialogId] = useState<string | null>(null);
  const [issueDraft, setIssueDraft] = useState("");

  // Tick every second for countdowns
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Initial load + realtime
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("ev_vehicles")
        .select("id,name,battery_pct,status,swap_at,sort_order,issue_note")
        .order("sort_order", { ascending: true });
      if (mounted && data) setVehicles(data as EvVehicle[]);
    };
    void load();
    const ch = supabase
      .channel("ev-vehicles-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ev_vehicles" },
        () => void load(),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  // Track which vehicles were already expired when this component mounted —
  // we don't want to beep again every time the user re-enters the page.
  const initialExpiredSeededRef = useRef(false);
  useEffect(() => {
    if (initialExpiredSeededRef.current || vehicles.length === 0) return;
    initialExpiredSeededRef.current = true;
    for (const v of vehicles) {
      if (v.swap_at && new Date(v.swap_at).getTime() <= Date.now()) {
        alarmedIdsRef.current.add(v.id);
      }
    }
  }, [vehicles]);

  // Alarm only when a timer transitions to expired during this session
  useEffect(() => {
    if (!initialExpiredSeededRef.current) return;
    for (const v of vehicles) {
      if (!v.swap_at) continue;
      const expired = new Date(v.swap_at).getTime() <= Date.now();
      if (expired && v.status === "בטעינה" && !alarmedIdsRef.current.has(v.id)) {
        alarmedIdsRef.current.add(v.id);
        playBeep();
        setTimeout(playBeep, 350);
        void notify("🔋 רכב מוכן להחלפה", {
          body: `${v.name} סיים טעינה — צריך להחליף עכשיו`,
          tag: `ev-swap-${v.id}`,
        });
      }
      if (!expired) alarmedIdsRef.current.delete(v.id);
    }
  });

  const anyExpired = useMemo(
    () =>
      vehicles.some(
        (v) => v.status === "בטעינה" && v.swap_at && new Date(v.swap_at).getTime() <= Date.now(),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicles, Math.floor(Date.now() / 1000)],
  );

  const update = async (id: string, patch: Partial<EvVehicle>) => {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    playPop();
    await supabase.from("ev_vehicles").update(patch).eq("id", id);
  };

  const startCharge = (id: string, minutes: number) => {
    const swap_at = new Date(Date.now() + minutes * 60_000).toISOString();
    void update(id, { status: "בטעינה", swap_at });
  };

  const openCustomCharge = (id: string) => {
    setHoursInput("2");
    setMinutesInput("0");
    setTimeDialogId(id);
  };

  const confirmCustomCharge = () => {
    if (!timeDialogId) return;
    const h = parseFloat(hoursInput) || 0;
    const m = parseFloat(minutesInput) || 0;
    const total = Math.round(h * 60 + m);
    if (total <= 0) return;
    startCharge(timeDialogId, total);
    setTimeDialogId(null);
  };

  const openIssueDialog = (id: string, current: string | null) => {
    setIssueDraft(current ?? "");
    setIssueDialogId(id);
  };

  const saveIssue = () => {
    if (!issueDialogId) return;
    const note = issueDraft.trim();
    void update(issueDialogId, { issue_note: note.length ? note : null });
    setIssueDialogId(null);
  };

  const clearIssue = (id: string) => {
    void update(id, { issue_note: null });
  };

  return (
    <section
      className={`rounded-2xl border-2 p-4 bg-card/80 backdrop-blur transition ${
        anyExpired ? "border-neon glow-neon animate-pulse" : "border-jungle/30"
      }`}
    >
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BatteryCharging className="h-5 w-5 text-neon" />
          <h2 className="font-display text-lg font-bold">⚡ ניהול טעינת רכבים</h2>
        </div>
        {anyExpired && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-neon">
            <Bell className="h-4 w-4" />
            החלף עכשיו!
          </span>
        )}
      </header>

      {vehicles.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6 border border-dashed border-border rounded-md">
          טוען רכבים…
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicles.map((v) => {
            const cd = fmtCountdown(v.swap_at);
            const isExpired = cd.expired && v.status === "בטעינה";
            const isCharging = v.status === "בטעינה" && !isExpired;
            const hasIssue = !!v.issue_note;
            return (
              <li
                key={v.id}
                className={`rounded-xl border bg-background/40 p-3 flex flex-col gap-2 transition ${
                  isExpired
                    ? "border-neon glow-neon"
                    : isCharging
                    ? "ev-charging"
                    : hasIssue
                    ? "border-destructive/60"
                    : "border-border"
                }`}
              >
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Car className="h-4 w-4 text-foreground/70 shrink-0" />
                    <span className="font-bold text-sm truncate">{v.name}</span>
                    {isCharging && (
                      <Zap
                        className="h-4 w-4 text-amber-brand shrink-0 ev-bolt-pulse"
                        aria-label="בטעינה"
                      />
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusClasses(
                      v.status,
                    )}`}
                  >
                    {isCharging ? "⚡ בטעינה" : v.status}
                  </span>
                </div>

                {hasIssue && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-[11px] text-destructive font-medium flex-1 break-words">
                      {v.issue_note}
                    </p>
                    <button
                      type="button"
                      onClick={() => clearIssue(v.id)}
                      className="text-destructive/70 hover:text-destructive shrink-0"
                      aria-label="סמן כתוקן"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    אחוז סוללה נוכחי
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={v.battery_pct}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const n = raw === "" ? 0 : Math.max(0, Math.min(100, Number(raw)));
                        setVehicles((prev) =>
                          prev.map((x) => (x.id === v.id ? { ...x, battery_pct: n } : x)),
                        );
                      }}
                      onBlur={(e) => {
                        const n = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        void update(v.id, { battery_pct: n });
                      }}
                      className="w-16 bg-input border border-border rounded px-2 py-1 text-center font-display text-lg font-black text-neon tabular-nums focus:outline-none focus:ring-2 focus:ring-neon"
                      aria-label={`סוללה ${v.name}`}
                    />
                    <span className="font-display text-lg font-black text-neon">%</span>
                  </div>
                </div>

                <div className="text-xs text-foreground/80 flex items-center justify-between">
                  <span>זמן להחלפה:</span>
                  <span className={`font-bold tabular-nums ${isExpired ? "text-neon" : ""}`}>
                    {cd.text}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <select
                    value={v.status}
                    onChange={(e) => void update(v.id, { status: e.target.value as EvStatus })}
                    className="text-[11px] bg-input border border-border rounded px-1.5 py-1"
                    aria-label="סטטוס"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => startCharge(v.id, 120)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-neon/40 text-neon hover:bg-neon/10"
                  >
                    <Plug className="h-3 w-3" /> 2 ש׳
                  </button>
                  <button
                    type="button"
                    onClick={() => startCharge(v.id, 180)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-neon/40 text-neon hover:bg-neon/10"
                  >
                    <Plug className="h-3 w-3" /> 3 ש׳
                  </button>
                  <button
                    type="button"
                    onClick={() => startCharge(v.id, 240)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-neon/40 text-neon hover:bg-neon/10"
                  >
                    <Plug className="h-3 w-3" /> 4 ש׳
                  </button>
                  <button
                    type="button"
                    onClick={() => openCustomCharge(v.id)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-neon/60 text-neon font-bold hover:bg-neon/10"
                  >
                    <Plug className="h-3 w-3" /> מותאם
                  </button>
                  <button
                    type="button"
                    onClick={() => openIssueDialog(v.id, v.issue_note)}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border font-bold transition ${
                      hasIssue
                        ? "border-destructive bg-destructive/15 text-destructive"
                        : "border-amber-brand/50 text-amber-brand hover:bg-amber-brand/10"
                    }`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {hasIssue ? "ערוך תקלה" : "דווח תקלה"}
                  </button>
                  {(v.status === "בטעינה" || v.swap_at) && (
                    <button
                      type="button"
                      onClick={() => void update(v.id, { status: "ממתין", swap_at: null })}
                      className="text-[11px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-destructive"
                    >
                      נתק
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Custom charge time dialog */}
      <Dialog open={!!timeDialogId} onOpenChange={(o) => !o && setTimeDialogId(null)}>
        <DialogContent dir="rtl" className="sm:max-w-sm border-neon/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Plug className="h-5 w-5 text-neon" />
              זמן טעינה מותאם
            </DialogTitle>
            <DialogDescription>בחר כמה זמן הרכב יישאר בטעינה לפני התראת החלפה.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-hours" className="text-xs">
                שעות
              </Label>
              <Input
                id="ev-hours"
                type="number"
                min={0}
                max={24}
                step={1}
                inputMode="numeric"
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                className="text-center text-lg font-display"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-minutes" className="text-xs">
                דקות
              </Label>
              <Input
                id="ev-minutes"
                type="number"
                min={0}
                max={59}
                step={5}
                inputMode="numeric"
                value={minutesInput}
                onChange={(e) => setMinutesInput(e.target.value)}
                className="text-center text-lg font-display"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { l: "1.5 ש׳", h: "1", m: "30" },
              { l: "2.5 ש׳", h: "2", m: "30" },
              { l: "5 ש׳", h: "5", m: "0" },
              { l: "6 ש׳", h: "6", m: "0" },
              { l: "8 ש׳", h: "8", m: "0" },
            ].map((p) => (
              <button
                key={p.l}
                type="button"
                onClick={() => {
                  setHoursInput(p.h);
                  setMinutesInput(p.m);
                }}
                className="text-[11px] px-2 py-1 rounded-full border border-border hover:border-neon/60 hover:text-neon transition"
              >
                {p.l}
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setTimeDialogId(null)}>
              ביטול
            </Button>
            <Button
              onClick={confirmCustomCharge}
              className="bg-neon text-background hover:bg-neon/90 font-bold"
            >
              התחל טעינה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue dialog */}
      <Dialog open={!!issueDialogId} onOpenChange={(o) => !o && setIssueDialogId(null)}>
        <DialogContent dir="rtl" className="sm:max-w-sm border-destructive/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-destructive">
              <AlertTriangle className="h-5 w-5" />
              דיווח על תקלה ברכב
            </DialogTitle>
            <DialogDescription>
              תאר בקצרה את הבעיה (למשל: חסר אוויר בגלגל קדמי שמאלי, נורית מנוע דולקת וכו׳).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={issueDraft}
            onChange={(e) => setIssueDraft(e.target.value)}
            placeholder="תיאור התקלה…"
            rows={4}
            maxLength={300}
            className="resize-none"
          />
          <div className="text-[10px] text-muted-foreground text-left">
            {issueDraft.length}/300
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {issueDialogId &&
              vehicles.find((v) => v.id === issueDialogId)?.issue_note && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (issueDialogId) clearIssue(issueDialogId);
                    setIssueDialogId(null);
                  }}
                  className="mr-auto text-muted-foreground"
                >
                  סמן כתוקן
                </Button>
              )}
            <Button variant="outline" onClick={() => setIssueDialogId(null)}>
              ביטול
            </Button>
            <Button
              onClick={saveIssue}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
            >
              שמור דיווח
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
