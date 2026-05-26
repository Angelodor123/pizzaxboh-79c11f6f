/**
 * Sports fixtures extraction via Firecrawl Search (Google results).
 * Searches Google for upcoming Champions League / World Cup matches,
 * scrapes the top results, and asks Gemini to extract confirmed matches.
 */

import type { ExtractedMatch } from "./sports-rss.server";

const FIRECRAWL_SEARCH_API = "https://api.firecrawl.dev/v2/search";

const SEARCH_QUERIES: { query: string; label: string }[] = [
  { query: "מונדיאל 2026 משחקים השבוע שעות שידור", label: "מונדיאל 2026" },
  { query: "ליגת האלופות משחקים השבוע שעות שידור", label: "ליגת האלופות" },
  { query: "FIFA World Cup 2026 fixtures this week kickoff time", label: "World Cup EN" },
  { query: "UEFA Champions League fixtures this week kickoff time", label: "Champions League EN" },
];

const SYSTEM_PROMPT = `אתה עוזר מומחה לחילוץ לוח משחקי כדורגל מתוצאות חיפוש גוגל.
מותר להחזיר משחק רק אם התוכן מציין במפורש תאריך עתידי, שעה וזהות שתי הקבוצות.
אסור להמציא או להשלים מהראש. בספק — לא להחזיר.

מותר רק שני סוגי טורנירים:
- "champions_league" (UEFA Champions League)
- "world_cup" (FIFA World Cup 2026)

תאריך חייב להיות עתידי בפורמט YYYY-MM-DD. שעה בפורמט HH:MM שעון ישראל (24h).
אם השעה מצוינת באזור זמן אחר — המר לשעון ישראל. אם לא ניתן לקבוע במדויק — לא להחזיר.

החזר JSON תקין בלבד:
{ "matches": [ { "team_a","team_b","competition","event_date","start_time","source_title","source_url" } ] }`;

type FirecrawlSearchResult = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
};

async function firecrawlSearch(
  query: string,
  firecrawlKey: string,
): Promise<FirecrawlSearchResult[]> {
  try {
    const res = await fetch(FIRECRAWL_SEARCH_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 6,
        tbs: "qdr:w",
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.warn(`[firecrawl-search] "${query}" HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as {
      data?: FirecrawlSearchResult[] | { web?: FirecrawlSearchResult[] };
    };
    const arr = Array.isArray(data.data)
      ? data.data
      : Array.isArray((data.data as { web?: FirecrawlSearchResult[] } | undefined)?.web)
        ? (data.data as { web: FirecrawlSearchResult[] }).web
        : [];
    return arr;
  } catch (e) {
    console.warn(`[firecrawl-search] "${query}" failed`, e);
    return [];
  }
}

export async function extractMatchesViaFirecrawl(
  lovableApiKey: string,
  firecrawlKey: string,
): Promise<{ matches: ExtractedMatch[]; pagesScraped: number }> {
  const pages: { url: string; label: string; markdown: string }[] = [];

  for (const target of SEARCH_QUERIES) {
    const results = await firecrawlSearch(target.query, firecrawlKey);
    for (const r of results) {
      const url = r.url ?? "";
      const title = r.title ?? target.label;
      const content = (r.markdown ?? r.description ?? "").trim();
      if (!url || !content) continue;
      pages.push({
        url,
        label: title,
        markdown: content.slice(0, 4_000),
      });
    }
  }

  if (pages.length === 0) {
    return { matches: [], pagesScraped: 0 };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const userPayload = JSON.stringify({
    today: todayIso,
    timezone: "Asia/Jerusalem",
    pages: pages.slice(0, 20).map((p) => ({
      source_title: p.label,
      source_url: p.url,
      content: p.markdown,
    })),
  });

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "raw",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    console.warn(`[firecrawl-extract] gateway HTTP ${res.status}`);
    return { matches: [], pagesScraped: pages.length };
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "{}";

  let parsed: { matches?: unknown } = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    return { matches: [], pagesScraped: pages.length };
  }

  const rawList = Array.isArray(parsed.matches) ? parsed.matches : [];
  const datePat = /^\d{4}-\d{2}-\d{2}$/;
  const timePat = /^\d{2}:\d{2}$/;
  const seen = new Set<string>();
  const matches: ExtractedMatch[] = [];

  for (const r of rawList) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const team_a = typeof row.team_a === "string" ? row.team_a.trim() : "";
    const team_b = typeof row.team_b === "string" ? row.team_b.trim() : "";
    const competition = row.competition;
    const event_date = typeof row.event_date === "string" ? row.event_date : "";
    const start_time = typeof row.start_time === "string" ? row.start_time : "";
    const source_url = typeof row.source_url === "string" ? row.source_url : "";
    const source_title = typeof row.source_title === "string" ? row.source_title : "";

    if (!team_a || !team_b) continue;
    if (competition !== "champions_league" && competition !== "world_cup") continue;
    if (!datePat.test(event_date)) continue;
    if (!timePat.test(start_time)) continue;
    if (event_date < todayIso) continue;

    const key = `${event_date}|${team_a.toLowerCase()}|${team_b.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    matches.push({ team_a, team_b, competition, event_date, start_time, source_url, source_title });
  }

  return { matches, pagesScraped: pages.length };
}
