import { useEffect, useMemo, useRef, useState } from "react";
import { BatteryCharging, Plug, Car, Bell, AlertTriangle, X, Zap, Pencil } from "lucide-react";
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
  updated_at: string;
}

const STATUS_OPTIONS: EvStatus[] = ["ממתין", "בטעינה", "בשימוש"];

function statusClasses(s: EvStatus) {
  if (s === "בטעינה") return "bg-amber-brand/15 text-amber-brand border-amber-brand/40";
  if (s === "בשימוש") return "bg-jungle/15 text-jungle border-jungle/40";
  return "bg-foreground/5 text-foreground/70 border-border";
}

function fmtTargetClock(targetIso: string | null): { text: string; expired: boolean } {
  if (!targetIso) return { text: "—", expired: false };
  const target = new Date(targetIso);
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return { text: "עכשיו!", expired: true };
  const text = target.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { text, expired: false };
}

export function EvChargingWidget() {
  const [vehicles, setVehicles] = useState<EvVehicle[]>([]);
  const [, setTick] = useState(0);
  const alarmedIdsRef = useRef<Set<string>>(new Set());
  const [batteryDraft, setBatteryDraft] = useState<Record<string, string>>({});

  // Custom-time dialog state
  const [timeDialogId, setTimeDialogId] = useState<string | null>(null);
  const [hoursInput, setHoursInput] = useState("2");
  const [minutesInput, setMinutesInput] = useState("0");

  // Issue dialog state
  const [issueDialogId, setIssueDialogId] = useState<string | null>(null);
  const [issueDraft, setIssueDraft] = useState("");

  // Tick every 30 seconds (slow) — only to detect expiration for alarm/badge.
  // The displayed time is a static target clock, not a live countdown.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Initial load + realtime
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("ev_vehicles")
        .select("id,name,battery_pct,status,swap_at,sort_order,issue_note,updated_at")
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
    const nowIso = new Date().toISOString();
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch, updated_at: nowIso } : v)));
    playPop();
    await supabase.from("ev_vehicles").update({ ...patch, updated_at: nowIso }).eq("id", id);
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
        anyExpired ? "border-neon glow-neon" : "border-jungle/30"
      }`}
    >
      <header className="mb-4 text-center">
        <div className="inline-flex items-center justify-center gap-2">
          <BatteryCharging className="h-5 w-5 text-neon" aria-hidden />
          <h2 className="font-display text-lg font-bold">ניהול טעינת רכבים</h2>
        </div>
        {anyExpired && (
          <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-neon">
            <Bell className="h-4 w-4" />
            יש רכב להחלפה!
          </div>
        )}
      </header>

      {vehicles.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6 border border-dashed border-border rounded-md">
          טוען רכבים…
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicles.map((v) => {
            const cd = fmtTargetClock(v.swap_at);
            const isExpired = cd.expired && v.status === "בטעינה";
            const isCharging = v.status === "בטעינה" && !isExpired;
            const hasIssue = !!v.issue_note;
            const battery = batteryDraft[v.id] ?? String(v.battery_pct);
            const batteryNum = Number(battery) || 0;
            const batteryColor =
              batteryNum >= 70
                ? "text-success"
                : batteryNum >= 30
                  ? "text-amber-brand"
                  : "text-destructive";
            return (
              <li
                key={v.id}
                className={`rounded-xl border bg-background/40 overflow-hidden flex flex-col transition ${
                  isExpired
                    ? "border-neon glow-neon"
                    : isCharging
                      ? "ev-charging"
                      : hasIssue
                        ? "border-destructive/60"
                        : "border-border"
                }`}
              >
                {/* Header: car name centered, status pill below */}
                <div className="relative px-3 pt-3 pb-2 text-center border-b border-border/40">
                  <div className="inline-flex items-center gap-1.5 max-w-full">
                    <Car className="h-4 w-4 text-foreground/70 shrink-0" aria-hidden />
                    <span className="font-bold text-sm truncate">{v.name}</span>
                    {isCharging && (
                      <Zap
                        className="h-4 w-4 text-amber-brand shrink-0 ev-bolt-pulse"
                        aria-label="בטעינה"
                      />
                    )}
                  </div>
                  <div className="mt-1.5">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusClasses(
                        v.status,
                      )}`}
                    >
                      {isCharging ? "⚡ בטעינה" : v.status}
                    </span>
                  </div>
                </div>

                {hasIssue && (
                  <div className="mx-3 mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-[11px] text-destructive font-medium flex-1 break-words text-right">
                      {v.issue_note}
                    </p>
                    <button
                      type="button"
                      onClick={() => clearIssue(v.id)}
                      className="text-destructive/70 hover:text-destructive active:scale-95 shrink-0"
                      aria-label="סמן כתוקן"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Battery big display — clickable to edit */}
                <label
                  htmlFor={`battery-${v.id}`}
                  className="mx-3 mt-3 cursor-pointer hover:bg-zinc-800/50 rounded-lg p-2 transition-all active:scale-95 block"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="flex items-baseline gap-0.5 font-display tabular-nums" dir="ltr">
                      <input
                        id={`battery-${v.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        value={battery}
                        onFocus={(e) => {
                          setBatteryDraft((d) => ({ ...d, [v.id]: String(v.battery_pct) }));
                          e.currentTarget.select();
                        }}
                        onChange={(e) => {
                          setBatteryDraft((d) => ({ ...d, [v.id]: e.target.value }));
                        }}
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          setBatteryDraft((d) => {
                            const { [v.id]: _, ...rest } = d;
                            return rest;
                          });
                          if (raw === "") return;
                          const n = Math.max(0, Math.min(100, Number(raw) || 0));
                          setVehicles((prev) =>
                            prev.map((x) => (x.id === v.id ? { ...x, battery_pct: n } : x)),
                          );
                          void update(v.id, { battery_pct: n });
                        }}
                        className={`w-[3.2ch] bg-transparent border-0 p-0 text-center text-3xl font-black cursor-pointer ${batteryColor} focus:outline-none focus:ring-0`}
                        aria-label={`אחוז סוללה ${v.name}`}
                      />
                      <span className={`text-xl font-black ${batteryColor}`}>%</span>
                    </div>
                    <Pencil className={`h-3.5 w-3.5 opacity-70 ${batteryColor}`} aria-hidden />
                  </div>
                  <div className="text-center text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                    סוללה נוכחית (לחץ לעדכון)
                  </div>
                  {v.updated_at && (
                    <div className="text-center text-[10px] text-zinc-600 mt-1" dir="rtl">
                      עודכן לאחרונה:{" "}
                      <span dir="ltr">
                        {new Date(v.updated_at).toLocaleTimeString("he-IL", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </span>
                    </div>
                  )}
                </label>


                {/* Countdown */}
                <div className="px-3 mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">זמן להחלפה</span>
                  <span
                    className={`font-bold tabular-nums ${isExpired ? "text-neon" : "text-foreground/90"}`}
                    dir="ltr"
                  >
                    {cd.text}
                  </span>
                </div>

                {/* Action grid: charge presets in a row */}
                <div className="px-3 pt-3 grid grid-cols-4 gap-1.5">
                  {[
                    { label: "2ש׳", mins: 120 },
                    { label: "3ש׳", mins: 180 },
                    { label: "4ש׳", mins: 240 },
                  ].map((p) => (
                    <button
                      key={p.mins}
                      type="button"
                      onClick={() => startCharge(v.id, p.mins)}
                      aria-label={`התחל טעינה ${p.label}`}
                      className="inline-flex items-center justify-center gap-1 text-[11px] px-1 py-1.5 rounded-md border border-neon/40 text-neon hover:bg-neon/10 active:scale-95 transition min-h-9"
                    >
                      <Plug className="h-3 w-3" /> {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => openCustomCharge(v.id)}
                    aria-label="זמן טעינה מותאם"
                    className="inline-flex items-center justify-center gap-1 text-[11px] px-1 py-1.5 rounded-md border border-neon/70 bg-neon/10 text-neon font-bold hover:bg-neon/20 active:scale-95 transition min-h-9"
                  >
                    מותאם
                  </button>
                </div>

                {/* Secondary row: status, issue, disconnect */}
                <div className="px-3 py-3 mt-1.5 grid grid-cols-[1fr_auto_auto] gap-1.5 items-center border-t border-border/40">
                  <select
                    value={v.status}
                    onChange={(e) => void update(v.id, { status: e.target.value as EvStatus })}
                    className="text-[11px] bg-input border border-border rounded-md px-2 py-1.5 min-h-9 focus:outline-none focus:ring-2 focus:ring-neon/40"
                    aria-label={`סטטוס ${v.name}`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openIssueDialog(v.id, v.issue_note)}
                    aria-label={hasIssue ? "ערוך תקלה" : "דווח תקלה"}
                    title={hasIssue ? "ערוך תקלה" : "דווח תקלה"}
                    className={`inline-flex items-center justify-center p-2 rounded-md border transition active:scale-95 min-h-9 min-w-9 ${
                      hasIssue
                        ? "border-destructive bg-destructive/15 text-destructive"
                        : "border-amber-brand/50 text-amber-brand hover:bg-amber-brand/10"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </button>
                  {(v.status === "בטעינה" || v.swap_at) ? (
                    <button
                      type="button"
                      onClick={() => void update(v.id, { status: "ממתין", swap_at: null })}
                      aria-label="נתק טעינה"
                      title="נתק"
                      className="inline-flex items-center justify-center p-2 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/60 active:scale-95 transition min-h-9 min-w-9"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="w-9" aria-hidden />
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
