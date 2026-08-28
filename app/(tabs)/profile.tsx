import { useState, useEffect } from 'react';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
  ActivityIndicator,
} from 'react-native';

import * as WebBrowser from 'expo-web-browser';
import * as SQLite from 'expo-sqlite';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import {
  getGeminiApiKey,
  saveGeminiApiKey,
  deleteGeminiApiKey,
  hasGeminiApiKey,
} from '@/services/gemini-key';

import { testGeminiConnection } from '@/services/gemini';

const ORANGE = '#F28C18';
const BACKGROUND = '#080808';
const CARD = '#151515';
const BORDER = '#292929';
const MUTED = '#888888';
const RED = '#E5484D';
const GREEN = '#22A559';

const GOALS = [
  'Lose Weight',
  'Build Muscle',
  'Stay Fit',
  'Improve Endurance',
];

const EQUIPMENT = [
  'None / Bodyweight',
  'Dumbbells',
  'Full Gym',
];

const TIME_OPTIONS = [
  '15 min',
  '30 min',
  '45 min',
  '60+ min',
];

const SEX_OPTIONS = [
  'Male',
  'Female',
  'Prefer not to say',
];

const FITNESS_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
];

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedEquipment, setSelectedEquipment] =
    useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [age, setAge] = useState('');
  const [selectedSex, setSelectedSex] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [selectedFitnessLevel, setSelectedFitnessLevel] =
    useState('');
  const [exercisesToAvoid, setExercisesToAvoid] =
    useState('');

  const [loading, setLoading] = useState(true);

  const [geminiConnected, setGeminiConnected] =
    useState(false);

  const [showKeyInput, setShowKeyInput] =
    useState(false);

  const [keyInputValue, setKeyInputValue] =
    useState('');

  const [testingConnection, setTestingConnection] =
    useState(false);

  useEffect(() => {
    setupAndLoad();
  }, []);

  // =====================================================================
  // LOAD PROFILE + GEMINI STATUS
  // =====================================================================

  const setupAndLoad = async () => {
    try {
      const db =
        await SQLite.openDatabaseAsync('atlas.db');

      const row =
        await db.getFirstAsync<{
          name: string | null;
          goal: string | null;
          equipment: string | null;
          time_available: string | null;
          age: number | null;
          sex: string | null;
          height_cm: number | null;
          fitness_level: string | null;
          exercises_to_avoid: string | null;
        }>(
          'SELECT * FROM profile WHERE id = 1'
        );

      if (row) {
        setName(row.name || '');
        setSelectedGoal(row.goal || '');

        setSelectedEquipment(
          row.equipment
            ? row.equipment
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : []
        );

        setSelectedTime(
          row.time_available || ''
        );

        setAge(
          row.age != null
            ? String(row.age)
            : ''
        );

        setSelectedSex(
          row.sex || ''
        );

        setHeightCm(
          row.height_cm != null
            ? String(row.height_cm)
            : ''
        );

        setSelectedFitnessLevel(
          row.fitness_level || ''
        );

        setExercisesToAvoid(
          row.exercises_to_avoid || ''
        );
      }

      const keyExists =
        await hasGeminiApiKey();

      setGeminiConnected(keyExists);
    } catch (error) {
      console.error(
        'Failed to load profile:',
        error
      );

      Alert.alert(
        'Unable to load profile',
        'BheemAI could not load your profile from this device.'
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================================
  // EQUIPMENT
  // =====================================================================

  const toggleEquipment = (
    item: string
  ) => {
    if (
      selectedEquipment.includes(item)
    ) {
      setSelectedEquipment(
        selectedEquipment.filter(
          (equipment) =>
            equipment !== item
        )
      );
    } else {
      setSelectedEquipment([
        ...selectedEquipment,
        item,
      ]);
    }
  };

  // =====================================================================
  // SAVE PROFILE
  // =====================================================================

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(
        'Missing information',
        'Please enter your name.'
      );
      return;
    }

    if (!selectedGoal) {
      Alert.alert(
        'Missing information',
        'Please select your primary fitness goal.'
      );
      return;
    }

    let ageValue: number | null =
      null;

    if (age.trim()) {
      const parsed =
        parseInt(age.trim(), 10);

      if (
        isNaN(parsed) ||
        parsed < 10 ||
        parsed > 100
      ) {
        Alert.alert(
          'Invalid age',
          'Please enter an age between 10 and 100.'
        );
        return;
      }

      ageValue = parsed;
    }

    let heightValue:
      | number
      | null = null;

    if (heightCm.trim()) {
      const parsed =
        parseFloat(heightCm.trim());

      if (
        isNaN(parsed) ||
        parsed < 50 ||
        parsed > 250
      ) {
        Alert.alert(
          'Invalid height',
          'Please enter a height between 50 and 250 cm.'
        );
        return;
      }

      heightValue = parsed;
    }

    try {
      const db =
        await SQLite.openDatabaseAsync(
          'atlas.db'
        );

      await db.runAsync(
        `INSERT INTO profile (
          id,
          name,
          goal,
          equipment,
          time_available,
          age,
          sex,
          height_cm,
          fitness_level,
          exercises_to_avoid
        )
        VALUES (
          1,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
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
          name.trim(),
          selectedGoal,
          selectedEquipment.join(','),
          selectedTime,
          ageValue,
          selectedSex,
          heightValue,
          selectedFitnessLevel,
          exercisesToAvoid.trim(),

          name.trim(),
          selectedGoal,
          selectedEquipment.join(','),
          selectedTime,
          ageValue,
          selectedSex,
          heightValue,
          selectedFitnessLevel,
          exercisesToAvoid.trim(),
        ]
      );

      Alert.alert(
        'Profile saved',
        'Your BheemAI training profile has been saved on this device.'
      );
    } catch (error: any) {
      console.error(
        'Failed to save profile:',
        error
      );

      Alert.alert(
        'Save failed',
        error?.message ||
          'BheemAI could not save your profile.'
      );
    }
  };

  // =====================================================================
  // SAVE GEMINI KEY
  // =====================================================================

  const handleSaveKey = async () => {
    const key =
      keyInputValue.trim();

    if (!key) {
      Alert.alert(
        'Missing API key',
        'Please paste your Gemini API key.'
      );
      return;
    }

    try {
      await saveGeminiApiKey(key);

      setKeyInputValue('');
      setShowKeyInput(false);
      setGeminiConnected(true);

      Alert.alert(
        'Gemini connected',
        'Your Gemini API key has been securely saved on this device.'
      );
    } catch (error: any) {
      console.error(
        'Failed to save Gemini key:',
        error
      );

      Alert.alert(
        'Could not save key',
        error?.message ||
          'BheemAI could not save the Gemini API key.'
      );
    }
  };

  // =====================================================================
  // REMOVE GEMINI KEY
  // =====================================================================

  const handleRemoveKey = () => {
    Alert.alert(
      'Remove Gemini API key?',
      'You will not be able to generate AI workouts until you add a key again.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGeminiApiKey();

              setGeminiConnected(false);

              Alert.alert(
                'API key removed',
                'Your Gemini API key has been removed from this device.'
              );
            } catch (error: any) {
              Alert.alert(
                'Could not remove key',
                error?.message ||
                  'Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  // =====================================================================
  // TEST GEMINI CONNECTION
  // =====================================================================

  const handleTestConnection = async () => {
    setTestingConnection(true);

    try {
      const key =
        await getGeminiApiKey();

      if (!key) {
        Alert.alert(
          'No API key',
          'Please connect your Gemini API key first.'
        );
        return;
      }

      await testGeminiConnection(key);

      Alert.alert(
        'Connection successful',
        'Your Gemini API key is working correctly.'
      );
    } catch (err: any) {
      Alert.alert(
        'Connection failed',
        err?.message ||
          'BheemAI could not connect using this key.'
      );
    } finally {
      setTestingConnection(false);
    }
  };

  // =====================================================================
  // LOADING
  // =====================================================================

  if (loading) {
    return (
      <ThemedView
        style={styles.loadingContainer}
      >
        <ActivityIndicator
          size="large"
        />

        <ThemedText
          style={styles.loadingText}
        >
          Loading profile...
        </ThemedText>
      </ThemedView>
    );
  }

  // =====================================================================
  // SCREEN
  // =====================================================================

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.container
        }
        keyboardShouldPersistTaps="handled"
      >

        {/* ===============================================================
            HEADER
        =============================================================== */}

        <View style={styles.header}>

          <ThemedText style={styles.brand}>
            BHEEMAI
          </ThemedText>

          <ThemedText
            type="title"
            style={styles.title}
          >
            Your Profile
          </ThemedText>

          <ThemedText
            style={styles.subtitle}
          >
            Tell BheemAI how you train so your
            workouts can adapt to you.
          </ThemedText>

        </View>


        {/* ===============================================================
            PERSONAL DETAILS
        =============================================================== */}

        <SectionHeader
          eyebrow="ABOUT YOU"
          title="Personal details"
        />

        <View style={styles.card}>

          <FieldLabel label="Name" />

          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />


          <FieldLabel label="Age" />

          <TextInput
            style={styles.input}
            placeholder="e.g. 32"
            placeholderTextColor="#666"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            maxLength={3}
          />


          <FieldLabel label="Sex" />

          <View style={styles.optionsRow}>
            {SEX_OPTIONS.map(
              (option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={
                    selectedSex === option
                  }
                  onPress={() =>
                    setSelectedSex(option)
                  }
                />
              )
            )}
          </View>


          <FieldLabel label="Height" />

          <View style={styles.heightRow}>

            <TextInput
              style={[
                styles.input,
                styles.heightInput,
              ]}
              placeholder="e.g. 175"
              placeholderTextColor="#666"
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="decimal-pad"
              maxLength={5}
            />

            <View
              style={styles.unitBox}
            >
              <ThemedText
                style={styles.unitText}
              >
                cm
              </ThemedText>
            </View>

          </View>

        </View>


        {/* ===============================================================
            FITNESS
        =============================================================== */}

        <SectionHeader
          eyebrow="TRAINING"
          title="Fitness preferences"
        />

        <View style={styles.card}>

          <FieldLabel label="Primary goal" />

          <View style={styles.optionsRow}>
            {GOALS.map(
              (goal) => (
                <OptionChip
                  key={goal}
                  label={goal}
                  selected={
                    selectedGoal === goal
                  }
                  onPress={() =>
                    setSelectedGoal(goal)
                  }
                />
              )
            )}
          </View>


          <FieldLabel label="Fitness level" />

          <View style={styles.optionsRow}>
            {FITNESS_LEVELS.map(
              (level) => (
                <OptionChip
                  key={level}
                  label={level}
                  selected={
                    selectedFitnessLevel ===
                    level
                  }
                  onPress={() =>
                    setSelectedFitnessLevel(
                      level
                    )
                  }
                />
              )
            )}
          </View>


          <FieldLabel label="Time available today" />

          <View style={styles.optionsRow}>
            {TIME_OPTIONS.map(
              (time) => (
                <OptionChip
                  key={time}
                  label={time}
                  selected={
                    selectedTime === time
                  }
                  onPress={() =>
                    setSelectedTime(time)
                  }
                />
              )
            )}
          </View>

        </View>


        {/* ===============================================================
            EQUIPMENT
        =============================================================== */}

        <SectionHeader
          eyebrow="EQUIPMENT"
          title="What can you train with?"
        />

        <View style={styles.card}>

          <ThemedText
            style={styles.helperText}
          >
            Select everything you currently
            have available.
          </ThemedText>

          <View style={styles.optionsRow}>
            {EQUIPMENT.map(
              (equipment) => (
                <OptionChip
                  key={equipment}
                  label={equipment}
                  selected={selectedEquipment.includes(
                    equipment
                  )}
                  onPress={() =>
                    toggleEquipment(
                      equipment
                    )
                  }
                />
              )
            )}
          </View>

        </View>


        {/* ===============================================================
            SPECIAL INSTRUCTIONS
        =============================================================== */}

        <SectionHeader
          eyebrow="PERSONALIZATION"
          title="Anything BheemAI should know?"
        />

        <View style={styles.card}>

          <ThemedText
            style={styles.helperText}
          >
            Add exercises to avoid, physical
            limitations, preferences, or other
            instructions you want your AI coach
            to consider.
          </ThemedText>

          <TextInput
            style={[
              styles.input,
              styles.textArea,
            ]}
            placeholder={
              'Example: avoid jumping exercises, prefer dumbbells, keep workouts low impact...'
            }
            placeholderTextColor="#666"
            value={exercisesToAvoid}
            onChangeText={
              setExercisesToAvoid
            }
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

        </View>


        {/* ===============================================================
            GEMINI AI COACH
        =============================================================== */}

        <SectionHeader
          eyebrow="AI COACH"
          title="Gemini connection"
        />

        <View style={styles.aiCard}>

          <View style={styles.aiHeader}>

            <View style={styles.aiIcon}>
              <ThemedText
                style={styles.aiIconText}
              >
                AI
              </ThemedText>
            </View>

            <View style={styles.aiHeaderText}>

              <ThemedText
                style={styles.aiTitle}
              >
                Your personal AI engine
              </ThemedText>

              <ThemedText
                style={styles.aiSubtitle}
              >
                Gemini generates your adaptive
                workouts.
              </ThemedText>

            </View>

          </View>


          {/* =============================================================
              EXPLANATION
          ============================================================= */}

          <View style={styles.explanationBox}>

            <ThemedText
              style={styles.explanationTitle}
            >
              Why do I need a key?
            </ThemedText>

            <ThemedText
              style={styles.explanationText}
            >
              BheemAI uses Google's Gemini AI to
              create personalized workouts. Your
              Gemini API key belongs to you and is
              stored securely on this device.
            </ThemedText>

            <TouchableOpacity
              onPress={() =>
                WebBrowser.openBrowserAsync(
                  'https://ai.google.dev/gemini-api/docs/api-key'
                )
              }
            >
              <ThemedText
                style={styles.aiLink}
              >
                Learn how to get a Gemini API key →
              </ThemedText>
            </TouchableOpacity>

          </View>


          {/* =============================================================
              STATUS
          ============================================================= */}

          {geminiConnected ? (

            <View style={styles.connectedSection}>

              <View style={styles.statusRow}>

                <View
                  style={
                    styles.statusDotConnected
                  }
                />

                <ThemedText
                  style={
                    styles.connectedText
                  }
                >
                  Gemini connected
                </ThemedText>

              </View>


              <TouchableOpacity
                style={styles.outlineButton}
                onPress={
                  handleTestConnection
                }
                disabled={
                  testingConnection
                }
              >
                <ThemedText
                  style={
                    styles.outlineButtonText
                  }
                >
                  {testingConnection
                    ? 'Testing connection...'
                    : 'Test Connection'}
                </ThemedText>
              </TouchableOpacity>


              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() =>
                  setShowKeyInput(true)
                }
              >
                <ThemedText
                  style={
                    styles.outlineButtonText
                  }
                >
                  Replace API Key
                </ThemedText>
              </TouchableOpacity>


              <TouchableOpacity
                style={styles.removeButton}
                onPress={
                  handleRemoveKey
                }
              >
                <ThemedText
                  style={
                    styles.removeButtonText
                  }
                >
                  Remove API Key
                </ThemedText>
              </TouchableOpacity>

            </View>

          ) : (

            <View style={styles.notConnectedSection}>

              <View style={styles.statusRow}>

                <View
                  style={
                    styles.statusDot
                  }
                />

                <ThemedText
                  style={styles.statusText}
                >
                  Gemini not connected
                </ThemedText>

              </View>

              <ThemedText
                style={styles.keyRequiredText}
              >
                Connect your own Gemini API key
                to generate AI workouts.
              </ThemedText>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() =>
                  setShowKeyInput(true)
                }
              >
                <ThemedText
                  style={
                    styles.primaryButtonText
                  }
                >
                  Connect Gemini
                </ThemedText>
              </TouchableOpacity>

            </View>

          )}


          {/* =============================================================
              KEY INPUT
          ============================================================= */}

          {showKeyInput && (
            <View
              style={
                styles.keyInputContainer
              }
            >

              <ThemedText
                style={styles.keyInputTitle}
              >
                {geminiConnected
                  ? 'Replace your API key'
                  : 'Add your Gemini API key'}
              </ThemedText>

              <ThemedText
                style={styles.keyInputSubtitle}
              >
                Paste the key you received from
                Google AI Studio.
              </ThemedText>

              <TextInput
                style={styles.input}
                placeholder="Paste Gemini API key"
                placeholderTextColor="#666"
                value={keyInputValue}
                onChangeText={
                  setKeyInputValue
                }
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
              />

              <View
                style={styles.keyButtonRow}
              >

                <TouchableOpacity
                  style={
                    styles.cancelButton
                  }
                  onPress={() => {
                    setShowKeyInput(
                      false
                    );
                    setKeyInputValue('');
                  }}
                >
                  <ThemedText
                    style={
                      styles.cancelButtonText
                    }
                  >
                    Cancel
                  </ThemedText>
                </TouchableOpacity>


                <TouchableOpacity
                  style={
                    styles.saveKeyButton
                  }
                  onPress={
                    handleSaveKey
                  }
                >
                  <ThemedText
                    style={
                      styles.saveKeyButtonText
                    }
                  >
                    Save Key
                  </ThemedText>
                </TouchableOpacity>

              </View>

            </View>
          )}

        </View>


        {/* ===============================================================
            SAVE PROFILE
        =============================================================== */}

        <TouchableOpacity
          style={styles.saveProfileButton}
          activeOpacity={0.85}
          onPress={handleSave}
        >
          <ThemedText
            style={
              styles.saveProfileButtonText
            }
          >
            Save Profile
          </ThemedText>
        </TouchableOpacity>


        <ThemedText
          style={styles.footerText}
        >
          BheemAI · Free AI Fitness Coach
        </ThemedText>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}


/* =========================================================================
   SMALL REUSABLE UI COMPONENTS
========================================================================= */

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>

      <ThemedText
        style={styles.sectionEyebrow}
      >
        {eyebrow}
      </ThemedText>

      <ThemedText
        style={styles.sectionTitle}
      >
        {title}
      </ThemedText>

    </View>
  );
}


function FieldLabel({
  label,
}: {
  label: string;
}) {
  return (
    <ThemedText
      style={styles.fieldLabel}
    >
      {label}
    </ThemedText>
  );
}


function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.option,
        selected &&
          styles.optionSelected,
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {selected && (
        <ThemedText
          style={styles.check}
        >
          ✓
        </ThemedText>
      )}

      <ThemedText
        style={
          selected
            ? styles.optionTextSelected
            : styles.optionText
        }
      >
        {label}
      </ThemedText>

    </TouchableOpacity>
  );
}


/* =========================================================================
   STYLES
========================================================================= */

const styles = StyleSheet.create({

  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 45,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    opacity: 0.55,
  },


  /* -----------------------------------------------------------------------
     HEADER
  ----------------------------------------------------------------------- */

  header: {
    marginBottom: 28,
  },

  brand: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 3.5,
    marginBottom: 9,
  },

  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    marginBottom: 7,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.58,
    maxWidth: 350,
  },


  /* -----------------------------------------------------------------------
     SECTION HEADERS
  ----------------------------------------------------------------------- */

  sectionHeader: {
    marginBottom: 12,
    marginTop: 7,
  },

  sectionEyebrow: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.7,
    marginBottom: 4,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
  },


  /* -----------------------------------------------------------------------
     CARDS
  ----------------------------------------------------------------------- */

  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 17,
    marginBottom: 25,
  },


  /* -----------------------------------------------------------------------
     FIELDS
  ----------------------------------------------------------------------- */

  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.72,
    marginBottom: 8,
    marginTop: 12,
  },

  input: {
    minHeight: 50,

    backgroundColor: '#101010',

    borderWidth: 1,
    borderColor: '#333333',

    borderRadius: 12,

    paddingHorizontal: 14,
    paddingVertical: 12,

    fontSize: 15,

    color: '#FFFFFF',
  },

  textArea: {
    minHeight: 110,
    paddingTop: 14,
  },

  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  heightInput: {
    flex: 1,
  },

  unitBox: {
    height: 50,
    paddingHorizontal: 15,

    borderWidth: 1,
    borderColor: '#333333',

    borderRadius: 12,

    backgroundColor: '#101010',

    justifyContent: 'center',

    marginLeft: 8,
  },

  unitText: {
    opacity: 0.55,
    fontSize: 14,
  },


  /* -----------------------------------------------------------------------
     OPTIONS
  ----------------------------------------------------------------------- */

  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  option: {
    minHeight: 40,

    flexDirection: 'row',
    alignItems: 'center',

    borderWidth: 1,
    borderColor: '#3A3A3A',

    borderRadius: 12,

    paddingVertical: 9,
    paddingHorizontal: 13,

    backgroundColor: '#101010',
  },

  optionSelected: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },

  optionText: {
    fontSize: 13,
    opacity: 0.75,
  },

  optionTextSelected: {
    color: '#080808',
    fontSize: 13,
    fontWeight: '800',
  },

  check: {
    color: '#080808',
    fontSize: 13,
    fontWeight: '900',
    marginRight: 5,
  },

  helperText: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.55,
    marginBottom: 13,
  },


  /* -----------------------------------------------------------------------
     AI CARD
  ----------------------------------------------------------------------- */

  aiCard: {
    backgroundColor: CARD,

    borderWidth: 1,
    borderColor: BORDER,

    borderRadius: 20,

    padding: 18,

    marginBottom: 25,
  },

  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  aiIcon: {
    width: 50,
    height: 50,

    borderRadius: 15,

    backgroundColor: ORANGE,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 13,
  },

  aiIconText: {
    color: '#080808',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  aiHeaderText: {
    flex: 1,
  },

  aiTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },

  aiSubtitle: {
    fontSize: 12,
    opacity: 0.55,
  },


  /* -----------------------------------------------------------------------
     GEMINI EXPLANATION
  ----------------------------------------------------------------------- */

  explanationBox: {
    backgroundColor: '#101010',

    borderRadius: 13,

    padding: 14,

    borderWidth: 1,
    borderColor: '#252525',

    marginBottom: 16,
  },

  explanationTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },

  explanationText: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.62,
    marginBottom: 9,
  },

  aiLink: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
  },


  /* -----------------------------------------------------------------------
     STATUS
  ----------------------------------------------------------------------- */

  connectedSection: {
    gap: 8,
  },

  notConnectedSection: {
    gap: 8,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },

  statusDot: {
    width: 9,
    height: 9,

    borderRadius: 5,

    backgroundColor: '#666',

    marginRight: 8,
  },

  statusDotConnected: {
    width: 9,
    height: 9,

    borderRadius: 5,

    backgroundColor: GREEN,

    marginRight: 8,
  },

  statusText: {
    fontSize: 13,
    opacity: 0.6,
  },

  connectedText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
  },

  keyRequiredText: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.55,
    marginBottom: 5,
  },


  /* -----------------------------------------------------------------------
     BUTTONS
  ----------------------------------------------------------------------- */

  primaryButton: {
    minHeight: 50,

    backgroundColor: ORANGE,

    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 15,

    marginTop: 4,
  },

  primaryButtonText: {
    color: '#080808',
    fontSize: 14,
    fontWeight: '800',
  },

  outlineButton: {
    minHeight: 46,

    borderWidth: 1,
    borderColor: ORANGE,

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 14,

    backgroundColor: 'transparent',
  },

  outlineButtonText: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '700',
  },

  removeButton: {
    minHeight: 46,

    borderWidth: 1,
    borderColor: '#4A2426',

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 14,

    backgroundColor: '#180E0F',
  },

  removeButtonText: {
    color: RED,
    fontSize: 13,
    fontWeight: '700',
  },


  /* -----------------------------------------------------------------------
     API KEY INPUT
  ----------------------------------------------------------------------- */

  keyInputContainer: {
    marginTop: 15,

    paddingTop: 16,

    borderTopWidth: 1,
    borderTopColor: BORDER,
  },

  keyInputTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },

  keyInputSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.55,
    marginBottom: 12,
  },

  keyButtonRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 9,
  },

  cancelButton: {
    flex: 1,

    minHeight: 48,

    borderWidth: 1,
    borderColor: '#444444',

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.7,
  },

  saveKeyButton: {
    flex: 1,

    minHeight: 48,

    backgroundColor: ORANGE,

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',
  },

  saveKeyButtonText: {
    color: '#080808',
    fontSize: 13,
    fontWeight: '800',
  },


  /* -----------------------------------------------------------------------
     SAVE PROFILE
  ----------------------------------------------------------------------- */

  saveProfileButton: {
    minHeight: 58,

    backgroundColor: ORANGE,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 2,
  },

  saveProfileButtonText: {
    color: '#080808',
    fontSize: 16,
    fontWeight: '900',
  },


  /* -----------------------------------------------------------------------
     FOOTER
  ----------------------------------------------------------------------- */

  footerText: {
    textAlign: 'center',

    fontSize: 11,

    opacity: 0.3,

    marginTop: 22,
  },
});