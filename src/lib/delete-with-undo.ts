// Soft-delete with a 5-second undo toast (sonner action).
// The actual delete is delayed; if the user clicks Undo we cancel it
// and call onUndo() to restore optimistic UI state.
//
// Usage:
//   deleteWithUndo({
//     label: "הפנייה נמחקה",
//     onCommit: async () => { await supabase.from(...).delete()... },
//     onUndo: () => setRows(prev => [removed, ...prev]),
//   });
import { toast } from "sonner";
import { toastError } from "./error-messages";

export type DeleteWithUndoOptions = {
  label: string;
  /** Called if the user does NOT undo. May throw to show an error toast. */
  onCommit: () => Promise<void> | void;
  /** Called when the user clicks Undo. */
  onUndo?: () => void;
  /** ms before commit (default 5000). */
  delayMs?: number;
};

export function deleteWithUndo(opts: DeleteWithUndoOptions) {
  const delay = opts.delayMs ?? 5000;
  let cancelled = false;

  const timer = setTimeout(async () => {
    if (cancelled) return;
    try {
      await opts.onCommit();
    } catch (err) {
      toastError(err);
      opts.onUndo?.();
    }
  }, delay);

  toast(opts.label, {
    duration: delay,
    action: {
      label: "בטל",
      onClick: () => {
        cancelled = true;
        clearTimeout(timer);
        opts.onUndo?.();
        toast.success("הפעולה בוטלה");
      },
    },
  });
}
