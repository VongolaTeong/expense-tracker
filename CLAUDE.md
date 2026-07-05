# CLAUDE.md — Expense Tracker

## What this app is

A mobile expense tracker built with React Native. It tracks **expenses only** — there is no income, no budgets, no accounts, no currency handling. Deliberately minimal: log what you spent, see where it went.

All data lives on-device in SQLite. The app writes an automatic full-data CSV backup once per month, supports manual CSV export at any time, and can re-import that same CSV to repopulate the database (fresh install, new phone, etc.). The CSV format is the single canonical interchange format — export and import must always round-trip losslessly.

## Non-goals (do not build these)

- Income tracking, budgets, recurring transactions, accounts, multi-currency
- Cloud sync, auth, any network calls
- Receipt photos, attachments
- Currency symbols or locale-aware currency formatting — amounts are plain numbers

## Tech stack

- **Expo (managed workflow), latest SDK, TypeScript strict mode**
- **expo-sqlite** — primary datastore
- **expo-file-system** — writing backup CSVs to app document directory
- **expo-sharing** — manual export via OS share sheet
- **expo-document-picker** — selecting a CSV for import
- **react-navigation** bottom tabs (or expo-router if it makes the center-button layout easier — pick one and stay with it)
- **react-native-gifted-charts** for the pie chart (fallback: victory-native if gifted-charts causes issues)
- **jest** for unit tests — all DB/CSV/date logic must be testable in Node without a device

## Architecture rules

Keep a hard separation between pure logic and UI, so the core is testable headlessly:

```
src/
  db/            # schema, migrations, repository functions (all async, no React)
  services/      # csv.ts (serialize/parse), backup.ts, importer.ts
  domain/        # types, date helpers, aggregation functions (pure, sync)
  screens/       # Home, Charts, AddExpense, CategoryManager
  components/    # list rows, date separators, period selector, etc.
  tests/
```

- `domain/` and `services/csv.ts` contain **pure functions only** — no Expo imports. These get unit tests.
- `db/` functions take/return domain types, never leak SQL rows to screens.
- Screens never touch SQL or the filesystem directly.

## Data model

### SQLite schema

```sql
CREATE TABLE categories (
  id         TEXT PRIMARY KEY,          -- uuid
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL              -- ISO 8601
);

CREATE TABLE expenses (
  id          TEXT PRIMARY KEY,         -- uuid
  category_id TEXT NOT NULL REFERENCES categories(id),
  note        TEXT NOT NULL DEFAULT '', -- empty string means "no note"
  amount_cents INTEGER NOT NULL,        -- always store minor units, never floats
  spent_on    TEXT NOT NULL,            -- ISO date YYYY-MM-DD (no time component)
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_expenses_spent_on ON expenses(spent_on);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- settings keys used: 'last_backup_month' (e.g. '2026-07'), 'schema_version'
```

Rules:
- **Amounts are integer cents everywhere in code.** Convert to decimal string only at the display and CSV boundary. No floating point arithmetic on money, ever.
- Dates are stored as `YYYY-MM-DD` strings. All grouping (day/week/month/year) is string/date math in `domain/dates.ts` — write it once, test it, reuse it in both tabs.
- Weeks start on **Monday** (ISO 8601).
- Seed categories on first launch: Food, Transport, Groceries, Shopping, Bills, Health, Entertainment, Other. User can add more and reorder.
- Category deletion: **only allowed if the category has zero expenses.** Otherwise the UI disables delete. (Renaming is allowed anytime.) This avoids orphan/reassignment complexity.

## CSV format (canonical, versioned)

```
id,date,category,note,amount
7f3c...-uuid,2026-07-04,Food,chicken rice,5.50
9a1b...-uuid,2026-07-04,Transport,,1.29
```

