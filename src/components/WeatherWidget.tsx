import { useCallback, useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, CloudSnow, CloudFog, CloudLightning, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useActiveBranchData } from "@/components/BranchGate";

// Default coords (Modi'in, Israel) — used when active branch has no coords set.
const DEFAULT_LAT = 31.9009;
const DEFAULT_LON = 35.0102;

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

const CACHE_KEY_PREFIX = "weather_widget_cache_v2:";
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 6_000;

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

function readCache(cacheKey: string): CachedWeather | null {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeather;
    if (!parsed?.data?.hours) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, data: WeatherData) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() } satisfies CachedWeather));
  } catch {
    /* ignore */
  }
}

async function fetchJsonWithTimeout(url: string, signal: AbortSignal) {
  const timeoutController = new AbortController();
  const abortFromParent = () => timeoutController.abort();
  const timer = window.setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  signal.addEventListener("abort", abortFromParent, { once: true });

  try {
    const response = await fetch(url, {
      signal: timeoutController.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", abortFromParent);
  }
}

function mapWttrCode(code: number) {
  if (code === 113) return 0;
  if (code === 116) return 2;
  if (code === 119 || code === 122) return 3;
  if ([143, 248, 260].includes(code)) return 45;
  if (code >= 386) return 95;
  if ((code >= 317 && code <= 338) || (code >= 368 && code <= 377)) return 71;
  if ((code >= 263 && code <= 284) || (code >= 293 && code <= 314)) return 51;
  if ((code >= 353 && code <= 365) || code === 176) return 61;
  return 2;
}

export function WeatherWidget({ alertText }: { title?: string; alertText: string }) {
  const branch = useActiveBranchData();
  const LAT = branch?.latitude ?? DEFAULT_LAT;
  const LON = branch?.longitude ?? DEFAULT_LON;
  const branchName = branch?.name ?? "—";
  const cityLabel = branch?.name ? encodeURIComponent(branch.name) : "Modiin";
  const cacheKey = `${CACHE_KEY_PREFIX}${branch?.id ?? "default"}`;
  const displayTitle = `מזג אוויר — ${branchName}`;

  const [data, setData] = useState<WeatherData | null>(null);
  const [staleAt, setStaleAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchFallback = useCallback(async (signal: AbortSignal): Promise<WeatherData> => {
    const j = await fetchJsonWithTimeout(`https://wttr.in/${cityLabel}?format=j1`, signal);
    const current = j?.current_condition?.[0];
    const hourly = (j?.weather ?? []).flatMap((day: { date?: string; hourly?: Array<Record<string, unknown>> }) =>
      (day.hourly ?? []).map((hour) => ({ ...hour, date: day.date })),
    );
    if (!current || !hourly.length) throw new Error("invalid fallback payload");

    const now = new Date();
    const currentHour = now.getHours() * 100;
    const upcoming = hourly.filter((h: { time?: unknown }) => Number(h.time ?? 0) >= currentHour).slice(0, 6);
    const selected = upcoming.length >= 3 ? upcoming : hourly.slice(0, 6);

    return {
      currentTemp: Math.round(Number(current.temp_C ?? 0)),
      currentCode: mapWttrCode(Number(current.weatherCode ?? 116)),
      hours: selected.map((h: { date?: unknown; time?: unknown; tempC?: unknown; weatherCode?: unknown; chanceofrain?: unknown }) => {
        const rawTime = String(h.time ?? "0").padStart(4, "0");
        const hour = rawTime.slice(0, -2) || "0";
        const minute = rawTime.slice(-2);
        const date = typeof h.date === "string" ? h.date : now.toISOString().slice(0, 10);
        return {
          time: `${date}T${hour.padStart(2, "0")}:${minute}:00`,
          temp: Math.round(Number(h.tempC ?? 0)),
          code: mapWttrCode(Number(h.weatherCode ?? 116)),
          precipProb: Math.round(Number(h.chanceofrain ?? 0)),
        };
      }),
    };
  }, [cityLabel]);

  const fetchOnce = useCallback(async (signal: AbortSignal): Promise<WeatherData> => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code,precipitation_probability&forecast_hours=6&timezone=Asia%2FJerusalem`;
    const j = await fetchJsonWithTimeout(url, signal);
    const times: string[] = j?.hourly?.time ?? [];
    const temps: number[] = j?.hourly?.temperature_2m ?? [];
    const codes: number[] = j?.hourly?.weather_code ?? [];
    const probs: number[] = j?.hourly?.precipitation_probability ?? [];
    if (!times.length || typeof j?.current?.temperature_2m !== "number") {
      throw new Error("invalid payload");
    }
    return {
      currentTemp: Math.round(j.current.temperature_2m),
      currentCode: j.current.weather_code ?? 0,
      hours: times.slice(0, 6).map((t, i) => ({
        time: t,
        temp: Math.round(temps[i] ?? 0),
        code: codes[i] ?? 0,
        precipProb: probs[i] ?? 0,
      })),
    };
  }, [LAT, LON]);

  const fetchWeather = useCallback(
    async (signal: AbortSignal): Promise<WeatherData> => {
      try {
        return await fetchOnce(signal);
      } catch (primaryError) {
        if (signal.aborted) throw primaryError;
        return fetchFallback(signal);
      }
    },
    [fetchFallback, fetchOnce],
  );

  useEffect(() => {
    const ctl = new AbortController();
    let active = true;

    // Reset visible state when branch (cacheKey) changes so the previous
    // branch's weather never lingers on screen.
    setData(null);
    setStaleAt(null);

    const cached = readCache(cacheKey);
    if (cached) {
      setData(cached.data);
      setStaleAt(cached.timestamp);
    }
    setLoading(true);
    setFailed(false);

    (async () => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (!active) return;
        try {
          const fresh = await fetchWeather(ctl.signal);
          if (!active) return;
          setData(fresh);
          setStaleAt(null);
          setFailed(false);
          setLoading(false);
          writeCache(cacheKey, fresh);
          return;
        } catch (e) {
          if (ctl.signal.aborted) return;
          if (attempt < MAX_RETRIES - 1) {
            await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
          }
        }
      }
      if (!active) return;
      // All retries failed
      setLoading(false);
      setFailed(true);
    })();

    return () => {
      active = false;
      ctl.abort();
    };
  }, [fetchWeather, reloadKey, cacheKey]);

  const rainSoon = !!data?.hours.some((h) => isRainCode(h.code) || h.precipProb >= 50);

  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-2 flex items-center gap-3" dir="rtl">
      {loading && !data && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      )}

      {failed && !data && !loading && (
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="inline-flex items-center gap-1 text-xs font-bold text-neon hover:underline shrink-0"
          aria-label="רענון מזג אוויר"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          רענון
        </button>
      )}

      {data && (
        <>
          {iconFor(data.currentCode, "h-5 w-5 text-neon shrink-0")}
          <span className="font-bold text-foreground tabular-nums">{data.currentTemp}°</span>
          <span className="text-sm text-muted-foreground">{descFor(data.currentCode)}</span>
        </>
      )}

      {rainSoon && (
        <span className="mr-auto inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-500 text-[10px] font-bold px-2 py-0.5 shrink-0">
          <AlertTriangle className="h-3 w-3" />
          {alertText}
        </span>
      )}
    </div>
  );
}
