import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
}

export function BarcodeScanner({ open, onClose, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const rear =
          devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];
        if (!rear) {
          setError("לא נמצאה מצלמה");
          return;
        }
        const controls = await reader.decodeFromVideoDevice(
          rear.deviceId,
          videoRef.current!,
          (res, _err, c) => {
            if (cancelled) return;
            if (res) {
              const text = res.getText();
              c.stop();
              onResult(text);
              onClose();
            }
          },
        );
        controlsRef.current = controls;
      } catch (e) {
        setError("לא ניתן לפתוח את המצלמה. אשר/י הרשאות.");
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onClose, onResult]);

  if (!open) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="text-white font-bold">סריקת פריט</div>
        <button
          onClick={onClose}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
          aria-label="סגור"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 relative flex items-center justify-center">
        <video
          ref={videoRef}
          className="max-h-full max-w-full"
          muted
          playsInline
        />
        <div className="pointer-events-none absolute inset-10 border-2 border-emerald-400 rounded-xl shadow-[0_0_24px_rgba(16,185,129,0.5)]" />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-white">
            {error}
          </div>
        )}
      </div>
      <div className="px-4 py-3 text-center text-white/70 text-xs">
        כוון את הברקוד אל המרכז של המסך
      </div>
    </div>
  );
}
