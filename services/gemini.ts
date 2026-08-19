const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export async function generateWorkout(profile: {
  goal: string;
  equipment: string[];
}): Promise<string> {
  const prompt = `You are a fitness coach. Create a single workout for today for a person with this profile:
Goal: ${profile.goal}
Available equipment: ${profile.equipment.join(', ') || 'bodyweight only'}

Give a short, clear workout with 4-6 exercises, including sets and reps for each. Keep it concise, no extra commentary.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`,
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
    throw new Error(data?.error?.message || 'Failed to generate workout');
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No workout returned from AI');
  }

  return text;
}