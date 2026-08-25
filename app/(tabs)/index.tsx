import { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  getTodaysMission,
  TodaysMission,
} from '@/services/mission';

export default function HomeScreen() {
  const router = useRouter();

  const [mission, setMission] = useState<TodaysMission | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMission = async () => {
    try {
      setLoading(true);

      const todaysMission = await getTodaysMission();

      setMission(todaysMission);
    } catch (error) {
      console.error('Failed to load today\'s mission:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMission();
    }, [])
  );

  const handleMissionAction = () => {
    if (!mission) {
      return;
    }

    if (mission.action === 'profile') {
      router.push('/(tabs)/profile');
      return;
    }

    if (mission.action === 'workout') {
      router.push('/(tabs)/workout');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.header}>
        Atlas
      </ThemedText>

      <ThemedText style={styles.subtitle}>
        Your fitness journey, one day at a time.
      </ThemedText>

      <ThemedText type="subtitle" style={styles.sectionTitle}>
        Today's Mission
      </ThemedText>

      {loading ? (
        <ThemedView style={styles.card}>
          <ThemedText>Loading your mission...</ThemedText>
        </ThemedView>
      ) : mission ? (
        <ThemedView style={styles.missionCard}>
          <ThemedText type="title" style={styles.missionTitle}>
            {mission.title}
          </ThemedText>

          <ThemedText style={styles.missionMessage}>
            {mission.message}
          </ThemedText>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleMissionAction}
          >
            <ThemedText style={styles.primaryButtonText}>
              {mission.buttonText}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      ) : (
        <ThemedView style={styles.card}>
          <ThemedText>
            We couldn't load today's mission. Please try again.
          </ThemedText>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={loadMission}
          >
            <ThemedText style={styles.primaryButtonText}>
              Try Again
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}

      <ThemedView style={styles.infoCard}>
        <ThemedText type="subtitle">
          Atlas
        </ThemedText>

        <ThemedText style={styles.infoText}>
          Your workouts, progress and fitness history stay on your device.
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  header: {
    marginTop: 20,
    marginBottom: 4,
  },

  subtitle: {
    opacity: 0.7,
    marginBottom: 30,
  },

  sectionTitle: {
    marginBottom: 12,
  },

  missionCard: {
    borderWidth: 1,
    borderColor: '#1D8CF8',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
  },

  missionTitle: {
    marginBottom: 14,
  },

  missionMessage: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.9,
    marginBottom: 20,
  },

  card: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
  },

  primaryButton: {
    backgroundColor: '#1D8CF8',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },

  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  infoCard: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 14,
    padding: 18,
    marginTop: 10,
  },

  infoText: {
    marginTop: 8,
    opacity: 0.7,
    lineHeight: 20,
  },
});