import { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LineChart } from 'react-native-gifted-charts';

/* ================================================================
   TYPES
   ================================================================ */

type HistoryRow = {
  id: number;
  date: string;
  workout_json: string;
};

type MeasurementRow = {
  id: number;
  date: string;
  weight_kg: number;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  neck_cm: number | null;
};

type SessionSummary = {
  totalSeconds?: number;
  activeSeconds?: number;
  restSeconds?: number;
  calories?: number;
};

type ParsedWorkout = {
  title?: string;
  exercises?: {
    name?: string;
    sets?: number | string;
    reps?: string;
    focus?: string;
    description?: string;
  }[];
  warmup?: {
    name?: string;
    seconds?: number;
  }[];
  cooldown?: {
    name?: string;
    seconds?: number;
  }[];
  sessionSummary?: SessionSummary | null;
};

/* ================================================================
   HELPERS
   ================================================================ */

function getTodayString(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseWorkout(json: string): ParsedWorkout | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function formatDuration(
  seconds: number | null | undefined
): string {
  if (
    seconds == null ||
    !Number.isFinite(Number(seconds)) ||
    Number(seconds) <= 0
  ) {
    return '—';
  }

  const total = Math.floor(Number(seconds));
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;

  if (minutes === 0) {
    return `${remainingSeconds} sec`;
  }

  return `${minutes} min ${String(
    remainingSeconds
  ).padStart(2, '0')} sec`;
}

function formatShortDuration(
  seconds: number | null | undefined
): string {
  if (
    seconds == null ||
    !Number.isFinite(Number(seconds)) ||
    Number(seconds) <= 0
  ) {
    return '—';
  }

  const total = Math.floor(Number(seconds));
  const minutes = Math.floor(total / 60);

  return `${minutes} min`;
}

function formatDate(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getWorkoutStats(
  history: HistoryRow[]
) {
  let activeSeconds = 0;
  let calories = 0;

  for (const item of history) {
    const plan = parseWorkout(item.workout_json);
    const summary = plan?.sessionSummary;

    if (!summary) {
      continue;
    }

    activeSeconds +=
      Number(summary.activeSeconds) || 0;

    calories +=
      Number(summary.calories) || 0;
  }

  return {
    activeSeconds,
    calories,
  };
}

function calculateCurrentStreak(
  history: HistoryRow[]
): number {
  if (history.length === 0) {
    return 0;
  }

  const uniqueDates = Array.from(
    new Set(
      history
        .map((item) => item.date)
        .filter(Boolean)
    )
  ).sort((a, b) => {
    return (
      new Date(`${b}T00:00:00`).getTime() -
      new Date(`${a}T00:00:00`).getTime()
    );
  });

  if (uniqueDates.length === 0) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const latest = new Date(
    `${uniqueDates[0]}T00:00:00`
  );

  const daysFromToday = Math.round(
    (today.getTime() - latest.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  /*
   * A streak remains active if the latest workout
   * was today or yesterday.
   */
  if (
    daysFromToday < 0 ||
    daysFromToday > 1
  ) {
    return 0;
  }

  let streak = 1;

  for (
    let i = 1;
    i < uniqueDates.length;
    i++
  ) {
    const previous = new Date(
      `${uniqueDates[i - 1]}T00:00:00`
    );

    const current = new Date(
      `${uniqueDates[i]}T00:00:00`
    );

    const difference = Math.round(
      (previous.getTime() -
        current.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (difference === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/* ================================================================
   SCREEN
   ================================================================ */

export default function ProgressScreen() {
  const router = useRouter();

  const [history, setHistory] =
    useState<HistoryRow[]>([]);

  const [measurements, setMeasurements] =
    useState<MeasurementRow[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    showMeasurementForm,
    setShowMeasurementForm,
  ] = useState(false);

  const [
    showMeasurementHistory,
    setShowMeasurementHistory,
  ] = useState(false);

  const [
    showAllWorkoutHistory,
    setShowAllWorkoutHistory,
  ] = useState(false);

  const [
    measurementDate,
    setMeasurementDate,
  ] = useState(getTodayString());

  const [weight, setWeight] =
    useState('');

  const [waist, setWaist] =
    useState('');

  const [chest, setChest] =
    useState('');

  const [hips, setHips] =
    useState('');

  const [neck, setNeck] =
    useState('');

  /* ================================================================
     LOAD DATA
     ================================================================ */

  const loadData = async () => {
    setLoading(true);

    try {
      const db =
        await SQLite.openDatabaseAsync(
          'atlas.db'
        );

      const historyRows =
        await db.getAllAsync<HistoryRow>(
          `SELECT id, date, workout_json
           FROM workout_history
           ORDER BY id DESC`
        );

      const measurementRows =
        await db.getAllAsync<MeasurementRow>(
          `SELECT *
           FROM measurements
           ORDER BY date DESC, id DESC`
        );

      setHistory(historyRows);
      setMeasurements(measurementRows);
    } catch (error) {
      console.error(
        'Failed to load progress:',
        error
      );

      Alert.alert(
        'Unable to load progress',
        'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  /* ================================================================
     MEASUREMENT FORM
     ================================================================ */

  const resetMeasurementForm = () => {
    setMeasurementDate(
      getTodayString()
    );

    setWeight('');
    setWaist('');
    setChest('');
    setHips('');
    setNeck('');

    setShowMeasurementForm(false);
  };

  const saveMeasurement = async () => {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        measurementDate
      )
    ) {
      Alert.alert(
        'Invalid date',
        'Please enter the date as YYYY-MM-DD.'
      );
      return;
    }

    const weightValue =
      Number(weight);

    if (
      !weight.trim() ||
      !Number.isFinite(weightValue)
    ) {
      Alert.alert(
        'Invalid weight',
        'Please enter a valid weight.'
      );
      return;
    }

    if (
      weightValue < 20 ||
      weightValue > 300
    ) {
      Alert.alert(
        'Invalid weight',
        'Weight should be between 20 and 300 kg.'
      );
      return;
    }

    const parseOptionalMeasurement = (
      value: string,
      fieldName: string,
      min: number,
      max: number
    ): number | null | false => {
      if (!value.trim()) {
        return null;
      }

      const numericValue =
        Number(value);

      if (
        !Number.isFinite(
          numericValue
        )
      ) {
        Alert.alert(
          'Invalid measurement',
          `${fieldName} must be a number.`
        );

        return false;
      }

      if (
        numericValue < min ||
        numericValue > max
      ) {
        Alert.alert(
          'Invalid measurement',
          `${fieldName} should be between ${min} and ${max} cm.`
        );

        return false;
      }

      return numericValue;
    };

    const waistValue =
      parseOptionalMeasurement(
        waist,
        'Waist',
        30,
        200
      );

    if (waistValue === false) {
      return;
    }

    const chestValue =
      parseOptionalMeasurement(
        chest,
        'Chest',
        30,
        200
      );

    if (chestValue === false) {
      return;
    }

    const hipsValue =
      parseOptionalMeasurement(
        hips,
        'Hips',
        30,
        200
      );

    if (hipsValue === false) {
      return;
    }

    const neckValue =
      parseOptionalMeasurement(
        neck,
        'Neck',
        10,
        80
      );

    if (neckValue === false) {
      return;
    }

    try {
      const db =
        await SQLite.openDatabaseAsync(
          'atlas.db'
        );

      await db.runAsync(
        `INSERT INTO measurements
          (
            date,
            weight_kg,
            waist_cm,
            chest_cm,
            hips_cm,
            neck_cm
          )
         VALUES (?, ?, ?, ?, ?, ?)`,
        measurementDate,
        weightValue,
        waistValue,
        chestValue,
        hipsValue,
        neckValue
      );

      resetMeasurementForm();

      await loadData();

      Alert.alert(
        'Saved',
        'Measurement saved successfully.'
      );
    } catch (error) {
      console.error(
        'Failed to save measurement:',
        error
      );

      Alert.alert(
        'Error',
        'The measurement could not be saved. Please try again.'
      );
    }
  };

  /* ================================================================
     DERIVED DATA
     ================================================================ */

  const latestMeasurement =
    measurements.length > 0
      ? measurements[0]
      : null;

  const previousMeasurement =
    measurements.length > 1
      ? measurements[1]
      : null;

  const oldestMeasurement =
    measurements.length > 0
      ? measurements[
          measurements.length - 1
        ]
      : null;

  const weightChange =
    latestMeasurement &&
    oldestMeasurement &&
    measurements.length >= 2
      ? latestMeasurement.weight_kg -
        oldestMeasurement.weight_kg
      : null;

  const previousWeightChange =
    latestMeasurement &&
    previousMeasurement
      ? latestMeasurement.weight_kg -
        previousMeasurement.weight_kg
      : null;

  const workoutStats =
    getWorkoutStats(history);

  const currentStreak =
    calculateCurrentStreak(history);

  const recentWorkouts =
    history.slice(0, 3);

  const chartData = [...measurements]
    .reverse()
    .map((measurement) => ({
      value: measurement.weight_kg,
      label:
        measurement.date.slice(5),
    }));

  /* ================================================================
     CHART SCALING
     ================================================================ */

  let chartMin = 0;
  let chartRange = 100;
  let chartStep = 25;

  if (measurements.length >= 2) {
    const weights =
      measurements.map(
        (measurement) =>
          measurement.weight_kg
      );

    const minimumWeight =
      Math.min(...weights);

    const maximumWeight =
      Math.max(...weights);

    const weightRange =
      maximumWeight -
      minimumWeight;

    const padding = Math.max(
      1,
      weightRange * 0.15
    );

    chartMin = Math.floor(
      minimumWeight - padding
    );

    const chartMax = Math.ceil(
      maximumWeight + padding
    );

    chartRange =
      chartMax - chartMin;

    if (chartRange <= 0) {
      chartRange = 4;
    }

    chartStep =
      chartRange / 4;
  }

  /* ================================================================
     RECENT WORKOUT CARD
     ================================================================ */

  const renderRecentWorkout = (
    item: HistoryRow
  ) => {
    const plan =
      parseWorkout(
        item.workout_json
      );

    const summary =
      plan?.sessionSummary;

    const title =
      plan?.title ||
      'Workout';

    const duration =
      summary?.totalSeconds;

    const calories =
      Number(summary?.calories) || 0;

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.75}
        style={styles.workoutCard}
        onPress={() =>
          router.push({
            pathname:
              '/workout-details',
            params: {
              id: String(item.id),
            },
          })
        }
      >
        <View style={styles.workoutCardMain}>
          <ThemedText
            style={styles.workoutTitle}
            numberOfLines={1}
          >
            {title}
          </ThemedText>

          <ThemedText
            style={styles.workoutMeta}
          >
            {formatDate(item.date)}
            {'  ·  '}
            {formatShortDuration(
              duration
            )}
            {'  ·  '}
            {calories > 0
              ? `${Math.round(
                  calories
                )} kcal`
              : '—'}
          </ThemedText>
        </View>

        <ThemedText
          style={styles.chevron}
        >
          ›
        </ThemedText>
      </TouchableOpacity>
    );
  };

  /* ================================================================
     MEASUREMENT ROW
     ================================================================ */

  const MeasurementRow = ({
    label,
    value,
    unit,
  }: {
    label: string;
    value: number | null;
    unit: string;
  }) => {
    if (value == null) {
      return null;
    }

    return (
      <View
        style={
          styles.measurementRow
        }
      >
        <ThemedText
          style={styles.measurementLabel}
        >
          {label}
        </ThemedText>

        <ThemedText
          style={styles.measurementValue}
        >
          {value.toFixed(1)} {unit}
        </ThemedText>
      </View>
    );
  };

  /* ================================================================
     LOADING
     ================================================================ */

  if (loading) {
    return (
      <ThemedView
        style={styles.container}
      >
        <View
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
          />

          <ThemedText
            style={styles.loadingText}
          >
            Loading progress...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  /* ================================================================
     MAIN UI
     ================================================================ */

  return (
    <ThemedView
      style={styles.container}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* HEADER */}

        <ThemedText
          style={styles.brand}
        >
          BHEEMAI
        </ThemedText>

        <ThemedText
          type="title"
          style={styles.header}
        >
          Progress
        </ThemedText>

        {/* ========================================================
            BODY
            ======================================================== */}

        <ThemedText
          style={styles.sectionLabel}
        >
          BODY
        </ThemedText>

        {latestMeasurement ? (
          <ThemedView
            style={styles.heroCard}
          >
            <View>
              <ThemedText
                style={styles.smallLabel}
              >
                Current weight
              </ThemedText>

              <View
                style={
                  styles.weightLine
                }
              >
                <ThemedText
                  style={
                    styles.weightNumber
                  }
                >
                  {latestMeasurement.weight_kg.toFixed(
                    1
                  )}
                </ThemedText>

                <ThemedText
                  style={
                    styles.weightUnit
                  }
                >
                  kg
                </ThemedText>
              </View>
            </View>

            {weightChange !==
              null && (
              <View
                style={
                  styles.changeBadge
                }
              >
                <ThemedText
                  style={
                    weightChange <= 0
                      ? styles.changePositive
                      : styles.changeNegative
                  }
                >
                  {weightChange < 0
                    ? '↓'
                    : weightChange > 0
                    ? '↑'
                    : '—'}{' '}
                  {Math.abs(
                    weightChange
                  ).toFixed(1)}{' '}
                  kg
                </ThemedText>

                <ThemedText
                  style={
                    styles.changeCaption
                  }
                >
                  since first measurement
                </ThemedText>
              </View>
            )}
          </ThemedView>
        ) : (
          <ThemedView
            style={styles.emptyCard}
          >
            <ThemedText
              style={styles.emptyTitle}
            >
              Your progress starts here
            </ThemedText>

            <ThemedText
              style={styles.emptyDescription}
            >
              Add your first body measurement
              to start tracking changes over
              time.
            </ThemedText>
          </ThemedView>
        )}

        {/* WEIGHT TREND */}

        <ThemedView
          style={styles.card}
        >
          <View
            style={
              styles.cardHeaderRow
            }
          >
            <ThemedText
              style={styles.cardTitle}
            >
              Weight trend
            </ThemedText>

            {latestMeasurement && (
              <ThemedText
                style={styles.cardHint}
              >
                {formatDate(
                  latestMeasurement.date
                )}
              </ThemedText>
            )}
          </View>

          {measurements.length <
          2 ? (
            <ThemedText
              style={styles.emptyDescription}
            >
              Add another measurement to
              see your weight trend.
            </ThemedText>
          ) : (
            <View
              style={
                styles.chartContainer
              }
            >
              <LineChart
                data={chartData}
                height={170}
                spacing={60}
                initialSpacing={20}
                endSpacing={20}
                thickness={3}
                color="#F28C18"
                dataPointsColor="#F28C18"
                dataPointsRadius={4}
                yAxisOffset={chartMin}
                maxValue={chartRange}
                noOfSections={4}
                stepValue={chartStep}
                showFractionalValues
                roundToDigits={1}
                yAxisColor="#333333"
                yAxisThickness={1}
                hideYAxisText={false}
                yAxisTextStyle={{
                  fontSize: 10,
                  color: '#8A8A8A',
                }}
                xAxisColor="#333333"
                xAxisThickness={1}
                xAxisLabelTextStyle={{
                  fontSize: 9,
                  color: '#8A8A8A',
                }}
                hideRules={false}
                rulesColor="#242424"
                rulesThickness={1}
                curved
                isAnimated
              />
            </View>
          )}
        </ThemedView>

        {/* LATEST MEASUREMENTS */}

        {latestMeasurement && (
          <ThemedView
            style={styles.card}
          >
            <View
              style={
                styles.cardHeaderRow
              }
            >
              <ThemedText
                style={styles.cardTitle}
              >
                Latest measurements
              </ThemedText>

              <ThemedText
                style={styles.cardHint}
              >
                {formatDate(
                  latestMeasurement.date
                )}
              </ThemedText>
            </View>

            <MeasurementRow
              label="Weight"
              value={
                latestMeasurement.weight_kg
              }
              unit="kg"
            />

            <MeasurementRow
              label="Waist"
              value={
                latestMeasurement.waist_cm
              }
              unit="cm"
            />

            <MeasurementRow
              label="Chest"
              value={
                latestMeasurement.chest_cm
              }
              unit="cm"
            />

            <MeasurementRow
              label="Hips"
              value={
                latestMeasurement.hips_cm
              }
              unit="cm"
            />

            <MeasurementRow
              label="Neck"
              value={
                latestMeasurement.neck_cm
              }
              unit="cm"
            />
          </ThemedView>
        )}

        {/* ADD MEASUREMENT */}

        <TouchableOpacity
          style={
            styles.outlineButton
          }
          onPress={() =>
            setShowMeasurementForm(
              !showMeasurementForm
            )
          }
        >
          <ThemedText
            style={
              styles.outlineButtonText
            }
          >
            {showMeasurementForm
              ? 'Cancel'
              : '+ Add Measurement'}
          </ThemedText>
        </TouchableOpacity>

        {/* MEASUREMENT FORM */}

        {showMeasurementForm && (
          <ThemedView
            style={styles.formCard}
          >
            <ThemedText
              style={styles.cardTitle}
            >
              Add measurement
            </ThemedText>

            <ThemedText
              style={styles.inputLabel}
            >
              Date
            </ThemedText>

            <TextInput
              style={styles.input}
              value={measurementDate}
              onChangeText={
                setMeasurementDate
              }
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#777"
            />

            <ThemedText
              style={styles.inputLabel}
            >
              Weight (kg) *
            </ThemedText>

            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="67.0"
              placeholderTextColor="#777"
              keyboardType="decimal-pad"
            />

            <ThemedText
              style={styles.inputLabel}
            >
              Waist (cm)
            </ThemedText>

            <TextInput
              style={styles.input}
              value={waist}
              onChangeText={setWaist}
              placeholder="Optional"
              placeholderTextColor="#777"
              keyboardType="decimal-pad"
            />

            <ThemedText
              style={styles.inputLabel}
            >
              Chest (cm)
            </ThemedText>

            <TextInput
              style={styles.input}
              value={chest}
              onChangeText={setChest}
              placeholder="Optional"
              placeholderTextColor="#777"
              keyboardType="decimal-pad"
            />

            <ThemedText
              style={styles.inputLabel}
            >
              Hips (cm)
            </ThemedText>

            <TextInput
              style={styles.input}
              value={hips}
              onChangeText={setHips}
              placeholder="Optional"
              placeholderTextColor="#777"
              keyboardType="decimal-pad"
            />

            <ThemedText
              style={styles.inputLabel}
            >
              Neck (cm)
            </ThemedText>

            <TextInput
              style={styles.input}
              value={neck}
              onChangeText={setNeck}
              placeholder="Optional"
              placeholderTextColor="#777"
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              style={
                styles.primaryButton
              }
              onPress={saveMeasurement}
            >
              <ThemedText
                style={
                  styles.primaryButtonText
                }
              >
                Save Measurement
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}

        {measurements.length > 0 && (
          <TouchableOpacity
            style={
              styles.secondaryAction
            }
            onPress={() =>
              setShowMeasurementHistory(
                true
              )
            }
          >
            <ThemedText
              style={
                styles.secondaryActionText
              }
            >
              View Measurement History
              <ThemedText
                style={
                  styles.secondaryActionArrow
                }
              >
                {'  ›'}
              </ThemedText>
            </ThemedText>
          </TouchableOpacity>
        )}

        {/* ========================================================
            WORKOUT
            ======================================================== */}

        <ThemedText
          style={styles.sectionLabel}
        >
          WORKOUT
        </ThemedText>

        <View
          style={styles.statsGrid}
        >
          <View
            style={styles.statCard}
          >
            <ThemedText
              style={styles.statNumber}
            >
              {history.length}
            </ThemedText>

            <ThemedText
              style={styles.statLabel}
            >
              Workouts completed
            </ThemedText>
          </View>

          <View
            style={styles.statCard}
          >
            <ThemedText
              style={styles.statNumber}
            >
              {Math.floor(
                workoutStats.activeSeconds /
                  3600
              ) > 0
                ? `${Math.floor(
                    workoutStats.activeSeconds /
                      3600
                  )}h ${Math.floor(
                    (workoutStats.activeSeconds %
                      3600) /
                      60
                  )}m`
                : `${Math.floor(
                    workoutStats.activeSeconds /
                      60
                  )}m`}
            </ThemedText>

            <ThemedText
              style={styles.statLabel}
            >
              Active time
            </ThemedText>
          </View>

          <View
            style={styles.statCard}
          >
            <ThemedText
              style={styles.statNumber}
            >
              {Math.round(
                workoutStats.calories
              )}
            </ThemedText>

            <ThemedText
              style={styles.statLabel}
            >
              Calories
            </ThemedText>
          </View>

          <View
            style={styles.statCard}
          >
            <ThemedText
              style={styles.statNumber}
            >
              {currentStreak}
            </ThemedText>

            <ThemedText
              style={styles.statLabel}
            >
              Day streak
            </ThemedText>
          </View>
        </View>

        {/* ========================================================
            RECENT WORKOUTS
            ======================================================== */}

        <View
          style={
            styles.sectionHeaderRow
          }
        >
          <ThemedText
            style={styles.sectionLabel}
          >
            RECENT WORKOUTS
          </ThemedText>

          {history.length > 3 && (
            <TouchableOpacity
              onPress={() =>
                setShowAllWorkoutHistory(
                  true
                )
              }
            >
              <ThemedText
                style={
                  styles.viewAllTop
                }
              >
                View all
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {recentWorkouts.length > 0 ? (
          recentWorkouts.map(
            renderRecentWorkout
          )
        ) : (
          <ThemedView
            style={styles.emptyCard}
          >
            <ThemedText
              style={styles.emptyTitle}
            >
              No workouts completed yet
            </ThemedText>

            <ThemedText
              style={styles.emptyDescription}
            >
              Complete your first workout and
              your training history will appear
              here.
            </ThemedText>
          </ThemedView>
        )}

        {history.length > 3 && (
          <TouchableOpacity
            style={
              styles.historyButton
            }
            onPress={() =>
              setShowAllWorkoutHistory(
                true
              )
            }
          >
            <ThemedText
              style={
                styles.historyButtonText
              }
            >
              View All Workout History
              {'  ›'}
            </ThemedText>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ============================================================
          ALL WORKOUT HISTORY MODAL
          ============================================================ */}

      <Modal
        visible={
          showAllWorkoutHistory
        }
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setShowAllWorkoutHistory(
            false
          )
        }
      >
        <ThemedView
          style={
            styles.modalContainer
          }
        >
          <View
            style={
              styles.modalHeader
            }
          >
            <View>
              <ThemedText
                style={
                  styles.brand
                }
              >
                BHEEMAI
              </ThemedText>

              <ThemedText
                type="title"
                style={
                  styles.modalTitle
                }
              >
                Workout History
              </ThemedText>
            </View>

            <TouchableOpacity
              style={
                styles.closeButton
              }
              onPress={() =>
                setShowAllWorkoutHistory(
                  false
                )
              }
            >
              <ThemedText
                style={
                  styles.closeButtonText
                }
              >
                Done
              </ThemedText>
            </TouchableOpacity>
          </View>

          <FlatList
            data={history}
            keyExtractor={(item) =>
              String(item.id)
            }
            contentContainerStyle={
              styles.modalList
            }
            renderItem={({ item }) => {
              const plan =
                parseWorkout(
                  item.workout_json
                );

              const summary =
                plan?.sessionSummary;

              return (
                <TouchableOpacity
                  style={
                    styles.workoutCard
                  }
                  activeOpacity={0.75}
                  onPress={() => {
                    setShowAllWorkoutHistory(
                      false
                    );

                    router.push({
                      pathname:
                        '/workout-details',
                      params: {
                        id: String(
                          item.id
                        ),
                      },
                    });
                  }}
                >
                  <View
                    style={
                      styles.workoutCardMain
                    }
                  >
                    <ThemedText
                      style={
                        styles.workoutTitle
                      }
                      numberOfLines={1}
                    >
                      {plan?.title ||
                        'Workout'}
                    </ThemedText>

                    <ThemedText
                      style={
                        styles.workoutMeta
                      }
                    >
                      {formatDate(
                        item.date
                      )}
                      {'  ·  '}
                      {formatShortDuration(
                        summary?.totalSeconds
                      )}
                      {'  ·  '}
                      {Number(
                        summary?.calories
                      ) > 0
                        ? `${Math.round(
                            Number(
                              summary?.calories
                            )
                          )} kcal`
                        : '—'}
                    </ThemedText>
                  </View>

                  <ThemedText
                    style={
                      styles.chevron
                    }
                  >
                    ›
                  </ThemedText>
                </TouchableOpacity>
              );
            }}
          />
        </ThemedView>
      </Modal>

      {/* ============================================================
          MEASUREMENT HISTORY MODAL
          ============================================================ */}

      <Modal
        visible={
          showMeasurementHistory
        }
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setShowMeasurementHistory(
            false
          )
        }
      >
        <ThemedView
          style={
            styles.modalContainer
          }
        >
          <View
            style={
              styles.modalHeader
            }
          >
            <View>
              <ThemedText
                style={
                  styles.brand
                }
              >
                BHEEMAI
              </ThemedText>

              <ThemedText
                type="title"
                style={
                  styles.modalTitle
                }
              >
                Measurement History
              </ThemedText>
            </View>

            <TouchableOpacity
              style={
                styles.closeButton
              }
              onPress={() =>
                setShowMeasurementHistory(
                  false
                )
              }
            >
              <ThemedText
                style={
                  styles.closeButtonText
                }
              >
                Done
              </ThemedText>
            </TouchableOpacity>
          </View>

          <FlatList
            data={measurements}
            keyExtractor={(item) =>
              String(item.id)
            }
            contentContainerStyle={
              styles.modalList
            }
            renderItem={({ item }) => (
              <ThemedView
                style={
                  styles.measurementHistoryCard
                }
              >
                <View
                  style={
                    styles.cardHeaderRow
                  }
                >
                  <ThemedText
                    style={
                      styles.cardTitle
                    }
                  >
                    {formatDate(
                      item.date
                    )}
                  </ThemedText>
                </View>

                <MeasurementRow
                  label="Weight"
                  value={
                    item.weight_kg
                  }
                  unit="kg"
                />

                <MeasurementRow
                  label="Waist"
                  value={
                    item.waist_cm
                  }
                  unit="cm"
                />

                <MeasurementRow
                  label="Chest"
                  value={
                    item.chest_cm
                  }
                  unit="cm"
                />

                <MeasurementRow
                  label="Hips"
                  value={
                    item.hips_cm
                  }
                  unit="cm"
                />

                <MeasurementRow
                  label="Neck"
                  value={
                    item.neck_cm
                  }
                  unit="cm"
                />
              </ThemedView>
            )}
          />
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

/* ================================================================
   STYLES
   ================================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 50,
  },

  brand: {
    color: '#F28C18',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3.5,
    marginBottom: 8,
  },

  header: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    marginBottom: 30,
  },

  sectionLabel: {
    color: '#F28C18',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 12,
  },

  heroCard: {
    backgroundColor: '#17130D',
    borderWidth: 1,
    borderColor: '#3A2B17',
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  smallLabel: {
    opacity: 0.55,
    fontSize: 13,
    marginBottom: 5,
  },

  weightLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  weightNumber: {
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 44,
  },

  weightUnit: {
    fontSize: 17,
    marginLeft: 5,
    opacity: 0.6,
  },

  changeBadge: {
    alignItems: 'flex-end',
  },

  changePositive: {
    color: '#F28C18',
    fontSize: 17,
    fontWeight: '800',
  },

  changeNegative: {
    color: '#D85C5C',
    fontSize: 17,
    fontWeight: '800',
  },

  changeCaption: {
    fontSize: 10,
    opacity: 0.45,
    marginTop: 3,
  },

  card: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 17,
    padding: 17,
    marginBottom: 12,
  },

  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },

  cardHint: {
    fontSize: 11,
    opacity: 0.42,
  },

  chartContainer: {
    marginTop: 8,
    marginLeft: -4,
    paddingRight: 4,
  },

  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },

  measurementLabel: {
    fontSize: 14,
    opacity: 0.62,
  },

  measurementValue: {
    fontSize: 14,
    fontWeight: '700',
  },

  emptyCard: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 17,
    padding: 18,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 5,
  },

  emptyDescription: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.55,
  },

  outlineButton: {
    borderWidth: 1,
    borderColor: '#F28C18',
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  outlineButtonText: {
    color: '#F28C18',
    fontSize: 14,
    fontWeight: '800',
  },

  formCard: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 17,
    padding: 17,
    marginBottom: 12,
  },

  inputLabel: {
    fontSize: 12,
    opacity: 0.55,
    marginTop: 13,
    marginBottom: 6,
  },

  input: {
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#303030',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#FFFFFF',
  },

  primaryButton: {
    backgroundColor: '#F28C18',
    borderRadius: 12,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  primaryButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },

  secondaryAction: {
    paddingVertical: 8,
    marginBottom: 8,
  },

  secondaryActionText: {
    color: '#F28C18',
    fontSize: 13,
    fontWeight: '700',
  },

  secondaryActionArrow: {
    color: '#F28C18',
    fontSize: 18,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  statCard: {
    width: '48%',
    minHeight: 96,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 16,
    padding: 15,
    justifyContent: 'center',
  },

  statNumber: {
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 5,
  },

  statLabel: {
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.48,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  viewAllTop: {
    color: '#F28C18',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },

  workoutCard: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 16,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },

  workoutCardMain: {
    flex: 1,
    minWidth: 0,
  },

  workoutTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },

  workoutMeta: {
    fontSize: 11,
    opacity: 0.5,
  },

  chevron: {
    color: '#F28C18',
    fontSize: 27,
    fontWeight: '300',
    marginLeft: 10,
  },

  historyButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#303030',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  historyButtonText: {
    color: '#F28C18',
    fontSize: 14,
    fontWeight: '800',
  },

  measurementHistoryCard: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    opacity: 0.5,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    paddingTop: 50,
  },

  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  modalTitle: {
    fontSize: 25,
    fontWeight: '800',
  },

  closeButton: {
    borderWidth: 1,
    borderColor: '#343434',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },

  closeButtonText: {
    color: '#F28C18',
    fontSize: 13,
    fontWeight: '800',
  },

  modalList: {
    padding: 20,
    paddingBottom: 50,
  },
});