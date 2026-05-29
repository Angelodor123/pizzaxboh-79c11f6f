import type { Recipe } from "@/lib/cookbook";

function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Compiles a recipe into a plain-text WhatsApp/clipboard-friendly format:
 *
 *   [Recipe Title]
 *
 *   רכיבים:
 *   - [Amount] [Unit] [Ingredient Name]
 *
 *   הוראות הכנה:
 *   [Instructions text]
 */
export function formatRecipeText(recipe: Recipe): string {
  const lines: string[] = [];
  lines.push(recipe.nameHebrew);

  if (recipe.baseYieldHebrew?.trim()) {
    lines.push(`(${recipe.baseYieldHebrew.trim()})`);
  }

  lines.push("");
  lines.push("רכיבים:");
  for (const ing of recipe.ingredients) {
    const qty = fmtNum(ing.quantity);
    lines.push(`- ${qty} ${ing.unit} ${ing.name}`.replace(/\s+/g, " ").trim());
  }

  if (recipe.spiceBag && recipe.spiceBag.items.length > 0) {
    lines.push("");
    lines.push(`שקית תבלינים — ${recipe.spiceBag.name}:`);
    for (const ing of recipe.spiceBag.items) {
      const qty = fmtNum(ing.quantity);
      lines.push(`- ${qty} ${ing.unit} ${ing.name}`.replace(/\s+/g, " ").trim());
    }
  }

  lines.push("");
  lines.push("הוראות הכנה:");
  lines.push((recipe.instructionsHebrew || "").trim());

  return lines.join("\n").trim() + "\n";
}

export function buildWhatsAppShareUrl(recipe: Recipe): string {
  const text = formatRecipeText(recipe);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
