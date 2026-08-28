import {
  useEffect,
  useState,
} from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import * as SQLite from 'expo-sqlite';

import {
  ThemedText,
} from '@/components/themed-text';

import {
  ThemedView,
} from '@/components/themed-view';

type WorkoutExercise = {
  name?: string;
  sets?: number | string;
  reps?: string;
  focus?: string;
  description?: string;
};

type WorkoutStep = {
  name?: string;
  seconds?: number;
};

type SessionSummary = {
  totalSeconds?: number;
  activeSeconds?: number;
  restSeconds?: number;
  calories?: number;
};

type WorkoutPlan = {
  title?: string;
  warmup?: WorkoutStep[];
  exercises?: WorkoutExercise[];
  cooldown?: WorkoutStep[];
  sessionSummary?: SessionSummary | null;
};

type HistoryRow = {
  id: number;
  date: string;
  workout_json: string;
};

/* ================================================================
   HELPERS
   ================================================================ */

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

  const total =
    Math.floor(Number(seconds));

  const minutes =
    Math.floor(total / 60);

  const remainingSeconds =
    total % 60;

  return `${minutes} min ${String(
    remainingSeconds
  ).padStart(2, '0')} sec`;
}

function formatDate(
  dateString: string
): string {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return dateString;
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );
}

/* ================================================================
   SCREEN
   ================================================================ */

