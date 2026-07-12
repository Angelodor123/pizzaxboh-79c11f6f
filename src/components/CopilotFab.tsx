import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, useMotionValue } from "framer-motion";
import { Loader2, Minus, Send, ListChecks, Package, AlertTriangle, ArrowLeft, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveBranchIdSync } from "@/lib/current-branch";
import { askCopilot, type CopilotAction } from "@/lib/copilot.functions";
import { getDailyBriefing } from "@/lib/briefing.functions";
import { useAuth } from "@/lib/auth";
import { CopilotMascot } from "@/components/CopilotMascot";
import { cn } from "@/lib/utils";

const COPILOT_OPENED_KEY = "pizzax-copilot-opened-date";
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function hasOpenedToday() {
  try { return localStorage.getItem(COPILOT_OPENED_KEY) === todayKey(); } catch { return false; }
}
function markOpenedToday() {
  try { localStorage.setItem(COPILOT_OPENED_KEY, todayKey()); } catch { /* noop */ }
}
const GREETINGS = [
  "ג'וני כאן. מה קורה? 💬",
  "ג'וני זמין. מה צריך?",
  "כאן ג'וני. דברו אליי.",
];
function randomGreeting() {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}


type Msg = { role: "user" | "model"; content: string; actions?: CopilotAction[] };

const TUTORIAL_PATTERNS = [
  /תפעיל\s*את\s*המדריך/,
  /הפעל\s*את\s*המדריך/,
  /איך\s*משתמשים\s*במערכת/,
  /^\s*עזרה\s*$/,
  /הראה\s*לי\s*את\s*המדריך/,
  /סיור\s*מודרך/,
];

function isTutorialIntent(text: string) {
  return TUTORIAL_PATTERNS.some((re) => re.test(text));
}

function triggerTutorial() {
  window.dispatchEvent(new Event("pizzax:start-tour"));
}

const FAB_SIZE = 60;
const MARGIN = 16;

const QUICK_ACTIONS = [
  "מה מצב המלאי?",
  "כמה הכנות נשארו?",
  "מה החוסרים היום?",
  "פתח פנקס עבודה",
  "חפש מתכון",
];

