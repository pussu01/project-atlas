import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Linking,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { getDatabase } from '@/services/db-init';

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

import {
  hasGeminiApiKey,
} from '@/services/gemini-key';

import { generateLocalWorkout } from '@/services/local-workout-generator';
import { findIllustrationFrames } from '@/services/exercise-illustration-lookup';
import ExerciseIllustration from '@/components/exercise-illustration';

import WorkoutSession, {
  WorkoutSessionSummary,
} from '@/components/workout-session';

/* ================================================================
   HELPERS
   ================================================================ */

function isValidWorkoutPlan(value: any): value is WorkoutPlan {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (typeof value.title !== 'string') {
    return false;
  }

  if (!Array.isArray(value.exercises)) {
    return false;
  }

  if (value.exercises.length === 0) {
    return false;
  }

  if (!Array.isArray(value.warmup)) {
    return false;
  }

  if (!Array.isArray(value.cooldown)) {
    return false;
  }

  return true;
}

function parseRepeatedWorkout(
  repeatWorkout: string | undefined
): WorkoutPlan | null {
  if (!repeatWorkout) {
    return null;
  }

  try {
    const parsed = JSON.parse(repeatWorkout);

    if (!isValidWorkoutPlan(parsed)) {
      return null;
    }

    /*
     * Remove old session summary.
     * A repeated workout is treated as a fresh workout.
     */

    return {
      title: parsed.title,
      warmup: parsed.warmup,
      exercises: parsed.exercises,
      cooldown: parsed.cooldown,
    };
  } catch {
    return null;
  }
}

type ProfileRow = {
  goal: string;
  equipment: string;
  time_available: string;
  age: number | null;
  sex: string;
  height_cm: number | null;
  fitness_level: string;
  exercises_to_avoid: string;
};

