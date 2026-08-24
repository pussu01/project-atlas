import { useState, useCallback } from 'react';
import { StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutPlan } from '@/services/gemini';

type HistoryRow = {
  id: number;
  date: string;
  workout_json: string;
};

export default function ProgressScreen() {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const db = await SQLite.openDatabaseAsync('atlas.db');
      
      const rows = await db.getAllAsync<HistoryRow>(
        'SELECT * FROM workout_history ORDER BY id DESC'
      );
      setHistory(rows);
    } finally {
      setLoading(false);
    }
  };

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
          renderItem={({ item }) => {
            let plan: WorkoutPlan | null = null;
            try {
              plan = JSON.parse(item.workout_json);
            } catch {
              plan = null;
            }
            return (
              <ThemedView style={styles.card}>
                <ThemedText type="subtitle">{item.date}</ThemedText>
                {plan ? (
                  <>
                    <ThemedText type="defaultSemiBold" style={{ marginTop: 4 }}>{plan.title}</ThemedText>
                    <ThemedText style={styles.preview}>
                      {plan.exercises.map((e) => e.name).join(', ')}
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText style={styles.preview}>(Unreadable old entry)</ThemedText>
                )}
              </ThemedView>
            );
          }}
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