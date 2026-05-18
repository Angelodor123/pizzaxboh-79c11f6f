// Minimal Web Audio synthesis helpers for kitchen UI feedback.
// No assets, no autoplay until first user gesture creates the context.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.25) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(c.destination);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.start(now);
  o.stop(now + dur + 0.02);
}

export function playPop() {
  tone(880, 0.08, "triangle", 0.18);
}

export function playSuccess() {
  tone(880, 0.12, "sine", 0.22);
  setTimeout(() => tone(1320, 0.18, "sine", 0.22), 110);
}

export function playBeep() {
  tone(1760, 0.2, "square", 0.3);
}

export function playThud() {
  tone(110, 0.18, "sine", 0.35);
}
