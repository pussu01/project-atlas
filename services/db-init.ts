import * as SQLite from 'expo-sqlite';

export async function initDatabase(): Promise<void> {
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
      workout_json TEXT
    );
  `);

  // ── Measurements ─────────────────────────────────────────────────────────
  // Each row represents one historical body measurement.
  // Weight is required; other measurements are optional.

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

  // ── Migrations ────────────────────────────────────────────────────────────
  // Each ALTER TABLE is wrapped in its own try/catch.
  // SQLite does not support ALTER TABLE … IF NOT EXISTS, so we catch the
  // "duplicate column" error and continue. This is safe to run on every
  // app launch — existing installations are unaffected.

  try {
    await db.execAsync('ALTER TABLE profile ADD COLUMN time_available TEXT;');
  } catch {
    // Column already exists — safe to ignore.
  }

  try {
    await db.execAsync('ALTER TABLE profile ADD COLUMN age INTEGER;');
  } catch {
    // Column already exists — safe to ignore.
  }

  try {
    await db.execAsync('ALTER TABLE profile ADD COLUMN sex TEXT;');
  } catch {
    // Column already exists — safe to ignore.
  }

  try {
    await db.execAsync('ALTER TABLE profile ADD COLUMN height_cm REAL;');
  } catch {
    // Column already exists — safe to ignore.
  }

  try {
    await db.execAsync('ALTER TABLE profile ADD COLUMN fitness_level TEXT;');
  } catch {
    // Column already exists — safe to ignore.
  }

  try {
    await db.execAsync(
      'ALTER TABLE profile ADD COLUMN exercises_to_avoid TEXT;'
    );
  } catch {
    // Column already exists — safe to ignore.
  }
}