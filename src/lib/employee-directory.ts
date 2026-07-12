// Employee directory helpers — server-backed via SECURITY DEFINER RPCs.
// `address` is automatically NULLed by the DB for non-managers (privacy layer).
import { supabase } from "@/integrations/supabase/client";

export type StaffDepartment = "kitchen" | "counter" | "delivery" | "management";

export const DEPARTMENT_LABEL: Record<StaffDepartment, string> = {
  kitchen: "מטבח",
  counter: "דלפק",
  delivery: "שליחים",
  management: "הנהלה",
};

export const DEPARTMENT_BADGE: Record<StaffDepartment, string> = {
  kitchen: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  counter: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  delivery: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  management: "bg-amber-500/15 text-amber-300 border-amber-500/40",
};

export type EmployeeRow = {
  user_id: string;
  full_name: string;
  department: StaffDepartment | null;
  seniority: string | null;
  phone: string | null;
  address: string | null;
  role: string | null;
  assigned_branch_id: string | null;
};

export async function fetchEmployeeDirectory(): Promise<EmployeeRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("list_employee_directory");
  if (error) {
    return [];
  }
  return (data ?? []) as EmployeeRow[];
}

export async function fetchGroupUserIds(group: string): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("list_users_in_group", { _group: group });
  if (error) {
    return [];
  }
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

/** Group tag dictionary: Hebrew label → DB enum key */
export const GROUP_TAGS: { tag: string; key: string; color: string; label: string }[] = [
  { tag: "כולם", key: "all", color: "bg-amber-500/20 text-amber-200 border-amber-400/50", label: "כולם" },
  { tag: "מטבח", key: "kitchen", color: "bg-orange-500/20 text-orange-200 border-orange-400/50", label: "מטבח" },
  { tag: "דלפק", key: "counter", color: "bg-sky-500/20 text-sky-200 border-sky-400/50", label: "דלפק" },
  { tag: "שליחים", key: "delivery", color: "bg-emerald-500/20 text-emerald-200 border-emerald-400/50", label: "שליחים" },
  { tag: "מנהלים", key: "management", color: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50", label: "מנהלים" },
];

/** Build a phone link cleaned for WhatsApp (Israel default 972). */
export function whatsappUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "972" + digits.slice(1);
  return `https://wa.me/${digits}`;
}
