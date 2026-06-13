// Shared helpers for the copilot tool modules. Extracted from
// copilot.functions.ts without behavior changes so each domain can live
// in its own file.

export function isPermissionError(err: any): boolean {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  const code = String(err?.code ?? "");
  return (
    code === "42501" ||
    code === "PGRST301" ||
    msg.includes("row-level security") ||
    msg.includes("row level security") ||
    msg.includes("permission denied") ||
    msg.includes("violates row-level")
  );
}

export function wrapError(err: any) {
  if (isPermissionError(err)) {
    return { error: "permission_denied", message: "אין לך הרשאה לפעולה הזו (RLS חסם)." };
  }
  return { error: String(err?.message ?? err) };
}

export const SAFE_TABLES = [
  "branches",
  "shifts",
  "tasks",
  "task_groups",
  "daily_task_logs",
  "prep_items",
  "prep_log",
  "dough_updates_log",
  "inventory_items",
  "inventory_movements",
  "calendar_events",
  "calendar_event_overrides",
  "suppliers",
  "orders",
  "invoices",
  "invoice_items",
  "restock_items",
  "restock_log",
  "ev_vehicles",
  "notebook_items",
  "recipes",
  "app_settings",
  "site_texts",
  "page_onboarding",
  "user_roles",
  "profiles",
] as const;
