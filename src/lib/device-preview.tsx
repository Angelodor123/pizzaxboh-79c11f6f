import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Smartphone, Tablet, Monitor, Maximize2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export type DevicePreviewMode = "auto" | "mobile" | "tablet" | "desktop";

interface DevicePreviewState {
  mode: DevicePreviewMode;
  setMode: (m: DevicePreviewMode) => void;
}

export const useDevicePreview = create<DevicePreviewState>()(
  persist(
    (set) => ({
      mode: "auto",
      setMode: (mode) => set({ mode }),
    }),
    { name: "pizzax-device-preview-v1" },
  ),
);

/** Returns the wrapper className for the simulated viewport. */
export function devicePreviewWrapperClass(mode: DevicePreviewMode): string {
  switch (mode) {
    case "mobile":
      return "max-w-md mx-auto border-x border-border shadow-2xl bg-background min-h-screen";
    case "tablet":
      return "max-w-4xl mx-auto border-x border-border shadow-xl bg-background min-h-screen";
    case "desktop":
    case "auto":
    default:
      return "";
  }
}

const OPTIONS: Array<{ key: DevicePreviewMode; Icon: typeof Smartphone; label: string }> = [
  { key: "mobile", Icon: Smartphone, label: "מובייל" },
  { key: "tablet", Icon: Tablet, label: "טאבלט" },
  { key: "desktop", Icon: Monitor, label: "מחשב" },
  { key: "auto", Icon: Maximize2, label: "אוטומטי" },
];

export function DevicePreviewToggle({ className = "" }: { className?: string }) {
  const { mode, setMode } = useDevicePreview();
  const { role, isSuperAdmin } = useAuth();
  const canSee = isSuperAdmin || role === "admin" || import.meta.env.DEV;
  if (!canSee) return null;

  return (
    <div
      role="group"
      aria-label="תצוגת מכשיר"
      className={`hidden md:inline-flex items-center rounded-md border border-border bg-card/60 p-0.5 ${className}`}
    >
      {OPTIONS.map(({ key, Icon, label }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`h-7 w-7 inline-flex items-center justify-center rounded transition ${
              active
                ? "bg-neon text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
