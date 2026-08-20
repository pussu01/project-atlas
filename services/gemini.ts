const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export type WorkoutExercise = {
  name: string;
  sets: number;
  reps: string;
  focus: string;
};

export type WorkoutPlan = {
  title: string;
  exercises: WorkoutExercise[];
};

export async function generateWorkout(profile: {
  goal: string;
  equipment: string[];
}): Promise<WorkoutPlan> {
  const prompt = `You are a fitness coach. Create a single workout for today for a person with this profile:
Goal: ${profile.goal}
Available equipment: ${profile.equipment.join(', ') || 'bodyweight only'}

Return ONLY valid JSON, no markdown formatting, no extra text, in exactly this shape:
{
  "title": "short workout title",
  "exercises": [
    { "name": "exercise name", "sets": 3, "reps": "10-12", "focus": "muscle group" }
  ]
}
Include 4-6 exercises.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
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