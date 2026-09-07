import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { initDatabase } from '@/services/db-init';

const BheemAITheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#F28C18',
    background: '#0B0B0B',
    card: '#151515',
    text: '#F5F5F5',
    border: '#292929',
    notification: '#F28C18',
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <ThemeProvider value={BheemAITheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Modal' }}
        />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}