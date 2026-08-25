import * as SecureStore from 'expo-secure-store';

const GEMINI_KEY_NAME = 'atlas_gemini_api_key';

export async function getGeminiApiKey(): Promise<string | null> {
  try {
    const key = await SecureStore.getItemAsync(GEMINI_KEY_NAME);
    return key;
  } catch {
    return null;
  }
}

export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  await SecureStore.setItemAsync(GEMINI_KEY_NAME, trimmed);
}

export async function deleteGeminiApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(GEMINI_KEY_NAME);
}

export async function hasGeminiApiKey(): Promise<boolean> {
  const key = await getGeminiApiKey();
  return !!key && key.length > 0;
}