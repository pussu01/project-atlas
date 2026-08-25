import * as SQLite from 'expo-sqlite';
import { RecentWorkoutSummary, RecentMeasurementSummary } from './gemini';

export async function getRecentWorkouts(limit: number = 5): Promise<RecentWorkoutSummary[]> {
  const db = await SQLite.openDatabaseAsync('atlas.db');
  const rows = await db.getAllAsync<{ date: string; workout_json: string }>(
    'SELECT date, workout_json FROM workout_history ORDER BY id DESC LIMIT ?',
    [limit]
  );

  const summaries: RecentWorkoutSummary[] = [];

  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.workout_json);
      summaries.push({
        date: row.date,
        title: parsed.title || 'Workout',
        exercises: Array.isArray(parsed.exercises)
          ? parsed.exercises.map((e: any) => ({
              name: e?.name || 'Unknown exercise',
              focus: e?.focus || '',
            }))
          : [],
      });
    } catch {
      // Skip any entry that fails to parse rather than crashing generation
      continue;
    }
  }

  return summaries;
}

export async function getRecentMeasurements(limit: number = 3): Promise<RecentMeasurementSummary[]> {
  const db = await SQLite.openDatabaseAsync('atlas.db');
  const rows = await db.getAllAsync<{
    date: string;
    weight_kg: number | null;
    waist_cm: number | null;
    chest_cm: number | null;
    hips_cm: number | null;
    neck_cm: number | null;
  }>(
    'SELECT date, weight_kg, waist_cm, chest_cm, hips_cm, neck_cm FROM measurements ORDER BY date DESC, id DESC LIMIT ?',
    [limit]
  );

  return rows.map((r) => ({
    date: r.date,
    weightKg: r.weight_kg,
    waistCm: r.waist_cm,
    chestCm: r.chest_cm,
    hipsCm: r.hips_cm,
    neckCm: r.neck_cm,
  }));
}

export function calculateRecoveryConstraint(recentWorkouts: RecentWorkoutSummary[]): string | null {
  if (!recentWorkouts || recentWorkouts.length === 0) {
    return null;
  }

  // recentWorkouts is ordered newest-first (id DESC)
  const mostRecent = recentWorkouts[0];

  const lastDate = new Date(mostRecent.date);
  const today = new Date();
  lastDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - lastDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Only impose a constraint if the last workout was within the previous 2 days
  if (diffDays < 0 || diffDays > 2) {
    return null;
  }

  const focusAreas = Array.from(
    new Set(mostRecent.exercises.map((e) => e.focus).filter((f) => !!f))
  );

  if (focusAreas.length === 0) {
    return null;
  }

  const dayLabel = diffDays === 0 ? 'today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;

  return `RECOVERY CONSTRAINT:

The user's most recent completed workout was ${dayLabel}.

Primary recently trained areas: ${focusAreas.join(', ')}

Do not make these muscle groups the primary focus of today's workout. Choose another appropriately recovered focus. Do not blindly prohibit every exercise involving these muscles — only avoid making them the primary emphasis.`;
}