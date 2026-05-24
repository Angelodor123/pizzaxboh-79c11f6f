export interface OrderRow {
  name: string;
  qty: string;
}

export function compileOrderMessage(rows: OrderRow[], notes: string): string {
  const cleanRows = rows.filter((r) => r.name.trim() !== "" || r.qty.trim() !== "");
  const list = cleanRows
    .map((r, i) => `${i + 1}. ${r.name.trim()} - ${r.qty.trim()}`)
    .join("\n");
  const noteLine = notes.trim() ? `\n\nהערות: ${notes.trim()}` : "";
  return `היי, מה נשמע?\n\nאנחנו רוצים לבצע הזמנה של המוצרים הבאים:\n\n${list}${noteLine}\n\nתודה רבה.`;
}

export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  // strip non-digits, drop leading 0 → assume Israel +972 if 9–10 digits starting with 0
  let p = phone.replace(/\D/g, "");
  if (!p) return null;
  if (p.startsWith("0")) p = "972" + p.slice(1);
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}
