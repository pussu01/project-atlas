import { getGeminiApiKey } from './gemini-key';

export type WorkoutExercise = {
  name: string;
  sets: number;
  reps: string;
  focus: string;
  description: string;
};

export type WorkoutStep = {
  name: string;
  seconds: number;
};

export type WorkoutPlan = {
  title: string;
  warmup: WorkoutStep[];
  exercises: WorkoutExercise[];
  cooldown: WorkoutStep[];
};

export type RecentWorkoutSummary = {
  date: string;
  title: string;
  exercises: { name: string; focus: string }[];
};

export type RecentMeasurementSummary = {
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  hipsCm: number | null;
  neckCm: number | null;
};

/*
 * ================================================================
 * CONFIGURATION
 * ================================================================
 */

const REQUEST_TIMEOUT_MS = 30_000;

/*
 * ================================================================
 * ERROR TYPES
 * ================================================================
 */

export type GeminiErrorType =
  | 'NO_API_KEY'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'INVALID_API_KEY'
  | 'PERMISSION'
  | 'RATE_LIMIT'
  | 'SERVER'
  | 'BAD_REQUEST'
  | 'BLOCKED'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

export class GeminiError extends Error {
  type: GeminiErrorType;
  originalMessage?: string;

  constructor(
    type: GeminiErrorType,
    message: string,
    originalMessage?: string
  ) {
    super(message);
    this.name = 'GeminiError';
    this.type = type;
    this.originalMessage = originalMessage;
  }
}

/*
 * ================================================================
 * RECENT WORKOUT FORMATTING
 * ================================================================
 */

function formatRecentWorkouts(
  workouts?: RecentWorkoutSummary[]
): string {
  if (!workouts || workouts.length === 0) {
    return '';
  }

  const blocks = workouts.map((w) => {
    const exerciseLines = w.exercises
      .map(
        (e) =>
          `- ${e.name}${e.focus ? ` — ${e.focus}` : ''}`
      )
      .join('\n');

    return `${w.date}
Title: ${w.title}
Exercises:
${exerciseLines}`;
  });

  return `RECENT COMPLETED WORKOUTS:

${blocks.join('\n\n')}`;
}

/*
 * ================================================================
 * RECENT MEASUREMENTS FORMATTING
 * ================================================================
 */

function formatRecentMeasurements(
  measurements?: RecentMeasurementSummary[]
): string {
  if (!measurements || measurements.length === 0) {
    return '';
  }

  const blocks = measurements.map((m) => {
    const parts: string[] = [];

    if (m.weightKg != null) {
      parts.push(`Weight: ${m.weightKg} kg`);
    }

    if (m.waistCm != null) {
      parts.push(`Waist: ${m.waistCm} cm`);
    }

    if (m.chestCm != null) {
      parts.push(`Chest: ${m.chestCm} cm`);
    }

    if (m.hipsCm != null) {
      parts.push(`Hips: ${m.hipsCm} cm`);
    }

    if (m.neckCm != null) {
      parts.push(`Neck: ${m.neckCm} cm`);
    }

    return `${m.date}\n${parts.join('\n')}`;
  });

  return `RECENT BODY MEASUREMENTS:

${blocks.join('\n\n')}`;
}