async function fetchProfileRow(): Promise<ProfileRow | null> {
  const db = await getDatabase();

  const profileRow = await db.getFirstAsync<ProfileRow>(
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

  return profileRow || null;
}

export default function WorkoutScreen() {
  const params = useLocalSearchParams<{
    repeatWorkout?: string;
  }>();

  const [loading, setLoading] = useState(false);

  const [workout, setWorkout] =
    useState<WorkoutPlan | null>(null);

  const [saved, setSaved] = useState(false);

  const [sessionActive, setSessionActive] =
    useState(false);

  const [needsProfile, setNeedsProfile] =
    useState(false);

  const [needsGemini, setNeedsGemini] =
    useState(false);

  const [isRepeatedWorkout, setIsRepeatedWorkout] =
    useState(false);

  const [isOfflineWorkout, setIsOfflineWorkout] =
    useState(false);

  /* ================================================================
     LOAD REPEATED WORKOUT
     ================================================================ */

  useEffect(() => {
    if (!params.repeatWorkout) {
      return;
    }

    const repeated =
      parseRepeatedWorkout(params.repeatWorkout);

    if (!repeated) {
      Alert.alert(
        'Unable to Repeat Workout',
        'The saved workout could not be loaded.'
      );
      return;
    }

    setWorkout(repeated);
    setSaved(false);
    setNeedsProfile(false);
    setNeedsGemini(false);
    setIsRepeatedWorkout(true);
    setIsOfflineWorkout(false);
    setSessionActive(false);
  }, [params.repeatWorkout]);

  /* ================================================================
     GENERATE NEW WORKOUT (AI)
     ================================================================ */

  const handleGenerate = async () => {
    setLoading(true);

    setWorkout(null);
    setSaved(false);
    setNeedsProfile(false);
    setNeedsGemini(false);
    setIsRepeatedWorkout(false);
    setIsOfflineWorkout(false);

    try {
      /*
       * ------------------------------------------------------------
       * 1. CHECK PROFILE
       * ------------------------------------------------------------
       */

      const profileRow = await fetchProfileRow();

      if (!profileRow || !profileRow.goal) {
        setNeedsProfile(true);
        return;
      }

      /*
       * ------------------------------------------------------------
       * 2. CHECK GEMINI CONNECTION
       * ------------------------------------------------------------
       */

      const geminiConnected =
        await hasGeminiApiKey();

      if (!geminiConnected) {
        setNeedsGemini(true);
        return;
      }

      /*
       * ------------------------------------------------------------
       * 3. LOAD CONTEXT
       * ------------------------------------------------------------
       */

      const recentWorkouts =
        await getRecentWorkouts(5);

      const recentMeasurements =
        await getRecentMeasurements(3);

      const recoveryConstraint =
        calculateRecoveryConstraint(
          recentWorkouts
        );

      /*
       * ------------------------------------------------------------
       * 4. GENERATE WORKOUT
       * ------------------------------------------------------------
       */

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
      setIsRepeatedWorkout(false);
      setIsOfflineWorkout(false);
    } catch (err: any) {
      console.error(
        'Workout generation failed:',
        err
      );

      Alert.alert(
        'Couldn’t generate workout',
        err?.message ||
          'Something went wrong while creating your workout. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ================================================================
     GENERATE NEW WORKOUT (OFFLINE, NO GEMINI KEY REQUIRED)
     ================================================================ */

  const handleGenerateOffline = async () => {
    setLoading(true);

    setWorkout(null);
    setSaved(false);
    setNeedsGemini(false);
    setIsRepeatedWorkout(false);
    setIsOfflineWorkout(false);

    try {
      const profileRow = await fetchProfileRow();

      if (!profileRow || !profileRow.goal) {
        setNeedsProfile(true);
        return;
      }

      const recentWorkouts = await getRecentWorkouts(5);

      const result = generateLocalWorkout({
        goal: profileRow.goal,
        equipment: profileRow.equipment
          ? profileRow.equipment.split(',')
          : [],
        timeAvailable: profileRow.time_available || '30 min',
        fitnessLevel: profileRow.fitness_level || '',
        exercisesToAvoid: profileRow.exercises_to_avoid || '',
        recentWorkouts,
      });

      setWorkout(result);
      setIsRepeatedWorkout(false);
      setIsOfflineWorkout(true);
    } catch (err: any) {
      console.error(
        'Offline workout generation failed:',
        err
      );

      Alert.alert(
        'Couldn’t generate workout',
        err?.message ||
          'Something went wrong while creating your offline workout. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ================================================================
     GO TO PROFILE
     ================================================================ */

  const handleGoToProfile = () => {
    router.push('/profile');
  };

  /* ================================================================
     SAVE COMPLETED WORKOUT
     ================================================================ */

  const handleMarkDone = async (
    summary?: WorkoutSessionSummary
  ) => {
    if (!workout) {
      return;
    }

    try {
      const db = await getDatabase();

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
          (date, workout_json, active_seconds, calories)
         VALUES (?, ?, ?, ?)`,
        [
          today,
          JSON.stringify(workoutToSave),
          summary
            ? Number(summary.activeSeconds) || 0
            : 0,
          summary
            ? Number(summary.calories) || 0
            : 0,
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

  /* ================================================================
     ACTIVE WORKOUT SESSION
     ================================================================ */

  if (sessionActive && workout) {
    return (
      <WorkoutSession
        workout={workout}
        onExit={() =>
          setSessionActive(false)
        }
        onComplete={(
          summary: WorkoutSessionSummary
        ) => {
          setSessionActive(false);
          handleMarkDone(summary);
        }}
      />
    );
  }

  /* ================================================================
     MAIN SCREEN
     ================================================================ */

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText style={styles.brand}>
        BHEEMAI
      </ThemedText>

      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <ThemedText
            type="title"
            style={styles.pageTitle}
          >
            {isRepeatedWorkout
              ? 'Repeated Workout'
              : "Today's Workout"}
          </ThemedText>

          <ThemedText style={styles.pageSubtitle}>
            {isRepeatedWorkout
              ? 'This is your previously completed workout. Gemini is not being used.'
              : 'Your workout adapts to your goals, recovery and recent training.'}
          </ThemedText>
        </View>
      </View>

      {isRepeatedWorkout && workout && (
        <ThemedView style={styles.repeatBanner}>
          <ThemedText style={styles.repeatBannerTitle}>
            ↻ Repeated Workout
          </ThemedText>

          <ThemedText style={styles.repeatBannerText}>
            You're training the exact workout you completed previously.
          </ThemedText>
        </ThemedView>
      )}

      {isOfflineWorkout && workout && (
        <ThemedView style={styles.repeatBanner}>
          <ThemedText style={styles.repeatBannerTitle}>
            📦 Offline Workout
          </ThemedText>

          <ThemedText style={styles.repeatBannerText}>
            Generated from BheemAI's built-in exercise library. No AI, no internet required — connect your Gemini key in Profile for personalized AI coaching.
          </ThemedText>
        </ThemedView>
      )}

      {needsProfile && (
        <ThemedView style={styles.setupCard}>
          <ThemedText
            type="subtitle"
            style={styles.setupTitle}
          >
            Let's set up your profile
          </ThemedText>

          <ThemedText style={styles.setupText}>
            Tell BheemAI your goal, equipment
            and available time so it can create
            a personalized workout for you.
          </ThemedText>

          <TouchableOpacity
            style={styles.setupButton}
            onPress={handleGoToProfile}
          >
            <ThemedText
              style={styles.setupButtonText}
            >
              Set Up Profile
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}

      {needsGemini && (
        <ThemedView style={styles.setupCard}>
          <ThemedText
            type="subtitle"
            style={styles.setupTitle}
          >
            Your AI coach isn't connected
          </ThemedText>

          <ThemedText style={styles.setupText}>
            BheemAI uses your Gemini API key to
            create personalized workouts. Your
            key is stored on this device.
          </ThemedText>

          <TouchableOpacity
            style={styles.setupButton}
            onPress={handleGoToProfile}
          >
            <ThemedText
              style={styles.setupButtonText}
            >
              Set Up AI Coach
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.offlineButton}
            onPress={handleGenerateOffline}
            disabled={loading}
          >
            <ThemedText style={styles.offlineButtonText}>
              Continue with Offline Workouts
            </ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.offlineHint}>
            Uses BheemAI's built-in exercise library instead of AI. Simpler, but works entirely offline with no key required.
          </ThemedText>
        </ThemedView>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={handleGenerate}
        disabled={loading}
      >
        <ThemedText style={styles.buttonText}>
          {loading
            ? 'Generating...'
            : isRepeatedWorkout
            ? 'Generate New Workout'
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
              <ThemedView style={styles.warmupCard}>
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
            (ex, i) => {
              const frames = findIllustrationFrames(ex.name);

              return (
                <ThemedView
                  key={i}
                  style={styles.exerciseCard}
                >
                  <View style={styles.exerciseTitleRow}>
                    <ThemedText type="defaultSemiBold" style={{ flex: 1 }}>
                      {i + 1}. {ex.name}
                    </ThemedText>

                    {frames && (
                      <ExerciseIllustration frameXml={frames} size={56} />
                    )}
                  </View>

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
                        'https://www.youtube.com/results?search_query=' +
                        encodeURIComponent(
                          `${ex.name} exercise proper form`
                        );

                      Linking.openURL(url).catch(() => {
                        Alert.alert(
                          'Unable to open YouTube',
                          'Please try again.'
                        );
                      });
                    }}
                  >
                    <ThemedText
                      style={styles.demoButtonText}
                    >
                      ▶ Watch Demo
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              );
            }
          )}

          {workout.cooldown &&
            workout.cooldown.length > 0 && (
              <ThemedView style={styles.cooldownCard}>
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

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

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

  repeatBanner: {
    backgroundColor: '#17130D',
    borderWidth: 1,
    borderColor: '#3A2B17',
    borderRadius: 16,
    padding: 15,
    gap: 5,
  },

  repeatBannerTitle: {
    color: '#F28C18',
    fontSize: 15,
    fontWeight: '800',
  },

  repeatBannerText: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.7,
  },

  setupCard: {
    marginTop: 10,
    padding: 18,
    borderRadius: 17,
    backgroundColor: '#17130D',
    borderWidth: 1,
    borderColor: '#3A2B17',
    gap: 8,
  },

  setupTitle: {
    fontSize: 20,
    fontWeight: '800',
  },

  setupText: {
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.72,
  },

  setupButton: {
    backgroundColor: '#F28C18',
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  setupButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '800',
  },

  offlineButton: {
    borderWidth: 1,
    borderColor: '#F28C18',
    backgroundColor: 'transparent',
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  offlineButtonText: {
    color: '#F28C18',
    fontSize: 15,
    fontWeight: '800',
  },

  offlineHint: {
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.55,
    marginTop: 2,
  },

  startSessionButton: {
    backgroundColor: '#F28C18',
    borderRadius: 14,
    minHeight: 58,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },

  sectionTitle: {
    marginTop: 24,
    marginBottom: 7,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },

  exerciseCard: {
    padding: 17,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#292929',
    backgroundColor: '#151515',
    gap: 6,
  },

  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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

  cooldownCard: {
    marginTop: 8,
    padding: 17,
    borderRadius: 17,
    backgroundColor: '#111416',
    borderWidth: 1,
    borderColor: '#292929',
    gap: 6,
  },

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