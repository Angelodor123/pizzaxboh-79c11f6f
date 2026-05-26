import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  /** Async delete operation. Should throw on failure. */
  onConfirm: () => Promise<void>;
  /** Optional label override. Defaults to "מחק". */
  label?: string;
  /** Confirmation title. */
  title?: string;
  /** Confirmation description. */
  description?: string;
  /** Use outline (less prominent) instead of solid red. */
  variant?: "solid" | "outline";
  disabled?: boolean;
}

/**
 * Standardized destructive delete button for use at the bottom-left of
 * Edit/Quick-Edit modals. Triggers an AlertDialog confirmation.
 */
export function ModalDeleteButton({
  onConfirm,
  label = "מחק",
  title = "מחיקה לצמיתות",
  description = "האם למחוק פריט זה לצמיתות?",
  variant = "outline",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const base =
    "inline-flex items-center gap-1.5 h-11 px-4 rounded-md text-xs font-bold transition disabled:opacity-50";
  const cls =
    variant === "solid"
      ? `${base} bg-destructive text-destructive-foreground hover:bg-destructive/90`
      : `${base} border border-destructive/60 text-destructive hover:bg-destructive/10`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || busy}
        className={cls}
        aria-label={label}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {label}
      </button>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent dir="rtl" className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handle();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "מחק לצמיתות"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
