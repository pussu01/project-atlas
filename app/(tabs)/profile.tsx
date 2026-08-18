import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const GOALS = ['Lose Weight', 'Build Muscle', 'Stay Fit', 'Improve Endurance'];
const EQUIPMENT = ['None / Bodyweight', 'Dumbbells', 'Full Gym'];

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  const toggleEquipment = (item: string) => {
    if (selectedEquipment.includes(item)) {
      setSelectedEquipment(selectedEquipment.filter((e) => e !== item));
    } else {
      setSelectedEquipment([...selectedEquipment, item]);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Please enter your name.');
      return;
    }
    if (!selectedGoal) {
      Alert.alert('Missing info', 'Please select a goal.');
      return;
    }
    Alert.alert(
      'Profile Saved',
      `Name: ${name}\nGoal: ${selectedGoal}\nEquipment: ${selectedEquipment.join(', ') || 'None selected'}`
    );
  };

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