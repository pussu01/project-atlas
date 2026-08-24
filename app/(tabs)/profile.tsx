import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const GOALS = ['Lose Weight', 'Build Muscle', 'Stay Fit', 'Improve Endurance'];
const EQUIPMENT = ['None / Bodyweight', 'Dumbbells', 'Full Gym'];
const TIME_OPTIONS = ['15 min', '30 min', '45 min', '60+ min'];
const SEX_OPTIONS = ['Male', 'Female', 'Prefer not to say'];
const FITNESS_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [age, setAge] = useState('');
  const [selectedSex, setSelectedSex] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [selectedFitnessLevel, setSelectedFitnessLevel] = useState('');
  const [exercisesToAvoid, setExercisesToAvoid] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setupAndLoad();
  }, []);

  const setupAndLoad = async () => {
    const db = await SQLite.openDatabaseAsync('atlas.db');
    const row = await db.getFirstAsync<{
      name: string;
      goal: string;
      equipment: string;
      time_available: string;
      age: number | null;
      sex: string;
      height_cm: number | null;
      fitness_level: string;
      exercises_to_avoid: string;
    }>('SELECT * FROM profile WHERE id = 1');

    if (row) {
      setName(row.name || '');
      setSelectedGoal(row.goal || '');
      setSelectedEquipment(row.equipment ? row.equipment.split(',') : []);
      setSelectedTime(row.time_available || '');
      setAge(row.age != null ? String(row.age) : '');
      setSelectedSex(row.sex || '');
      setHeightCm(row.height_cm != null ? String(row.height_cm) : '');
      setSelectedFitnessLevel(row.fitness_level || '');
      setExercisesToAvoid(row.exercises_to_avoid || '');
    }
    setLoading(false);
  };

  const toggleEquipment = (item: string) => {
    if (selectedEquipment.includes(item)) {
      setSelectedEquipment(selectedEquipment.filter((e) => e !== item));
    } else {
      setSelectedEquipment([...selectedEquipment, item]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Please enter your name.');
      return;
    }
    if (!selectedGoal) {
      Alert.alert('Missing info', 'Please select a goal.');
      return;
    }

    // Validate age if provided
    let ageValue: number | null = null;
    if (age.trim()) {
      const parsed = parseInt(age.trim(), 10);
      if (isNaN(parsed) || parsed < 10 || parsed > 100) {
        Alert.alert('Invalid age', 'Please enter an age between 10 and 100.');
        return;
      }
      ageValue = parsed;
    }

    // Validate height if provided
    let heightValue: number | null = null;
    if (heightCm.trim()) {
      const parsed = parseFloat(heightCm.trim());
      if (isNaN(parsed) || parsed < 50 || parsed > 250) {
        Alert.alert('Invalid height', 'Please enter a height between 50 and 250 cm.');
        return;
      }
      heightValue = parsed;
    }

    const db = await SQLite.openDatabaseAsync('atlas.db');
    await db.runAsync(
      `INSERT INTO profile (id, name, goal, equipment, time_available, age, sex, height_cm, fitness_level, exercises_to_avoid)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = ?,
         goal = ?,
         equipment = ?,
         time_available = ?,
         age = ?,
         sex = ?,
         height_cm = ?,
         fitness_level = ?,
         exercises_to_avoid = ?`,
      [
        name, selectedGoal, selectedEquipment.join(','), selectedTime,
        ageValue, selectedSex, heightValue, selectedFitnessLevel, exercisesToAvoid,
        name, selectedGoal, selectedEquipment.join(','), selectedTime,
        ageValue, selectedSex, heightValue, selectedFitnessLevel, exercisesToAvoid,
      ]
    );
    Alert.alert('Profile Saved', 'Your profile has been saved to the device.');
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText type="title" style={styles.header}>Your Profile</ThemedText>

        {/* Name */}
        <ThemedText type="subtitle" style={styles.label}>Name</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          placeholderTextColor="#888"
          value={name}
          onChangeText={setName}
        />

        {/* Age */}
        <ThemedText type="subtitle" style={styles.label}>Age</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="e.g. 32"
          placeholderTextColor="#888"
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          maxLength={3}
        />

        {/* Sex */}
        <ThemedText type="subtitle" style={styles.label}>Sex</ThemedText>
        <ThemedView style={styles.optionsRow}>
          {SEX_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.option, selectedSex === s && styles.optionSelected]}
              onPress={() => setSelectedSex(s)}>
              <ThemedText style={selectedSex === s ? styles.optionTextSelected : styles.optionText}>
                {s}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        {/* Height */}
        <ThemedText type="subtitle" style={styles.label}>Height (cm)</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="e.g. 175"
          placeholderTextColor="#888"
          value={heightCm}
          onChangeText={setHeightCm}
          keyboardType="decimal-pad"
          maxLength={5}
        />

        {/* Fitness Level */}
        <ThemedText type="subtitle" style={styles.label}>Fitness Level</ThemedText>
        <ThemedView style={styles.optionsRow}>
          {FITNESS_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.option, selectedFitnessLevel === level && styles.optionSelected]}
              onPress={() => setSelectedFitnessLevel(level)}>
              <ThemedText style={selectedFitnessLevel === level ? styles.optionTextSelected : styles.optionText}>
                {level}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        {/* Goal */}
        <ThemedText type="subtitle" style={styles.label}>Goal</ThemedText>
        <ThemedView style={styles.optionsRow}>
          {GOALS.map((goal) => (
            <TouchableOpacity
              key={goal}
              style={[styles.option, selectedGoal === goal && styles.optionSelected]}
              onPress={() => setSelectedGoal(goal)}>
              <ThemedText style={selectedGoal === goal ? styles.optionTextSelected : styles.optionText}>
                {goal}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        {/* Equipment */}
        <ThemedText type="subtitle" style={styles.label}>Available Equipment</ThemedText>
        <ThemedView style={styles.optionsRow}>
          {EQUIPMENT.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.option, selectedEquipment.includes(item) && styles.optionSelected]}
              onPress={() => toggleEquipment(item)}>
              <ThemedText style={selectedEquipment.includes(item) ? styles.optionTextSelected : styles.optionText}>
                {item}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        {/* Time Available */}
        <ThemedText type="subtitle" style={styles.label}>Time Available Today</ThemedText>
        <ThemedView style={styles.optionsRow}>
          {TIME_OPTIONS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.option, selectedTime === t && styles.optionSelected]}
              onPress={() => setSelectedTime(t)}>
              <ThemedText style={selectedTime === t ? styles.optionTextSelected : styles.optionText}>
                {t}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ThemedView>

        {/* Exercises to Avoid */}
        <ThemedText type="subtitle" style={styles.label}>Exercises to Avoid</ThemedText>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="e.g. deep squats, jumping exercises"
          placeholderTextColor="#888"
          value={exercisesToAvoid}
          onChangeText={setExercisesToAvoid}
          multiline
          numberOfLines={3}
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <ThemedText style={styles.saveButtonText}>Save Profile</ThemedText>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 8,
  },
  header: {
    marginBottom: 12,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  optionSelected: {
    backgroundColor: '#1D8CF8',
    borderColor: '#1D8CF8',
  },
  optionText: {
    fontSize: 14,
  },
  optionTextSelected: {
    fontSize: 14,
    color: '#fff',
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#1D8CF8',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});