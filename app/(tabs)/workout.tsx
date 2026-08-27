import { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import * as SQLite from 'expo-sqlite';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  generateWorkout,
  WorkoutPlan,
} from '@/services/gemini';

import {
  getRecentWorkouts,
  getRecentMeasurements,
  calculateRecoveryConstraint,
} from '@/services/workout-context';

import WorkoutSession, {
  WorkoutSessionSummary,
} from '@/components/workout-session';

export default function WorkoutScreen() {
  const [loading, setLoading] = useState(false);
  const [workout, setWorkout] =
    useState<WorkoutPlan | null>(null);

  const [saved, setSaved] = useState(false);
  const [sessionActive, setSessionActive] =
    useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setWorkout(null);
    setSaved(false);

    try {
      const db =
        await SQLite.openDatabaseAsync('atlas.db');

      const profileRow =
        await db.getFirstAsync<{
          goal: string;
          equipment: string;
          time_available: string;
          age: number | null;
          sex: string;
          height_cm: number | null;
          fitness_level: string;
          exercises_to_avoid: string;
        }>(
          `SELECT
            goal,
            equipment,
            time_available,
            age,
            sex,
            height_cm,
            fitness_level,
            exercises_to_avoid
          FROM profile
          WHERE id = 1`
        );

      if (!profileRow || !profileRow.goal) {
        Alert.alert(
          'No profile found',
          'Please fill in your Profile tab first.'
        );

        setLoading(false);
        return;
      }

      const recentWorkouts =
        await getRecentWorkouts(5);

      const recentMeasurements =
        await getRecentMeasurements(3);

      const recoveryConstraint =
        calculateRecoveryConstraint(
          recentWorkouts
        );

      const result = await generateWorkout({
        goal: profileRow.goal,

        equipment: profileRow.equipment
          ? profileRow.equipment.split(',')
          : [],

        timeAvailable:
          profileRow.time_available || '30 min',

        age: profileRow.age ?? null,

        sex: profileRow.sex || '',

        heightCm:
          profileRow.height_cm ?? null,

        fitnessLevel:
          profileRow.fitness_level || '',

        exercisesToAvoid:
          profileRow.exercises_to_avoid || '',

        recentWorkouts,

        recentMeasurements,

        recoveryConstraint,
      });

      setWorkout(result);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message ||
          'Something went wrong while generating the workout.'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save a completed workout.
   *
   * Session metrics are embedded inside workout_json so we don't
   * need to alter the SQLite schema right now.
   */
  const handleMarkDone = async (
    summary?: WorkoutSessionSummary
  ) => {
    if (!workout) {
      return;
    }

    try {
      const db =
        await SQLite.openDatabaseAsync('atlas.db');

      const today =
        new Date().toISOString().split('T')[0];

      const workoutToSave = {
        ...workout,

        sessionSummary: summary
          ? {
              totalSeconds:
                Number(summary.totalSeconds) || 0,

              activeSeconds:
                Number(summary.activeSeconds) || 0,

              restSeconds:
                Number(summary.restSeconds) || 0,

              calories:
                Number(summary.calories) || 0,
            }
          : null,
      };

      await db.runAsync(
        `INSERT INTO workout_history
          (date, workout_json)
         VALUES (?, ?)`,
        [
          today,
          JSON.stringify(workoutToSave),
        ]
      );

      setSaved(true);

      if (summary) {
        Alert.alert(
          'Workout Saved',
          `${summary.calories} kcal estimated\n\n` +
            `Total: ${formatTime(summary.totalSeconds)}\n` +
            `Active: ${formatTime(summary.activeSeconds)}\n` +
            `Rest: ${formatTime(summary.restSeconds)}`
        );
      } else {
        Alert.alert(
          'Workout Saved',
          'Workout saved to your history.'
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Save Error',
        err?.message ||
          'Could not save the workout.'
      );
    }
  };

  if (sessionActive && workout) {
    return (
      <WorkoutSession
        workout={workout}
        onExit={() => setSessionActive(false)}
        onComplete={(
          summary: WorkoutSessionSummary
        ) => {
          setSessionActive(false);
          handleMarkDone(summary);
        }}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText type="title">
        Workout
      </ThemedText>

      <TouchableOpacity
        style={styles.button}
        onPress={handleGenerate}
        disabled={loading}
      >
        <ThemedText style={styles.buttonText}>
          {loading
            ? 'Generating...'
            : "Generate Today's Workout"}
        </ThemedText>
      </TouchableOpacity>

      {loading && (
        <ActivityIndicator
          size="large"
          style={{ marginTop: 20 }}
        />
      )}

      {workout ? (
        <>
          <ThemedText
            type="subtitle"
            style={{ marginTop: 20 }}
          >
            {workout.title}
          </ThemedText>

          <TouchableOpacity
            style={styles.startSessionButton}
            onPress={() =>
              setSessionActive(true)
            }
          >
            <ThemedText style={styles.buttonText}>
              ▶ Start Workout
            </ThemedText>
          </TouchableOpacity>

          {workout.warmup &&
            workout.warmup.length > 0 && (
              <ThemedView
                style={styles.warmupCard}
              >
                <ThemedText type="defaultSemiBold">
                  🔥 Warm-up
                </ThemedText>

                {workout.warmup.map(
                  (w, i) => (
                    <ThemedText
                      key={i}
                      style={styles.warmupItem}
                    >
                      • {w.name} ({w.seconds}s)
                    </ThemedText>
                  )
                )}
              </ThemedView>
            )}

          <ThemedText
            type="subtitle"
            style={styles.sectionTitle}
          >
            Exercises
          </ThemedText>

          {workout.exercises.map(
            (ex, i) => (
              <ThemedView
                key={i}
                style={styles.exerciseCard}
              >
                <ThemedText type="defaultSemiBold">
                  {i + 1}. {ex.name}
                </ThemedText>

                <ThemedText
                  style={styles.exerciseDetail}
                >
                  {ex.sets} sets × {ex.reps} reps
                </ThemedText>

                <ThemedText
                  style={styles.exerciseFocus}
                >
                  Focus: {ex.focus}
                </ThemedText>

                <ThemedText
                  style={styles.exerciseDescription}
                >
                  {ex.description}
                </ThemedText>

                <TouchableOpacity
                  style={styles.demoButton}
                  onPress={() => {
                    const url =
                      `https://www.youtube.com/results?search_query=` +
                      encodeURIComponent(
                        `${ex.name} exercise proper form`
                      );

                    Linking.openURL(url).catch(
                      () => {
                        Alert.alert(
                          'Unable to open YouTube',
                          'Please try again.'
                        );
                      }
                    );
                  }}
                >
                  <ThemedText
                    style={styles.demoButtonText}
                  >
                    ▶ Watch Demo
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            )
          )}

          {workout.cooldown &&
            workout.cooldown.length > 0 && (
              <ThemedView
                style={styles.cooldownCard}
              >
                <ThemedText type="defaultSemiBold">
                  🧘 Cool-down
                </ThemedText>

                {workout.cooldown.map(
                  (c, i) => (
                    <ThemedText
                      key={i}
                      style={styles.warmupItem}
                    >
                      • {c.name} ({c.seconds}s)
                    </ThemedText>
                  )
                )}
              </ThemedView>
            )}

          <TouchableOpacity
            style={[
              styles.doneButton,
              saved &&
                styles.doneButtonSaved,
            ]}
            onPress={() =>
              handleMarkDone()
            }
            disabled={saved}
          >
            <ThemedText style={styles.buttonText}>
              {saved
                ? '✓ Saved to History'
                : 'Mark as Done'}
            </ThemedText>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds)
    ? Math.max(0, Math.floor(seconds))
    : 0;

  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  return `${minutes}:${secs
    .toString()
    .padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
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

  startSessionButton: {
    backgroundColor: '#22A559',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },

  sectionTitle: {
    marginTop: 18,
    marginBottom: 4,
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

  exerciseDescription: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.9,
  },

  demoButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#1D8CF8',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  demoButtonText: {
    color: '#1D8CF8',
    fontSize: 13,
    fontWeight: '600',
  },

  warmupCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2a2410',
    gap: 4,
  },

  cooldownCard: {
    marginTop: 4,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#10202a',
    gap: 4,
  },

  warmupItem: {
    fontSize: 13,
    opacity: 0.9,
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