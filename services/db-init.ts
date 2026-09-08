import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('atlas.db');

  // ── Core tables ──────────────────────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT,
      goal TEXT,
      equipment TEXT
    );
  `);

  await db.execAsync(`
  CREATE TABLE IF NOT EXISTS workout_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    workout_json TEXT,
    active_seconds REAL DEFAULT 0,
    calories REAL DEFAULT 0
  );
`);
try {
  await db.execAsync(
    'ALTER TABLE workout_history ADD COLUMN active_seconds REAL DEFAULT 0;'
  );
} catch {
  // Column already exists.
}

try {
  await db.execAsync(
    'ALTER TABLE workout_history ADD COLUMN calories REAL DEFAULT 0;'
  );
} catch {
  // Column already exists.
}

  // ── Measurements ─────────────────────────────────────────────────────────

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      waist_cm REAL,
      chest_cm REAL,
      hips_cm REAL,
      neck_cm REAL
    );
  `);

  // ── Profile migrations ───────────────────────────────────────────────────

  try {
    await db.execAsync(
      'ALTER TABLE profile ADD COLUMN time_available TEXT;'
    );
  } catch {
    // Column already exists.
  }

  try {
    await db.execAsync(
      'ALTER TABLE profile ADD COLUMN age INTEGER;'
    );
  } catch {
    // Column already exists.
  }

  try {
    await db.execAsync(
      'ALTER TABLE profile ADD COLUMN sex TEXT;'
    );
  } catch {
    // Column already exists.
  }

  try {
    await db.execAsync(
      'ALTER TABLE profile ADD COLUMN height_cm REAL;'
    );
  } catch {
    // Column already exists.
  }

  try {
    await db.execAsync(
      'ALTER TABLE profile ADD COLUMN fitness_level TEXT;'
    );
  } catch {
    // Column already exists.
  }

  try {
    await db.execAsync(
      'ALTER TABLE profile ADD COLUMN exercises_to_avoid TEXT;'
    );
  } catch {
    // Column already exists.
  }

  return db;
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initializeDatabase().catch((error) => {
      // Allow a later attempt if initialization itself failed.
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}

export async function initDatabase(): Promise<void> {
  await getDatabase();
}