/*
 * ================================================================
 * SAFE FETCH WITH TIMEOUT
 * ================================================================
 */

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new GeminiError(
        'TIMEOUT',
        'BheemAI took too long to respond. Please try again.'
      );
    }

    throw new GeminiError(
      'NETWORK',
      'BheemAI could not connect to Gemini. Check your internet connection and try again.',
      error?.message
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/*
 * ================================================================
 * READ GEMINI ERROR
 * ================================================================
 */

async function readGeminiError(
  response: Response
): Promise<never> {
  let data: any = null;

  try {
    data = await response.json();
  } catch {
    // Response was not valid JSON.
  }

  const message =
    data?.error?.message ||
    data?.error?.status ||
    `Gemini request failed with status ${response.status}.`;

  switch (response.status) {
    case 400:
      throw new GeminiError(
        'BAD_REQUEST',
        'BheemAI could not process the workout request. Please try again.',
        message
      );

    case 401:
      throw new GeminiError(
        'INVALID_API_KEY',
        'Your Gemini API key is invalid. Check it in Profile → AI Coach.',
        message
      );

    case 403:
      throw new GeminiError(
        'PERMISSION',
        'Gemini rejected this API request. Check your API key and Google AI Studio settings.',
        message
      );

    case 429:
      throw new GeminiError(
        'RATE_LIMIT',
        'Gemini usage limit reached. Please try again later.',
        message
      );

    case 500:
    case 502:
    case 503:
    case 504:
      throw new GeminiError(
        'SERVER',
        'Gemini is temporarily unavailable. Please try again in a moment.',
        message
      );

    default:
      throw new GeminiError(
        'UNKNOWN',
        'BheemAI could not generate your workout right now. Please try again.',
        message
      );
  }
}

/*
 * ================================================================
 * WORKOUT VALIDATION
 * ================================================================
 */

function normalizeWorkout(
  value: any
): WorkoutPlan {
  if (!value || typeof value !== 'object') {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'BheemAI returned an invalid workout. Please try again.'
    );
  }

  if (
    typeof value.title !== 'string' ||
    !value.title.trim()
  ) {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'BheemAI returned a workout without a valid title. Please try again.'
    );
  }

  if (!Array.isArray(value.exercises)) {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'BheemAI returned an invalid exercise list. Please try again.'
    );
  }

  if (value.exercises.length === 0) {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'BheemAI did not return any exercises. Please try again.'
    );
  }

  const normalizeStep = (
    step: any
  ): WorkoutStep | null => {
    if (!step || typeof step !== 'object') {
      return null;
    }

    if (
      typeof step.name !== 'string' ||
      !step.name.trim()
    ) {
      return null;
    }

    const seconds = Number(step.seconds);

    if (
      !Number.isFinite(seconds) ||
      seconds <= 0
    ) {
      return null;
    }

    return {
      name: step.name.trim(),
      seconds: Math.round(seconds),
    };
  };

  const normalizeExercise = (
    exercise: any
  ): WorkoutExercise | null => {
    if (
      !exercise ||
      typeof exercise !== 'object'
    ) {
      return null;
    }

    if (
      typeof exercise.name !== 'string' ||
      !exercise.name.trim()
    ) {
      return null;
    }

    const sets = Number(exercise.sets);

    if (
      !Number.isFinite(sets) ||
      sets <= 0
    ) {
      return null;
    }

    return {
      name: exercise.name.trim(),

      sets: Math.max(
        1,
        Math.round(sets)
      ),

      reps:
        typeof exercise.reps === 'string'
          ? exercise.reps.trim()
          : String(
              exercise.reps ?? ''
            ),

      focus:
        typeof exercise.focus === 'string'
          ? exercise.focus.trim()
          : '',

      description:
        typeof exercise.description === 'string'
          ? exercise.description.trim()
          : '',
    };
  };

  const warmup = Array.isArray(value.warmup)
    ? value.warmup
        .map(normalizeStep)
        .filter(
          (
            item
          ): item is WorkoutStep =>
            item !== null
        )
    : [];

  const exercises = value.exercises
    .map(normalizeExercise)
    .filter(
      (
        item
      ): item is WorkoutExercise =>
        item !== null
    );

  const cooldown =
    Array.isArray(value.cooldown)
      ? value.cooldown
          .map(normalizeStep)
          .filter(
            (
              item
            ): item is WorkoutStep =>
              item !== null
          )
      : [];

  if (exercises.length === 0) {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'BheemAI returned no usable exercises. Please try again.'
    );
  }

  return {
    title: value.title.trim(),
    warmup,
    exercises,
    cooldown,
  };
}

