import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { useEffect } from "react";
import { triggerHaptic } from "@/lib/haptics";

type ToasterProps = React.ComponentProps<typeof Sonner>;

let hapticsPatched = false;
function patchToastHaptics() {
  if (hapticsPatched) return;
  hapticsPatched = true;
  const original = sonnerToast.error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sonnerToast as any).error = (...args: unknown[]) => {
    triggerHaptic("warning");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (original as any).apply(sonnerToast, args);
  };
}

const Toaster = ({ ...props }: ToasterProps) => {
  useEffect(() => {
    patchToastHaptics();
  }, []);
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group toast !bg-zinc-950 !text-zinc-100 !border !border-zinc-800 shadow-2xl rounded-lg backdrop-blur-sm",
          title: "!text-zinc-100 font-semibold",
          description: "!text-zinc-400",
          actionButton:
            "!bg-primary !text-primary-foreground hover:!opacity-90",
          cancelButton: "!bg-zinc-800 !text-zinc-300",
          closeButton: "!bg-zinc-900 !border-zinc-800 !text-zinc-400",
          success:
            "!bg-zinc-950 !border-l-4 !border-l-primary [&_[data-icon]]:!text-primary",
          info:
            "!bg-zinc-950 !border-l-4 !border-l-primary [&_[data-icon]]:!text-primary",
          error:
            "!bg-zinc-950 !border-l-4 !border-l-red-500 [&_[data-icon]]:!text-red-500",
          warning:
            "!bg-zinc-950 !border-l-4 !border-l-amber-500 [&_[data-icon]]:!text-amber-500",
          loading: "!bg-zinc-950 [&_[data-icon]]:!text-zinc-400",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
