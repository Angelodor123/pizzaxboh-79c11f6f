import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const OcrInput = z.object({
  imageBase64: z.string().min(100).max(15_000_000),
  mimeType: z.string().min(3).max(64).default("image/jpeg"),
  supplierHintId: z.string().uuid().nullable().optional(),
});

type OcrItem = { name: string; quantity: number; unit_price?: number; total_price?: number };
type ParsedReceipt = {
  supplier_name_hint: string | null;
  invoice_number: string | null;
  total_amount: number | null;
  document_date: string | null;
  items: OcrItem[];
};

// Reuse the rich parsing prompt + normalization from the training pipeline so
// the real "Smart Receiving" modal benefits from the same logistical-item
// filtering, date/number normalization, hidden-discount math, learned
// supplier-specific instructions, and catalog RAG context.
const BASE_SYSTEM = `אתה מערכת OCR לקבלות וחשבוניות בעברית, מבוססת Google Gemini Vision.
- קרא את כל השורות, התעלם מלוגואים, כותרות עיצוביות, חתימות, חותמות וברקודים.
- חלץ עבור כל שורת פריט: שם פריט נקי (בעברית אם קיים), כמות, מחיר נטו ליחידה, וסה"כ.
- אם ערך לא ברור — החזר null (אל תנחש מספרים). שדה items חייב להיות מערך, גם אם ריק.

🚫 סינון פריטים לוגיסטיים: התעלם מ"משטח", "פלטה", "ארגז ריק", "פיקדון", "Pallet", "Crate", "Deposit".

📄 תעודות משלוח ללא מחירים: חלץ שמות וכמויות; השאר מחירים=null.

🔢 נרמול מספרים: הסר ₪/$/€/ש״ח/שח/NIS/ILS ופסיקי אלפים. דוגמה: "₪569.86"→569.86. total_amount חייב להיות הסכום הסופי כולל מע״מ ("סה״כ לתשלום"/"Total").

📅 נרמול תאריך: ISO YYYY-MM-DD בלבד. המר "27/05/26"→"2026-05-27" (יום/חודש/שנה ישראלי). תאריך לא קריא → null.

🧮 הנחות מובלעות: אם quantity × unit_price המודפס גדול מ-total_price המודפס ביותר מ-1% — חשב את הנטו האמיתי: unit_price = total_price / quantity.`;

