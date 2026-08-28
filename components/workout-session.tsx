import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { ThemedText } from '@/components/themed-text';
import { WorkoutPlan } from '@/services/gemini';

const WHISTLE_SOUND = require('@/assets/sounds/whistle.mp3');

type Props = {
  workout: WorkoutPlan;
  onExit: () => void;
  onComplete: (summary: WorkoutSessionSummary) => void;
};

export type WorkoutSessionSummary = {
  totalSeconds: number;
  activeSeconds: number;
  restSeconds: number;
  calories: number;
};

type Phase = 'warmup' | 'exercise' | 'rest' | 'cooldown' | 'complete';

const REST_BETWEEN_SETS = 60;

// Moderate full-body exercise estimate.
// This is deliberately labelled as an estimate.
// We can later replace it with the user's actual body weight.
const CALORIES_PER_ACTIVE_MINUTE = 6;

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function calculateCalories(activeSeconds: number): number {
  const calories =
    (Math.max(0, activeSeconds) / 60) * CALORIES_PER_ACTIVE_MINUTE;

  return Math.max(0, Math.round(calories));
}

function safeHaptic(callback: () => Promise<any>) {
  callback().catch(() => {});
}

export default function WorkoutSession({
  workout,
  onExit,
  onComplete,
}: Props) {
  const warmup = workout.warmup ?? [];
  const cooldown = workout.cooldown ?? [];
  const exercises = workout.exercises ?? [];

  const [phase, setPhase] = useState<Phase>(
    warmup.length > 0 ? 'warmup' : 'exercise'
  );

  const [warmupIndex, setWarmupIndex] = useState(0);
  const [cooldownIndex, setCooldownIndex] = useState(0);

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);

  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [totalSeconds, setTotalSeconds] = useState(0);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);

  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [restRemaining, setRestRemaining] =
    useState(REST_BETWEEN_SETS);

  const sessionStartedAt = useRef(Date.now());
  const lastTickAt = useRef(Date.now());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSecondsRef = useRef(0);
  const activeSecondsRef = useRef(0);
  const restSecondsRef = useRef(0);

  // Reusable local whistle sound for exercise transitions.
  const whistleRef = useRef<Audio.Sound | null>(null);

  // Used to distinguish "new exercise" from "next set of the same exercise".
  const whistledExerciseIndex = useRef<number | null>(null);

  const currentExercise =
    exercises[currentExerciseIndex];

  const totalExercises = exercises.length;

  useEffect(() => {
    if (phase !== 'exercise') {
      whistledExerciseIndex.current = null;
    }
  }, [phase]);

  const totalSetsForExercise =
    Number(currentExercise?.sets) > 0
      ? Number(currentExercise?.sets)
      : 1;

  /**
   * ------------------------------------------------------------
   * WHISTLE AUDIO
   * ------------------------------------------------------------
   *
   * Whistle plays when an exercise starts and when its final set
   * is completed. iOS silent mode is explicitly supported.
   */
  useEffect(() => {
    let mounted = true;

    const prepareWhistle = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          WHISTLE_SOUND,
          {
            shouldPlay: false,
            volume: 1.0,
          }
        );

        if (mounted) {
          whistleRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch {
        // Audio failure must never break the workout session.
      }
    };

    prepareWhistle();

    return () => {
      mounted = false;

      const sound = whistleRef.current;
      whistleRef.current = null;

      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const playWhistle = async () => {
    try {
      const sound = whistleRef.current;

      if (!sound) {
        return;
      }

      await sound.replayAsync();
    } catch {
      // Audio failure must never break the workout session.
    }
  };

  // Start/change cue for exercises only.
  //
  // Important: returning from REST for Set 2/3/4 of the same exercise does
  // NOT whistle. A whistle is reserved for the beginning of an exercise.
  useEffect(() => {
    if (
      phase !== 'exercise' ||
      completed ||
      exercises.length === 0 ||
      whistledExerciseIndex.current === currentExerciseIndex
    ) {
      return;
    }

    whistledExerciseIndex.current = currentExerciseIndex;

    const timer = setTimeout(() => {
      playWhistle();
    }, 250);

    return () => clearTimeout(timer);
  }, [phase, currentExerciseIndex, completed, exercises.length]);

  // Warm-up: whistle at the beginning of the first warm-up movement and
  // whenever the warm-up movement changes.
  useEffect(() => {
    if (
      phase !== 'warmup' ||
      completed ||
      warmup.length === 0
    ) {
      return;
    }

    const timer = setTimeout(() => {
      playWhistle();
    }, 250);

    return () => clearTimeout(timer);
  }, [phase, warmupIndex, completed, warmup.length]);

  // Cool-down: whistle at the beginning of the first cool-down movement and
  // whenever the cool-down movement changes.
  useEffect(() => {
    if (
      phase !== 'cooldown' ||
      completed ||
      cooldown.length === 0
    ) {
      return;
    }

    const timer = setTimeout(() => {
      playWhistle();
    }, 250);

    return () => clearTimeout(timer);
  }, [phase, cooldownIndex, completed, cooldown.length]);

  /**
   * ------------------------------------------------------------
   * MASTER SESSION TIMER
   * ------------------------------------------------------------
   *
   * One timer for the entire session.
   *
   * It does NOT depend on exercise index, set number, warm-up index,
   * etc. This is important because changing phase/index must never
   * accidentally kill the timer.
   */
  useEffect(() => {
    if (paused || completed || phase === 'complete') {
      lastTickAt.current = Date.now();
      return;
    }

    lastTickAt.current = Date.now();

    intervalRef.current = setInterval(() => {
      const now = Date.now();

      const deltaSeconds =
        Math.max(0, now - lastTickAt.current) / 1000;

      lastTickAt.current = now;

      if (deltaSeconds <= 0) {
        return;
      }

      totalSecondsRef.current += deltaSeconds;
      setTotalSeconds(totalSecondsRef.current);

      if (phase === 'rest') {
        restSecondsRef.current += deltaSeconds;
        setRestSeconds(restSecondsRef.current);

        setRestRemaining((value) =>
          Math.max(0, value - deltaSeconds)
        );
      } else {
        activeSecondsRef.current += deltaSeconds;
        setActiveSeconds(activeSecondsRef.current);

        if (phase === 'warmup' || phase === 'cooldown') {
          setRemainingSeconds((value) =>
            Math.max(0, value - deltaSeconds)
          );
        }
      }
    }, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [paused, completed, phase]);

  /**
   * ------------------------------------------------------------
   * WARM-UP INITIALIZATION
   * ------------------------------------------------------------
   */
  useEffect(() => {
    if (phase !== 'warmup') {
      return;
    }

    const step = warmup[warmupIndex];

    if (!step) {
      setPhase('exercise');
      setCurrentExerciseIndex(0);
      setCurrentSet(1);
      return;
    }

    setRemainingSeconds(
      Math.max(0, Number(step.seconds) || 0)
    );
  }, [phase, warmupIndex]);

  /**
   * ------------------------------------------------------------
   * WARM-UP AUTO ADVANCE
   * ------------------------------------------------------------
   */
  useEffect(() => {
    if (
      phase !== 'warmup' ||
      paused ||
      remainingSeconds > 0
    ) {
      return;
    }

    const nextIndex = warmupIndex + 1;

    if (nextIndex < warmup.length) {
      safeHaptic(() =>
        Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Light
        )
      );

      // The new warm-up movement emits its own change whistle.
      setWarmupIndex(nextIndex);
      return;
    }

    safeHaptic(() =>
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      )
    );

    // The first main exercise emits its own start whistle.
    setCurrentExerciseIndex(0);
    setCurrentSet(1);
    setPhase('exercise');
  }, [
    phase,
    paused,
    remainingSeconds,
    warmupIndex,
    warmup.length,
  ]);

  /**
   * ------------------------------------------------------------
   * REST AUTO ADVANCE
   * ------------------------------------------------------------
   */
  useEffect(() => {
    if (
      phase !== 'rest' ||
      paused ||
      restRemaining > 0
    ) {
      return;
    }

    advanceAfterRest();
  }, [phase, paused, restRemaining]);

  /**
   * ------------------------------------------------------------
   * COOLDOWN INITIALIZATION
   * ------------------------------------------------------------
   */
  useEffect(() => {
    if (phase !== 'cooldown') {
      return;
    }

    const step = cooldown[cooldownIndex];

    if (!step) {
      finishWorkout();
      return;
    }

    setRemainingSeconds(
      Math.max(0, Number(step.seconds) || 0)
    );
  }, [phase, cooldownIndex]);

  /**
   * ------------------------------------------------------------
   * COOLDOWN AUTO ADVANCE
   * ------------------------------------------------------------
   */
  useEffect(() => {
    if (
      phase !== 'cooldown' ||
      paused ||
      remainingSeconds > 0
    ) {
      return;
    }

    const nextIndex = cooldownIndex + 1;

    if (nextIndex < cooldown.length) {
      setCooldownIndex(nextIndex);
      return;
    }

    finishWorkout();
  }, [
    phase,
    paused,
    remainingSeconds,
    cooldownIndex,
    cooldown.length,
  ]);

  /**
   * ------------------------------------------------------------
   * SKIP WARM-UP
   * ------------------------------------------------------------
   */
  const handleSkipWarmup = () => {
    safeHaptic(() =>
      Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Light
      )
    );

    const nextIndex = warmupIndex + 1;

    if (nextIndex < warmup.length) {
      setWarmupIndex(nextIndex);
      return;
    }

    setCurrentExerciseIndex(0);
    setCurrentSet(1);
    setPhase('exercise');
  };

  /**
   * ------------------------------------------------------------
   * COMPLETE SET
   * ------------------------------------------------------------
   */
  const handleCompleteSet = () => {
    safeHaptic(() =>
      Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium
      )
    );

    const finalSetOfExercise =
      currentSet >= totalSetsForExercise;

    // The final set is the end of the exercise, so emit the end cue now.
    // There is STILL a rest period after this set.
    if (finalSetOfExercise) {
      playWhistle();
    }

    // Every set — including the final set — enters REST.
    setRestRemaining(REST_BETWEEN_SETS);
    setPhase('rest');
  };

  /**
   * ------------------------------------------------------------
   * AFTER REST
   * ------------------------------------------------------------
   */
  const advanceAfterRest = () => {
    safeHaptic(() =>
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      )
    );

    if (currentSet < totalSetsForExercise) {
      // Same exercise, next set. No exercise-change whistle.
      setCurrentSet((value) => value + 1);
      setPhase('exercise');
      return;
    }

    // Final-set rest has finished. Move to the next exercise, or to
    // cooldown, or finish the session.
    const nextExerciseIndex = currentExerciseIndex + 1;

    if (nextExerciseIndex < totalExercises) {
      setCurrentExerciseIndex(nextExerciseIndex);
      setCurrentSet(1);
      setPhase('exercise');
      // The exercise-start effect emits the next whistle.
      return;
    }

    if (cooldown.length > 0) {
      setCooldownIndex(0);
      setPhase('cooldown');
      // The cooldown-start effect emits the change whistle.
      return;
    }

    finishWorkout();
  };

  /**
   * ------------------------------------------------------------
   * SKIP REST
   * ------------------------------------------------------------
   */
  const handleSkipRest = () => {
    safeHaptic(() =>
      Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Light
      )
    );

    advanceAfterRest();
  };

  /**
   * ------------------------------------------------------------
   * SKIP COOLDOWN
   * ------------------------------------------------------------
   */
  const handleSkipCooldown = () => {
    safeHaptic(() =>
      Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Light
      )
    );

    const nextIndex = cooldownIndex + 1;

    if (nextIndex < cooldown.length) {
      setCooldownIndex(nextIndex);
    } else {
      finishWorkout();
    }
  };

  /**
   * ------------------------------------------------------------
   * FINISH WORKOUT
   * ------------------------------------------------------------
   */
  const finishWorkout = () => {
    if (completed) {
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const finalTotal = Math.max(
      0,
      Math.round(totalSecondsRef.current)
    );

    const finalActive = Math.max(
      0,
      Math.round(activeSecondsRef.current)
    );

    const finalRest = Math.max(
      0,
      Math.round(restSecondsRef.current)
    );

    const calories = calculateCalories(finalActive);

    setTotalSeconds(finalTotal);
    setActiveSeconds(finalActive);
    setRestSeconds(finalRest);

    safeHaptic(() =>
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      )
    );

    setCompleted(true);
    setPhase('complete');
  };

  /**
   * ------------------------------------------------------------
   * EXIT
   * ------------------------------------------------------------
   */
  const handleExit = () => {
    Alert.alert(
      'Exit workout?',
      'Your current workout session will not be saved as completed.',
      [
        {
          text: 'Keep Working Out',
          style: 'cancel',
        },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => onExit(),
        },
      ]
    );
  };

  /**
   * ------------------------------------------------------------
   * PAUSE
   * ------------------------------------------------------------
   */
  const togglePause = () => {
    safeHaptic(() =>
      Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Light
      )
    );

    lastTickAt.current = Date.now();
    setPaused((value) => !value);
  };

  /**
   * ------------------------------------------------------------
   * COMPLETION SCREEN
   * ------------------------------------------------------------
   */
  if (phase === 'complete' || completed) {
    const calories = calculateCalories(
      Math.round(activeSeconds)
    );

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.completeScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.completeContent}>
            <ThemedText
              type="title"
              style={styles.completeTitle}
            >
              Workout Complete
            </ThemedText>

            <ThemedText style={styles.completeSubtitle}>
              Great work. Your session is finished.
            </ThemedText>

            <View style={styles.calorieCard}>
  <View style={styles.calorieNumberContainer}>
    <ThemedText style={styles.calorieNumber}>
      {calories}
    </ThemedText>
  </View>

  <ThemedText style={styles.calorieLabel}>
    kcal estimated
  </ThemedText>