export function CopilotFab() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDailyCta, setShowDailyCta] = useState(false);
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const ask = useServerFn(askCopilot);
  const fetchBriefing = useServerFn(getDailyBriefing);
  const router = useRouter();
  const { role, isSuperAdmin } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draggedRef = useRef(false);
  const initializedRef = useRef(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [bounds, setBounds] = useState({ left: 0, top: 0, right: 0, bottom: 0 });

  // Show daily briefing CTA if user hasn't opened today
  // Inject the johnny-pulse keyframes once on mount
  useEffect(() => {
    const id = "johnny-pulse-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@keyframes johnny-pulse { 0%,100% { opacity: 0; } 50% { opacity: 0.5; } }`;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    if (!hasOpenedToday()) setShowDailyCta(true);
  }, []);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setBounds({
        left: -(w - FAB_SIZE - MARGIN * 2),
        top: -(h - FAB_SIZE - MARGIN * 2),
        right: 0,
        bottom: 0,
      });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pizzax-copilot-pos") || "null");
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
        x.set(saved.x);
        y.set(saved.y);
      }
    } catch {
      /* noop */
    }
  }, [x, y]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open && typeof window !== "undefined" && window.innerWidth >= 768) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Track visualViewport so the modal stays above the on-screen keyboard
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const isMobile = window.innerWidth < 640;
      // On mobile when keyboard is up, dock just above keyboard with small gap
      const bottom = kb > 0 ? `${kb + 8}px` : isMobile ? "5rem" : "5rem";
      const avail = vv.height - (kb > 0 ? 16 : 96);
      root.style.setProperty("--copilot-bottom", bottom);
      root.style.setProperty("--copilot-h", `${Math.max(280, Math.min(560, avail))}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--copilot-bottom");
      root.style.removeProperty("--copilot-h");
    };
  }, [open]);


  // Lock body scroll while chat is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const initSession = useCallback(
    async (firstToday: boolean) => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      if (!firstToday) {
        setMessages([{ role: "model", content: randomGreeting() }]);
        return;
      }

      // Show a quick loading placeholder, then fetch the contextual briefing
      setMessages([
        { role: "model", content: "רגע, סוקר את המצב להיום... 🌿" },
      ]);
      try {
        const briefing = await fetchBriefing({ data: {} } as any);
        setBriefingText(briefing.summaryText);
        setMessages([{ role: "model", content: briefing.summaryText }]);
      } catch (err) {
        const hour = new Date().getHours();
        const tg = hour >= 5 && hour < 12 ? "בוקר טוב" : hour >= 12 && hour < 18 ? "צהריים טובים" : "ערב טוב";
        setMessages([
          { role: "model", content: `${tg}, ג'וני כאן. מוכן לעבודה. דברו אליי. 💬` },
        ]);
      }
    },
    [fetchBriefing],
  );


  const handleFabClick = useCallback(() => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    const firstToday = !hasOpenedToday();
    markOpenedToday();
    setShowDailyCta(false);
    setOpen(true);
    void initSession(firstToday);
  }, [initSession]);

  async function handleSend(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");

    if (isTutorialIntent(text)) {
      setMessages((m) => [
        ...m,
        { role: "model", content: "בוודאי. פותח עבורך את המדריך המודרך כעת." },
      ]);
      setOpen(false);
      setTimeout(triggerTutorial, 250);
      return;
    }

    setLoading(true);
    try {
      const { getCurrentBranchId } = await import("@/lib/current-branch");
      const branchId = await getCurrentBranchId();
      const res = await ask({
        data: {
          messages: next.slice(-20),
          context: {
            route: router.state.location.pathname,
            role: isSuperAdmin ? "super_admin" : role ?? "guest",
            branchId: branchId ?? undefined,
            briefing: briefingText ?? undefined,
          },
        },
      });
      setMessages((m) => [...m, { role: "model", content: res.reply, actions: res.actions }]);
    } catch (err: any) {
      const detail = isSuperAdmin
        ? `\n\n🔧 לסופר־אדמין: ${String(err?.message ?? err).slice(0, 220)}`
        : "";
      setMessages((m) => [
        ...m,
        {
          role: "model",
          content:
            "וואלה אחי, נפל לי השרת רגע 🌿 לא הצלחתי להגיע למודל. תנסה עוד שנייה." +
            detail,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Daily greeting tooltip — only when user hasn't opened today */}
      {showDailyCta && !open && (
        <div
          dir="rtl"
          aria-hidden="true"
          className="fixed z-50 pointer-events-none animate-fade-in"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)",
            right: "1rem",
          }}
        >
          <div className="relative bg-gradient-to-br from-[#ff3d8a] to-[#c4006a] text-white text-xs font-bold px-3 py-2 rounded-xl shadow-[0_8px_24px_-4px_rgba(255,61,138,0.6)] whitespace-nowrap">
            ג'וני זמין לעזרה 👇
            <span className="absolute -bottom-1.5 right-6 w-3 h-3 bg-[#c4006a] rotate-45" />
          </div>
        </div>
      )}

      {/* Draggable FAB anchored bottom-right */}
      <div
        className="fixed z-50"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
          right: "1rem",
        }}
      >
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0}
          dragConstraints={bounds}
          style={{ x, y }}
          onDragStart={() => {
            draggedRef.current = true;
          }}
          onDragEnd={() => {
            try {
              localStorage.setItem(
                "pizzax-copilot-pos",
                JSON.stringify({ x: x.get(), y: y.get() }),
              );
            } catch {
              /* noop */
            }
            setTimeout(() => {
              draggedRef.current = false;
            }, 50);
          }}
          className={cn("relative touch-none", open && "opacity-0 pointer-events-none")}
        >
          {showDailyCta && (
            <>
              <span className="absolute inset-0 rounded-full ring-2 ring-[#ff3d8a] animate-ping pointer-events-none" />
              <span className="absolute inset-[-4px] rounded-full ring-2 ring-[#ff3d8a]/40 animate-pulse pointer-events-none" />
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full pointer-events-none bg-[#39ff88]"
                style={{
                  animation: "johnny-pulse 2s ease-in-out infinite",
                  willChange: "opacity",
                }}
              />
            </>
          )}
          <button
            type="button"
            onClick={handleFabClick}
            aria-label="פתח את ג'וני, מנהל התפעול הדיגיטלי"
            style={{
              width: FAB_SIZE,
              height: FAB_SIZE,
            }}
            className={cn(
              "relative rounded-full cursor-grab active:cursor-grabbing",
              "bg-gradient-to-br from-zinc-900 to-black border-2",
              showDailyCta ? "border-[#39ff88] shadow-[0_8px_24px_-4px_rgba(57,255,136,0.65)]" : "border-[#ff3d8a]/60 shadow-[0_8px_24px_-4px_rgba(255,61,138,0.55)]",
              "flex items-center justify-center hover:scale-105 active:scale-95 transition-transform",
              showDailyCta && "animate-bounce",
            )}
          >
            <CopilotMascot className="h-10 w-10" glow={showDailyCta} />
          </button>
        </motion.div>
      </div>

      {/* Chat window — sized, not fullscreen */}
      {open && (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="false"
          aria-label="ג'וני - מנהל התפעול הדיגיטלי"
          className={cn(
            "fixed z-50 bg-card border border-[#ff3d8a]/40 text-foreground rounded-2xl",
            "shadow-[0_20px_60px_-10px_rgba(255,61,138,0.45)]",
            "flex flex-col overflow-hidden animate-scale-in",
            // Mobile: bottom sheet that fills available width; Desktop: floating window
            "left-2 right-2 sm:left-auto sm:right-4 sm:w-96",
            "h-[min(500px,var(--copilot-h,85dvh))] sm:h-[500px] sm:max-h-[85dvh]",
          )}
          style={{
            bottom: "calc(var(--copilot-bottom, 5rem) + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-gradient-to-l from-[#1a0a14] to-card">
            <div className="flex items-center gap-2 min-w-0">
              <CopilotMascot className="h-9 w-9 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-wide truncate">ג'וני</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  מנהל התפעול הדיגיטלי
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="מזער"
              title="מזער"
              className="h-8 w-8 rounded-md border border-border hover:border-[#ff3d8a]/60 inline-flex items-center justify-center"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2 items-start",
                  m.role === "user" ? "flex-row-reverse" : "flex-row",
                )}
              >
                {m.role === "model" && (
                  <CopilotMascot className="h-7 w-7 shrink-0 mt-0.5" />
                )}
                <div className="max-w-[80%] flex flex-col gap-2 items-stretch">
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary text-foreground rounded-tl-sm border border-border",
                    )}
                  >
                    {m.content}
                  </div>
                  {m.role === "model" && m.actions && m.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.actions.map((a) => (
                        <Link
                          key={a.kind}
                          to={a.to}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition active:scale-95",
                            a.count > 0
                              ? "bg-[#ff3d8a]/15 border-[#ff3d8a]/60 text-[#ff66c4] hover:bg-[#ff3d8a]/25"
                              : "bg-secondary border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {a.kind === "tasks" && <ListChecks className="h-3.5 w-3.5" />}
                          {a.kind === "warehouse" && <Package className="h-3.5 w-3.5" />}
                          {a.kind === "shortages" && <AlertTriangle className="h-3.5 w-3.5" />}
                          <span>{a.label}</span>
                          <ArrowLeft className="h-3 w-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-start">
                <CopilotMascot className="h-7 w-7 shrink-0 mt-0.5" />
                <div className="bg-secondary border border-[#ff3d8a]/40 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-foreground inline-flex items-center gap-2">
                  <span className="inline-flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ff3d8a] animate-pulse [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ff3d8a] animate-pulse [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ff3d8a] animate-pulse [animation-delay:300ms]" />
                  </span>
                  <span className="text-muted-foreground">ג'וני בודק במערכת...</span>
                </div>
              </div>
            )}
          </div>


          {/* Composer */}
          <div className="shrink-0 border-t border-border p-3 bg-card/80">
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {QUICK_ACTIONS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      if (chip === "פתח פנקס עבודה") {
                        setOpen(false);
                        void router.navigate({ to: "/notebook" });
                        return;
                      }
                      setInput(chip);
                      void handleSend(chip);
                    }}
                    className="rounded-full border border-border bg-card/60 text-xs text-muted-foreground px-3 py-1.5 hover:border-neon/60 hover:text-neon transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                dir="rtl"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder="שאל את ג'וני..."
                className="flex-1 resize-none rounded-xl bg-background border border-border focus:border-[#ff3d8a] focus:ring-1 focus:ring-[#ff3d8a]/40 outline-none px-3 py-2 text-sm max-h-32"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                aria-label="שלח"
                className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-[#ff3d8a] to-[#c4006a] text-white inline-flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 rotate-180" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
