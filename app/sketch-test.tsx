import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { generateExerciseSketch } from '@/services/gemini';

export default function SketchTestScreen() {
  const [exerciseName, setExerciseName] = useState('Dumbbell Renegade Rows');
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);

  const handleGenerate = async () => {
    setLoading(true);
    setImageUri('');
    const start = Date.now();
    try {
      const uri = await generateExerciseSketch(exerciseName);
      setImageUri(uri);
      setElapsedMs(Date.now() - start);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Sketch Test</ThemedText>
      <ThemedText style={{ opacity: 0.7 }}>Test screen — not part of the real app flow.</ThemedText>

      <TextInput
        style={styles.input}
        placeholder="Exercise name"
        placeholderTextColor="#888"
        value={exerciseName}
        onChangeText={setExerciseName}
      />

      <TouchableOpacity style={styles.button} onPress={handleGenerate} disabled={loading}>
        <ThemedText style={styles.buttonText}>
          {loading ? 'Generating...' : 'Generate Sketch'}
        </ThemedText>
      </TouchableOpacity>

      {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}

      {imageUri ? (
        <ThemedView style={styles.resultBox}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          <ThemedText style={{ marginTop: 8, opacity: 0.7 }}>Took {(elapsedMs / 1000).toFixed(1)}s</ThemedText>
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
  resultBox: {
    marginTop: 20,
    alignItems: 'center',
  },
  image: {
    width: 300,
    height: 300,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
});