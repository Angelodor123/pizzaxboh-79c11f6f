import { Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveBranchId } from "@/lib/current-branch";
import { useActiveBranch, useBranches } from "@/components/BranchGate";
import { useAuth } from "@/lib/auth";

export function BranchSwitcher() {
  const { isSuperAdmin } = useAuth();
  const { branches } = useBranches();
  const activeId = useActiveBranch();
  const active = branches.find((b) => b.id === activeId);

  if (!isSuperAdmin || branches.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-9 inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 text-xs font-semibold text-foreground hover:text-neon hover:border-neon/60 transition"
          aria-label="החלפת סניף"
          title="החלפת סניף"
        >
          <Building2 className="h-3.5 w-3.5" />
          <span className="max-w-[90px] truncate">{active?.name ?? "סניף"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>החלפת סניף</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => {
              if (b.id !== activeId) {
                setActiveBranchId(b.id);
                if (typeof window !== "undefined") window.location.reload();
              }
            }}
            className={b.id === activeId ? "text-neon font-bold" : ""}
          >
            {b.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setActiveBranchId(null);
            if (typeof window !== "undefined") window.location.reload();
          }}
          className="text-muted-foreground"
        >
          חזרה למסך בחירת סניף
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
