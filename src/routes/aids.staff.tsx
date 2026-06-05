import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Contact,
  Loader2,
  MessageCircle,
  PhoneCall,
  Pencil,
  Search,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  DEPARTMENT_BADGE,
  DEPARTMENT_LABEL,
  fetchEmployeeDirectory,
  whatsappUrl,
  type EmployeeRow,
  type StaffDepartment,
} from "@/lib/employee-directory";
import { EditEmployeeDialog } from "@/components/EditEmployeeDialog";

export const Route = createFileRoute("/aids/staff")({
  head: () => ({
    meta: [
      { title: "דף קשר — צוות הסניף" },
      { name: "description", content: "ספריית עובדים: התקשרות מהירה ו-WhatsApp." },
    ],
  }),
  component: StaffDirectoryPage,
});

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "??";
}

function StaffDirectoryPage() {
  const { role, isSuperAdmin } = useAuth();
  const canManage = isSuperAdmin || role === "admin";

  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<StaffDepartment | "all">("all");
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchEmployeeDirectory();
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (dept !== "all") list = list.filter((r) => r.department === dept);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          (r.phone ?? "").toLowerCase().includes(q) ||
          (r.seniority ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, dept, query]);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4">
          <Link
            to="/aids"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-bold hover:bg-zinc-800/60 transition"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            חזור לעזרים
          </Link>
        </div>

        <header className="mb-4">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <span className="p-2 rounded-md bg-emerald-500/15 text-emerald-300">
              <Contact className="h-5 w-5" />
            </span>
            דף קשר — צוות הסניף
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ספריית עובדים פעילים. לחיצה על 📞 מחייגת מיידית, על 💬 פותחת וואטסאפ.
          </p>
        </header>

        <div className="mb-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם / טלפון / ותק"
              className="w-full rounded-lg border border-border bg-card/60 pr-8 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/40"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {(["all", "kitchen", "counter", "delivery", "management"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDept(k)}
                className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  dept === k
                    ? "bg-neon text-primary-foreground"
                    : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {k === "all" ? "הכל" : DEPARTMENT_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
            לא נמצאו עובדים תואמים.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((e) => (
              <li
                key={e.user_id}
                className="rounded-xl border border-border bg-card/60 p-3 flex items-start gap-3"
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-neon/15 text-neon text-sm font-bold flex items-center justify-center">
                  {initials(e.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-foreground truncate">{e.full_name}</span>
                    {e.department && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${DEPARTMENT_BADGE[e.department]}`}
                      >
                        {DEPARTMENT_LABEL[e.department]}
                      </span>
                    )}
                  </div>
                  {e.seniority && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">ותק: {e.seniority}</p>
                  )}
                  {canManage && e.address && (
                    <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {e.address}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {e.phone ? (
                      <>
                        <a
                          href={`tel:${e.phone}`}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-1 text-xs font-bold hover:bg-emerald-500/20 transition"
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                          {e.phone}
                        </a>
                        {whatsappUrl(e.phone) && (
                          <a
                            href={whatsappUrl(e.phone)!}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-green-500/40 bg-green-500/10 text-green-300 px-2 py-1 text-xs font-bold hover:bg-green-500/20 transition"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        לא הוזן טלפון
                      </span>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        className="ms-auto inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        ערוך
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <EditEmployeeDialog
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
