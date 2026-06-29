import { useEffect, useState, useCallback } from "react";
import { Flame, Trophy, Sparkles, Upload, History, X } from "lucide-react";
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
  // === Dual metrics ===
  // Parsing Accuracy: based on user 👍/👎 OCR feedback (approved / total graded).
  parsingApproved: number;
  parsingTotal: number;
  // Delivery Accuracy: based on Received vs Not-Received checkboxes.
  deliveryReceived: number;
  deliveryTotal: number;
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
  const [historySupplier, setHistorySupplier] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => subscribeBranch((id) => setBranchId(id)), []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("invoice_ocr_feedback")
      .select("supplier_id,diff_summary,created_at,raw_ocr,final_data")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (branchId) q = q.eq("branch_id", branchId);
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
      // Aggregate dual metrics from final_data._validation and final_data._delivery.
      let parsingApproved = 0, parsingTotal = 0, deliveryReceived = 0, deliveryTotal = 0;
      for (const r of arr) {
        const fd = (r.final_data ?? {}) as { _validation?: { approved?: number; corrected?: number }; _delivery?: { received?: number; total?: number } };
        const v = fd._validation;
        if (v && (Number(v.approved) || 0) + (Number(v.corrected) || 0) > 0) {
          parsingApproved += Number(v.approved) || 0;
          parsingTotal += (Number(v.approved) || 0) + (Number(v.corrected) || 0);
        }
        const d = fd._delivery;
        if (d && Number(d.total) > 0) {
          deliveryReceived += Number(d.received) || 0;
          deliveryTotal += Number(d.total) || 0;
        }
      }
      result.push({
        supplier_id: sid,
        name: suppliers.find((s) => s.id === sid)?.name ?? "ספק לא ידוע",
        xp,
        invoices: arr.length,
        streak,
        parsingApproved, parsingTotal,
        deliveryReceived, deliveryTotal,
      });
    }
    for (const s of suppliers) {
      if (!bySup.has(s.id)) {
        result.push({ supplier_id: s.id, name: s.name, xp: 0, invoices: 0, streak: 0, parsingApproved: 0, parsingTotal: 0, deliveryReceived: 0, deliveryTotal: 0 });
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

                {/* Dual metrics — parsing accuracy (AI 👍/👎) vs delivery accuracy (Received/Not). */}
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const pPct = s.parsingTotal > 0 ? Math.round((s.parsingApproved / s.parsingTotal) * 100) : null;
                    const dPct = s.deliveryTotal > 0 ? Math.round((s.deliveryReceived / s.deliveryTotal) * 100) : null;
                    const tone = (pct: number | null) =>
                      pct == null ? "border-border text-muted-foreground bg-background/40"
                        : pct >= 90 ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/5"
                        : pct >= 70 ? "border-amber-brand/40 text-amber-brand bg-amber-brand/5"
                        : "border-rose-500/40 text-rose-400 bg-rose-500/5";
                    return (
                      <>
                        <div className={`rounded-md border px-2 py-1.5 ${tone(pPct)}`}>
                          <div className="text-[9px] uppercase tracking-wider font-bold opacity-80">דיוק קליטה (AI)</div>
                          <div className="text-base font-bold tabular-nums">{pPct == null ? "—" : `${pPct}%`}</div>
                          <div className="text-[9px] opacity-70 tabular-nums">{s.parsingApproved}/{s.parsingTotal} שדות</div>
                        </div>
                        <div className={`rounded-md border px-2 py-1.5 ${tone(dPct)}`}>
                          <div className="text-[9px] uppercase tracking-wider font-bold opacity-80">דיוק אספקה</div>
                          <div className="text-base font-bold tabular-nums">{dPct == null ? "—" : `${dPct}%`}</div>
                          <div className="text-[9px] opacity-70 tabular-nums">{s.deliveryReceived}/{s.deliveryTotal} פריטים</div>
                        </div>
                      </>
                    );
                  })()}
                </div>


                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTrainingSupplierId(s.supplier_id)}
                    className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-neon text-black font-bold text-sm active:scale-[0.98] transition shadow-[0_0_18px_rgba(255,45,180,0.3)]"
                  >
                    <Upload className="h-4 w-4" />
                    📤 אמן
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistorySupplier({ id: s.supplier_id, name: s.name })}
                    disabled={s.invoices === 0}
                    className="h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-foreground font-bold text-xs active:scale-[0.98] transition disabled:opacity-40"
                  >
                    <History className="h-4 w-4" />
                    היסטוריה
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {trainingSupplierId && (
        <InvoiceIntakeModal
          suppliers={suppliers}
          initialSupplierId={trainingSupplierId}
          trainingMode
          onClose={() => setTrainingSupplierId(null)}
          onSaved={() => {
            setTrainingSupplierId(null);
            void celebrate();
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {historySupplier && (
        <TrainingHistoryModal
          supplierId={historySupplier.id}
          supplierName={historySupplier.name}
          branchId={branchId}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setHistorySupplier(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// History modal — lists every training event for one supplier.
// Shows date, diff_summary badge, and a per-row expansion with
// the corrected items so the user can see what the AI learned from.
// ============================================================
interface HistoryRow {
  id: string;
  created_at: string;
  diff_summary: string | null;
  final_data: { items?: Array<{ item_name?: string }> } | null;
}

function TrainingHistoryModal({
  supplierId,
  supplierName,
  branchId,
  isSuperAdmin,
  onClose,
}: {
  supplierId: string;
  supplierName: string;
  branchId: string | null;
  isSuperAdmin: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("invoice_ocr_feedback")
        .select("id,created_at,diff_summary,final_data")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      const { data: sup } = await supabase
        .from("suppliers")
        .select("parsing_instructions")
        .eq("id", supplierId)
        .maybeSingle();
      if (cancelled) return;
      setRows(((data as unknown) as HistoryRow[]) ?? []);
      setInstructions((sup?.parsing_instructions as string) ?? "");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supplierId, branchId, isSuperAdmin]);

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm grid place-items-center p-3" onClick={onClose} dir="rtl">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-card border border-border rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between gap-2 p-4 border-b border-border">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-neon">היסטוריית אימון</div>
            <div className="font-bold text-base truncate">{supplierName}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 h-9 w-9 grid place-content-center rounded-md border border-border hover:border-neon hover:text-neon transition"
            aria-label="סגור"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {instructions && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 mb-1.5">
                🧠 הנחיות פרסור שנלמדו
              </div>
              <pre className="text-xs whitespace-pre-wrap text-emerald-100/90 font-mono leading-relaxed">{instructions}</pre>
            </div>
          )}

          {loading ? (
            <div className="text-center text-muted-foreground py-8">טוען היסטוריה…</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              עדיין לא בוצעו אימונים לספק זה.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {rows.length} אירועי אימון
              </div>
              {rows.map((r) => {
                const isPerfect = (r.diff_summary ?? "").startsWith("perfect");
                const m = /^edits:(\d+)/.exec(r.diff_summary ?? "");
                const edits = m ? Number(m[1]) : null;
                const aiSummary = (r.diff_summary ?? "").split(" · ")[1] ?? null;
                const itemCount = r.final_data?.items?.length ?? 0;
                return (
                  <div key={r.id} className="rounded-lg border border-border bg-background/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {new Date(r.created_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                      {isPerfect ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                          ✓ מושלם
                        </span>
                      ) : edits !== null ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-brand/15 border border-amber-brand/40 text-amber-brand">
                          {edits} תיקונים
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          legacy
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-foreground/80">
                      {itemCount} פריטים נשמרו
                    </div>
                    {aiSummary && (
                      <div className="text-[11px] text-emerald-400/90 border-r-2 border-emerald-500/40 pr-2">
                        💡 {aiSummary}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

