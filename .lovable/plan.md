## Plan: Comprehensive feature rollout

This is a large multi-system update. I'll batch into focused implementation phases.

### Phase 1 — Database (single migration)
- `profiles` table: `user_id`, `has_accepted_nda` (bool) + RLS (user reads/writes own)
- `ev_vehicles` table: `id`, `name`, `battery_pct`, `status`, `swap_at` (timestamptz), `updated_at` + RLS (admin/viewer read, admin write); seed BYD / Leapmotor / Hyundai Kona
- `notebook_items`: add `priority` ('urgent'|'normal'), `archived_at` (timestamptz)
- `notebook_snapshots` table: `snapshot_date`, `list_key`, `items` (jsonb) — for 14-day history; daily cron at 05:00 snapshots + clears
- pg_cron: 05:00 Asia/Jerusalem job → snapshot active `notebook_items`, then set `archived_at = now()` on all undone+done
- Wipe existing `recipes` rows (deleted=true) and seed the full recipe catalog from the prompt (5 categories, all items)

### Phase 2 — NDA gate
- New `<NdaGate />` mounted in `__root.tsx` after auth: fetches profile, if `has_accepted_nda=false` shows non-dismissible modal with exact text + "מאשר/ת" button → updates profile.

### Phase 3 — EV Charging widget
- `<EvChargingWidget />` on dashboard: per-vehicle card with battery slider/input, status select, countdown timer (set hours+minutes). On expiry: neon-pink pulse + beep audio. Realtime sync via Supabase channel.

### Phase 4 — Notebook enhancements
- Priority selector on create; urgent items pinned + neon-pink badge
- "📋 היסטוריית פנקס" route/section with date picker reading `notebook_snapshots`
- Frontend uses `archived_at IS NULL` for active view (cron handles reset)

### Phase 5 — Recipes module UX
- `/recipes` already exists — enhance: search bar, horizontal category tabs, card grid, detail view with ingredient checklist + pop audio
- Recipes import seeds via migration above

### Phase 6 — Audio system
- `src/lib/audio.ts`: WebAudio synthesized tones — `playPop()`, `playSuccess()`, `playBeep()`, `playThud()`. Wire into checkboxes, EV alerts, deletions.

### Phase 7 — Weather, footer, admin fixes, CMS
- Already implemented from prior turns; verify in place and only patch if missing.

### Technical notes
- Recipes table uses text `id` — generate stable slugs (e.g. `dessert-nutella-classic`).
- Cron uses `pg_cron` + a SQL function (no HTTP needed).
- All new tables RLS-aligned with existing `current_user_role()` pattern.
- Audio: synthesized via Web Audio API — no asset files.

### Scope of this turn
Execute Phase 1 migration first, then build all frontend modules in parallel file writes.