/*
 * ================================================================
 * EXTRACT JSON TEXT
 * ================================================================
 */

function extractResponseText(
  data: any
): string {
  const candidates =
    data?.candidates;

  if (
    !Array.isArray(candidates) ||
    candidates.length === 0
  ) {
    if (
      data?.promptFeedback?.blockReason
    ) {
      throw new GeminiError(
        'BLOCKED',
        'BheemAI could not generate this workout because the request was blocked. Please try again.'
      );
    }

    throw new GeminiError(
      'INVALID_RESPONSE',
      'Gemini returned no workout. Please try again.'
    );
  }

  const parts =
    candidates[0]?.content?.parts;

  if (
    !Array.isArray(parts) ||
    parts.length === 0
  ) {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'Gemini returned an empty workout response. Please try again.'
    );
  }

  const textPart = parts.find(
    (part: any) =>
      typeof part?.text === 'string'
  );

  if (!textPart?.text) {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'Gemini returned no usable workout data. Please try again.'
    );
  }

  return textPart.text.trim();
}

/*
 * ================================================================
 * GENERATE WORKOUT
 * ================================================================
 */

export async function generateWorkout(
  profile: {
    goal: string;
    equipment: string[];
    timeAvailable: string;
    age?: number | null;
    sex?: string;
    heightCm?: number | null;
    fitnessLevel?: string;
    exercisesToAvoid?: string;
    recentWorkouts?: RecentWorkoutSummary[];
    recentMeasurements?: RecentMeasurementSummary[];
    recoveryConstraint?: string | null;
  }
): Promise<WorkoutPlan> {
  const apiKey =
    await getGeminiApiKey();

  if (!apiKey) {
    throw new GeminiError(
      'NO_API_KEY',
      'Your Gemini API key is not configured. Please add it in Profile → AI Coach.'
    );
  }

  const recentWorkoutsBlock =
    formatRecentWorkouts(
      profile.recentWorkouts
    );

  const recentMeasurementsBlock =
    formatRecentMeasurements(
      profile.recentMeasurements
    );

  const prompt = `You are a fitness coach. Create a single workout for today for a person with this profile:

Goal: ${profile.goal}
${profile.age ? `Age: ${profile.age}` : ''}
${profile.sex ? `Sex: ${profile.sex}` : ''}
${profile.heightCm ? `Height: ${profile.heightCm} cm` : ''}
${profile.fitnessLevel ? `Fitness level: ${profile.fitnessLevel}` : ''}
Available equipment: ${profile.equipment.join(', ') || 'bodyweight only'}
Time available: ${profile.timeAvailable || '30 min'}
${profile.exercisesToAvoid ? `Special Instructions / Health & Exercise Considerations: ${profile.exercisesToAvoid}` : ''}

${recentWorkoutsBlock}

${recentMeasurementsBlock}

${profile.recoveryConstraint || ''}

Size the number of main exercises to fit within the time available, including warm-up and cool-down. For shorter times (15 min), include fewer exercises (2-3) with a brief warm-up/cool-down. For longer times (45-60+ min), include more exercises (5-6) with a fuller warm-up/cool-down.

Adjust difficulty, exercise selection and volume to match the user's fitness level.

Use recent workout history to avoid unnecessarily repeating the same workout. Do not simply reproduce the most recent workout. Variation should be purposeful and appropriate to the user's goal, equipment, fitness level and recovery. Prefer sensible progression and exercise variation over random changes. Do not introduce random exercises merely for the sake of variety.

Treat the user's special instructions and health/exercise considerations as constraints. Do not recommend exercises that directly conflict with stated restrictions. Do not diagnose medical conditions. If the user's stated condition or request requires medical judgment, favor conservative exercise selection and intensity rather than attempting a diagnosis or medical recommendation.

Do not include any exercises listed under special instructions if they describe exercises to avoid.

Return ONLY valid JSON, no markdown formatting, no extra text, in exactly this shape:
{
  "title": "short workout title",
  "warmup": [{ "name": "short warm-up movement", "seconds": 30 }],
  "exercises": [
    {
      "name": "exercise name",
      "sets": 3,
      "reps": "10-12",
      "focus": "muscle group",
      "description": "one short sentence explaining how to perform this exercise with correct form"
    }
  ],
  "cooldown": [{ "name": "short cooldown stretch", "seconds": 30 }]
}`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/` +
    `models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

  let response: Response;

  try {
    response =
      await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType:
                'application/json',
            },
          }),
        }
      );
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    throw new GeminiError(
      'NETWORK',
      'BheemAI could not connect to Gemini. Check your internet connection and try again.'
    );
  }

  if (!response.ok) {
    await readGeminiError(response);
  }

  let data: any;

  try {
    data = await response.json();
  } catch {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'Gemini returned an unreadable response. Please try again.'
    );
  }

  const text =
    extractResponseText(data);

  try {
    const parsed =
      JSON.parse(text);

    return normalizeWorkout(parsed);
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    throw new GeminiError(
      'INVALID_RESPONSE',
      'BheemAI returned an unexpected workout format. Please try again.'
    );
  }
}

