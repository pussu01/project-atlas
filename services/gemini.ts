const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

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

export async function generateWorkout(profile: {
  goal: string;
  equipment: string[];
  timeAvailable: string;
}): Promise<WorkoutPlan> {
  const prompt = `You are a fitness coach. Create a single workout for today for a person with this profile:

Goal: ${profile.goal}
Available equipment: ${profile.equipment.join(', ') || 'bodyweight only'}
Time available: ${profile.timeAvailable || '30 min'}

Size the number of main exercises to fit within the time available, including warm-up and cool-down.

For shorter times (15 min), include fewer exercises (2-3) with a brief warm-up/cool-down.

For longer times (45-60+ min), include more exercises (5-6) with a fuller warm-up/cool-down.

Return ONLY valid JSON, no markdown formatting, no extra text, in exactly this shape:

{
  "title": "short workout title",
  "warmup": [
    {
      "name": "short warm-up movement",
      "seconds": 30
    }
  ],
  "exercises": [
    {
      "name": "exercise name",
      "sets": 3,
      "reps": "10-12",
      "focus": "muscle group",
      "description": "one short sentence explaining how to perform this exercise with correct form"
    }
  ],
  "cooldown": [
    {
      "name": "short cooldown stretch",
      "seconds": 30
    }
  ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`,
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
  const prompt = `Simple black and white line-art sketch, minimal style, showing a person demonstrating the exercise "${exerciseName}". Two or three sequential poses showing the movement from start to end position. No color, no background, no text labels, clean instructional fitness diagram style, similar to a physical therapy handout.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${API_KEY}`,
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