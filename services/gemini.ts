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

function formatRecentWorkouts(workouts?: RecentWorkoutSummary[]): string {
  if (!workouts || workouts.length === 0) {
    return '';
  }
  const blocks = workouts.map((w) => {
    const exerciseLines = w.exercises
      .map((e) => `- ${e.name}${e.focus ? ` — ${e.focus}` : ''}`)
      .join('\n');
    return `${w.date}\nTitle: ${w.title}\nExercises:\n${exerciseLines}`;
  });
  return `RECENT COMPLETED WORKOUTS:\n\n${blocks.join('\n\n')}`;
}

function formatRecentMeasurements(measurements?: RecentMeasurementSummary[]): string {
  if (!measurements || measurements.length === 0) {
    return '';
  }
  const blocks = measurements.map((m) => {
    const parts: string[] = [];
    if (m.weightKg != null) parts.push(`Weight: ${m.weightKg} kg`);
    if (m.waistCm != null) parts.push(`Waist: ${m.waistCm} cm`);
    if (m.chestCm != null) parts.push(`Chest: ${m.chestCm} cm`);
    if (m.hipsCm != null) parts.push(`Hips: ${m.hipsCm} cm`);
    if (m.neckCm != null) parts.push(`Neck: ${m.neckCm} cm`);
    return `${m.date}\n${parts.join('\n')}`;
  });
  return `RECENT BODY MEASUREMENTS:\n\n${blocks.join('\n\n')}`;
}

export async function generateWorkout(profile: {
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
}): Promise<WorkoutPlan> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add your Gemini API key in Profile.');
  }

  const recentWorkoutsBlock = formatRecentWorkouts(profile.recentWorkouts);
  const recentMeasurementsBlock = formatRecentMeasurements(profile.recentMeasurements);

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
    { "name": "exercise name", "sets": 3, "reps": "10-12", "focus": "muscle group", "description": "one short sentence explaining how to perform this exercise with correct form" }
  ],
  "cooldown": [{ "name": "short cooldown stretch", "seconds": 30 }]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Failed to generate workout');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No workout returned from AI');
  }

  try {
    const parsed: WorkoutPlan = JSON.parse(text);
    return parsed;
  } catch {
    throw new Error('AI returned an unexpected format. Please try again.');
  }
}

export async function generateExerciseSketch(
  exerciseName: string
): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add your Gemini API key in Profile.');
  }

  const prompt = `Simple black and white line-art sketch, minimal style, showing a person demonstrating the exercise "${exerciseName}". Two or three sequential poses showing the movement from start to end position. No color, no background, no text labels, clean instructional fitness diagram style, similar to a physical therapy handout.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Failed to generate sketch');
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData);

  if (!imagePart) {
    throw new Error('No image returned from AI');
  }

  return `data:image/png;base64,${imagePart.inlineData.data}`;
}

export async function testGeminiConnection(apiKeyToTest: string): Promise<void> {
  const trimmed = apiKeyToTest.trim();
  if (!trimmed) {
    throw new Error('No API key provided.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${trimmed}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with the single word: OK' }] }],
      }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.error?.message || 'Could not authenticate with the provided key.';
    throw new Error(message);
  }
}