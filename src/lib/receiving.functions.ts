import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const SYSTEM_PROMPT = `אתה עוזר OCR לחשבוניות ספקים בעברית. תקבל תמונה של חשבונית/קבלה ותחזיר אך ורק JSON תקין לפי הסכימה הזו:
{
  "supplier_name_hint": string|null,
  "invoice_number": string|null,
  "total_amount": number|null,
  "document_date": string|null,   // YYYY-MM-DD
  "items": [{ "name": string, "quantity": number, "unit_price": number|null, "total_price": number|null }]
}
חוקים: ללא הסברים, ללא markdown, רק JSON. אם משהו לא ידוע — null. נקה שמות מוצרים מקודים/ברקודים.`;

function safeJson(text: string): ParsedReceipt | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]) as ParsedReceipt;
  } catch {
    return null;
  }
}

export const ocrInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => OcrInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { parsed: null as ParsedReceipt | null, matches: [], error: "LOVABLE_API_KEY missing" };
    }

    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;

    let parsed: ParsedReceipt | null = null;
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "נא לחלץ נתונים מהחשבונית הזו והחזר JSON בלבד." },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          temperature: 0,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          parsed: null,
          matches: [],
          error: res.status === 429 ? "מכסת AI התמלאה, נסה שוב מאוחר יותר" :
                 res.status === 402 ? "נגמר הקרדיט ל-AI" :
                 `OCR failed (${res.status}): ${errText.slice(0, 160)}`,
        };
      }
      const json = await res.json();
      const text: string = json.choices?.[0]?.message?.content ?? "";
      parsed = safeJson(text);
    } catch (e) {
      console.error("OCR error", e);
      return { parsed: null, matches: [], error: "OCR failed" };
    }

    // Find recent sent orders within 48h for matching
    const { supabase } = context;
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

    // Attach supplier names
    const supplierIds = Array.from(new Set((orders ?? []).map((o) => o.supplier_id)));
    let supplierMap: Record<string, string> = {};
    if (supplierIds.length) {
      const { data: sups } = await supabase
        .from("suppliers")
        .select("id, name")
        .in("id", supplierIds);
      supplierMap = Object.fromEntries((sups ?? []).map((s) => [s.id, s.name]));
    }

    // Lightweight scoring: name-hint fuzzy + recency
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
