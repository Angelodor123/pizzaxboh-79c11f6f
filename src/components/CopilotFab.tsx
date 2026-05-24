import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, useMotionValue } from "framer-motion";
import { Loader2, Minus, Send, Sparkles } from "lucide-react";
import { askCopilot } from "@/lib/copilot.functions";
import { useAuth } from "@/lib/auth";
import { CopilotMascot } from "@/components/CopilotMascot";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "model"; content: string };

const GREETING: Msg = {
  role: "model",
  content:
    "שלום, אני ג'וני, מנהל התפעול הדיגיטלי. אני כאן כדי לעזור עם נהלי העבודה, המערכת וקליטת הסחורות. מה אפשר לעשות בשבילכם היום?",
};

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

const FAB_SIZE = 56;
const MARGIN = 16;

export function CopilotFab() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = useServerFn(askCopilot);
  const router = useRouter();
  const { role, isSuperAdmin } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draggedRef = useRef(false);

  // Position (bottom-right by default), persisted to keep user's last spot
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [bounds, setBounds] = useState({ left: 0, top: 0, right: 0, bottom: 0 });

  useEffect(() => {
    const compute = () => {
      const safeBottom = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--sab") || "0",
        10,
      ) || 0;
      const w = window.innerWidth;
      const h = window.innerHeight;
      // We place FAB anchored bottom-right via style; drag offsets from there.
      setBounds({
        left: -(w - FAB_SIZE - MARGIN * 2),
        top: -(h - FAB_SIZE - MARGIN * 2 - safeBottom),
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
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleFabClick = useCallback(() => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    setOpen(true);
  }, []);

  async function handleSend(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");

    if (isTutorialIntent(text)) {
      setMessages((m) => [
        ...m,
        {
          role: "model",
          content: "בוודאי. פותח עבורך את המדריך המודרך כעת.",
        },
      ]);
      setOpen(false);
      setTimeout(triggerTutorial, 250);
      return;
    }

    setLoading(true);
    try {
      const res = await ask({
        data: {
          messages: next.filter((m) => m !== GREETING).slice(-20),
          context: {
            route: router.state.location.pathname,
            role: isSuperAdmin ? "super_admin" : role ?? "guest",
          },
        },
      });
      setMessages((m) => [...m, { role: "model", content: res.reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "model", content: "השירות לא זמין כרגע. נסה שוב בעוד רגע." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Draggable FAB anchored bottom-right */}
      <motion.button
        type="button"
        drag
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={bounds}
        style={{
          x,
          y,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
          right: "1rem",
        }}
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
          // Reset slightly later so click handler can read it
          setTimeout(() => {
            draggedRef.current = false;
          }, 50);
        }}
        onClick={handleFabClick}
        aria-label="פתח את ג'וני, מנהל התפעול הדיגיטלי"
        className={cn(
          "fixed z-50 h-14 w-14 rounded-full touch-none cursor-grab active:cursor-grabbing",
          "bg-gradient-to-br from-[#1a0e0a] to-black border-2 border-[#ff5a3c]/60",
          "shadow-[0_8px_24px_-4px_rgba(255,90,60,0.55)]",
          "flex items-center justify-center hover:scale-105 active:scale-95 transition-transform",
          open && "opacity-0 pointer-events-none",
        )}
      >
        <CopilotMascot className="h-10 w-10" />
      </motion.button>

      {/* Chat window — sized, not fullscreen */}
      {open && (
        <div
          dir="rtl"
          role="dialog"
          aria-modal="false"
          aria-label="ג'וני - מנהל התפעול הדיגיטלי"
          className={cn(
            "fixed z-50 bg-card border border-[#ff5a3c]/40 text-foreground rounded-2xl",
            "shadow-[0_20px_60px_-10px_rgba(255,90,60,0.45)]",
            "flex flex-col overflow-hidden",
            "w-96 h-[500px] max-w-[90vw] max-h-[80vh]",
          )}
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)",
            right: "1rem",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-gradient-to-l from-[#1a0e0a] to-card">
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
              className="h-8 w-8 rounded-md border border-border hover:border-[#ff5a3c]/60 inline-flex items-center justify-center"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
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
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-secondary text-foreground rounded-tl-sm border border-border",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-start">
                <CopilotMascot className="h-7 w-7 shrink-0 mt-0.5" />
                <div className="bg-secondary border border-border rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  חושב...
                </div>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void handleSend("תפעיל את המדריך")}
              className="inline-flex items-center gap-1 rounded-full border border-[#ff5a3c]/40 bg-background/60 px-2.5 py-1 text-[11px] text-foreground hover:border-[#ff5a3c] transition"
            >
              <Sparkles className="h-3 w-3" />
              הפעל את המדריך
            </button>
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3 bg-card/80">
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
                className="flex-1 resize-none rounded-xl bg-background border border-border focus:border-[#ff5a3c] focus:ring-1 focus:ring-[#ff5a3c]/40 outline-none px-3 py-2 text-sm max-h-32"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                aria-label="שלח"
                className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-[#ff5a3c] to-[#b91c1c] text-white inline-flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition"
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
