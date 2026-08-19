import { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { generateWorkout } from '@/services/gemini';

export default function WorkoutScreen() {
  const [loading, setLoading] = useState(false);
  const [workout, setWorkout] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setWorkout('');
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Workout</ThemedText>

      <TouchableOpacity style={styles.button} onPress={handleGenerate} disabled={loading}>
        <ThemedText style={styles.buttonText}>
          {loading ? 'Generating...' : 'Generate Today\'s Workout'}
        </ThemedText>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

      {workout ? (
        <ThemedView style={styles.resultBox}>
          <ThemedText>{workout}</ThemedText>
        </ThemedView>
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
  resultBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
});