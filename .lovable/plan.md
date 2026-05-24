# Plan: Daily To-Do Module + Ecosystem Upgrades

This is a large scope. I'll execute it in phases. After each phase the app will be in a working state.

## Phase 1 — Database Foundation
Tables `shifts`, `task_groups`, `tasks`, `daily_task_logs` already exist (verified in schema). I will:
- Add `comments` column already exists ✅, `completed_at` exists ✅, `completed_by_user_id` exists ✅
- Add `is_urgent` boolean to `notebook_items` for two-tier sort
- Add `tutorial_version` integer to `profiles` (default 0)
- Add `ready_trays` integer to a new singleton key in `app_settings` (or use existing `prep_items` "בצקים" row)
- Create pg_cron job to archive `daily_task_logs` daily at 05:00 Asia/Jerusalem (move to history table or just rely on `log_date = operational_today()`)
- RLS: branch-scoped policies on all task tables

## Phase 2 — Admin Panel Bug Fix
Fix branch name not updating instantly in user management table — invalidate React Query cache for `branches` + `user_roles` on mutation success.

## Phase 3 — Dashboard Refactor
In `src/routes/index.tsx` (or wherever dashboard lives):
- Rename "פנקס יומי" → "פנקס הערות ומשימות"
- Add "צ'ק-ליסט משמרות" quick button → `/checklist`
- Add "סטטוס בצקים" card — modal updates `prep_items` row where name=בצקים, `current_stock` for today's `prep_log`
- Add "סטטוס משמרת נוכחית" progress card (computed from `daily_task_logs` for current shift)

## Phase 4 — To-Do List Module (`/checklist`)
New route with:
- Shift selector tabs (morning/evening/closing)
- Accordion per `task_group` with dark `bg-gray-800/80` header
- Each task = card with neon-pink border, checkbox, comments textarea
- Optimistic auto-save on check (mutation to `daily_task_logs`)
- Debounced 750ms auto-save on comments
- Neon Pulse animation on completion (scale-125 → neon green glow #39FF14, border pulse, strikethrough)
- Audit stamp "בוצע על ידי X בתאריך Y בשעה Z"
- Respect manual `sort_order` (no alphabetical)
- Info icon next to tasks linked to recipes → slide-out drawer
- Toast keyword sync with notebook items on completion

## Phase 5 — Smart Versioned Tutorial
- Migrate `has_seen_tutorial` → `tutorial_version` (int)
- v0 → full master tour, sets to 2 on finish
- v1 → "Feature Discovery" banner → mini tour (3 steps) → sets to 2
- v2 → silent

## Phase 6 — Email Invitation Redesign
The invite email is sent via Supabase Auth. I'll customize the auth-email-hook with a dark-mode RTL React Email template, embed logo from public storage bucket, neon-pink CTA.

## Phase 7 — Global Sort Logic
- Suppliers/users/warehouse: `ORDER BY name ASC` (Hebrew collation)
- Notebook: `ORDER BY is_urgent DESC, text ASC`
- Tasks: keep `sort_order` (no change)

## Phase 8 — Seed Data
Insert all shifts, task_groups, and tasks for "סניף מודיעין" via insert tool.

## Phase 9 — Ecosystem Extras
- Notepad keyword match toast on task completion
- Recipe drawer
- Weather-triggered task group (defer — needs weather API key; will stub or ask)

---

## Technical Notes
- Stack: TanStack Start + Supabase, RTL, dark theme already in place
- All mutations use TanStack Query with optimistic updates
- All colors via design tokens in `src/styles.css` — I'll add `--neon-pink`, `--neon-green` if not present
- pg_cron for daily reset (already used for notebook_daily_reset)

## Open Questions Before Starting
1. **Logo for email** — please attach the Pizza X logo image (or confirm I should use an existing one in `src/assets/`).
2. **Weather API** — should I skip the weather-triggered task group for now, or do you have a weather API key (OpenWeatherMap, etc.)?
3. **Email infrastructure** — the system invitation currently uses Supabase's default auth email. To customize with full branding, I need to set up an email domain (sender like `notify@yourdomain.com`). Do you want to set that up now, or should I just update the in-app invite acceptance screen for now and defer the email itself?

This is ~6-9 hours of focused work. I'll execute phases 1-5 + 7 + 8 in this session if you approve. Phase 6 depends on Q1+Q3 above. Phase 9 weather depends on Q2.

Ready to proceed?
