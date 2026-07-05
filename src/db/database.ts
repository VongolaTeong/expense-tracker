import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'expense-tracker.db';

export const SEED_CATEGORY_NAMES = [
  'Food',
  'Transport',
  'Groceries',
  'Shopping',
  'Bills',
  'Health',
  'Entertainment',
  'Other',
] as const;

interface Migration {
  toVersion: number;
  run: (txn: SQLite.SQLiteDatabase) => Promise<void>;
}

const migrations: Migration[] = [{ toVersion: 1, run: migrateToV1 }];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens (and on first call migrates) the app database. All repository
 * functions go through this; screens never call it directly.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate().catch((err: unknown) => {
      dbPromise = null; // allow retry on next call
      throw err;
    });
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');
  await runMigrations(db);
  return db;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // settings is the bootstrap table: it must exist before we can read
  // schema_version, so it is created here rather than in a migration.
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
  );
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'schema_version'"
  );
  let version = row ? Number(row.value) : 0;

  for (const migration of migrations) {
    if (migration.toVersion <= version) continue;
    await db.withExclusiveTransactionAsync(async (txn) => {
      await migration.run(txn);
      await txn.runAsync(
        `INSERT INTO settings (key, value) VALUES ('schema_version', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [String(migration.toVersion)]
      );
    });
    version = migration.toVersion;
  }
}

async function migrateToV1(txn: SQLite.SQLiteDatabase): Promise<void> {
  await txn.execAsync(`
    CREATE TABLE categories (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE expenses (
      id           TEXT PRIMARY KEY,
      category_id  TEXT NOT NULL REFERENCES categories(id),
      note         TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL,
      spent_on     TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );

    CREATE INDEX idx_expenses_spent_on ON expenses(spent_on);
  `);

  // Seed default categories. Running inside the v1 migration makes this a
  // strict first-launch event — reinstalls that import a backup CSV will
  // simply update/extend these rows later.
  const createdAt = new Date().toISOString();
  for (let i = 0; i < SEED_CATEGORY_NAMES.length; i++) {
    await txn.runAsync(
      'INSERT INTO categories (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)',
      [Crypto.randomUUID(), SEED_CATEGORY_NAMES[i], i, createdAt]
    );
  }
}

export function newId(): string {
  return Crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
