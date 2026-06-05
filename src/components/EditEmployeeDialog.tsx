// Manager-only dialog to edit operational fields on a profile:
// department / seniority / phone / address.
import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DEPARTMENT_LABEL,
  type EmployeeRow,
  type StaffDepartment,
} from "@/lib/employee-directory";

interface Props {
  employee: EmployeeRow;
  onClose: () => void;
  onSaved: () => void;
}

const DEPARTMENTS: StaffDepartment[] = ["kitchen", "counter", "delivery", "management"];

export function EditEmployeeDialog({ employee, onClose, onSaved }: Props) {
  const [department, setDepartment] = useState<StaffDepartment | "">(employee.department ?? "");
  const [seniority, setSeniority] = useState(employee.seniority ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [address, setAddress] = useState(employee.address ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("profiles") as any)
      .update({
        department: department || null,
        seniority: seniority.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      .eq("user_id", employee.user_id);
    setBusy(false);
    if (error) {
      console.error(error);
      toast.error("שמירה נכשלה: " + error.message);
      return;
    }
    toast.success("פרטי העובד עודכנו");
    onSaved();
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-lg">עריכת עובד: {employee.full_name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-800/60 text-muted-foreground"
            aria-label="סגור"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={save} className="space-y-3">
          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">מחלקה</span>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value as StaffDepartment | "")}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/40"
            >
              <option value="">— בחר —</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {DEPARTMENT_LABEL[d]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">ותק</span>
            <input
              type="text"
              value={seniority}
              onChange={(e) => setSeniority(e.target.value)}
              placeholder='לדוגמה: "שנה וחצי", "גיוס נובמבר 24"'
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/40"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">טלפון</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/40"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">כתובת מגורים</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="רחוב, מספר, עיר"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/40"
            />
            <span className="text-[10px] text-muted-foreground mt-1 block">
              שדה מוסתר אוטומטית מעובדים רגילים — נראה רק למנהלים.
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-neon text-primary-foreground font-bold py-2.5 glow-neon hover:brightness-110 transition disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            שמור
          </button>
        </form>
      </div>
    </div>
  );
}
