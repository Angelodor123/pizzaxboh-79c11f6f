// Lightweight Vibration API wrapper. Silently no-op on unsupported devices.
export type HapticType = "success" | "warning" | "light";

const PATTERNS: Record<HapticType, number | number[]> = {
  light: 50,
  success: [40, 30, 80],
  warning: [100, 50, 100],
};

export function triggerHaptic(type: HapticType = "light"): void {
  if (typeof window === "undefined") return;
  const nav = window.navigator;
  if (!nav || typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(PATTERNS[type]);
  } catch {
    /* noop */
  }
}
