import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useUnreadTicketCount } from "@/lib/maintenance-store";

export function MaintenanceBell() {
  const { role } = useAuth();
  const isManager = role === "admin";
  const count = useUnreadTicketCount(isManager);
  if (!isManager) return null;

  return (
    <Link
      to="/admin/maintenance"
      className="relative h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-card/60 text-foreground hover:text-neon hover:border-neon/60 transition"
      aria-label="קריאות שירות"
      title="קריאות שירות"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
          style={{
            background: "linear-gradient(135deg, #ff1493, #ff66c4)",
            boxShadow: "0 0 8px rgba(255,20,147,0.9), 0 0 16px rgba(255,20,147,0.6)",
          }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
