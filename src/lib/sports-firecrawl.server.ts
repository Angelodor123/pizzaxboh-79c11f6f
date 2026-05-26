/**
 * Firecrawl fallback for sports fixtures.
 * Used only when RSS feeds return zero confident matches.
 *
 * Scrapes well-known fixture pages and asks Gemini (via Lovable AI Gateway)
 * to extract confirmed Champions League / World Cup matches with a concrete
 * future date and kickoff time in Asia/Jerusalem.
 */

import type { ExtractedMatch } from "./sports-rss.server";

const FIRECRAWL_API = "https://api.firecrawl.dev/v2/scrape";

const FALLBACK_URLS: { url: string; label: string }[] = [
  { url: "https://www.365scores.com/he/football/competition/world-cup-tournaments-72", label: "365scores - World Cup" },
  { url: "https://www.365scores.com/he/football/competition/champions-league-7", label: "365scores - Champions League" },
  { url: "https://www.uefa.com/uefachampionsleague/fixtures-results/", label: "UEFA Champions League" },
  { url: "https://www.fifa.com/fifaplus/en/tournaments/mens/worldcup/canadamexicousa2026/matches", label: "FIFA World Cup 2026" },
];

const SYSTEM_PROMPT = `אתה עוזר מומחה לקליטת לוח משחקי כדורגל מתוכן עמוד אינטרנט.
מותר להחזיר משחק רק אם התוכן מציין במפורש תאריך עתידי, שעה וקבוצות זהויות.
אסור להמציא או להשלים מהראש. בספק — לא להחזיר.

מותר רק שני סוגי טורנירים:
- "champions_league" (UEFA Champions League)
- "world_cup" (FIFA World Cup 2026)

תאריך חייב להיות עתידי בפורמט YYYY-MM-DD. שעה בפורמט HH:MM שעון ישראל (24h).
אם שעה לא ידועה במפורש — לא להחזיר את המשחק.

החזר JSON תקין בלבד:
{ "matches": [ { "team_a","team_b","competition","event_date","start_time","source_title","source_url" } ] }`;

async function firecrawlScrape(url: string, firecrawlKey: string): Promise<string | null> {
  try {
    const res = await fetch(FIRECRAWL_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.warn(`[firecrawl] ${url} HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { data?: { markdown?: string }; markdown?: string };
    return data.markdown ?? data.data?.markdown ?? null;
  } catch (e) {
    console.warn(`[firecrawl] ${url} failed`, e);
    return null;
  }
}

export async function extractMatchesViaFirecrawl(
  lovableApiKey: string,
  firecrawlKey: string,
): Promise<{ matches: ExtractedMatch[]; pagesScraped: number }> {
  const pages: { url: string; label: string; markdown: string }[] = [];

  for (const target of FALLBACK_URLS) {
    const md = await firecrawlScrape(target.url, firecrawlKey);
    if (md && md.trim().length > 0) {
      pages.push({ url: target.url, label: target.label, markdown: md.slice(0, 8_000) });
    }
  }

  if (pages.length === 0) {
    return { matches: [], pagesScraped: 0 };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const userPayload = JSON.stringify({
    today: todayIso,
    timezone: "Asia/Jerusalem",
    pages: pages.map((p) => ({ source_title: p.label, source_url: p.url, content: p.markdown })),
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
    signal: AbortSignal.timeout(30_000),
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
