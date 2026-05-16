import { useEffect, useRef, useState } from "react";

export function CountdownTimer({ seconds, label }: { seconds: number; label: string }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      setRunning(false);
      setFlash(true);
      try {
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = 880;
        g.gain.value = 0.15;
        o.start();
        setTimeout(() => {
          o.stop();
          ctx.close();
        }, 600);
      } catch {
        // ignore
      }
      setTimeout(() => setFlash(false), 3000);
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [running, remaining]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div
      ref={containerRef}
      className={`rounded-xl border border-border bg-background/60 p-4 ${flash ? "flash-neon border-neon" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
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
              setFlash(false);
            }}
            className="px-4 py-2 rounded-md border border-border text-xs text-muted-foreground"
          >
            איפוס
          </button>
        </div>
      </div>
    </div>
  );
}
