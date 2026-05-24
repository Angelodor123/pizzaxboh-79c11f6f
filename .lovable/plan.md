# Comprehensive Supplier & Invoice Ecosystem

This is a large, multi-area build. Breaking it into clean phases. Access throughout is restricted to **Admin + Super Admin** only.

## Phase 1 — Database (single migration)

Alter / add the following:

**`suppliers`** — add columns:
- `contact_phone` (text) — for WhatsApp links
- `delivery_days` (text[]) — `['Sunday','Tuesday',...]` (mirrors existing `delivery_weekdays`; we'll keep both in sync for calendar)
- `is_archived` (boolean, default false)

**`supplier_orders_history`** — new table:
- `id, branch_id, supplier_id, order_details jsonb, created_by, created_at`
- RLS: Admin read/insert within own branch (super admin all)

**`invoices`** — add:
- `is_archived` (boolean, default false)

**`invoice_items`** — already exists, no change.

**Seed data** — Insert the 10 default suppliers (מרינה, געש, בנדיקט, צח, פסטטריה, ישראקו, החברה המרכזית, פרש פסטה, Ristretto, אנשי הזית) into every existing active branch, with `logo_url` pointing to bundled assets and matching `delivery_days`.

**Logos** — Copy 9 uploaded logos into `src/assets/suppliers/` and import; seed `logo_url` with the imported asset paths (resolved at build time).

## Phase 2 — Supplier Selection Hub (`/orders`)

New route `src/routes/orders.tsx`:
- Admin/super-admin gate (redirect viewers).
- Header + "סה״כ הזמנות החודש" mini-stat.
- Logo grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6`, identical card sizes, logo in `h-32 w-full flex items-center justify-center p-4 bg-zinc-800/50` box with `object-contain max-h-full max-w-full`, name + category centered below, hover scale + neon-green glow.
- Click → opens **OrderModal**.

## Phase 3 — Order Modal + WhatsApp

New `src/components/OrderModal.tsx`:
- Dynamic row builder: שם מוצר, כמות, "הוסף שורה", delete row.
- "הערות להזמנה" textarea.
- **localStorage persistence** keyed by `order:{supplierId}` — restored on open, cleared on success.
- Compiles the exact Hebrew template (numbered list, omit הערות line when empty).
- **Primary** (WhatsApp green): writes to `supplier_orders_history`, opens `https://wa.me/{phone}?text=...` in new tab. Button disables + spinner during submit.
- **Secondary**: copy to clipboard + toast "ההזמנה הועתקה בהצלחה".

## Phase 4 — Goods Receiving (`/invoices`)

New route `src/routes/invoices.tsx`:
- Admin/super-admin gate.
- **Financial banner**: "סה״כ הוצאות ספקים (חודש נוכחי)" — sum of `total_amount` for non-archived invoices in current calendar month, large high-contrast typography.
- Table: תאריך, ספק, מס׳ חשבונית, סכום, סטטוס, פעולות (archive).
- Neon pink "קליטת חשבונית חדשה" button → opens split-view modal.

New `src/components/InvoiceIntakeModal.tsx`:
- **Left**: image viewer w/ pan & zoom (lightweight CSS transform on wheel/drag), CSS scanning animation overlay during upload.
- **Right**: supplier dropdown, invoice_number, סכום כולל (required), תאריך חשבונית (required), repeating items table.
- Submit button disabled until required fields valid.
- localStorage persistence; double-submit prevention.
- **Financial anomaly check**: before submit, query avg total for that supplier — if entered > 5× avg OR > 15,000₪, show confirmation modal "שים לב: הסכום שהוזן גבוה מהרגיל" with אישור / חזור לעריכה.
- Upload to `invoice-images` bucket → insert `invoices` + `invoice_items`.

## Phase 5 — Admin CRUD for Suppliers

Extend `src/routes/suppliers.tsx` (or add `SuppliersAdminPanel` section) for super-admin:
- Add/Edit form: name, category, contact_phone, file dropzone for logo (uploads to a new `supplier-logos` bucket), day checkboxes ש-ש mapped to both `delivery_days` and `delivery_weekdays`.
- "Delete" → soft delete (`is_archived = true`). Archived suppliers hidden from grid + calendar.

## Phase 6 — Calendar Failsafe

Update `src/routes/calendar.tsx`:
- Existing supplier delivery events already auto-sync via DB trigger. Augment the rendered event block:
  - Default: 🚚 קבלת סחורה: {Supplier} — {Category}
  - For events with date ≤ today: query `invoices` for matching `supplier_id` on that operational date. If missing → render pulsing red `bg-red-500/10 border border-red-500/40` block with "⚠️ חסרה חשבונית". If present → success styling.

## Phase 7 — Dashboard quick access

Add two buttons to `src/routes/index.tsx` quick-access section (admin only): **הזמנת סחורה** → `/orders`, **קליטת סחורה** → `/invoices`.

## Technical Notes
- All inserts respect `branch_id` via existing `current_user_branch_id()` helper.
- RTL preserved via existing `dir="rtl"` root.
- All buttons have spinner + disabled state during async ops.
- Reusable `useLocalStorageForm` hook for form persistence.

---

This is roughly **1 migration + 2 new routes + 4 new components + edits to 3 existing files**. Shall I proceed?