const NumLike = z.preprocess((v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v
      .replace(/[₪$€£]/g, "")
      .replace(/ש["״']?\s*ח/g, "")
      .replace(/NIS|ILS/gi, "")
      .replace(/,/g, "")
      .replace(/[^\d.\-]/g, "")
      .trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}, z.number().nullable());

const DateLike = z.preprocess((v) => {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let y = parseInt(dmy[3], 10); if (y < 100) y += 2000;
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}, z.string().nullable());

const ParsedSchema = z.object({
  supplier_guess: z.string().max(120).nullable().optional(),
  invoice_number: z.string().max(60).nullable().optional(),
  document_date: DateLike.optional(),
  total_amount: NumLike.optional(),
  items: z.array(z.object({
    item_name: z.string().min(1).max(200),
    quantity: NumLike.optional(),
    unit_price: NumLike.optional(),
    total_price: NumLike.optional(),
  })).max(120),
});

function buildCatalogBlock(catalog: Array<{ name: string; unit?: string | null; price?: number | null }>, supplierName: string | null): string {
  if (!catalog.length) return "";
  const lines = catalog.slice(0, 200).map((c, i) => {
    const parts: string[] = [`${i + 1}. ${c.name}`];
    if (c.unit) parts.push(`יח׳:${c.unit}`);
    if (c.price != null) parts.push(`מחיר צפוי:${c.price}`);
    return parts.join(" | ");
  });
  const label = supplierName ? ` של הספק "${supplierName}"` : "";
  return `\n\n📚 קטלוג ידוע${label} — מפה את שמות הפריטים לשמות הקנוניים מהרשימה:\n${lines.join("\n")}`;
}

export const ocrInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => OcrInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { parsed: null as ParsedReceipt | null, matches: [], error: "LOVABLE_API_KEY missing" };
    }

    const { supabase } = context;

    // Load supplier-specific learned instructions + catalog for RAG
    let supplierHint = "";
    let supplierName: string | null = null;
    let catalog: Array<{ name: string; unit: string | null; price: number | null }> = [];
    if (data.supplierHintId) {
      const { data: sup } = await supabase
        .from("suppliers")
        .select("name, parsing_instructions")
        .eq("id", data.supplierHintId)
        .maybeSingle();
      if (sup?.name) supplierName = sup.name;
      if (sup?.parsing_instructions) {
        supplierHint = `\n\nהנחיות ספציפיות לספק "${sup.name}" (נלמדו אוטומטית):\n${sup.parsing_instructions}`;
      }
      const { data: products } = await supabase
        .from("supplier_products")
        .select("name, unit, expected_price, cost_price")
        .eq("supplier_id", data.supplierHintId)
        .eq("active", true)
        .limit(200);
      catalog = (products ?? []).map((p: { name: string; unit: string | null; expected_price: number | null; cost_price: number | null }) => ({
        name: p.name, unit: p.unit, price: p.cost_price ?? p.expected_price,
      }));
    }

    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    let parsed: ParsedReceipt | null = null;
    try {
      const { output } = await generateText({
        model,
        system: BASE_SYSTEM + supplierHint + buildCatalogBlock(catalog, supplierName),
        output: Output.object({ schema: ParsedSchema }),
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "פענח את החשבונית/קבלה הזו. החזר JSON תקין בלבד." },
            { type: "image", image: dataUrl, mediaType: data.mimeType || "image/jpeg" },
          ],
        }],
      });
      parsed = {
        supplier_name_hint: output.supplier_guess ?? null,
        invoice_number: output.invoice_number ?? null,
        total_amount: output.total_amount ?? null,
        document_date: output.document_date ?? null,
        items: (output.items ?? []).map((it) => ({
          name: it.item_name,
          quantity: Number(it.quantity ?? 0) || 0,
          unit_price: it.unit_price ?? undefined,
          total_price: it.total_price ?? undefined,
        })),
      };
    } catch (e) {
      console.error("OCR error", e);
      const msg = (e as Error).message || "";
      return {
        parsed: null,
        matches: [],
        error: msg.includes("429") ? "מכסת AI התמלאה, נסה שוב מאוחר יותר" :
               msg.includes("402") ? "נגמר הקרדיט ל-AI" :
               "ניתוח החשבונית נכשל",
      };
    }

    // Find recent sent orders within 48h for matching
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from("orders")
      .select("id, supplier_id, sent_at, items, notes, status")
      .eq("status", "sent")
      .gte("sent_at", cutoff)
      .order("sent_at", { ascending: false })
      .limit(15);
    if (data.supplierHintId) query = query.eq("supplier_id", data.supplierHintId);
    const { data: orders } = await query;

    const supplierIds = Array.from(new Set((orders ?? []).map((o) => o.supplier_id)));
    let supplierMap: Record<string, string> = {};
    if (supplierIds.length) {
      const { data: sups } = await supabase
        .from("suppliers")
        .select("id, name")
        .in("id", supplierIds);
      supplierMap = Object.fromEntries((sups ?? []).map((s) => [s.id, s.name]));
    }

    const hint = (parsed?.supplier_name_hint ?? "").toLowerCase().trim();
    const matches = (orders ?? []).map((o) => {
      const supName = supplierMap[o.supplier_id] ?? "";
      let score = 0;
      if (data.supplierHintId && o.supplier_id === data.supplierHintId) score += 50;
      if (hint && supName && (supName.toLowerCase().includes(hint) || hint.includes(supName.toLowerCase()))) score += 30;
      const ageHrs = (Date.now() - new Date(o.sent_at).getTime()) / 3_600_000;
      score += Math.max(0, 20 - ageHrs);
      return {
        order_id: o.id as string,
        supplier_id: o.supplier_id as string,
        supplier_name: supName,
        sent_at: o.sent_at as string,
        items: (o.items ?? []) as Array<{ name: string; qty: string }>,
        score,
      };
    }).sort((a, b) => b.score - a.score);

    return { parsed, matches, error: null };
  });
