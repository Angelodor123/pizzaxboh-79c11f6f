import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  markTicketRead,
  useUrgentUnreadTickets,
  type Urgency,
} from "@/lib/maintenance-store";
import { Link } from "@tanstack/react-router";

const URGENCY_COLOR: Record<Urgency, string> = {
  "קריטי - משבית עבודה": "from-red-600 to-rose-500",
  "דחוף - מפריע לעבודה": "from-orange-500 to-amber-400",
  "רגיל": "from-slate-500 to-slate-400",
};

export function CriticalMaintenanceInterceptor() {
  const { role, loading } = useAuth();
  const isManager = role === "admin";
  const tickets = useUrgentUnreadTickets(isManager && !loading);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = tickets.filter((t) => !dismissed.has(t.id));
  if (!isManager || visible.length === 0) return null;

  const current = visible[0];

  const handleAck = async () => {
    setDismissed((prev) => new Set(prev).add(current.id));
    await markTicketRead(current.id);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-md w-full rounded-2xl border border-red-500/40 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-6 text-right shadow-[0_0_60px_-10px_rgba(255,20,60,0.6)]"
        dir="rtl"
      >
        <div
          className={`absolute -top-3 right-6 px-3 py-1 rounded-full text-[11px] font-bold text-white bg-gradient-to-r ${URGENCY_COLOR[current.urgency]} shadow-lg`}
        >
          {current.urgency}
        </div>

        <div className="flex items-start gap-3 mb-4 pt-2">
          <div className="h-12 w-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white">
              תקלה טכנית דורשת התייחסות
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {current.equipment_name ?? "ציוד לא צוין"}
              {current.reporter_name ? ` • דווח ע״י ${current.reporter_name}` : ""}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-black/40 p-3 mb-4">
          <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
            {current.description}
          </p>
        </div>

        {current.photo_url && (
          <img
            src={current.photo_url}
            alt="תמונת התקלה"
            className="w-full max-h-48 object-cover rounded-lg border border-zinc-800 mb-4"
          />
        )}

        <p className="text-[11px] text-zinc-500 mb-4">
          {new Date(current.created_at).toLocaleString("he-IL")}
          {visible.length > 1 && ` • עוד ${visible.length - 1} ממתינות`}
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleAck}
            className="w-full h-11 rounded-lg font-bold text-white bg-gradient-to-r from-red-600 to-rose-500 hover:opacity-90 transition shadow-[0_0_24px_-4px_rgba(255,20,60,0.7)]"
          >
            סמן כנקרא וסגור
          </button>
          <Link
            to="/service-calls"
            onClick={handleAck}
            className="w-full h-10 rounded-lg font-medium text-zinc-300 border border-zinc-800 hover:border-zinc-600 hover:text-white transition inline-flex items-center justify-center"
          >
            פתח את כל הקריאות
          </Link>
        </div>

        <button
          onClick={() => setDismissed((p) => new Set(p).add(current.id))}
          className="absolute top-3 left-3 h-7 w-7 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition"
          aria-label="דחה"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
