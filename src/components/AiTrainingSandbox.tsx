import { useEffect, useState, useCallback } from "react";
import { Flame, Trophy, Sparkles, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveBranchIdSync, subscribeBranch } from "@/lib/current-branch";
import { InvoiceIntakeModal } from "@/components/InvoiceIntakeModal";
import { celebrate } from "@/lib/celebrate";


interface SupplierOpt { id: string; name: string }
interface Props { suppliers: SupplierOpt[]; isSuperAdmin: boolean }

interface FeedbackRow {
  supplier_id: string | null;
  diff_summary: string | null;
  created_at: string;
  raw_ocr: Record<string, unknown>;
  final_data: Record<string, unknown>;
}

interface SupplierStat {
  supplier_id: string;
  name: string;
  xp: number;
  invoices: number;
  streak: number;
}

const LEVEL_NAMES = ["מתחיל", "חניך", "מומחה", "וירטואוז", "מאסטר"];
const LEVEL_COLORS = [
  "from-zinc-500 to-zinc-700",
  "from-sky-500 to-cyan-600",
  "from-violet-500 to-fuchsia-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
];
const XP_PER_LEVEL = 50;

function levelFromXp(xp: number) {
  const idx = Math.min(LEVEL_NAMES.length - 1, Math.floor(xp / XP_PER_LEVEL));
  const inLevel = xp - idx * XP_PER_LEVEL;
  const pct = idx === LEVEL_NAMES.length - 1 ? 100 : Math.round((inLevel / XP_PER_LEVEL) * 100);
  return { level: idx + 1, name: LEVEL_NAMES[idx], color: LEVEL_COLORS[idx], pct, inLevel, max: XP_PER_LEVEL };
}

// Count fields the AI got right (raw matched final). diff_summary='perfect' shortcut.
function xpFromRow(row: FeedbackRow): number {
  if (row.diff_summary === "perfect") return 8;
  // Parse "edits:N" → award (8 - N) bounded [1,7]
  const m = /^edits:(\d+)/.exec(row.diff_summary || "");
  if (m) {
    const edits = Number(m[1]) || 0;
    return Math.max(1, 8 - edits);
  }
  return 2; // unknown / legacy
}

export function AiTrainingSandbox({ suppliers, isSuperAdmin }: Props) {
  const [branchId, setBranchId] = useState<string | null>(() => getActiveBranchIdSync());
  const [stats, setStats] = useState<SupplierStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [trainingSupplierId, setTrainingSupplierId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => subscribeBranch((id) => setBranchId(id)), []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("invoice_ocr_feedback")
      .select("supplier_id,diff_summary,created_at,raw_ocr,final_data")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (isSuperAdmin && branchId) q = q.eq("branch_id", branchId);
    const { data } = await q;
    const rows = ((data as unknown) as FeedbackRow[]) ?? [];
    const bySup = new Map<string, FeedbackRow[]>();
    for (const r of rows) {
      if (!r.supplier_id) continue;
      const arr = bySup.get(r.supplier_id) ?? [];
      arr.push(r);
      bySup.set(r.supplier_id, arr);
    }
    const result: SupplierStat[] = [];
    for (const [sid, arr] of bySup) {
      const xp = arr.reduce((a, r) => a + xpFromRow(r), 0);
      let streak = 0;
      for (const r of arr) {
        if (r.diff_summary === "perfect") streak += 1;
        else break;
      }
      result.push({
        supplier_id: sid,
        name: suppliers.find((s) => s.id === sid)?.name ?? "ספק לא ידוע",
        xp,
        invoices: arr.length,
        streak,
      });
    }
    for (const s of suppliers) {
      if (!bySup.has(s.id)) {
        result.push({ supplier_id: s.id, name: s.name, xp: 0, invoices: 0, streak: 0 });
      }
    }
    result.sort((a, b) => b.xp - a.xp);
    setStats(result);
    setLoading(false);
  }, [branchId, isSuperAdmin, suppliers]);

  useEffect(() => {
    void loadStats();
  }, [loadStats, reloadKey]);

  if (loading) return <div className="text-center text-muted-foreground py-12">טוען…</div>;


  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-neon/40 bg-gradient-to-bl from-neon/10 to-transparent p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-neon">
          <Sparkles className="h-4 w-4" />
          <div className="text-[10px] uppercase tracking-[0.3em] font-bold">AI Training Sandbox</div>
          <Sparkles className="h-4 w-4" />
        </div>
        <h3 className="font-display text-xl font-bold mt-1">אמן את ה-AI שלך 🎮</h3>
        <p className="text-xs text-muted-foreground mt-1">
          כל קליטה חכמה מעלה לספק XP. אפס תיקונים = רצף 🔥 + קונפטי.
        </p>
      </div>

      {stats.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 rounded-2xl border border-border bg-card/60">
          אין עדיין נתוני אימון. בצע קליטה חכמה כדי להתחיל!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.map((s) => {
            const L = levelFromXp(s.xp);
            return (
              <div key={s.supplier_id} className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{s.name}</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      {s.invoices} חשבוניות שעובדו
                    </div>
                  </div>
                  <div className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-br ${L.color} text-white text-[10px] font-bold shadow-lg`}>
                    <Trophy className="h-3 w-3" />
                    LV{L.level} · {L.name}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 font-bold tabular-nums">
                    <span>XP {s.xp}</span>
                    <span>
                      {L.level === LEVEL_NAMES.length
                        ? "MAX"
                        : `${L.inLevel} / ${L.max}`}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden border border-border">
                    <div
                      className={`h-full bg-gradient-to-r ${L.color} transition-all duration-700 shadow-[0_0_12px_rgba(255,45,180,0.4)]`}
                      style={{ width: `${L.pct}%` }}
                    />
                  </div>
                </div>

                {s.streak > 0 && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/40 text-orange-400 text-xs font-bold">
                    <Flame className="h-3.5 w-3.5" />
                    {s.streak} ברצף מושלם
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setTrainingSupplierId(s.supplier_id)}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-neon text-black font-bold text-sm active:scale-[0.98] transition shadow-[0_0_18px_rgba(255,45,180,0.3)]"
                >
                  <Upload className="h-4 w-4" />
                  📤 העלה קבלה לאימון
                </button>
              </div>
            );
          })}
        </div>
      )}

      {trainingSupplierId && (
        <InvoiceIntakeModal
          suppliers={suppliers}
          initialSupplierId={trainingSupplierId}
          onClose={() => setTrainingSupplierId(null)}
          onSaved={() => {
            setTrainingSupplierId(null);
            void celebrate();
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

      )}
    </div>
  );
}
