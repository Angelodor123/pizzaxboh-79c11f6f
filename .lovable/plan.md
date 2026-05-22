# Plan: Onboarding Banners + Par Level Modules

## 1. Global Onboarding Banner (כל הדפים)
- New component `src/components/PageOnboarding.tsx` — semi-transparent card with title + Hebrew explanation, themed to "Urban Jungle" (green/leaf accents from existing tokens), positioned below page title.
- Stored in DB table `page_onboarding` (key, title, body, updated_at). Seed default Hebrew explanations for every existing route (index, recipes, calendar, suppliers, notebook, guide, admin, new prep + restock pages).
- Admin can edit text per-page from admin panel (new "הסברי דפים" tab).
- Insert `<PageOnboarding pageKey="..." />` at top of every route component.

## 2. Shared Units of Measurement
- DB table `measurement_units` (id, name, sort_order).
- Admin tab "יחידות מידה": CRUD list with inline add/edit/delete.
- Seeded with: ק"ג, ליטר, קופסה, פיילה, שק, ארגז, יחידה.
- Used by both modules as a dropdown.

## 3. Module A — הכנות יומיות (`/prep`)
- DB table `prep_items`: id, name, unit, target_sun..target_sat (numeric), sort_order, active.
- DB table `prep_log`: id, prep_item_id, log_date, current_stock, completed, updated_by.
- Admin tab "הכנות יומיות": form with name, unit dropdown, 7 numeric inputs (one per weekday).
- Shift page `/prep`:
  - Filter items whose target for today's weekday > 0.
  - Each row: name, target, "מלאי קיים" input (empty when 0), computed "להכנה" = max(target - stock, 0).
  - Green badge when stock ≥ target; bold red/amber warning otherwise.
  - Swipe right → set current_stock = target (100% done). Swipe left → clear.
  - Persist per-day log via upsert on (prep_item_id, log_date).

## 4. Module B — השלמות מהמחסן (`/restock`)
- DB table `restock_items`: id, name, unit, barcode (text nullable), target_sun..target_sat, sort_order, active.
- DB table `restock_log`: id, restock_item_id, log_date, current_stock, completed.
- Admin tab "השלמות מהמחסן": same per-weekday form + optional barcode field.
- Shift page `/restock`:
  - Search bar + prominent "סריקת פריט" button. Scanner uses `@zxing/browser` (BrowserMultiFormatReader) opening device camera; on detect, matches by `barcode` and focuses that row's input.
  - Row: target, "מלאי בעמדה" input, computed "להשלמה".
  - Swipe right → mark complete (sets stock = target). Swipe left → clear.

## 5. Shared UX
- Empty-on-clear numeric input pattern (already used elsewhere) for all stock fields.
- Swipe via touch handlers (no extra lib needed): track touchstart/touchend deltaX with threshold ~60px.
- Strict RTL (`dir="rtl"`), green complete state via `bg-emerald-500/20 border-emerald-500`, warning via `bg-amber-500/20 border-amber-500 text-amber-200`.

## Technical Details
- DB: one migration creates 6 tables with RLS — admins write, admins+viewers read (mirrors existing tables).
- Routes: `src/routes/prep.tsx`, `src/routes/restock.tsx` (file-based). Add nav entries to home page.
- Admin: extend `src/routes/admin.tsx` with new tabs.
- Barcode: `bun add @zxing/browser @zxing/library`.
- Onboarding insertion: each route renders `<PageOnboarding pageKey="<route>" />` below its existing header.

## Out of scope (to keep this turn focused)
- Historical analytics on prep/restock logs.
- Multi-user assignment / sign-off names beyond `updated_by`.
- Offline mode for scanner.

Confirm and I'll build it.