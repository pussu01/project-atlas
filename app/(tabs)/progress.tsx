import { useState, useCallback } from 'react';
import { StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type HistoryRow = {
  id: number;
  date: string;
  workout_text: string;
};

export default function ProgressScreen() {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const db = await SQLite.openDatabaseAsync('atlas.db');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS workout_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT,
          workout_text TEXT
        );
      `);
      const rows = await db.getAllAsync<HistoryRow>(
        'SELECT * FROM workout_history ORDER BY id DESC'
      );
      setHistory(rows);
    } finally {
      setLoading(false);
    }
  };

  // Reload every time this tab comes into focus, so new workouts show up immediately
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.header}>Progress</ThemedText>

      {loading ? (
        <ThemedText>Loading...</ThemedText>
      ) : history.length === 0 ? (
        <ThemedText>No workouts completed yet. Finish one from the Workout tab!</ThemedText>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <ThemedView style={styles.card}>
              <ThemedText type="subtitle">{item.date}</ThemedText>
              <ThemedText numberOfLines={4} style={styles.preview}>
                {item.workout_text}
              </ThemedText>
            </ThemedView>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 14,
  },
  preview: {
    marginTop: 6,
    opacity: 0.8,
  },
});