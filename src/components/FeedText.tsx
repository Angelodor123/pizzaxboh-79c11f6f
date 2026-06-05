// Renders shift-feed message text with styled @mentions:
// - @[Name](uuid) explicit mentions → neon pill
// - Group tags (@כולם, @מטבח, @דלפק, @שליחים, @מנהלים) → colored pills per group
// - Plain @Name matching a known user → neon pill
import { Fragment } from "react";
import { GROUP_TAGS } from "@/lib/employee-directory";
import type { MentionUser } from "@/lib/notifications-store";

interface Props {
  text: string;
  users?: MentionUser[];
  className?: string;
}

type Part = { kind: "text"; value: string } | { kind: "pill"; label: string; color: string };

const GROUP_BY_TAG = new Map(GROUP_TAGS.map((g) => [g.tag, g] as const));
const NEON_PILL = "bg-neon/20 text-neon border-neon/50";

function buildParts(text: string, users: MentionUser[]): Part[] {
  const parts: Part[] = [];
  // Token regex matches:
  //  - @[Name](uuid)
  //  - @Hebrew/Latin word(s, allows single internal spaces of length 1-3 words)
  const re = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)|@([\u0590-\u05FFA-Za-z][\u0590-\u05FFA-Za-z0-9_]{0,40}(?:\s[\u0590-\u05FFA-Za-z0-9_]{1,30}){0,2})/g;

  // Build a sorted name list (longest-first) for plain mention resolution
  const nameSet = new Set(users.map((u) => u.full_name));
  const sortedNames = [...nameSet].sort((a, b) => b.length - a.length);

  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > lastIdx) parts.push({ kind: "text", value: text.slice(lastIdx, m.index) });
    if (m[1]) {
      // explicit @[Name](uuid)
      parts.push({ kind: "pill", label: m[1], color: NEON_PILL });
      lastIdx = re.lastIndex;
      continue;
    }
    const raw = m[3] ?? "";
    // Group tag?
    const grp = GROUP_BY_TAG.get(raw.trim());
    if (grp) {
      parts.push({ kind: "pill", label: grp.label, color: grp.color });
      lastIdx = re.lastIndex;
      continue;
    }
    // Try to match longest known user name from `raw`
    let matched: string | null = null;
    for (const nm of sortedNames) {
      if (raw === nm || raw.startsWith(nm + " ")) {
        matched = nm;
        break;
      }
    }
    if (matched) {
      parts.push({ kind: "pill", label: matched, color: NEON_PILL });
      // push the tail back as text
      const tail = raw.slice(matched.length);
      if (tail) parts.push({ kind: "text", value: tail });
      lastIdx = re.lastIndex;
      continue;
    }
    // unrecognized → keep as plain text
    parts.push({ kind: "text", value: m[0] });
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) parts.push({ kind: "text", value: text.slice(lastIdx) });
  return parts;
}

export function FeedText({ text, users = [], className }: Props) {
  const parts = buildParts(text, users);
  return (
    <span className={className} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <Fragment key={i}>{p.value}</Fragment>
        ) : (
          <span
            key={i}
            className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md border text-[12px] font-bold ${p.color}`}
          >
            @{p.label}
          </span>
        ),
      )}
    </span>
  );
}
