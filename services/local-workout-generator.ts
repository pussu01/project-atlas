import catalogData from '@/assets/exercise-catalog.json';
import { WorkoutPlan, WorkoutExercise, WorkoutStep, RecentWorkoutSummary } from './gemini';

type CatalogExercise = {
  id: string;
  name: string;
  force: string;
  level: string;
  mechanic: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
};

type LocalGeneratorProfile = {
  goal: string;
  equipment: string[]; // e.g. ['None / Bodyweight', 'Dumbbells']
  timeAvailable: string; // e.g. '30 min'
  fitnessLevel?: string; // 'Beginner' | 'Intermediate' | 'Advanced'
  exercisesToAvoid?: string;
  recentWorkouts?: RecentWorkoutSummary[];
};

// ── Equipment mapping ────────────────────────────────────────────────────────
// Free Exercise DB equipment strings are lowercase, e.g. "body only", "dumbbell",
// "barbell", "cable", "machine", "kettlebells", "bands", "exercise ball", etc.
// Each Atlas equipment tier includes everything below it.

const EQUIPMENT_TIERS: Record<string, string[]> = {
  'None / Bodyweight': ['body only'],
  Dumbbells: ['body only', 'dumbbell'],
  'Full Gym': [
    'body only', 'dumbbell', 'barbell', 'cable', 'machine',
    'kettlebells', 'bands', 'exercise ball', 'e-z curl bar',
    'medicine ball', 'foam roll', 'other',
  ],
};

function getAllowedEquipment(userEquipment: string[]): Set<string> {
  const allowed = new Set<string>();
  for (const tier of userEquipment) {
    const items = EQUIPMENT_TIERS[tier] || [];
    for (const item of items) allowed.add(item);
  }
  if (allowed.size === 0) allowed.add('body only');
  return allowed;
}

// ── Fitness level mapping ───────────────────────────────────────────────────

function getAllowedLevels(fitnessLevel?: string): Set<string> {
  switch (fitnessLevel) {
    case 'Beginner':
      return new Set(['beginner']);
    case 'Intermediate':
      return new Set(['beginner', 'intermediate']);
    case 'Advanced':
      return new Set(['beginner', 'intermediate', 'expert']);
    default:
      return new Set(['beginner', 'intermediate', 'expert']);
  }
}

// ── Time -> exercise count ──────────────────────────────────────────────────

function getExerciseCount(timeAvailable: string): number {
  if (timeAvailable.startsWith('15')) return 3;
  if (timeAvailable.startsWith('30')) return 4;
  if (timeAvailable.startsWith('45')) return 5;
  return 6; // 60+ min
}

// ── Avoid-list keyword filtering ────────────────────────────────────────────
// Deliberately simple, literal keyword matching — NOT semantic understanding.
// This is intentionally weaker than Gemini and should be disclosed to the user.

