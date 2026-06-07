import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Package,
  CalendarDays,
  Truck,
  ListChecks,
  NotebookPen,
  Wrench,
  MessageSquareWarning,
  Wallet,
  UserCircle,
  Bell,
  Settings,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useIsModiinBranch } from "@/lib/active-branch";
import { useNewComplaintCount } from "@/lib/complaints-store";
import { ComplaintModal } from "@/components/ComplaintModal";
import pizzaXLogo from "@/assets/pizza-x-logo.png";

type Item = {
  to?: string;
  onClick?: () => void;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const className = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
    active
      ? "bg-neon/10 text-neon border border-neon/40"
      : "text-foreground/80 hover:bg-zinc-800/60 hover:text-neon border border-transparent"
  }`;
  const content = (
    <>
      <span className="shrink-0">{item.icon}</span>
      <span className="flex-1 text-right truncate">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-black">
          {item.badge}
        </span>
      ) : null}
    </>
  );
  if (item.to) {
    return (
      <Link to={item.to} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={item.onClick} className={`${className} w-full text-right`}>
      {content}
    </button>
  );
}

function Group({ label, items, pathname }: { label: string; items: Item[]; pathname: string }) {
  return (
    <div className="px-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-3 mt-3 mb-1.5">
        {label}
      </div>
      <ul className="flex flex-col gap-0.5">
        {items.map((it, i) => (
          <li key={i}>
            <NavLink item={it} active={!!it.to && pathname === it.to} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DesktopSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, isSuperAdmin, fullName, email, signOut } = useAuth();
  const isModiinBranch = useIsModiinBranch();
  const newComplaintCount = useNewComplaintCount();
  const [complaintOpen, setComplaintOpen] = useState(false);

  const canSeeManagement = isSuperAdmin || role === "admin";

  const workItems: Item[] = [
    { to: "/", label: "דף הבית", icon: <Home className="h-4 w-4" /> },
    { to: "/aids", label: "עזרים", icon: <Package className="h-4 w-4" /> },
    { to: "/calendar", label: "יומן אירועים וסחורה", icon: <CalendarDays className="h-4 w-4" /> },
    { to: "/orders", label: "קבלת סחורה", icon: <Truck className="h-4 w-4" /> },
    { to: "/tasks", label: "משימות יומיות", icon: <ListChecks className="h-4 w-4" /> },
    { to: "/notebook", label: "פנקס עבודה", icon: <NotebookPen className="h-4 w-4" /> },
    { to: "/maintenance", label: "קריאת שירות", icon: <Wrench className="h-4 w-4" /> },
    { onClick: () => setComplaintOpen(true), label: "פתיחת תלונה", icon: <MessageSquareWarning className="h-4 w-4" /> },
    ...(isModiinBranch
      ? [{ to: "/cibus", label: "צבירות סיבוס", icon: <Wallet className="h-4 w-4" /> } as Item]
      : []),
  ];

  const personalItems: Item[] = [
    { to: "/my-profile", label: "הפרופיל שלי", icon: <UserCircle className="h-4 w-4" /> },
    { to: "/notifications", label: "התראות", icon: <Bell className="h-4 w-4" /> },
  ];

  const managementItems: Item[] = [
    { to: "/admin", label: "פאנל ניהול", icon: <Settings className="h-4 w-4" /> },
    { to: "/suppliers", label: "ניהול ספקים", icon: <Truck className="h-4 w-4" /> },
    { to: "/complaints", label: "ניהול תלונות", icon: <ShieldAlert className="h-4 w-4" />, badge: newComplaintCount },
  ];

  return (
    <>
      <aside
        dir="rtl"
        className="hidden lg:flex fixed inset-y-0 right-0 z-30 w-64 flex-col bg-[#18181b] border-l border-zinc-800/60"
      >
        <Link to="/" className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800/60">
          <img src={pizzaXLogo} alt="Pizza X" className="h-9 w-auto" />
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neon">
            Back of House
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto py-2">
          <Group label="עבודה שוטפת" items={workItems} pathname={pathname} />
          <div className="border-t border-zinc-800/50 mx-3 my-2" />
          <Group label="אזור אישי" items={personalItems} pathname={pathname} />
          {canSeeManagement && (
            <>
              <div className="border-t border-zinc-800/50 mx-3 my-2" />
              <Group label="ניהול" items={managementItems} pathname={pathname} />
            </>
          )}
        </nav>
        <div className="border-t border-zinc-800/60 px-4 py-3 space-y-2">
          <div className="text-right">
            <div className="text-sm font-bold text-foreground truncate">
              {fullName?.trim() || "אורח"}
            </div>
            {email && (
              <div className="text-[10px] text-muted-foreground truncate">{email}</div>
            )}
          </div>
          <button
            onClick={async () => {
              await signOut();
            }}
            className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-foreground hover:text-neon border border-zinc-800 rounded-md py-1.5 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            התנתק
          </button>
        </div>
      </aside>
      <ComplaintModal open={complaintOpen} onOpenChange={setComplaintOpen} />
    </>
  );
}
