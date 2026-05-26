/**
 * Sports RSS → structured match extractor.
 *
 * Pulls news/fixture items from stable football RSS feeds and asks Gemini
 * (via Lovable AI Gateway) to extract only confirmed upcoming match fixtures
 * (Champions League / FIFA World Cup) with a concrete date and kickoff time.
 *
 * Returns ONLY items the model is confident about. Anything ambiguous is
 * dropped — we never want to hallucinate calendar events.
 */

export type ExtractedMatch = {
  team_a: string;
  team_b: string;
  competition: "champions_league" | "world_cup";
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM (Asia/Jerusalem, 24h)
  source_url: string;
  source_title: string;
};

const RSS_FEEDS: { url: string; label: string }[] = [
  { url: "https://feeds.bbci.co.uk/sport/football/rss.xml", label: "BBC Football" },
  { url: "https://www.espn.com/espn/rss/soccer/news", label: "ESPN Soccer" },
];

type RssItem = { title: string; link: string; description: string; pubDate: string };

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const pick = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
      return r ? stripCdata(r[1]).trim() : "";
    };
    items.push({
      title: stripHtml(pick("title")),
      link: pick("link"),
      description: stripHtml(pick("description")),
      pubDate: pick("pubDate"),
    });
  }
  return items;
}

async function fetchFeed(url: string, label: string): Promise<RssItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 PizzaXSportsSync/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.warn(`[sports-rss] ${label} HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRss(xml).slice(0, 30);
  } catch (e) {
    console.warn(`[sports-rss] ${label} fetch failed`, e);
    return [];
  }
}

const SYSTEM_PROMPT = `אתה עוזר מומחה לקליטת לוח משחקי כדורגל מתוך פיד RSS חדשותי בלבד.
מותר לך להחזיר משחק רק אם הפריט מציין במפורש תאריך עתידי וקבוצות זהויות.
אסור להמציא, להשלים מהראש, או להחזיר משחק היפותטי. במקרה של ספק — אל תחזיר אותו.

מותר רק שני סוגי טורנירים:
- "champions_league" (ליגת האלופות של UEFA)
- "world_cup" (מונדיאל FIFA 2026)

תאריך חייב להיות בעתיד (אחרי היום בשעון ישראל) ובפורמט YYYY-MM-DD.
שעה חייבת להיות בפורמט HH:MM שעון ישראל (24 שעות). אם השעה לא ידועה במפורש — אל תחזיר את המשחק.

החזר אך ורק JSON תקין במבנה הזה (ללא טקסט נוסף):
{
  "matches": [
    {
      "team_a": "string",
      "team_b": "string",
      "competition": "champions_league" | "world_cup",
      "event_date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "source_title": "string",
      "source_url": "string"
    }
  ]
}`;

export async function extractMatchesFromRss(
  apiKey: string,
): Promise<{ matches: ExtractedMatch[]; feedsTried: number; itemsScanned: number }> {
  const all: RssItem[] = [];
  let feedsTried = 0;
  for (const f of RSS_FEEDS) {
    feedsTried++;
    const items = await fetchFeed(f.url, f.label);
    all.push(...items);
  }

  if (all.length === 0) {
    return { matches: [], feedsTried, itemsScanned: 0 };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const userPayload = JSON.stringify(
    {
      today: todayIso,
      timezone: "Asia/Jerusalem",
      items: all.map((it) => ({
        title: it.title,
        description: it.description.slice(0, 400),
        url: it.link,
        pubDate: it.pubDate,
      })),
    },
    null,
    0,
  );

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
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
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    console.warn(`[sports-rss] gateway HTTP ${res.status}`, await res.text().catch(() => ""));
    return { matches: [], feedsTried, itemsScanned: all.length };
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "{}";

  let parsed: { matches?: unknown } = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    return { matches: [], feedsTried, itemsScanned: all.length };
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

    matches.push({
      team_a,
      team_b,
      competition,
      event_date,
      start_time,
      source_url,
      source_title,
    });
  }

  return { matches, feedsTried, itemsScanned: all.length };
}
