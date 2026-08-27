import { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import StickFigure from '@/components/stick-figure';

import {
  generatePoseFrames,
  ExercisePoseSet,
} from '@/services/pose-gen';

const FRAME_LABELS = [
  'Start',
  'Early',
  'Middle',
  'Late',
  'End',
];

export default function PoseTestScreen() {
  const [
    exerciseName,
    setExerciseName,
  ] = useState('Bodyweight Squat');

  const [loading, setLoading] =
    useState(false);

  const [poseSet, setPoseSet] =
    useState<ExercisePoseSet | null>(null);

  const [elapsedMs, setElapsedMs] =
    useState(0);

  const handleGenerate = async () => {
    const name =
      exerciseName.trim();

    if (!name) {
      Alert.alert(
        'Exercise required',
        'Please enter an exercise name.'
      );
      return;
    }

    setLoading(true);
    setPoseSet(null);

    const start = Date.now();

    try {
      const result =
        await generatePoseFrames(name);

      setPoseSet(result);

      setElapsedMs(
        Date.now() - start
      );
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message ||
          'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
    >
      <ThemedText type="title">
        Pose Test
      </ThemedText>

      <ThemedText style={styles.subtitle}>
        Vector Coach prototype — Gemini
        generates movement coordinates and
        Atlas renders the skeleton.
      </ThemedText>

      <TextInput
        style={styles.input}
        placeholder="Exercise name"
        placeholderTextColor="#888"
        value={exerciseName}
        onChangeText={setExerciseName}
        autoCapitalize="words"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleGenerate}
        disabled={loading}
      >
        <ThemedText
          style={styles.buttonText}
        >
          {loading
            ? 'Generating...'
            : 'Generate Pose'}
        </ThemedText>
      </TouchableOpacity>

      {loading && (
        <ActivityIndicator
          size="large"
          style={styles.loader}
        />
      )}

      {poseSet && (
        <>
          <ThemedText
            style={styles.resultInfo}
          >
            Generated in{' '}
            {(elapsedMs / 1000).toFixed(1)}
            s
          </ThemedText>

          <ThemedText
            style={styles.viewInfo}
          >
            View: {poseSet.view}
          </ThemedText>

          <ThemedView
            style={styles.framesContainer}
          >
            {poseSet.frames.map(
              (frame, index) => (
                <View
                  key={index}
                  style={styles.frameBox}
                >
                  <StickFigure
                    frame={frame}
                    size={150}
                  />

                  <ThemedText
                    style={
                      styles.frameLabel
                    }
                  >
                    {FRAME_LABELS[index] ||
                      `Frame ${index + 1}`}
                  </ThemedText>
                </View>
              )
            )}
          </ThemedView>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },

  subtitle: {
    opacity: 0.7,
    lineHeight: 22,
  },

  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    marginTop: 16,
  },

  button: {
    backgroundColor: '#1D8CF8',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  loader: {
    marginTop: 20,
  },

  resultInfo: {
    marginTop: 8,
    opacity: 0.7,
  },

  viewInfo: {
    opacity: 0.7,
  },

  framesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },

  frameBox: {
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 8,
    width: 170,
  },

  frameLabel: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.7,
  },
});