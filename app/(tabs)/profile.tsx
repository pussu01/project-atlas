import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';

const GOALS = ['Lose Weight', 'Build Muscle', 'Stay Fit', 'Improve Endurance'];
const EQUIPMENT = ['None / Bodyweight', 'Dumbbells', 'Full Gym'];
const TIME_OPTIONS = ['15 min', '30 min', '45 min', '60+ min'];

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setupAndLoad();
  }, []);

  const setupAndLoad = async () => {
    const db = await SQLite.openDatabaseAsync('atlas.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT,
        goal TEXT,
        equipment TEXT
      );
    `);
    try {
      await db.execAsync('ALTER TABLE profile ADD COLUMN time_available TEXT;');
    } catch {
      // Column already exists, ignore
    }

    const row = await db.getFirstAsync<{ name: string; goal: string; equipment: string; time_available: string }>(
      'SELECT * FROM profile WHERE id = 1'
    );
    if (row) {
      setName(row.name || '');
      setSelectedGoal(row.goal || '');
      setSelectedEquipment(row.equipment ? row.equipment.split(',') : []);
      setSelectedTime(row.time_available || '');
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
    const db = await SQLite.openDatabaseAsync('atlas.db');
    await db.runAsync(
      `INSERT INTO profile (id, name, goal, equipment, time_available) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = ?, goal = ?, equipment = ?, time_available = ?`,
      [name, selectedGoal, selectedEquipment.join(','), selectedTime, name, selectedGoal, selectedEquipment.join(','), selectedTime]
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
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.header}>Your Profile</ThemedText>

      <ThemedText type="subtitle" style={styles.label}>Name</ThemedText>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
      />

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

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <ThemedText style={styles.saveButtonText}>Save Profile</ThemedText>
      </TouchableOpacity>

      
    </ScrollView>
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
  testLink: {
  marginTop: 30,
  alignSelf: 'center',
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