// Auto-save form drafts to localStorage with debounce.
// Restores on mount; clears on explicit reset() (e.g. after successful submit).
//
// Usage:
//   const { restored, reset } = useAutosaveDraft("complaint-new", form, setForm);
//   // call reset() after successful submit
import { useEffect, useRef } from "react";

const PREFIX = "lovable.draft.v1.";
const DEBOUNCE_MS = 800;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Stored<T> = { value: T; updatedAt: number };

function readDraft<T>(key: string): T | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, value: T) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ value, updatedAt: Date.now() } satisfies Stored<T>),
    );
  } catch {
    /* ignore quota */
  }
}

export function clearDraft(key: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/**
 * Auto-persist `value` under `key`. On first mount, if a prior draft exists,
 * calls `onRestore(savedValue)` so the caller can hydrate state.
 *
 * `enabled` lets the caller pause autosave (e.g. while a modal is closed).
 */
export function useAutosaveDraft<T>(
  key: string,
  value: T,
  onRestore: (v: T) => void,
  enabled: boolean = true,
) {
  const restoredRef = useRef(false);

  // Restore once on first enable.
  useEffect(() => {
    if (!enabled || restoredRef.current) return;
    restoredRef.current = true;
    const saved = readDraft<T>(key);
    if (saved != null) onRestore(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  // Debounced write on every change.
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => writeDraft(key, value), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [enabled, key, value]);

  return {
    reset: () => {
      clearDraft(key);
      restoredRef.current = false;
    },
  };
}
