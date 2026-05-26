import { useCallback, useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, CloudSnow, CloudFog, CloudLightning, Loader2, AlertTriangle, RefreshCw } from "lucide-react";

// Modi'in, Israel
const LAT = 31.9009;
const LON = 35.0102;

interface HourPoint {
  time: string; // ISO
  temp: number;
  code: number;
  precipProb: number;
}

interface WeatherData {
  currentTemp: number;
  currentCode: number;
  hours: HourPoint[];
}

const HEBREW_HOURS = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
};

function iconFor(code: number, className = "h-5 w-5") {
  if (code === 0 || code === 1) return <Sun className={className} />;
  if (code >= 95) return <CloudLightning className={className} />;
  if (code >= 71 && code <= 77) return <CloudSnow className={className} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 86)) return <CloudRain className={className} />;
  if (code === 45 || code === 48) return <CloudFog className={className} />;
  return <Cloud className={className} />;
}

function descFor(code: number): string {
  if (code === 0) return "בהיר";
  if (code === 1) return "בהיר חלקית";
  if (code === 2) return "מעונן חלקית";
  if (code === 3) return "מעונן";
  if (code === 45 || code === 48) return "ערפל";
  if (code >= 51 && code <= 57) return "טפטוף";
  if (code >= 61 && code <= 67) return "גשם";
  if (code >= 71 && code <= 77) return "שלג";
  if (code >= 80 && code <= 86) return "ממטרים";
  if (code >= 95) return "סופת רעמים";
  return "—";
}

function isRainCode(code: number) {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 86) || code >= 95;
}

export function WeatherWidget({ title, alertText }: { title: string; alertText: string }) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchWeather = useCallback(async (signal: AbortSignal) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code,precipitation_probability&forecast_hours=6&timezone=Asia%2FJerusalem`;
    const attempt = async () => {
      const r = await fetch(url, { signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    };
    // Retry once on transient failure
    let j: any;
    try {
      j = await attempt();
    } catch {
      await new Promise((res) => setTimeout(res, 800));
      j = await attempt();
    }
    const times: string[] = j?.hourly?.time ?? [];
    const temps: number[] = j?.hourly?.temperature_2m ?? [];
    const codes: number[] = j?.hourly?.weather_code ?? [];
    const probs: number[] = j?.hourly?.precipitation_probability ?? [];
    if (!times.length || typeof j?.current?.temperature_2m !== "number") {
      throw new Error("invalid payload");
    }
    const hours: HourPoint[] = times.slice(0, 6).map((t, i) => ({
      time: t,
      temp: Math.round(temps[i] ?? 0),
      code: codes[i] ?? 0,
      precipProb: probs[i] ?? 0,
    }));
    return {
      currentTemp: Math.round(j.current.temperature_2m),
      currentCode: j.current.weather_code ?? 0,
      hours,
    } satisfies WeatherData;
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    setError(null);
    fetchWeather(ctl.signal)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (ctl.signal.aborted) return;
        setError(e?.message ?? "error");
        setLoading(false);
      });
    return () => ctl.abort();
  }, [fetchWeather, reloadKey]);

  const rainSoon = !!data?.hours.some((h) => isRainCode(h.code) || h.precipProb >= 50);

  return (
    <div className="rounded-xl border-2 border-jungle/30 bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-bold flex items-center gap-2">
          {data ? iconFor(data.currentCode, "h-5 w-5 text-neon") : <Cloud className="h-5 w-5 text-neon" />}
          {title}
        </h2>
        {data && (
          <div className="text-right">
            <div className="font-display text-3xl font-black text-neon tabular-nums leading-none">
              {data.currentTemp}°
            </div>
            <div className="text-[10px] text-foreground/70 mt-0.5">{descFor(data.currentCode)}</div>
          </div>
        )}
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-4 text-muted-foreground text-xs">
          <Loader2 className="h-4 w-4 animate-spin ml-2" /> טוען מזג אוויר…
        </div>
      )}
      {error && !loading && !data && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">לא הצלחנו לטעון את מזג האוויר כעת</span>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="inline-flex items-center gap-1 text-xs font-bold text-neon hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" /> רענון
          </button>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-6 gap-1 text-center">
          {data.hours.map((h) => (
            <div
              key={h.time}
              className="rounded-md bg-background/40 border border-border/40 py-2 flex flex-col items-center gap-1"
            >
              <span className="text-[9px] text-foreground/70 tabular-nums">{HEBREW_HOURS(h.time)}</span>
              <span className="text-neon">{iconFor(h.code, "h-4 w-4")}</span>
              <span className="text-[11px] font-bold tabular-nums">{h.temp}°</span>
              {h.precipProb >= 30 && (
                <span className="text-[9px] text-neon-soft tabular-nums">{h.precipProb}%</span>
              )}
            </div>
          ))}
        </div>
      )}

      {rainSoon && (
        <div
          className="rounded-md border-2 border-neon bg-neon/10 text-neon px-3 py-2 flex items-center gap-2 pulse-alarm"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold leading-snug">{alertText}</span>
        </div>
      )}
    </div>
  );
}
