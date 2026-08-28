import { useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(0);
  const [lastWorkoutDate, setLastWorkoutDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHomeData = async () => {
    const db = await SQLite.openDatabaseAsync('atlas.db');

    const profileRow = await db.getFirstAsync<{ name: string }>(
      'SELECT name FROM profile WHERE id = 1'
    );
    setName(profileRow?.name || '');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const countRow = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM workout_history WHERE date >= ?',
      [sevenDaysAgoStr]
    );
    setWorkoutsThisWeek(countRow?.count || 0);

    const lastRow = await db.getFirstAsync<{ date: string }>(
      'SELECT date FROM workout_history ORDER BY id DESC LIMIT 1'
    );
    setLastWorkoutDate(lastRow?.date || null);

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, [])
  );

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.greeting}>
        {getGreeting()}{name ? `, ${name}` : ''}
      </ThemedText>
      <ThemedText style={styles.subGreeting}>Ready to train today?</ThemedText>

      <ThemedView style={styles.statsRow}>
        <ThemedView style={styles.statCard}>
          <ThemedText type="title" style={styles.statNumber}>{workoutsThisWeek}</ThemedText>
          <ThemedText style={styles.statLabel}>Workouts this week</ThemedText>
        </ThemedView>
        <ThemedView style={styles.statCard}>
          <ThemedText type="title" style={styles.statNumber}>
            {lastWorkoutDate ? formatRelativeDate(lastWorkoutDate) : '—'}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Last workout</ThemedText>
        </ThemedView>
      </ThemedView>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push('/(tabs)/workout')}>
        <ThemedText style={styles.primaryButtonText}>Generate Today's Workout</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push('/(tabs)/progress')}>
        <ThemedText style={styles.secondaryButtonText}>View Progress</ThemedText>
      </TouchableOpacity>

      {!name && (
        <ThemedView style={styles.setupPrompt}>
          <ThemedText style={styles.setupPromptText}>
            Set up your profile to get personalized workouts.
          </ThemedText>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <ThemedText style={styles.setupPromptLink}>Go to Profile →</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}
    </ThemedView>
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 70,
    gap: 12,
  },
  greeting: {
    marginBottom: 2,
  },
  subGreeting: {
    opacity: 0.7,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
  },
  statLabel: {
    opacity: 0.6,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#1D8CF8',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#1D8CF8',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1D8CF8',
    fontSize: 15,
    fontWeight: '600',
  },
  setupPrompt: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#D89614',
    borderRadius: 8,
    padding: 14,
    gap: 6,
  },
  setupPromptText: {
    fontSize: 13,
    opacity: 0.85,
  },
  setupPromptLink: {
    color: '#D89614',
    fontSize: 13,
    fontWeight: '600',
  },
});