/*
 * ================================================================
 * EXERCISE SKETCH
 * ================================================================
 *
 * Kept unchanged for now. Exercise illustrations are NOT part of
 * the first EAS build.
 */

export async function generateExerciseSketch(
  exerciseName: string
): Promise<string> {
  const apiKey =
    await getGeminiApiKey();

  if (!apiKey) {
    throw new GeminiError(
      'NO_API_KEY',
      'Your Gemini API key is not configured. Please add it in Profile → AI Coach.'
    );
  }

  const prompt = `Simple black and white line-art sketch, minimal style, showing a person demonstrating the exercise "${exerciseName}". Two or three sequential poses showing the movement from start to end position. No color, no background, no text labels, clean instructional fitness diagram style, similar to a physical therapy handout.`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/` +
    `models/gemini-3.1-flash-image:generateContent?key=${apiKey}`;

  let response: Response;

  try {
    response =
      await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        }
      );
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    throw new GeminiError(
      'NETWORK',
      'Could not connect to the image service.'
    );
  }

  if (!response.ok) {
    await readGeminiError(response);
  }

  let data: any;

  try {
    data = await response.json();
  } catch {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'The image service returned an unreadable response.'
    );
  }

  const parts =
    data?.candidates?.[0]?.content?.parts ||
    [];

  const imagePart = parts.find(
    (p: any) => p?.inlineData
  );

  if (!imagePart) {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'No exercise illustration was returned.'
    );
  }

  return `data:image/png;base64,${imagePart.inlineData.data}`;
}

/*
 * ================================================================
 * TEST GEMINI CONNECTION
 * ================================================================
 */

export async function testGeminiConnection(
  apiKeyToTest: string
): Promise<void> {
  const trimmed =
    apiKeyToTest.trim();

  if (!trimmed) {
    throw new GeminiError(
      'NO_API_KEY',
      'No API key provided.'
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/` +
    `models/gemini-3.5-flash-lite:generateContent?key=${trimmed}`;

  let response: Response;

  try {
    response =
      await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      'Reply with the single word: OK',
                  },
                ],
              },
            ],
          }),
        }
      );
  } catch (error) {
    if (error instanceof GeminiError) {
      throw error;
    }

    throw new GeminiError(
      'NETWORK',
      'Could not connect to Gemini. Check your internet connection and try again.'
    );
  }

  if (!response.ok) {
    await readGeminiError(response);
  }

  let data: any;

  try {
    data = await response.json();
  } catch {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'Gemini returned an unreadable response.'
    );
  }

  const text =
    extractResponseText(data);

  if (
    !text
      .trim()
      .toUpperCase()
      .includes('OK')
  ) {
    throw new GeminiError(
      'INVALID_RESPONSE',
      'Gemini responded, but the connection test returned an unexpected response.'
    );
  }
}