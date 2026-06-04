// Lightweight textarea/input with @ mention autocomplete.
// Renders a dropdown over the input when the user types `@…`.

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MentionUser } from "@/lib/notifications-store";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onMentionUsersChange?: (users: MentionUser[]) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  disabled?: boolean;
  onSubmit?: () => void;
}

let cachedUsers: MentionUser[] | null = null;

async function loadUsers(): Promise<MentionUser[]> {
  if (cachedUsers) return cachedUsers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc("list_mentionable_users");
  const users = (data ?? []) as MentionUser[];
  cachedUsers = users;
  return users;
}

export function MentionInput({
  value,
  onChange,
  onMentionUsersChange,
  placeholder,
  multiline = false,
  rows = 2,
  className = "",
  disabled,
  onSubmit,
}: Props) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    void loadUsers().then((u) => {
      setUsers(u);
      onMentionUsersChange?.(u);
    });
  }, [onMentionUsersChange]);

  const filtered = (() => {
    if (query === null) return [];
    const q = query.toLowerCase().trim();
    const list = q ? users.filter((u) => u.full_name.toLowerCase().includes(q)) : users;
    return list.slice(0, 6);
  })();

  const updateQuery = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = before.match(/@([\u0590-\u05FFa-zA-Z0-9 _-]{0,30})$/);
    if (m) {
      setQuery(m[1]);
      setActiveIdx(0);
    } else {
      setQuery(null);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const text = e.target.value;
    onChange(text);
    updateQuery(text, e.target.selectionStart ?? text.length);
  };

  const pickUser = (u: MentionUser) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const replaced = before.replace(/@([\u0590-\u05FFa-zA-Z0-9 _-]{0,30})$/, `@${u.full_name} `);
    const next = replaced + after;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = replaced.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (query !== null && filtered.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickUser(filtered[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        setQuery(null);
        return;
      }
    }
    if (!multiline && e.key === "Enter" && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  const sharedProps = {
    value,
    onChange: handleChange,
    onKeyDown: handleKey,
    placeholder,
    disabled,
    className: `w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-neon focus:outline-none ${className}`,
    dir: "rtl" as const,
  };

  return (
    <div className="relative" dir="rtl">
      {multiline ? (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          rows={rows}
          {...sharedProps}
        />
      ) : (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type="text"
          {...sharedProps}
        />
      )}
      {query !== null && filtered.length > 0 && (
        <ul className="absolute z-50 bottom-full mb-1 w-full max-h-48 overflow-auto rounded-lg border border-border bg-card shadow-xl">
          {filtered.map((u, i) => (
            <li
              key={u.user_id}
              onMouseDown={(e) => {
                e.preventDefault();
                pickUser(u);
              }}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === activeIdx ? "bg-neon/15 text-neon" : "hover:bg-muted/30"
              }`}
            >
              @{u.full_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