- Header row is required and must match exactly.
- `amount` is a decimal string with up to 2 decimal places (cents → string on export, string → cents on import).
- `category` is the category **name** (human-readable, survives DB wipes).
- `note` may be empty. Fields containing commas/quotes/newlines must be RFC 4180 quoted — use a proper serializer/parser, do not string-split.
- **Import semantics (idempotent upsert):**
  - Rows are matched by `id`. Existing id → update; unknown id → insert. Importing the same file twice must produce zero duplicates.
  - Unknown category names are auto-created (appended to the end of sort order).
  - Invalid rows (bad date, non-numeric amount) are skipped and counted; after import show a summary: "Imported 213, updated 4, skipped 2."
  - Import never deletes anything.

## Automatic monthly backup

Mobile OSes do not reliably run scheduled background jobs for a closed app, so **do not use background tasks for v1.** Instead, do a lazy check:

- On every app launch (and foreground resume), compare the current month (`YYYY-MM`) to `settings.last_backup_month`.
- If different: write a **full export** of all data to `<documentDirectory>/backups/backup-YYYY-MM.csv` (the month just started, so this snapshot covers everything up to the end of last month and prior), then update `last_backup_month`.
- Keep all backup files; they're tiny. Show the backup list somewhere reachable (e.g. a small settings/gear screen) so the user can share/delete old ones.
- Backup uses the exact same CSV serializer as manual export — one code path.

Manual export: button triggers full export and opens the OS share sheet immediately.

## Navigation & screens

Bottom bar: **[Home] [ (+) ] [Charts]** — two tabs with a prominent circular Add button centered between them. The Add button is not a tab; it opens the Add Expense flow as a modal over whatever tab is active.

### 1. Home tab

- Shows the **selected month's** expenses (default: current month). A month selector at the top lets the user page backward/forward (chevrons) — don't allow navigating into future months beyond the current one.
- Single scrollable list, **newest first**, grouped by day with **date separator headers** (e.g. "Fri, 4 Jul"). Within a day, newest `created_at` first.
- Each row: primary text = the note, or **the category name when the note is empty**; right-aligned amount. Secondary text = category name (only when a note exists, to avoid repetition).
- A month total somewhere persistent (header) — cheap to compute, high value.
- Tapping a row opens it for edit (same UI as Add, pre-filled) with a delete option.
- Empty state for months with no expenses.

### 2. Charts tab

- Pie chart of total spend per category for the selected period.
- Period type selector: **Week / Month / Year** (default: Month, current month).
- Period pager: chevrons to move to previous/next week/month/year, same "no future" rule.
- Below the pie: a legend list of categories sorted by amount desc, each with amount and percentage. Categories with zero spend in the period are omitted.
- Assign each category a stable color (derive from a fixed palette by sort order or hash of id — must be consistent across sessions).

### Add Expense flow (modal)

Two steps in one modal:

1. **Category picker** — grid or list of categories in user-defined `sort_order`. The final item is an **"＋ Add / Edit"** entry that opens the Category Manager.
2. After a category is tapped: show an input panel — **note text field** (optional) and **amount input** (numeric keyboard) — plus a **date chip defaulting to today**; tapping it opens a date picker. Save is disabled until amount > 0. On save: insert, dismiss modal, Home refreshes.

Amount input detail: treat input as a decimal string, validate ≤ 2 decimal places, convert to cents on save.

### Category Manager

- List of categories with drag-to-reorder (or up/down buttons if drag is painful — functionality over polish).
- Add new category (name must be non-empty and unique, case-insensitive).
- Rename inline. Delete only when unused (see data model rules).

## Conventions

- TypeScript strict; no `any` in `domain/`, `services/`, `db/`.
- All money formatting through one helper: `formatAmount(cents): string` (e.g. `1250 → "12.50"`).
- All date grouping/labels through `domain/dates.ts`.
- Run `npm test` before considering any milestone done. CSV round-trip test (export → import into empty DB → export → byte-identical) is the most important test in the project.
- Never commit on your own, the author will review and commit.
