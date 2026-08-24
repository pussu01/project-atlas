import { useState, useCallback } from 'react';
import {
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutPlan } from '@/services/gemini';
import { LineChart } from 'react-native-gifted-charts';

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

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function ProgressScreen() {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showMeasurementForm, setShowMeasurementForm] =
    useState(false);

  const [measurementDate, setMeasurementDate] =
    useState(getTodayString());

  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [hips, setHips] = useState('');
  const [neck, setNeck] = useState('');

  const loadData = async () => {
    setLoading(true);

    try {
      const db = await SQLite.openDatabaseAsync('atlas.db');

      const historyRows = await db.getAllAsync<HistoryRow>(
        'SELECT * FROM workout_history ORDER BY id DESC'
      );

      const measurementRows =
        await db.getAllAsync<MeasurementRow>(
          'SELECT * FROM measurements ORDER BY date DESC, id DESC'
        );

      setHistory(historyRows);
      setMeasurements(measurementRows);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const resetMeasurementForm = () => {
    setMeasurementDate(getTodayString());
    setWeight('');
    setWaist('');
    setChest('');
    setHips('');
    setNeck('');
    setShowMeasurementForm(false);
  };

  const saveMeasurement = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(measurementDate)) {
      Alert.alert(
        'Invalid date',
        'Please enter the date as YYYY-MM-DD.'
      );
      return;
    }

    const weightValue = Number(weight);

    if (!weight.trim() || !Number.isFinite(weightValue)) {
      Alert.alert(
        'Invalid weight',
        'Please enter a valid weight.'
      );
      return;
    }

    if (weightValue < 20 || weightValue > 300) {
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

      const numericValue = Number(value);

      if (!Number.isFinite(numericValue)) {
        Alert.alert(
          'Invalid measurement',
          `${fieldName} must be a number.`
        );
        return false;
      }

      if (numericValue < min || numericValue > max) {
        Alert.alert(
          'Invalid measurement',
          `${fieldName} should be between ${min} and ${max} cm.`
        );
        return false;
      }

      return numericValue;
    };

    const waistValue = parseOptionalMeasurement(
      waist,
      'Waist',
      30,
      200
    );

    if (waistValue === false) {
      return;
    }

    const chestValue = parseOptionalMeasurement(
      chest,
      'Chest',
      30,
      200
    );

    if (chestValue === false) {
      return;
    }

    const hipsValue = parseOptionalMeasurement(
      hips,
      'Hips',
      30,
      200
    );

    if (hipsValue === false) {
      return;
    }

    const neckValue = parseOptionalMeasurement(
      neck,
      'Neck',
      10,
      80
    );

    if (neckValue === false) {
      return;
    }

    try {
      const db = await SQLite.openDatabaseAsync('atlas.db');

      await db.runAsync(
        `INSERT INTO measurements
          (date, weight_kg, waist_cm, chest_cm, hips_cm, neck_cm)
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

  const latestMeasurement =
    measurements.length > 0
      ? measurements[0]
      : null;

  const oldestMeasurement =
    measurements.length > 0
      ? measurements[measurements.length - 1]
      : null;

  const weightChange =
    latestMeasurement &&
    oldestMeasurement &&
    measurements.length >= 2
      ? latestMeasurement.weight_kg -
        oldestMeasurement.weight_kg
      : null;

  /*
   * Chart data
   *
   * Database order:
   * newest -> oldest
   *
   * Chart order:
   * oldest -> newest
   */
  const chartData = [...measurements]
    .reverse()
    .map((measurement) => ({
      value: measurement.weight_kg,
      label: measurement.date.slice(5),
    }));

  /*
   * Dynamic Y-axis scaling.
   *
   * IMPORTANT:
   *
   * react-native-gifted-charts uses:
   *
   *   maxValue = noOfSections * stepValue
   *
   * when yAxisOffset is used.
   *
   * Therefore:
   *
   * chartMin = actual starting value
   * chartRange = chartMax - chartMin
   * chartStep = chartRange / number of sections
   *
   * Example:
   *
   * actual data: 65 - 69 kg
   *
   * chartMin   = 64
   * chartMax   = 70
   * chartRange = 6
   * sections   = 4
   * step       = 1.5
   *
   * Result:
   *
   * 70
   * 68.5
   * 67
   * 65.5
   * 64
   */

  let chartMin = 0;
  let chartRange = 100;
  let chartStep = 25;

  if (measurements.length >= 2) {
    const weights = measurements.map(
      (measurement) => measurement.weight_kg
    );

    const minimumWeight = Math.min(...weights);
    const maximumWeight = Math.max(...weights);

    const weightRange =
      maximumWeight - minimumWeight;

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

    chartRange = chartMax - chartMin;

    if (chartRange <= 0) {
      chartRange = 4;
    }

    chartStep = chartRange / 4;
  }

  const renderWorkoutHistory = ({
    item,
  }: {
    item: HistoryRow;
  }) => {
    let plan: WorkoutPlan | null = null;

    try {
      plan = JSON.parse(item.workout_json);
    } catch {
      plan = null;
    }

    return (
      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">
          {item.date}
        </ThemedText>

        {plan ? (
          <>
            <ThemedText
              type="defaultSemiBold"
              style={{ marginTop: 4 }}
            >
              {plan.title}
            </ThemedText>

            <ThemedText style={styles.preview}>
              {plan.exercises
                .map((e) => e.name)
                .join(', ')}
            </ThemedText>
          </>
        ) : (
          <ThemedText style={styles.preview}>
            (Unreadable old entry)
          </ThemedText>
        )}
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText
        type="title"
        style={styles.header}
      >
        Progress
      </ThemedText>

      {loading ? (
        <ThemedText>
          Loading...
        </ThemedText>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) =>
            item.id.toString()
          }
          contentContainerStyle={
            styles.listContent
          }
          ListHeaderComponent={
            <View>

              {/* ================= BODY PROGRESS ================= */}

              <ThemedText
                type="subtitle"
                style={styles.sectionTitle}
              >
                Body Progress
              </ThemedText>

              {latestMeasurement ? (
                <ThemedView
                  style={styles.bodyCard}
                >
                  <ThemedText
                    style={styles.label}
                  >
                    Current Weight
                  </ThemedText>

                  <ThemedText type="title">
                    {latestMeasurement.weight_kg.toFixed(
                      1
                    )}{' '}
                    kg
                  </ThemedText>

                  {measurements.length >= 2 &&
                    oldestMeasurement && (
                      <View
                        style={
                          styles.weightChangeContainer
                        }
                      >
                        <ThemedText
                          style={styles.label}
                        >
                          Starting Weight
                        </ThemedText>

                        <ThemedText>
                          {oldestMeasurement.weight_kg.toFixed(
                            1
                          )}{' '}
                          kg
                        </ThemedText>

                        <ThemedText
                          style={styles.label}
                        >
                          Change
                        </ThemedText>

                        <ThemedText>
                          {weightChange! >= 0
                            ? '+'
                            : ''}
                          {weightChange!.toFixed(
                            1
                          )}{' '}
                          kg
                        </ThemedText>
                      </View>
                    )}
                </ThemedView>
              ) : (
                <ThemedView
                  style={styles.bodyCard}
                >
                  <ThemedText
                    style={styles.emptyText}
                  >
                    No measurements yet.
                  </ThemedText>

                  <ThemedText
                    style={styles.preview}
                  >
                    Add your first measurement
                    to start tracking your
                    progress.
                  </ThemedText>
                </ThemedView>
              )}

              {/* ================= WEIGHT TREND ================= */}

              <ThemedView
                style={styles.chartCard}
              >
                <ThemedText type="defaultSemiBold">
                  Weight Trend
                </ThemedText>

                {measurements.length < 2 ? (
                  <ThemedText
                    style={styles.preview}
                  >
                    Add another measurement to
                    see your weight trend.
                  </ThemedText>
                ) : (
                  <View
                    style={styles.chartContainer}
                  >
                    <LineChart
                      data={chartData}

                      height={180}

                      spacing={60}
                      initialSpacing={20}
                      endSpacing={20}

                      thickness={3}
                      color="#7DD3FC"
                      dataPointsColor="#7DD3FC"
                      dataPointsRadius={4}

                      /*
                       * Y-axis scaling
                       */
                      yAxisOffset={chartMin}
                      maxValue={chartRange}
                      noOfSections={4}
                      stepValue={chartStep}

                      showFractionalValues
                      roundToDigits={1}

                      /*
                       * Y-axis
                       */
                      yAxisColor="#FFFFFF"
                      yAxisThickness={1}
                      hideYAxisText={false}
                      yAxisTextStyle={{
                        fontSize: 11,
                        color: '#FFFFFF',
                      }}

                      /*
                       * X-axis
                       */
                      xAxisColor="#FFFFFF"
                      xAxisThickness={1}
                      xAxisLabelTextStyle={{
                        fontSize: 10,
                        color: '#FFFFFF',
                      }}

                      /*
                       * Horizontal grid
                       */
                      hideRules={false}
                      rulesColor="#555555"
                      rulesThickness={1}

                      curved
                      isAnimated
                    />
                  </View>
                )}
              </ThemedView>

              {/* ================= LATEST MEASUREMENTS ================= */}

              {latestMeasurement && (
                <ThemedView
                  style={styles.bodyCard}
                >
                  <ThemedText type="defaultSemiBold">
                    Latest Measurements
                  </ThemedText>

                  <View
                    style={styles.measurementRow}
                  >
                    <ThemedText>
                      Weight
                    </ThemedText>

                    <ThemedText>
                      {latestMeasurement.weight_kg.toFixed(
                        1
                      )}{' '}
                      kg
                    </ThemedText>
                  </View>

                  {latestMeasurement.waist_cm !==
                    null && (
                    <View
                      style={
                        styles.measurementRow
                      }
                    >
                      <ThemedText>
                        Waist
                      </ThemedText>

                      <ThemedText>
                        {latestMeasurement.waist_cm.toFixed(
                          1
                        )}{' '}
                        cm
                      </ThemedText>
                    </View>
                  )}

                  {latestMeasurement.chest_cm !==
                    null && (
                    <View
                      style={
                        styles.measurementRow
                      }
                    >
                      <ThemedText>
                        Chest
                      </ThemedText>

                      <ThemedText>
                        {latestMeasurement.chest_cm.toFixed(
                          1
                        )}{' '}
                        cm
                      </ThemedText>
                    </View>
                  )}

                  {latestMeasurement.hips_cm !==
                    null && (
                    <View
                      style={
                        styles.measurementRow
                      }
                    >
                      <ThemedText>
                        Hips
                      </ThemedText>

                      <ThemedText>
                        {latestMeasurement.hips_cm.toFixed(
                          1
                        )}{' '}
                        cm
                      </ThemedText>
                    </View>
                  )}

                  {latestMeasurement.neck_cm !==
                    null && (
                    <View
                      style={
                        styles.measurementRow
                      }
                    >
                      <ThemedText>
                        Neck
                      </ThemedText>

                      <ThemedText>
                        {latestMeasurement.neck_cm.toFixed(
                          1
                        )}{' '}
                        cm
                      </ThemedText>
                    </View>
                  )}
                </ThemedView>
              )}

              {/* ================= ADD MEASUREMENT ================= */}

              <TouchableOpacity
                style={styles.addButton}
                onPress={() =>
                  setShowMeasurementForm(
                    !showMeasurementForm
                  )
                }
              >
                <ThemedText
                  style={styles.addButtonText}
                >
                  {showMeasurementForm
                    ? 'Cancel'
                    : '+ Add Measurement'}
                </ThemedText>
              </TouchableOpacity>

              {showMeasurementForm && (
                <ThemedView
                  style={styles.formCard}
                >
                  <ThemedText type="subtitle">
                    Add Measurement
                  </ThemedText>

                  <ThemedText
                    style={styles.inputLabel}
                  >
                    Date (YYYY-MM-DD)
                  </ThemedText>

                  <TextInput
                    style={styles.input}
                    value={measurementDate}
                    onChangeText={
                      setMeasurementDate
                    }
                    placeholder="2026-08-24"
                    placeholderTextColor="#888"
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
                    placeholderTextColor="#888"
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
                    placeholderTextColor="#888"
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
                    placeholderTextColor="#888"
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
                    placeholderTextColor="#888"
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
                    placeholderTextColor="#888"
                    keyboardType="decimal-pad"
                  />

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={saveMeasurement}
                  >
                    <ThemedText
                      style={
                        styles.saveButtonText
                      }
                    >
                      Save Measurement
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              )}

              {/* ================= MEASUREMENT HISTORY ================= */}

              {measurements.length > 0 && (
                <View>
                  <ThemedText
                    type="subtitle"
                    style={styles.sectionTitle}
                  >
                    Measurement History
                  </ThemedText>

                  {measurements.map(
                    (measurement) => (
                      <ThemedView
                        key={measurement.id}
                        style={
                          styles.measurementCard
                        }
                      >
                        <ThemedText
                          type="defaultSemiBold"
                        >
                          {measurement.date}
                        </ThemedText>

                        <View
                          style={
                            styles.measurementRow
                          }
                        >
                          <ThemedText>
                            Weight
                          </ThemedText>

                          <ThemedText>
                            {measurement.weight_kg.toFixed(
                              1
                            )}{' '}
                            kg
                          </ThemedText>
                        </View>

                        {measurement.waist_cm !==
                          null && (
                          <View
                            style={
                              styles.measurementRow
                            }
                          >
                            <ThemedText>
                              Waist
                            </ThemedText>

                            <ThemedText>
                              {measurement.waist_cm.toFixed(
                                1
                              )}{' '}
                              cm
                            </ThemedText>
                          </View>
                        )}

                        {measurement.chest_cm !==
                          null && (
                          <View
                            style={
                              styles.measurementRow
                            }
                          >
                            <ThemedText>
                              Chest
                            </ThemedText>

                            <ThemedText>
                              {measurement.chest_cm.toFixed(
                                1
                              )}{' '}
                              cm
                            </ThemedText>
                          </View>
                        )}

                        {measurement.hips_cm !==
                          null && (
                          <View
                            style={
                              styles.measurementRow
                            }
                          >
                            <ThemedText>
                              Hips
                            </ThemedText>

                            <ThemedText>
                              {measurement.hips_cm.toFixed(
                                1
                              )}{' '}
                              cm
                            </ThemedText>
                          </View>
                        )}

                        {measurement.neck_cm !==
                          null && (
                          <View
                            style={
                              styles.measurementRow
                            }
                          >
                            <ThemedText>
                              Neck
                            </ThemedText>

                            <ThemedText>
                              {measurement.neck_cm.toFixed(
                                1
                              )}{' '}
                              cm
                            </ThemedText>
                          </View>
                        )}
                      </ThemedView>
                    )
                  )}
                </View>
              )}

              {/* ================= WORKOUT HISTORY ================= */}

              <ThemedText
                type="subtitle"
                style={styles.sectionTitle}
              >
                Workout History
              </ThemedText>

              {history.length === 0 && (
                <ThemedText
                  style={styles.emptyText}
                >
                  No workouts completed yet.
                  Finish one from the Workout tab!
                </ThemedText>
              )}
            </View>
          }
          renderItem={renderWorkoutHistory}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  header: {
    marginBottom: 16,
  },

  listContent: {
    paddingBottom: 30,
    gap: 12,
  },

  sectionTitle: {
    marginTop: 12,
    marginBottom: 10,
  },

  bodyCard: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },

  chartCard: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },

  chartContainer: {
    marginTop: 12,
    marginLeft: 0,
    paddingRight: 10,
  },

  card: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 14,
  },

  measurementCard: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },

  weightChangeContainer: {
    marginTop: 12,
  },

  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  label: {
    opacity: 0.7,
    marginTop: 4,
  },

  preview: {
    marginTop: 6,
    opacity: 0.8,
  },

  emptyText: {
    opacity: 0.8,
  },

  addButton: {
    borderWidth: 1,
    borderColor: '#777',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },

  addButtonText: {
    fontWeight: '600',
  },

  formCard: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },

  inputLabel: {
    marginTop: 14,
    marginBottom: 6,
    opacity: 0.8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#fff',
  },

  saveButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 18,
    backgroundColor: '#2e7d32',
  },

  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});