</View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>
                  Total time
                </ThemedText>

                <ThemedText style={styles.summaryValue}>
                  {formatTime(totalSeconds)}
                </ThemedText>
              </View>

              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>
                  Active time
                </ThemedText>

                <ThemedText style={styles.summaryValue}>
                  {formatTime(activeSeconds)}
                </ThemedText>
              </View>

              <View style={styles.summaryRow}>
                <ThemedText style={styles.summaryLabel}>
                  Rest time
                </ThemedText>

                <ThemedText style={styles.summaryValue}>
                  {formatTime(restSeconds)}
                </ThemedText>
              </View>
            </View>

            <TouchableOpacity
              style={styles.finishButton}
              onPress={() => {
                const summary: WorkoutSessionSummary = {
                  totalSeconds: Math.max(
                    0,
                    Math.round(totalSeconds)
                  ),
                  activeSeconds: Math.max(
                    0,
                    Math.round(activeSeconds)
                  ),
                  restSeconds: Math.max(
                    0,
                    Math.round(restSeconds)
                  ),
                  calories,
                };

                onComplete(summary);
              }}
            >
              <ThemedText style={styles.finishButtonText}>
                Save Workout
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /**
   * ------------------------------------------------------------
   * WARM-UP SCREEN
   * ------------------------------------------------------------
   */
  if (phase === 'warmup') {
    const step = warmup[warmupIndex];

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topStats}>
          <View style={styles.stat}>
            <ThemedText style={styles.statLabel}>
              TOTAL
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {formatTime(totalSeconds)}
            </ThemedText>
          </View>

          <View style={styles.stat}>
            <ThemedText style={styles.statLabel}>
              ACTIVE
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {formatTime(activeSeconds)}
            </ThemedText>
          </View>

          <View style={styles.stat}>
            <ThemedText style={styles.statLabel}>
              REST
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {formatTime(restSeconds)}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={styles.exitButton}
            onPress={handleExit}
          >
            <ThemedText style={styles.exitText}>
              Exit
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.mainScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContent}>
            <ThemedText style={styles.progress}>
              Warm-up {warmupIndex + 1} of {warmup.length}
            </ThemedText>

            <ThemedText
              type="title"
              style={styles.exerciseTitle}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              {step?.name || 'Warm-up'}
            </ThemedText>

            <View style={styles.timerCircle}>
              <ThemedText style={styles.timerText}>
                {formatTime(remainingSeconds)}
              </ThemedText>

              <ThemedText style={styles.timerLabel}>
                remaining
              </ThemedText>
            </View>

            <TouchableOpacity
              style={styles.pauseButton}
              onPress={togglePause}
            >
              <ThemedText style={styles.pauseButtonText}>
                {paused ? 'Resume' : 'Pause'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipWarmup}
            >
              <ThemedText style={styles.skipText}>
                Skip / Next
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /**
   * ------------------------------------------------------------
   * REST SCREEN
   * ------------------------------------------------------------
   */
  if (phase === 'rest') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topStats}>
          <View style={styles.stat}>
            <ThemedText style={styles.statLabel}>
              TOTAL
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {formatTime(totalSeconds)}
            </ThemedText>
          </View>

          <View style={styles.stat}>
            <ThemedText style={styles.statLabel}>
              ACTIVE
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {formatTime(activeSeconds)}
            </ThemedText>
          </View>

          <View style={styles.stat}>
            <ThemedText style={styles.statLabel}>
              REST
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {formatTime(restSeconds)}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={styles.exitButton}
            onPress={handleExit}
          >
            <ThemedText style={styles.exitText}>
              Exit
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.mainScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContent}>
            <ThemedText style={styles.progress}>
              Rest
            </ThemedText>

            <ThemedText
              type="title"
              style={styles.exerciseTitle}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              Take a break
            </ThemedText>

            <ThemedText
              style={styles.nextExercise}
              numberOfLines={2}
            >
              Up next: {currentExercise?.name || 'Next exercise'}
            </ThemedText>

            <View style={styles.timerCircle}>
              <ThemedText style={styles.timerText}>
                {formatTime(restRemaining)}
              </ThemedText>

              <ThemedText style={styles.timerLabel}>
                rest
              </ThemedText>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSkipRest}
            >
              <ThemedText style={styles.primaryButtonText}>
                Skip Rest
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pauseButton}
              onPress={togglePause}
            >
              <ThemedText style={styles.pauseButtonText}>
                {paused ? 'Resume' : 'Pause'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /**
   * ------------------------------------------------------------
   * COOLDOWN SCREEN
   * ------------------------------------------------------------
   */
  if (phase === 'cooldown') {
    const step = cooldown[cooldownIndex];

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topStats}>
          <View style={styles.stat}>
            <ThemedText style={styles.statLabel}>
              TOTAL
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {formatTime(totalSeconds)}
            </ThemedText>
          </View>

          <View style={styles.stat}>
            <ThemedText style={styles.statLabel}>
              ACTIVE
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {formatTime(activeSeconds)}
            </ThemedText>
          </View>

          <View style={styles.stat}>
            <ThemedText style={styles.statLabel}>
              REST
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {formatTime(restSeconds)}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={styles.exitButton}
            onPress={handleExit}
          >
            <ThemedText style={styles.exitText}>
              Exit
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.mainScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContent}>
            <ThemedText style={styles.progress}>
              Cool-down {cooldownIndex + 1} of {cooldown.length}
            </ThemedText>

            <ThemedText
              type="title"
              style={styles.exerciseTitle}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              {step?.name || 'Cool-down'}
            </ThemedText>

            <View style={styles.timerCircle}>
              <ThemedText style={styles.timerText}>
                {formatTime(remainingSeconds)}
              </ThemedText>

              <ThemedText style={styles.timerLabel}>
                remaining
              </ThemedText>
            </View>

            <TouchableOpacity
              style={styles.pauseButton}
              onPress={togglePause}
            >
              <ThemedText style={styles.pauseButtonText}>
                {paused ? 'Resume' : 'Pause'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkipCooldown}
            >
              <ThemedText style={styles.skipText}>
                Skip / Finish
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /**
   * ------------------------------------------------------------
   * EXERCISE SCREEN
   * ------------------------------------------------------------
   */
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topStats}>
        <View style={styles.stat}>
          <ThemedText style={styles.statLabel}>
            TOTAL
          </ThemedText>
          <ThemedText style={styles.statValue}>
            {formatTime(totalSeconds)}
          </ThemedText>
        </View>

        <View style={styles.stat}>
          <ThemedText style={styles.statLabel}>
            ACTIVE
          </ThemedText>
          <ThemedText style={styles.statValue}>
            {formatTime(activeSeconds)}
          </ThemedText>
        </View>

        <View style={styles.stat}>
          <ThemedText style={styles.statLabel}>
            REST
          </ThemedText>
          <ThemedText style={styles.statValue}>
            {formatTime(restSeconds)}
          </ThemedText>
        </View>

        <TouchableOpacity
          style={styles.exitButton}
          onPress={handleExit}
        >
          <ThemedText style={styles.exitText}>
            Exit
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.exerciseScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          <ThemedText style={styles.progress}>
            Exercise {currentExerciseIndex + 1} of {totalExercises}
          </ThemedText>

          <ThemedText
            type="title"
            style={styles.exerciseTitle}
            numberOfLines={2}
            adjustsFontSizeToFit
          >
            {currentExercise?.name || 'Exercise'}
          </ThemedText>

          <ThemedText style={styles.setText}>
            Set {currentSet} of {totalSetsForExercise}
          </ThemedText>

          <ThemedText style={styles.repsText}>
            {currentExercise?.reps ?? 0} reps
          </ThemedText>

          <View style={styles.exerciseGuideCard}>

            <View style={styles.exerciseGuideAccent} />


            <View style={styles.exerciseGuideContent}>

              <ThemedText style={styles.exerciseGuideEyebrow}>

                FORM GUIDE

              </ThemedText>


              <ThemedText

                style={styles.exerciseGuideTitle}

                numberOfLines={2}

              >

                {currentExercise?.name || 'Exercise'}

              </ThemedText>


              {!!currentExercise?.focus && (

                <ThemedText style={styles.exerciseGuideFocus}>

                  {currentExercise.focus}

                </ThemedText>

              )}


              {!!currentExercise?.description && (

                <ThemedText

                  style={styles.exerciseGuideDescription}

                  numberOfLines={3}

                >

                  {currentExercise.description}

                </ThemedText>

              )}


              <TouchableOpacity

                style={styles.demoButton}

                onPress={() => {

                  const url =

                    `https://www.youtube.com/results?search_query=` +

                    encodeURIComponent(

                      `${currentExercise?.name || 'exercise'} proper form`

                    );


                  Linking.openURL(url).catch(() => {

                    Alert.alert(

                      'Unable to open YouTube',

                      'Please try again.'

                    );

                  });

                }}

              >

                <ThemedText style={styles.demoButtonText}>

                  ▶  Watch Proper Form

                </ThemedText>

              </TouchableOpacity>

            </View>

          </View>
          <View style={styles.exerciseTimerCircle}>
            <ThemedText style={styles.exerciseTimerText}>
              {formatTime(totalSeconds)}
            </ThemedText>

            <ThemedText style={styles.timerLabel}>
              total
            </ThemedText>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCompleteSet}
          >
            <ThemedText style={styles.primaryButtonText}>
              Complete Set
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pauseButton}
            onPress={togglePause}
          >
            <ThemedText style={styles.pauseButtonText}>
              {paused ? 'Resume' : 'Pause'}
            </ThemedText>
          </TouchableOpacity>

          {paused && (
            <ThemedText style={styles.pausedText}>
              Workout paused
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },

  topStats: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },

  stat: {
    alignItems: 'flex-start',
    minWidth: 65,
  },

  statLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '600',
    opacity: 0.45,
    marginBottom: 3,
  },

  statValue: {
    fontSize: 21,
    fontWeight: '500',
  },

  exitButton: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  exitText: {
    fontSize: 16,
    color: '#F28C18',
    opacity: 0.9,
    fontWeight: '600',
  },

  mainScroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  exerciseScroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 35,
  },

  mainContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },

  progress: {
    fontSize: 15,
    color: '#F28C18',
    fontWeight: '700',
    opacity: 0.95,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  exerciseTitle: {
    width: '100%',
    fontSize: 31,
    lineHeight: 35,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
    fontWeight: '800',
  },

  setText: {
    fontSize: 23,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },

  repsText: {
    fontSize: 18,
    opacity: 0.62,
    marginBottom: 16,
  },

  nextExercise: {
    width: '90%',
    fontSize: 17,
    opacity: 0.65,
    textAlign: 'center',
    marginBottom: 14,
  },

  timerCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 7,
    borderColor: '#F28C18',
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 22,
  },

  exerciseGuideCard: {
    width: '100%',
    minHeight: 190,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#151515',
    marginBottom: 18,
    overflow: 'hidden',
    flexDirection: 'row',
  },

  exerciseGuideAccent: {
    width: 5,
    backgroundColor: '#F28C18',
  },

  exerciseGuideContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 17,
  },

  exerciseGuideEyebrow: {
    color: '#F28C18',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 7,
  },

  exerciseGuideTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    marginBottom: 4,
  },

  exerciseGuideFocus: {
    color: '#F28C18',
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.9,
    marginBottom: 5,
  },

  exerciseGuideDescription: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.62,
    marginBottom: 8,
  },

  demoButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#F28C18',
    backgroundColor: '#21170C',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginTop: 3,
  },

  demoButtonText: {
    color: '#F28C18',
    fontSize: 13,
    fontWeight: '800',
  },

  exerciseTimerCircle: {
    width: 175,
    height: 175,
    borderRadius: 88,
    borderWidth: 7,
    borderColor: '#F28C18',
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 20,
  },

  timerText: {
    fontSize: 50,
    lineHeight: 58,
    fontWeight: '600',
    textAlign: 'center',
  },

  exerciseTimerText: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '600',
    textAlign: 'center',
  },

  timerLabel: {
    fontSize: 15,
    opacity: 0.5,
    marginTop: 2,
  },

  primaryButton: {
    width: '88%',
    backgroundColor: '#F28C18',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },

  primaryButtonText: {
    color: '#080808',
    fontSize: 18,
    fontWeight: '800',
  },

  pauseButton: {
    minWidth: 150,
    borderWidth: 1,
    borderColor: '#454545',
    backgroundColor: '#151515',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 28,
    alignItems: 'center',
  },

  pauseButtonText: {
    color: '#F2F2F2',
    fontSize: 17,
    fontWeight: '600',
  },

  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },

  skipText: {
    color: '#F28C18',
    fontSize: 17,
    opacity: 0.8,
    textAlign: 'center',
    fontWeight: '600',
  },

  pausedText: {
    marginTop: 12,
    fontSize: 14,
    opacity: 0.55,
  },

  completeScroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },

  completeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  completeTitle: {
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '800',
  },

  completeSubtitle: {
    textAlign: 'center',
    fontSize: 17,
    opacity: 0.65,
    marginBottom: 22,
  },

  calorieCard: {
    width: '100%',
    minHeight: 145,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F28C18',
    backgroundColor: '#21170C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginBottom: 16,
  },

  calorieNumberContainer: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  calorieNumber: {
    color: '#F28C18',
    fontSize: 42,
    lineHeight: 52,
    fontWeight: '800',
    textAlign: 'center',
  },

  calorieLabel: {
    fontSize: 15,
    lineHeight: 20,
    opacity: 0.65,
    marginTop: 4,
    textAlign: 'center',
  },

  summaryCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#303030',
    backgroundColor: '#151515',
    borderRadius: 14,
    padding: 18,
    marginBottom: 22,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },

  summaryLabel: {
    fontSize: 17,
    opacity: 0.65,
  },

  summaryValue: {
    fontSize: 21,
    fontWeight: '600',
  },

  finishButton: {
    width: '90%',
    backgroundColor: '#F28C18',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },

  finishButtonText: {
    color: '#080808',
    fontSize: 18,
    fontWeight: '800',
  },
});
