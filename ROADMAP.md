# Roadmap

Each phase ends in a runnable, testable state. Don't start a phase until the previous one's checkboxes are done. Pure-logic phases (2, 3, 7) are ideal for Claude Code to own end-to-end with tests; UI phases need on-device checks.

## Phase 0 — Project setup

- [x] `npx create-expo-app` with TypeScript template, strict mode on
- [x] Install deps: expo-sqlite, expo-file-system, expo-sharing, expo-document-picker, react-navigation (bottom tabs), react-native-gifted-charts, jest + ts-jest
- [x] Folder structure per CLAUDE.md (`src/db`, `src/services`, `src/domain`, `src/screens`, `src/components`, `src/tests`)
- [x] Jest configured so `domain/` and `services/csv.ts` tests run in plain Node (no Expo runtime)
- [x] App boots to a placeholder screen on device/simulator

## Phase 1 — Database layer

- [x] Schema creation + `schema_version` in settings; simple migration runner (v1 just creates tables)
- [x] Seed default categories on first launch
- [x] Repository functions:
  - [x] `insertExpense`, `updateExpense`, `deleteExpense`
  - [x] `getExpensesForMonth(yyyyMm)` sorted newest-first
  - [x] `getCategorySummary(startDate, endDate)` → `{categoryId, name, totalCents}[]`
  - [x] `listCategories` (by sort_order), `addCategory`, `renameCategory`, `reorderCategories`, `deleteCategory` (fails if in use), `categoryHasExpenses`
  - [x] settings get/set
- [x] Smoke test on device: insert a few rows via a temporary debug button, read them back

## Phase 2 — Domain logic (pure, fully unit-tested)

- [x] `domain/money.ts`: `parseAmountInput(str) → cents | error`, `formatAmount(cents)`
- [x] `domain/dates.ts`: today ISO, month bounds, ISO-week bounds (Mon start), year bounds, prev/next period, "is future period", day-separator labels, month/week/year display labels
- [x] `domain/grouping.ts`: group expense list into `[{dayLabel, items[]}]` sections
- [x] Unit tests for all of the above, including edge cases: year boundaries, week 52/53, leap day, `"12."`/`"12.345"`/`""` amount inputs

## Phase 3 — CSV service (pure, fully unit-tested)

- [ ] RFC 4180 serializer + parser (handle quotes, commas, newlines in notes; CRLF/LF tolerance)
- [ ] `exportToCsv(expenses, categories) → string`
- [ ] `parseCsv(string) → {validRows, skippedCount}` with per-row validation (date format, amount, header check)
- [ ] **Round-trip test: export → parse → export produces identical output** (this test gates the phase)

## Phase 4 — Home tab

- [ ] Bottom tab navigator: Home / Charts + custom center Add button (button opens a placeholder modal for now)
- [ ] Month selector header with chevrons, future months blocked
- [ ] Sectioned list with date separators, newest first
- [ ] Row rendering: note-or-category-name primary text, amount right-aligned, category as secondary text when note exists
- [ ] Month total in header
- [ ] Empty state
- [ ] Refreshes when data changes (refetch on focus is fine for v1)

## Phase 5 — Add Expense flow

- [ ] Modal step 1: category picker in sort order, "＋ Add / Edit" tail item (dead link for now)
- [ ] Modal step 2: note input, amount input (numeric keyboard, live validation via `parseAmountInput`), date chip → date picker, save disabled until valid amount
- [ ] Save inserts and dismisses; Home reflects it
- [ ] Tap an expense on Home → same modal pre-filled → update / delete

## Phase 6 — Category Manager

- [ ] Screen reachable from Add flow's tail item
- [ ] Add category (unique, non-empty, case-insensitive check)
- [ ] Rename inline
- [ ] Reorder (drag, or up/down buttons if drag fights you)
- [ ] Delete disabled when category has expenses
- [ ] Category picker order updates immediately after changes

## Phase 7 — Charts tab

- [ ] Period selector (Week / Month / Year) + prev/next pager, future blocked
- [ ] `getCategorySummary` wired to selected period bounds from `domain/dates.ts`
- [ ] Pie chart with stable per-category colors
- [ ] Legend list sorted by amount desc with amounts + percentages; zero-spend categories omitted
- [ ] Empty state for periods with no data

## Phase 8 — Export / Import / Auto-backup

- [ ] Manual export: full CSV → temp file → share sheet
- [ ] Import: document picker → parse → idempotent upsert by id → auto-create unknown categories → summary alert ("Imported X, updated Y, skipped Z")
- [ ] Import-twice test: second import of the same file changes nothing
- [ ] Auto-backup: on launch/foreground, if current `YYYY-MM` ≠ `last_backup_month`, write `backups/backup-YYYY-MM.csv`, update setting
- [ ] Minimal settings/gear screen: list backup files with share + delete, plus the Import and Export buttons

## Phase 9 — Polish & hardening

- [ ] Fresh-install → import backup → verify Home and Charts match pre-wipe state (manual E2E)
- [ ] Keyboard avoidance in Add modal; amount field autofocus after category pick
- [ ] Haptic/visual feedback on save
- [ ] Performance sanity check with ~5,000 seeded expenses (FlatList/SectionList virtualization behaving)
- [ ] App icon + splash
- [ ] Final `npm test` green, no TS errors, dead code removed

## Deferred ideas (do not build now)

- expo-background-task for true background backups
- Search/filter on Home
- Category icons/custom colors
- Monthly spending trend line chart