export default function WorkoutDetailsScreen() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      id?: string;
    }>();

  const [historyRow, setHistoryRow] =
    useState<HistoryRow | null>(
      null
    );

  const [workout, setWorkout] =
    useState<WorkoutPlan | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [repeating, setRepeating] =
    useState(false);

  /* ================================================================
     LOAD WORKOUT
     ================================================================ */

  useEffect(() => {
    const loadWorkout =
      async () => {
        if (!params.id) {
          setLoading(false);
          return;
        }

        try {
          const db =
            await SQLite.openDatabaseAsync(
              'atlas.db'
            );

          const row =
            await db.getFirstAsync<HistoryRow>(
              `SELECT
                id,
                date,
                workout_json
               FROM workout_history
               WHERE id = ?`,
              Number(params.id)
            );

          if (!row) {
            setLoading(false);
            return;
          }

          let parsed: WorkoutPlan;

          try {
            parsed =
              JSON.parse(
                row.workout_json
              );
          } catch {
            Alert.alert(
              'Workout unavailable',
              'This workout could not be read.'
            );

            setLoading(false);
            return;
          }

          setHistoryRow(row);
          setWorkout(parsed);
        } catch (error) {
          console.error(
            'Failed to load workout details:',
            error
          );

          Alert.alert(
            'Error',
            'Could not load this workout.'
          );
        } finally {
          setLoading(false);
        }
      };

    loadWorkout();
  }, [params.id]);

  /* ================================================================
     REPEAT WORKOUT
     ================================================================ */

  const repeatWorkout =
    async () => {
      if (!workout) {
        return;
      }

      setRepeating(true);

      try {
        /*
         * IMPORTANT:
         *
         * We use the already stored workout.
         * Gemini is NOT called.
         */

        router.push({
          pathname:
            '/(tabs)/workout',
          params: {
            repeatWorkout:
              JSON.stringify(
                workout
              ),
          },
        });
      } catch (error) {
        console.error(
          'Failed to repeat workout:',
          error
        );

        Alert.alert(
          'Unable to repeat workout',
          'Please return to the Workout tab and try again.'
        );
      } finally {
        setRepeating(false);
      }
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
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
          />

          <ThemedText
            style={
              styles.loadingText
            }
          >
            Loading workout...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  /* ================================================================
     NOT FOUND
     ================================================================ */

  if (
    !historyRow ||
    !workout
  ) {
    return (
      <ThemedView
        style={styles.container}
      >
        <View
          style={
            styles.notFoundContainer
          }
        >
          <ThemedText
            style={
              styles.notFoundTitle
            }
          >
            Workout not found
          </ThemedText>

          <ThemedText
            style={
              styles.notFoundText
            }
          >
            This workout is no longer
            available in your history.
          </ThemedText>

          <TouchableOpacity
            style={
              styles.primaryButton
            }
            onPress={() =>
              router.back()
            }
          >
            <ThemedText
              style={
                styles.primaryButtonText
              }
            >
              Back to Progress
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const summary =
    workout.sessionSummary;

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
          styles.content
        }
      >
        {/* HEADER */}

        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          style={styles.backButton}
        >
          <ThemedText
            style={
              styles.backButtonText
            }
          >
            ‹ Progress
          </ThemedText>
        </TouchableOpacity>

        <ThemedText
          style={styles.brand}
        >
          BHEEMAI
        </ThemedText>

        <ThemedText
          style={styles.title}
        >
          {workout.title ||
            'Workout'}
        </ThemedText>

        <ThemedText
          style={styles.date}
        >
          {formatDate(
            historyRow.date
          )}
        </ThemedText>

        {/* ========================================================
            SESSION
            ======================================================== */}

        <ThemedText
          style={styles.sectionLabel}
        >
          SESSION
        </ThemedText>

        <View
          style={styles.statsGrid}
        >
          <View
            style={styles.statCard}
          >
            <ThemedText
              style={
                styles.statValue
              }
            >
              {formatDuration(
                summary?.totalSeconds
              )}
            </ThemedText>

            <ThemedText
              style={styles.statLabel}
            >
              Total time
            </ThemedText>
          </View>

          <View
            style={styles.statCard}
          >
            <ThemedText
              style={
                styles.statValue
              }
            >
              {formatDuration(
                summary?.activeSeconds
              )}
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
              style={
                styles.statValue
              }
            >
              {formatDuration(
                summary?.restSeconds
              )}
            </ThemedText>

            <ThemedText
              style={styles.statLabel}
            >
              Rest time
            </ThemedText>
          </View>

          <View
            style={styles.statCard}
          >
            <ThemedText
              style={
                styles.statValue
              }
            >
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

            <ThemedText
              style={styles.statLabel}
            >
              Calories
            </ThemedText>
          </View>
        </View>

        {/* ========================================================
            WARM-UP
            ======================================================== */}

        {workout.warmup &&
          workout.warmup.length >
            0 && (
            <>
              <ThemedText
                style={
                  styles.sectionLabel
                }
              >
                WARM-UP
              </ThemedText>

              <ThemedView
                style={styles.card}
              >
                {workout.warmup.map(
                  (
                    step,
                    index
                  ) => (
                    <View
                      key={index}
                      style={
                        styles.stepRow
                      }
                    >
                      <View
                        style={
                          styles.stepNumber
                        }
                      >
                        <ThemedText
                          style={
                            styles.stepNumberText
                          }
                        >
                          {index +
                            1}
                        </ThemedText>
                      </View>

                      <ThemedText
                        style={
                          styles.stepName
                        }
                      >
                        {step.name ||
                          'Warm-up'}
                      </ThemedText>

                      <ThemedText
                        style={
                          styles.stepTime
                        }
                      >
                        {step.seconds
                          ? `${step.seconds}s`
                          : '—'}
                      </ThemedText>
                    </View>
                  )
                )}
              </ThemedView>
            </>
          )}

        {/* ========================================================
            EXERCISES
            ======================================================== */}

        <ThemedText
          style={styles.sectionLabel}
        >
          EXERCISES
        </ThemedText>

        {workout.exercises &&
        workout.exercises.length >
          0 ? (
          workout.exercises.map(
            (
              exercise,
              index
            ) => (
              <ThemedView
                key={index}
                style={
                  styles.exerciseCard
                }
              >
                <View
                  style={
                    styles.exerciseHeader
                  }
                >
                  <View
                    style={
                      styles.exerciseNumber
                    }
                  >
                    <ThemedText
                      style={
                        styles.exerciseNumberText
                      }
                    >
                      {index + 1}
                    </ThemedText>
                  </View>

                  <View
                    style={
                      styles.exerciseHeaderText
                    }
                  >
                    <ThemedText
                      style={
                        styles.exerciseName
                      }
                    >
                      {exercise.name ||
                        'Exercise'}
                    </ThemedText>

                    {exercise.focus && (
                      <ThemedText
                        style={
                          styles.exerciseFocus
                        }
                      >
                        {exercise.focus}
                      </ThemedText>
                    )}
                  </View>
                </View>

                <View
                  style={
                    styles.exerciseStats
                  }
                >
                  <View>
                    <ThemedText
                      style={
                        styles.exerciseStatLabel
                      }
                    >
                      SETS
                    </ThemedText>

                    <ThemedText
                      style={
                        styles.exerciseStatValue
                      }
                    >
                      {exercise.sets ??
                        '—'}
                    </ThemedText>
                  </View>

                  <View>
                    <ThemedText
                      style={
                        styles.exerciseStatLabel
                      }
                    >
                      REPS
                    </ThemedText>

                    <ThemedText
                      style={
                        styles.exerciseStatValue
                      }
                    >
                      {exercise.reps ||
                        '—'}
                    </ThemedText>
                  </View>
                </View>

                {exercise.description && (
                  <ThemedText
                    style={
                      styles.description
                    }
                  >
                    {exercise.description}
                  </ThemedText>
                )}
              </ThemedView>
            )
          )
        ) : (
          <ThemedText
            style={
              styles.notFoundText
            }
          >
            No exercise details are
            available for this workout.
          </ThemedText>
        )}

        {/* ========================================================
            COOL-DOWN
            ======================================================== */}

        {workout.cooldown &&
          workout.cooldown.length >
            0 && (
            <>
              <ThemedText
                style={
                  styles.sectionLabel
                }
              >
                COOL-DOWN
              </ThemedText>

              <ThemedView
                style={styles.card}
              >
                {workout.cooldown.map(
                  (
                    step,
                    index
                  ) => (
                    <View
                      key={index}
                      style={
                        styles.stepRow
                      }
                    >
                      <View
                        style={
                          styles.stepNumber
                        }
                      >
                        <ThemedText
                          style={
                            styles.stepNumberText
                          }
                        >
                          {index +
                            1}
                        </ThemedText>
                      </View>

                      <ThemedText
                        style={
                          styles.stepName
                        }
                      >
                        {step.name ||
                          'Cool-down'}
                      </ThemedText>

                      <ThemedText
                        style={
                          styles.stepTime
                        }
                      >
                        {step.seconds
                          ? `${step.seconds}s`
                          : '—'}
                      </ThemedText>
                    </View>
                  )
                )}
              </ThemedView>
            </>
          )}

        {/* ========================================================
            REPEAT
            ======================================================== */}

        <TouchableOpacity
          style={
            styles.repeatButton
          }
          onPress={repeatWorkout}
          disabled={repeating}
        >
          <ThemedText
            style={
              styles.repeatButtonText
            }
          >
            {repeating
              ? 'Loading Workout...'
              : '↻  Repeat This Workout'}
          </ThemedText>
        </TouchableOpacity>

        <ThemedText
          style={
            styles.repeatNote
          }
        >
          This uses the original completed
          workout. BheemAI will not generate a
          new workout.
        </ThemedText>
      </ScrollView>
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

  content: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 55,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 25,
  },

  backButtonText: {
    color: '#F28C18',
    fontSize: 14,
    fontWeight: '700',
  },

  brand: {
    color: '#F28C18',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3.5,
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '800',
  },

  date: {
    marginTop: 7,
    fontSize: 13,
    opacity: 0.48,
  },

  sectionLabel: {
    color: '#F28C18',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 28,
    marginBottom: 12,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  statCard: {
    width: '48%',
    minHeight: 104,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 16,
    padding: 14,
    justifyContent: 'center',
  },

  statValue: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    marginBottom: 5,
  },

  statLabel: {
    fontSize: 11,
    opacity: 0.45,
  },

  card: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 17,
    padding: 15,
  },

  stepRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },

  stepNumber: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#241A0F',
    borderWidth: 1,
    borderColor: '#5B3B18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  stepNumberText: {
    color: '#F28C18',
    fontSize: 11,
    fontWeight: '800',
  },

  stepName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },

  stepTime: {
    fontSize: 12,
    opacity: 0.5,
    marginLeft: 10,
  },

  exerciseCard: {
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 17,
    padding: 16,
    marginBottom: 10,
  },

  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  exerciseNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F28C18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  exerciseNumberText: {
    color: '#080808',
    fontSize: 13,
    fontWeight: '900',
  },

  exerciseHeaderText: {
    flex: 1,
  },

  exerciseName: {
    fontSize: 16,
    fontWeight: '800',
  },

  exerciseFocus: {
    color: '#F28C18',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },

  exerciseStats: {
    flexDirection: 'row',
    gap: 45,
    marginTop: 17,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },

  exerciseStatLabel: {
    fontSize: 9,
    letterSpacing: 1.3,
    opacity: 0.4,
    marginBottom: 3,
  },

  exerciseStatValue: {
    fontSize: 15,
    fontWeight: '800',
  },

  description: {
    marginTop: 13,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.58,
  },

  repeatButton: {
    backgroundColor: '#F28C18',
    minHeight: 57,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },

  repeatButtonText: {
    color: '#080808',
    fontSize: 16,
    fontWeight: '900',
  },

  repeatNote: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    opacity: 0.38,
    marginTop: 10,
    paddingHorizontal: 20,
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

  notFoundContainer: {
    flex: 1,
    padding: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notFoundTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },

  notFoundText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.5,
    textAlign: 'center',
  },

  primaryButton: {
    backgroundColor: '#F28C18',
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },

  primaryButtonText: {
    color: '#080808',
    fontSize: 15,
    fontWeight: '900',
  },
});