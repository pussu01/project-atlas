import { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutPlan } from '@/services/gemini';

const DEFAULT_REST_SECONDS = 60;
const REST_STEP = 30;
const MIN_REST = 30;
const MAX_REST = 180;

type Props = {
  workout: WorkoutPlan;
  onComplete: () => void;
  onExit: () => void;
};

type SessionPhase = 'warmup' | 'exercise' | 'rest' | 'cooldown';

export default function WorkoutSession({ workout, onComplete, onExit }: Props) {
  const [phase, setPhase] = useState<SessionPhase>(
    workout.warmup && workout.warmup.length > 0 ? 'warmup' : 'exercise'
  );
  const [warmupIndex, setWarmupIndex] = useState(0);
  const [cooldownIndex, setCooldownIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [prepRemaining, setPrepRemaining] = useState(workout.warmup?.[0]?.seconds || 30);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST_SECONDS);
  const [restRemaining, setRestRemaining] = useState(DEFAULT_REST_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const currentExercise = workout.exercises[currentIndex];
  const nextExercise = workout.exercises[currentIndex + 1];
  const isLastExercise = currentIndex === workout.exercises.length - 1;
  const hasCooldown = workout.cooldown && workout.cooldown.length > 0;

  const safeHaptic = (fn: () => void) => {
    try {
      fn();
    } catch {
      // Ignore haptic errors
    }
  };

  const playWhistle = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(require('@/assets/sounds/whistle.mp3'));
      soundRef.current = sound;
      await sound.playAsync();
    } catch {
      // Ignore sound errors, never let them break the app
    }
  };

  useEffect(() => {
    playWhistle(); // session start
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (phase === 'warmup') {
      const seconds = workout.warmup[warmupIndex]?.seconds || 30;
      setPrepRemaining(seconds);
      intervalRef.current = setInterval(() => {
        setPrepRemaining((s) => {
          if (s <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            playWhistle();
            safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
            advancePrepStep();
            return seconds;
          }
          return s - 1;
        });
      }, 1000);
    } else if (phase === 'cooldown') {
      const seconds = workout.cooldown[cooldownIndex]?.seconds || 30;
      setPrepRemaining(seconds);
      intervalRef.current = setInterval(() => {
        setPrepRemaining((s) => {
          if (s <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            playWhistle();
            safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
            advancePrepStep();
            return seconds;
          }
          return s - 1;
        });
      }, 1000);
    } else if (phase === 'exercise') {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else if (phase === 'rest') {
      intervalRef.current = setInterval(() => {
        setRestRemaining((s) => {
          if (s <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            playWhistle();
            safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
            goToNextExercise();
            return restDuration;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, currentIndex, warmupIndex, cooldownIndex]);

  const advancePrepStep = () => {
    if (phase === 'warmup') {
      const isLastWarmup = warmupIndex === workout.warmup.length - 1;
      if (isLastWarmup) {
        setPhase('exercise');
      } else {
        setWarmupIndex((i) => i + 1);
      }
    } else if (phase === 'cooldown') {
      const isLastCooldown = cooldownIndex === workout.cooldown.length - 1;
      if (isLastCooldown) {
        finishSession();
      } else {
        setCooldownIndex((i) => i + 1);
      }
    }
  };

  const handleSkipPrepStep = () => {
    playWhistle();
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    if (intervalRef.current) clearInterval(intervalRef.current);
    advancePrepStep();
  };

  const goToNextExercise = () => {
    if (isLastExercise) {
      if (hasCooldown) {
        setPhase('cooldown');
      } else {
        finishSession();
      }
      return;
    }
    setCurrentIndex((i) => i + 1);
    setElapsedSeconds(0);
    setPhase('exercise');
  };

  const finishSession = () => {
    playWhistle();
    onComplete();
  };

  const handleFinishExercise = () => {
    playWhistle();
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    if (isLastExercise) {
      if (hasCooldown) {
        setPhase('cooldown');
      } else {
        finishSession();
      }
      return;
    }
    setRestRemaining(restDuration);
    setPhase('rest');
  };

  const handleSkipRest = () => {
    playWhistle();
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    if (intervalRef.current) clearInterval(intervalRef.current);
    goToNextExercise();
  };

  const increaseRest = () => {
    safeHaptic(() => Haptics.selectionAsync());
    setRestDuration((d) => {
      const updated = Math.min(MAX_REST, d + REST_STEP);
      setRestRemaining(updated);
      return updated;
    });
  };

  const decreaseRest = () => {
    safeHaptic(() => Haptics.selectionAsync());
    setRestDuration((d) => {
      const updated = Math.max(MIN_REST, d - REST_STEP);
      setRestRemaining(updated);
      return updated;
    });
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <ThemedView style={styles.container}>
      <TouchableOpacity onPress={onExit} style={styles.exitButton}>
        <ThemedText style={styles.exitText}>Exit Session</ThemedText>
      </TouchableOpacity>

      {phase === 'warmup' && (
        <>
          <ThemedText style={styles.progress}>
            Warm-up {warmupIndex + 1} of {workout.warmup.length}
          </ThemedText>
          <ThemedText type="title" style={styles.exerciseName}>{workout.warmup[warmupIndex]?.name}</ThemedText>

          <View style={[styles.timerCircle, styles.warmupCircle]}>
            <ThemedText style={styles.timerText}>{formatTime(prepRemaining)}</ThemedText>
          </View>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkipPrepStep}>
            <ThemedText style={styles.skipButtonText}>Skip / Next</ThemedText>
          </TouchableOpacity>
        </>
      )}

      {phase === 'cooldown' && (
        <>
          <ThemedText style={styles.progress}>
            Cool-down {cooldownIndex + 1} of {workout.cooldown.length}
          </ThemedText>
          <ThemedText type="title" style={styles.exerciseName}>{workout.cooldown[cooldownIndex]?.name}</ThemedText>

          <View style={[styles.timerCircle, styles.cooldownCircle]}>
            <ThemedText style={styles.timerText}>{formatTime(prepRemaining)}</ThemedText>
          </View>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkipPrepStep}>
            <ThemedText style={styles.skipButtonText}>Skip / Next</ThemedText>
          </TouchableOpacity>
        </>
      )}

      {phase === 'exercise' && (
        <>
          <ThemedText style={styles.progress}>
            Exercise {currentIndex + 1} of {workout.exercises.length}
          </ThemedText>
          <ThemedText type="title" style={styles.exerciseName}>{currentExercise.name}</ThemedText>
          <ThemedText style={styles.exerciseDetail}>
            {currentExercise.sets} sets, {currentExercise.reps} reps
          </ThemedText>
          <ThemedText style={styles.exerciseDescription}>{currentExercise.description}</ThemedText>

          <View style={styles.timerCircle}>
            <ThemedText style={styles.timerText}>{formatTime(elapsedSeconds)}</ThemedText>
            <ThemedText style={styles.timerLabel}>elapsed</ThemedText>
          </View>

          <TouchableOpacity style={styles.finishButton} onPress={handleFinishExercise}>
            <ThemedText style={styles.finishButtonText}>
              {isLastExercise && !hasCooldown ? 'Finish Workout' : 'Finish Exercise'}
            </ThemedText>
          </TouchableOpacity>
        </>
      )}

      {phase === 'rest' && (
        <>
          <ThemedText type="title" style={styles.restTitle}>Rest</ThemedText>

          <View style={[styles.timerCircle, styles.restCircle]}>
            <ThemedText style={styles.timerText}>{formatTime(restRemaining)}</ThemedText>
            <ThemedText style={styles.timerLabel}>remaining</ThemedText>
          </View>

          <View style={styles.adjustRow}>
  <TouchableOpacity style={styles.adjustButton} onPress={decreaseRest}>
    <ThemedText style={styles.adjustButtonText}>Less 30s</ThemedText>
  </TouchableOpacity>

  <ThemedText style={styles.adjustLabel}>
    Rest: {restDuration}s
  </ThemedText>

  <TouchableOpacity style={styles.adjustButton} onPress={increaseRest}>
    <ThemedText style={styles.adjustButtonText}>More 30s</ThemedText>
  </TouchableOpacity>
</View>

          {nextExercise && (
            <ThemedView style={styles.upNextCard}>
              <ThemedText style={styles.upNextLabel}>UP NEXT</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.upNextName}>{nextExercise.name}</ThemedText>
              <ThemedText style={styles.exerciseDetail}>
                {nextExercise.sets} sets, {nextExercise.reps} reps
              </ThemedText>
            </ThemedView>
          )}

          <TouchableOpacity style={styles.skipButton} onPress={handleSkipRest}>
            <ThemedText style={styles.skipButtonText}>Skip Rest</ThemedText>
          </TouchableOpacity>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  exitButton: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
  exitText: {
    opacity: 0.6,
    fontSize: 13,
  },
  progress: {
    opacity: 0.6,
    marginBottom: 8,
  },
  exerciseName: {
    textAlign: 'center',
  },
  exerciseDetail: {
    opacity: 0.85,
    textAlign: 'center',
  },
  exerciseDescription: {
    opacity: 0.7,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 6,
    borderColor: '#1D8CF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  warmupCircle: {
    borderColor: '#D89614',
  },
  cooldownCircle: {
    borderColor: '#1094A0',
  },
  restCircle: {
    borderColor: '#22A559',
  },
  timerText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 50,
  },
  timerLabel: {
    opacity: 0.6,
    fontSize: 13,
  },
  finishButton: {
    backgroundColor: '#1D8CF8',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 12,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  restTitle: {
    color: '#22A559',
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  adjustButton: {
    borderWidth: 1,
    borderColor: '#22A559',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  adjustButtonText: {
    color: '#22A559',
    fontSize: 14,
    fontWeight: '600',
  },
  adjustLabel: {
    opacity: 0.7,
    fontSize: 13,
  },
  upNextCard: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    minWidth: 220,
  },
  upNextLabel: {
    fontSize: 11,
    opacity: 0.5,
    letterSpacing: 1,
  },
  upNextName: {
    fontSize: 18,
    marginTop: 4,
    marginBottom: 4,
  },
  skipButton: {
    marginTop: 16,
  },
  skipButtonText: {
    color: '#888',
    fontSize: 14,
  },
});