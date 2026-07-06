# Expense Tracker

A deliberately minimal, offline-only expense tracker for Android/iOS, built with Expo and React Native. Log what you spent, see where it went — nothing else. No income, budgets, accounts, currencies, cloud sync, or network calls of any kind.

## Features

- **Home** — expenses for a selected month, grouped by day, newest first, with a running month total.
- **Add / edit** — two-step modal: pick a category, then note (optional), amount, and date. Tap any row to edit or delete it.
- **Charts** — donut chart of spend per category for any week / month / year, with a sorted legend (amounts + percentages) and stable per-category colors.
- **Categories** — add, rename, and reorder; deleting is only allowed for categories with no expenses.
- **CSV export / import** — full export via the OS share sheet; re-importing is an idempotent upsert (import the same file twice, nothing duplicates). Unknown categories are auto-created.
- **Automatic monthly backup** — on launch/foreground, once per calendar month, a full CSV snapshot is written to the app's documents folder. Backups can be shared or deleted from the settings screen.

All data lives on-device in SQLite. The CSV file is the single canonical interchange format — a fresh install plus an import restores everything.

## Tech

Expo SDK 57 · React Native · TypeScript (strict) · expo-sqlite · react-navigation (bottom tabs) · react-native-gifted-charts · Jest + ts-jest

Money is stored as integer cents (no floats, ever); dates as `YYYY-MM-DD` strings with ISO-8601 weeks (Monday start).

## Project layout

```
src/
  domain/      # pure logic: money, dates, grouping, colors (no Expo imports)
  services/    # csv serialize/parse, import planning, backup — csv & planning are pure
  db/          # sqlite schema, migrations, repositories (SQL never leaks out)
  screens/     # Home, Charts, Add/Edit modal, Category Manager, Settings
  components/  # list rows, separators, month/period selectors
  tests/       # Jest unit tests for all pure logic, runs in plain Node
```

## Development

```bash
npm install
npm start          # Metro dev server — open in Expo Go / a dev client
npm test           # unit tests (pure logic only, no device needed)
npm run typecheck  # tsc --noEmit
```

The most important test is the CSV round-trip: export → import into an empty DB → export must be byte-identical.

## Building an installable APK

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Download the APK from the build page and sideload it. Rebuilds with the same package id install over the top; on-device data persists.
