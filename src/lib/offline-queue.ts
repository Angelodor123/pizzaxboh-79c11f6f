// Lightweight offline action queue. Persists pending mutations to
// localStorage and replays them when the browser regains connectivity.
//
// Usage:
//   import { runOrQueue, registerQueueHandler } from "@/lib/offline-queue";
//   registerQueueHandler("task.toggle", async (payload) => { ... });
//   await runOrQueue("task.toggle", { id, completed }, "סימון משימה");
//
// Idempotency: pass opts.clientId to dedupe retries / double-taps.
// - If an action with the same (kind, clientId) is already in flight,
//   the second call returns the same promise instead of issuing a duplicate.
// - If an action with the same (kind, clientId) is already queued offline,
//   the new payload replaces it instead of stacking.
import { toast } from "sonner";
import { toastError } from "./error-messages";
import { recheckOnlineStatus } from "./online-status";

const STORAGE_KEY = "lovable.offline-queue.v1";

export type QueuedAction = {
  id: string;
  kind: string;
  clientId?: string;
  payload: unknown;
  label: string;
  createdAt: number;
  attempts: number;
};

type Handler = (payload: unknown) => Promise<void> | void;

const handlers = new Map<string, Handler>();
const inFlight = new Map<string, Promise<{ queued: boolean }>>();
let flushing = false;
let initialized = false;

function read(): QueuedAction[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

function write(actions: QueuedAction[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch {
    /* ignore quota errors */
  }
  notify(actions.length);
}

const listeners = new Set<(count: number) => void>();
function notify(count: number) {
  listeners.forEach((l) => {
    try {
      l(count);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeQueueCount(cb: (count: number) => void) {
  listeners.add(cb);
  cb(read().length);
  return () => listeners.delete(cb);
}

export function registerQueueHandler(kind: string, handler: Handler) {
  handlers.set(kind, handler);
  ensureInit();
}

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("online", () => {
    void flushQueue();
  });
  // Try once on startup in case there is residue from a previous session.
  setTimeout(() => void flushQueue(), 1500);
}

export async function flushQueue() {
  if (flushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const online = await recheckOnlineStatus();
    if (!online) return;
  }
  flushing = true;
  try {
    const actions = read();
    if (!actions.length) return;
    const remaining: QueuedAction[] = [];
    let okCount = 0;
    for (const action of actions) {
      const handler = handlers.get(action.kind);
      if (!handler) {
        remaining.push(action);
        continue;
      }
      try {
        await handler(action.payload);
        okCount++;
      } catch (err) {
        action.attempts = (action.attempts ?? 0) + 1;
        // Drop after 5 failed attempts to avoid poison messages.
        if (action.attempts < 5) remaining.push(action);
        else toastError(err, `הפעולה "${action.label}" נכשלה והוסרה מהתור.`);
      }
    }
    write(remaining);
    if (okCount > 0) {
      toast.success(
        okCount === 1
          ? "פעולה אחת נשלחה לשרת לאחר חזרת החיבור."
          : `${okCount} פעולות נשלחו לשרת לאחר חזרת החיבור.`,
      );
    }
  } finally {
    flushing = false;
  }
}

export type RunOrQueueOptions = {
  /**
   * Stable identifier for idempotency. Two calls with the same
   * (kind, clientId) won't run in parallel and won't stack in the queue.
   * Recommended: `crypto.randomUUID()` per logical user action.
   */
  clientId?: string;
};

export async function runOrQueue(
  kind: string,
  payload: unknown,
  label: string,
  opts: RunOrQueueOptions = {},
): Promise<{ queued: boolean }> {
  ensureInit();
  const dedupeKey = opts.clientId ? `${kind}::${opts.clientId}` : "";
  if (dedupeKey && inFlight.has(dedupeKey)) {
    return inFlight.get(dedupeKey)!;
  }
  const exec = async (): Promise<{ queued: boolean }> => {
    const online =
      typeof navigator === "undefined" || navigator.onLine
        ? true
        : await recheckOnlineStatus();
    const handler = handlers.get(kind);
    if (online && handler) {
      try {
        await handler(payload);
        return { queued: false };
      } catch (err) {
        const msg = (err as { message?: string })?.message || "";
        if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
          enqueue(kind, payload, label, opts.clientId);
          toast.info(`אין חיבור — "${label}" יישלח כשהחיבור יחזור.`);
          return { queued: true };
        }
        throw err;
      }
    }
    enqueue(kind, payload, label, opts.clientId);
    toast.info(`אין חיבור — "${label}" יישלח כשהחיבור יחזור.`);
    return { queued: true };
  };
  const promise = exec().finally(() => {
    if (dedupeKey) inFlight.delete(dedupeKey);
  });
  if (dedupeKey) inFlight.set(dedupeKey, promise);
  return promise;
}

function enqueue(kind: string, payload: unknown, label: string, clientId?: string) {
  const list = read();
  // Replace any existing queued action with the same (kind, clientId).
  const filtered = clientId
    ? list.filter((a) => !(a.kind === kind && a.clientId === clientId))
    : list;
  filtered.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    clientId,
    payload,
    label,
    createdAt: Date.now(),
    attempts: 0,
  });
  write(filtered);
}

export function getQueueCount(): number {
  return read().length;
}

export function clearQueue() {
  write([]);
}