function buildAvoidKeywords(avoidText?: string): string[] {
  if (!avoidText || !avoidText.trim()) return [];
  return avoidText
    .toLowerCase()
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchesAvoidKeyword(exercise: CatalogExercise, keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const searchable = [
    exercise.name,
    ...exercise.primaryMuscles,
    ...exercise.secondaryMuscles,
    exercise.category,
  ]
    .join(' ')
    .toLowerCase();

  return keywords.some((kw) => searchable.includes(kw));
}

// ── Recent-exercise exclusion (simple non-repeat rule) ──────────────────────

function getRecentlyUsedExerciseNames(recentWorkouts?: RecentWorkoutSummary[]): Set<string> {
  const names = new Set<string>();
  if (!recentWorkouts || recentWorkouts.length === 0) return names;
  // Only look at the single most recent workout to avoid over-restricting the pool
  const mostRecent = recentWorkouts[0];
  for (const ex of mostRecent.exercises) {
    names.add(ex.name.toLowerCase().trim());
  }
  return names;
}

// ── Exercise -> WorkoutExercise conversion ──────────────────────────────────

function toWorkoutExercise(exercise: CatalogExercise): WorkoutExercise {
  const isStretchOrCardio = exercise.category === 'stretching' || exercise.category === 'cardio';

  return {
    name: exercise.name,
    sets: isStretchOrCardio ? 1 : 3,
    reps: isStretchOrCardio ? '30-45 sec' : exercise.mechanic === 'isolation' ? '12-15' : '10-12',
    focus: exercise.primaryMuscles[0] || exercise.category,
    description: exercise.instructions?.[0]?.slice(0, 140) || `Targets ${exercise.primaryMuscles.join(', ') || exercise.category}.`,
  };
}

// ── Fixed warm-up / cool-down pools ──────────────────────────────────────────
// Free Exercise DB has no reliable structured warm-up/cool-down tagging, so
// these are curated fixed lists, rotated by simple random selection.

const WARMUP_POOL: WorkoutStep[] = [
  { name: 'Arm circles', seconds: 30 },
  { name: 'Jumping jacks', seconds: 30 },
  { name: 'Bodyweight squats', seconds: 30 },
  { name: 'High knees', seconds: 30 },
  { name: 'Torso twists', seconds: 30 },
  { name: 'Leg swings', seconds: 30 },
];

const COOLDOWN_POOL: WorkoutStep[] = [
  { name: 'Standing quad stretch', seconds: 30 },
  { name: 'Hamstring stretch', seconds: 30 },
  { name: 'Shoulder stretch', seconds: 30 },
  { name: 'Child\'s pose', seconds: 30 },
  { name: 'Cat-cow stretch', seconds: 30 },
  { name: 'Deep breathing', seconds: 30 },
];

function pickRandom<T>(pool: T[], count: number): T[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Main generator ───────────────────────────────────────────────────────────

export function generateLocalWorkout(profile: LocalGeneratorProfile): WorkoutPlan {
  const catalog = catalogData as CatalogExercise[];

  const allowedEquipment = getAllowedEquipment(profile.equipment);
  const allowedLevels = getAllowedLevels(profile.fitnessLevel);
  const avoidKeywords = buildAvoidKeywords(profile.exercisesToAvoid);
  const recentlyUsed = getRecentlyUsedExerciseNames(profile.recentWorkouts);
  const exerciseCount = getExerciseCount(profile.timeAvailable);

  let pool = catalog.filter((ex) => {
    if (ex.category === 'stretching' || ex.category === 'strongman' || ex.category === 'powerlifting') return false;
    if (!ex.equipment || !allowedEquipment.has(ex.equipment)) return false;
    if (!allowedLevels.has(ex.level)) return false;
    if (matchesAvoidKeyword(ex, avoidKeywords)) return false;
    if (recentlyUsed.has(ex.name.toLowerCase().trim())) return false;
    return true;
  });

  // Fallback: if filtering was too aggressive (e.g. very restrictive avoid list),
  // relax the recent-exclusion rule first, since repeating occasionally is better
  // than returning an empty workout.
  if (pool.length < exerciseCount) {
    pool = catalog.filter((ex) => {
      if (ex.category === 'stretching') return false;
      if (!ex.equipment || !allowedEquipment.has(ex.equipment)) return false;
      if (!allowedLevels.has(ex.level)) return false;
      if (matchesAvoidKeyword(ex, avoidKeywords)) return false;
      return true;
    });
  }

  // Group by primary muscle for variety, then round-robin pick across groups
  const groups = new Map<string, CatalogExercise[]>();
  for (const ex of pool) {
    const key = ex.primaryMuscles[0] || ex.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ex);
  }

  const groupKeys = [...groups.keys()].sort(() => Math.random() - 0.5);
  for (const key of groupKeys) {
    groups.set(key, [...groups.get(key)!].sort(() => Math.random() - 0.5));
  }

  const selected: CatalogExercise[] = [];
  let groupIndex = 0;
  while (selected.length < exerciseCount && groupKeys.length > 0) {
    const key = groupKeys[groupIndex % groupKeys.length];
    const group = groups.get(key)!;
    if (group.length > 0) {
      selected.push(group.shift()!);
    }
    groupIndex++;
    if (groupIndex > groupKeys.length * (exerciseCount + 5)) break; // safety valve
  }

  const exercises = selected.map(toWorkoutExercise);

  return {
    title: `${profile.goal} — Offline Workout`,
    warmup: pickRandom(WARMUP_POOL, 3),
    exercises,
    cooldown: pickRandom(COOLDOWN_POOL, 3),
  };
}