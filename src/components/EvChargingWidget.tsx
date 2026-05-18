import { useEffect, useMemo, useRef, useState } from "react";
import { BatteryCharging, Plug, Car, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playBeep, playPop } from "@/lib/audio";

type EvStatus = "ממתין" | "בטעינה" | "בשימוש";

interface EvVehicle {
  id: string;
  name: string;
  battery_pct: number;
  status: EvStatus;
  swap_at: string | null;
  sort_order: number;
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
        .select("id,name,battery_pct,status,swap_at,sort_order")
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

  // Alarm on expiration
  useEffect(() => {
    for (const v of vehicles) {
      if (!v.swap_at) continue;
      const expired = new Date(v.swap_at).getTime() <= Date.now();
      if (expired && v.status === "בטעינה" && !alarmedIdsRef.current.has(v.id)) {
        alarmedIdsRef.current.add(v.id);
        playBeep();
        setTimeout(playBeep, 350);
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

  const startCustomCharge = (id: string) => {
    const raw = window.prompt("כמה זמן לטעינה? אפשר לרשום שעות (למשל 2 או 2.5) או דקות (למשל 90m)", "2");
    if (!raw) return;
    const trimmed = raw.trim().toLowerCase();
    let minutes = 0;
    if (trimmed.endsWith("m") || trimmed.endsWith("מ")) {
      minutes = parseFloat(trimmed.replace(/[mמ]$/, ""));
    } else if (trimmed.endsWith("h") || trimmed.endsWith("ש")) {
      minutes = parseFloat(trimmed.replace(/[hש]$/, "")) * 60;
    } else {
      const n = parseFloat(trimmed);
      // Treat numbers <= 12 as hours, otherwise as minutes
      minutes = n <= 12 ? n * 60 : n;
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      window.alert("ערך לא תקין");
      return;
    }
    startCharge(id, Math.round(minutes));
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
            return (
              <li
                key={v.id}
                className={`rounded-xl border bg-background/40 p-3 flex flex-col gap-2 transition ${
                  isExpired ? "border-neon glow-neon" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Car className="h-4 w-4 text-foreground/70 shrink-0" />
                    <span className="font-bold text-sm truncate">{v.name}</span>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusClasses(
                      v.status,
                    )}`}
                  >
                    {v.status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    סוללה
                  </span>
                  <span className="font-display text-xl font-black text-neon tabular-nums">
                    {v.battery_pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={v.battery_pct}
                  onChange={(e) =>
                    setVehicles((prev) =>
                      prev.map((x) => (x.id === v.id ? { ...x, battery_pct: Number(e.target.value) } : x)),
                    )
                  }
                  onPointerUp={(e) =>
                    void update(v.id, { battery_pct: Number((e.target as HTMLInputElement).value) })
                  }
                  className="w-full accent-neon"
                  aria-label={`סוללה ${v.name}`}
                />

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
                    onClick={() => startCustomCharge(v.id)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-neon/60 text-neon font-bold hover:bg-neon/10"
                  >
                    <Plug className="h-3 w-3" /> מותאם
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
    </section>
  );
}
