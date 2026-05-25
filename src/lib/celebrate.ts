// Brand-aligned confetti burst. Lazy-loads canvas-confetti to keep initial bundle small.
import { triggerHaptic } from "./haptics";

const BRAND_COLORS = [
  "#ff2d87", // vibrant pink
  "#ff6fb5", // soft pink
  "#f5d061", // gold
  "#ffffff", // white accent
  "#1a1a1a", // deep dark
];

let lastFireAt = 0;

export async function celebrate(): Promise<void> {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastFireAt < 1500) return; // throttle
  lastFireAt = now;
  try {
    const mod = await import("canvas-confetti");
    const confetti = mod.default;
    triggerHaptic("success");
    const defaults = {
      colors: BRAND_COLORS,
      disableForReducedMotion: true,
      scalar: 0.9,
      ticks: 120,
    };
    confetti({
      ...defaults,
      particleCount: 70,
      spread: 70,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.7 },
    });
    setTimeout(() => {
      confetti({ ...defaults, particleCount: 40, spread: 100, angle: 60, origin: { x: 0, y: 0.8 } });
      confetti({ ...defaults, particleCount: 40, spread: 100, angle: 120, origin: { x: 1, y: 0.8 } });
    }, 180);
  } catch {
    /* noop */
  }
}
