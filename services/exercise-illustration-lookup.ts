import catalogData from '@/assets/exercise-catalog.json';

type CatalogEntry = {
  id: string;
  name: string;
  illustration: {
    slug: string;
    matchType: string;
    frames: string[];
    frameXml?: string[];
    attribution: any;
  } | null;
};

const FUZZY_MATCHING_ENABLED = false; // conservative default — see note below
const FUZZY_THRESHOLD = 0.8;

const DISTINGUISHING_MODIFIERS = new Set([
  'barbell', 'dumbbell', 'cable', 'machine', 'smith', 'kettlebell', 'band', 'banded',
  'incline', 'decline', 'flat', 'seated', 'standing', 'kneeling', 'lying', 'bent',
  'prone', 'supine', 'close', 'wide', 'narrow', 'grip', 'single', 'double',
  'alternating', 'unilateral', 'bilateral', 'reverse', 'underhand', 'overhand',
  'neutral', 'assisted', 'weighted', 'bodyweight', 'front', 'back', 'behind',
  'zercher', 'sumo', 'conventional', 'romanian', 'stiff', 'wrist', 'overhead',
  'upright', 'pistol', 'ball', 'stability', 'bench', 'leg', 'suspended', 'trx',
  'depth', 'plyo', 'plyometric',
]);

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/s\b/g, '') // very light plural handling: "push-ups" -> "push up"
    .split(' ')
    .filter(Boolean)
    .join(' ');
}

function tokens(name: string): string[] {
  return normalize(name).split(' ').filter(Boolean);
}

function hasConflictingModifier(tokensA: string[], tokensB: string[]): boolean {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  for (const mod of DISTINGUISHING_MODIFIERS) {
    if (setA.has(mod) !== setB.has(mod)) return true;
  }
  return false;
}

function jaccard(tokensA: string[], tokensB: string[]): number {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const union = new Set([...setA, ...setB]);
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  return union.size === 0 ? 0 : intersection / union.size;
}

const illustrated: CatalogEntry[] = (catalogData as CatalogEntry[]).filter(
  (e) => e.illustration?.frameXml && e.illustration.frameXml.length > 0
);

const exactLookup = new Map<string, CatalogEntry>();
for (const entry of illustrated) {
  exactLookup.set(normalize(entry.name), entry);
}

/**
 * Returns the 3 SVG frame XML strings for a given exercise name, or null
 * if no confident match exists. Deliberately conservative — see
 * FUZZY_MATCHING_ENABLED above.
 */
export function findIllustrationFrames(exerciseName: string): string[] | null {
  const normalized = normalize(exerciseName);

  const exact = exactLookup.get(normalized);
  if (exact?.illustration?.frameXml) {
    return exact.illustration.frameXml;
  }

  if (!FUZZY_MATCHING_ENABLED) return null;

  const givenTokens = tokens(exerciseName);
  let best: CatalogEntry | null = null;
  let bestScore = 0;

  for (const entry of illustrated) {
    const entryTokens = tokens(entry.name);
    if (hasConflictingModifier(givenTokens, entryTokens)) continue;

    const score = jaccard(givenTokens, entryTokens);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (best && bestScore >= FUZZY_THRESHOLD && best.illustration?.frameXml) {
    return best.illustration.frameXml;
  }

  return null;
}