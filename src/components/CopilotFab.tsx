import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, X } from "lucide-react";
import { askCopilot } from "@/lib/copilot.functions";
import { useAuth } from "@/lib/auth";
import { CopilotMascot } from "@/components/CopilotMascot";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "model"; content: string };

const GREETING: Msg = {
  role: "model",
  content: "כאן העוזר התפעולי של Pizza X. כיצד אוכל לסייע?",
};

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

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
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
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="פתח את העוזר של Pizza X"
        className={cn(
          "fixed bottom-4 left-4 z-[60] h-14 w-14 rounded-full",
          "bg-gradient-to-br from-[#1a0e0a] to-black border-2 border-[#ff5a3c]/60",
          "shadow-[0_8px_24px_-4px_rgba(255,90,60,0.55)]",
          "flex items-center justify-center transition hover:scale-105 active:scale-95",
          "pb-[env(safe-area-inset-bottom)]"
        )}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        <CopilotMascot className="h-10 w-10" />
      </button>

      {/* Backdrop */}
      {open && (
        <button
          aria-label="סגור"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* Drawer */}
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label="העוזר התפעולי של Pizza X"
        className={cn(
          "fixed z-[80] bg-card border border-[#ff5a3c]/40 text-foreground",
          "shadow-[0_20px_60px_-10px_rgba(255,90,60,0.45)]",
          "flex flex-col transition-all duration-200",
          "right-0 left-0 bottom-0 rounded-t-2xl h-[80vh]",
          "sm:right-4 sm:left-auto sm:bottom-20 sm:w-[400px] sm:h-[600px] sm:rounded-2xl",
          open ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-gradient-to-l from-[#1a0e0a] to-card rounded-t-2xl">
          <div className="flex items-center gap-2 min-w-0">
            <CopilotMascot className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-wide truncate">Pizza X Copilot</p>
              <p className="text-[11px] text-muted-foreground truncate">העוזר התפעולי</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="סגור"
            className="h-8 w-8 rounded-md border border-border hover:border-[#ff5a3c]/60 inline-flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2 items-start",
                m.role === "user" ? "flex-row-reverse" : "flex-row"
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
                    : "bg-secondary text-foreground rounded-tl-sm border border-border"
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
              placeholder="שאל את העוזר..."
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rotate-180" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
