import { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { generateWorkout, WorkoutPlan } from '@/services/gemini';

export default function WorkoutScreen() {
  const [loading, setLoading] = useState(false);
  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [saved, setSaved] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setWorkout(null);
    setSaved(false);
    try {
      const db = await SQLite.openDatabaseAsync('atlas.db');
      const profileRow = await db.getFirstAsync<{ goal: string; equipment: string }>(
        'SELECT goal, equipment FROM profile WHERE id = 1'
      );

      if (!profileRow || !profileRow.goal) {
        Alert.alert('No profile found', 'Please fill in your Profile tab first.');
        setLoading(false);
        return;
      }

      const result = await generateWorkout({
        goal: profileRow.goal,
        equipment: profileRow.equipment ? profileRow.equipment.split(',') : [],
      });

      setWorkout(result);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDone = async () => {
    if (!workout) return;
    try {
      const db = await SQLite.openDatabaseAsync('atlas.db');
      await db.execAsync(`
  DROP TABLE IF EXISTS workout_history;
  CREATE TABLE workout_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    workout_json TEXT
  );
`);
      const today = new Date().toISOString().split('T')[0];
      await db.runAsync(
        'INSERT INTO workout_history (date, workout_json) VALUES (?, ?)',
        [today, JSON.stringify(workout)]
      );
      setSaved(true);
      Alert.alert('Nice work!', 'Workout saved to your history.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save workout.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Workout</ThemedText>

      <TouchableOpacity style={styles.button} onPress={handleGenerate} disabled={loading}>
        <ThemedText style={styles.buttonText}>
          {loading ? 'Generating...' : "Generate Today's Workout"}
        </ThemedText>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

      {workout ? (
        <>
          <ThemedText type="subtitle" style={{ marginTop: 20 }}>{workout.title}</ThemedText>

          {workout.exercises.map((ex, i) => (
            <ThemedView key={i} style={styles.exerciseCard}>
              <ThemedText type="defaultSemiBold">{i + 1}. {ex.name}</ThemedText>
              <ThemedText style={styles.exerciseDetail}>{ex.sets} sets × {ex.reps} reps</ThemedText>
              <ThemedText style={styles.exerciseFocus}>Focus: {ex.focus}</ThemedText>
            </ThemedView>
          ))}

          <TouchableOpacity
            style={[styles.doneButton, saved && styles.doneButtonSaved]}
            onPress={handleMarkDone}
            disabled={saved}>
            <ThemedText style={styles.buttonText}>
              {saved ? '✓ Saved to History' : 'Mark as Done'}
            </ThemedText>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  button: {
    backgroundColor: '#1D8CF8',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseCard: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    gap: 4,
  },
  exerciseDetail: {
    opacity: 0.85,
  },
  exerciseFocus: {
    opacity: 0.6,
    fontSize: 13,
  },
  doneButton: {
    backgroundColor: '#22A559',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  doneButtonSaved: {
    backgroundColor: '#2b6b45',
  },
});