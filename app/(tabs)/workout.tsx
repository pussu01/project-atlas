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
      <ThemedText style={styles.brand}>
  BHEEMAI
</ThemedText>

<ThemedText type="title" style={styles.pageTitle}>
  Today's Workout
</ThemedText>

<ThemedText style={styles.pageSubtitle}>
  Your workout adapts to your goals, recovery and recent training.
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
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 50,
    gap: 12,
  },

  /* ================================================================
     PRIMARY GENERATE BUTTON
  ================================================================ */

  button: {
    backgroundColor: '#F28C18',
    borderRadius: 14,
    minHeight: 58,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  buttonText: {
    color: '#080808',
    fontSize: 16,
    fontWeight: '800',
  },
  brand: {
  color: '#F28C18',
  fontSize: 13,
  fontWeight: '900',
  letterSpacing: 3.5,
  marginBottom: 9,
},

pageTitle: {
  fontSize: 30,
  lineHeight: 36,
  fontWeight: '800',
},

pageSubtitle: {
  fontSize: 15,
  lineHeight: 21,
  opacity: 0.58,
  marginBottom: 8,
},

  /* ================================================================
     START SESSION
  ================================================================ */

  startSessionButton: {
    backgroundColor: '#F28C18',
    borderRadius: 14,
    minHeight: 58,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },

  /* ================================================================
     SECTION HEADINGS
  ================================================================ */

  sectionTitle: {
    marginTop: 24,
    marginBottom: 7,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },

  /* ================================================================
     EXERCISE CARDS
  ================================================================ */

  exerciseCard: {
    padding: 17,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#292929',
    backgroundColor: '#151515',
    gap: 6,
  },

  exerciseDetail: {
    fontSize: 14,
    opacity: 0.85,
    marginTop: 2,
  },

  exerciseFocus: {
    color: '#F28C18',
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.9,
    marginTop: 1,
  },

  exerciseDescription: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.62,
  },

  /* ================================================================
     WATCH DEMO
  ================================================================ */

  demoButton: {
    marginTop: 10,
    alignSelf: 'flex-start',

    borderWidth: 1,
    borderColor: '#3A3A3A',

    backgroundColor: '#101010',

    borderRadius: 10,

    paddingVertical: 8,
    paddingHorizontal: 13,
  },

  demoButtonText: {
    color: '#F28C18',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ================================================================
     WARM-UP
  ================================================================ */

  warmupCard: {
    marginTop: 16,

    padding: 17,

    borderRadius: 17,

    backgroundColor: '#17130D',

    borderWidth: 1,
    borderColor: '#3A2B17',

    gap: 6,
  },

  warmupItem: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.72,
  },

  /* ================================================================
     COOL-DOWN
  ================================================================ */

  cooldownCard: {
    marginTop: 8,

    padding: 17,

    borderRadius: 17,

    backgroundColor: '#111416',

    borderWidth: 1,
    borderColor: '#292929',

    gap: 6,
  },

  /* ================================================================
     MARK AS DONE
  ================================================================ */

  doneButton: {
    backgroundColor: '#F28C18',

    borderRadius: 14,

    minHeight: 58,

    paddingHorizontal: 16,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 18,

    marginBottom: 10,
  },

  doneButtonSaved: {
    backgroundColor: '#343434',
  },
});