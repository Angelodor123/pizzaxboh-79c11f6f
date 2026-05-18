import { useEffect, useRef, useState } from "react";
import { notify } from "@/lib/notifications";

export function CountdownTimer({
  seconds,
  label,
  onAlarmChange,
}: {
  seconds: number;
  label: string;
  onAlarmChange?: (alarming: boolean) => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [alarming, setAlarming] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown tick
  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      setRunning(false);
      setAlarming(true);
      void notify("⏰ הטיימר הסתיים", {
        body: label || "שלב ההכנה הושלם",
        tag: `recipe-timer-${label}`,
      });
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [running, remaining, label]);

  // Looping kitchen-bell alarm
  useEffect(() => {
    onAlarmChange?.(alarming);
    if (!alarming) return;

    const playBell = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        const now = ctx.currentTime;
        // Two-tone high-frequency kitchen bell
        [1320, 1760].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "square";
          o.frequency.value = freq;
          o.connect(g);
          g.connect(ctx.destination);
          const start = now + i * 0.18;
          g.gain.setValueAtTime(0.0001, start);
          g.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
          o.start(start);
          o.stop(start + 0.34);
        });
      } catch {
        // ignore
      }
    };

    playBell();
    beepIntervalRef.current = setInterval(playBell, 900);

    return () => {
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
    };
  }, [alarming, onAlarmChange]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      audioCtxRef.current?.close().catch(() => {});
    },
    [],
  );

  function dismiss() {
    setAlarming(false);
    setRemaining(seconds);
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div
      className={`rounded-xl border border-border bg-background/60 p-4 ${alarming ? "border-neon" : ""}`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            טיימר
          </div>
          <div className="font-display text-3xl font-bold tabular-nums text-glow-neon text-neon">
            {mm}:{ss}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
        <div className="flex flex-col gap-2">
          {alarming ? (
            <button
              onClick={dismiss}
              className="px-5 py-3 rounded-md bg-neon text-primary-foreground font-bold text-base glow-neon"
            >
              ביטול / עצור
            </button>
          ) : (
            <>
              <button
                onClick={() => setRunning((r) => !r)}
                className="px-4 py-2 rounded-md bg-neon text-primary-foreground font-bold text-sm glow-neon"
              >
                {running ? "השהה" : remaining === 0 ? "אופס" : "התחל"}
              </button>
              <button
                onClick={() => {
                  setRunning(false);
                  setRemaining(seconds);
                }}
                className="px-4 py-2 rounded-md border border-border text-xs text-muted-foreground"
              >
                איפוס
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
