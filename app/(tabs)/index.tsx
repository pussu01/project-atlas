import { useState, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SQLite from 'expo-sqlite';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type HomeData = {
  name: string;
  workoutsThisWeek: number;
  totalWorkouts: number;
  activeSeconds: number;
  calories: number;
  lastWorkoutDate: string | null;
  lastWorkoutTitle: string | null;
  currentStreak: number;
};

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [data, setData] = useState<HomeData>({
    name: '',
    workoutsThisWeek: 0,
    totalWorkouts: 0,
    activeSeconds: 0,
    calories: 0,
    lastWorkoutDate: null,
    lastWorkoutTitle: null,
    currentStreak: 0,
  });

  const [loading, setLoading] = useState(true);

  const loadHomeData = async () => {
    try {
      const db = await SQLite.openDatabaseAsync('atlas.db');

      // ---------------------------------------------------------------
      // PROFILE
      // ---------------------------------------------------------------

      const profileRow = await db.getFirstAsync<{
        name: string | null;
      }>(
        'SELECT name FROM profile WHERE id = 1'
      );

      const name = profileRow?.name || '';

      // ---------------------------------------------------------------
      // DATE RANGE
      // ---------------------------------------------------------------

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      const sevenDaysAgoStr = toLocalDateString(sevenDaysAgo);

      // ---------------------------------------------------------------
      // WORKOUTS THIS WEEK
      // ---------------------------------------------------------------

      const weekCountRow = await db.getFirstAsync<{
        count: number;
      }>(
        `SELECT COUNT(*) as count
         FROM workout_history
         WHERE date >= ?`,
        [sevenDaysAgoStr]
      );

      const workoutsThisWeek = weekCountRow?.count || 0;

      // ---------------------------------------------------------------
      // TOTAL WORKOUTS
      // ---------------------------------------------------------------

      const totalRow = await db.getFirstAsync<{
        count: number;
      }>(
        `SELECT COUNT(*) as count
         FROM workout_history`
      );

      const totalWorkouts = totalRow?.count || 0;

      // ---------------------------------------------------------------
      // ACTIVE TIME
      // ---------------------------------------------------------------

      const activeRow = await db.getFirstAsync<{
        total: number | null;
      }>(
        `SELECT SUM(COALESCE(active_seconds, 0)) as total
         FROM workout_history`
      );

      const activeSeconds = activeRow?.total || 0;

      // ---------------------------------------------------------------
      // CALORIES
      // ---------------------------------------------------------------

      const caloriesRow = await db.getFirstAsync<{
        total: number | null;
      }>(
        `SELECT SUM(COALESCE(calories, 0)) as total
         FROM workout_history`
      );

      const calories = caloriesRow?.total || 0;

      // ---------------------------------------------------------------
      // LAST WORKOUT
      // ---------------------------------------------------------------

      const lastRow = await db.getFirstAsync<{
        date: string;
        workout_json: string;
      }>(
        `SELECT date, workout_json
         FROM workout_history
         ORDER BY id DESC
         LIMIT 1`
      );

      let lastWorkoutTitle: string | null = null;

      if (lastRow?.workout_json) {
        try {
          const parsed = JSON.parse(lastRow.workout_json);
          lastWorkoutTitle = parsed?.title || 'Workout';
        } catch {
          lastWorkoutTitle = 'Workout';
        }
      }

      // ---------------------------------------------------------------
      // STREAK
      // ---------------------------------------------------------------

      const workoutRows = await db.getAllAsync<{
        date: string;
      }>(
        `SELECT date
         FROM workout_history
         ORDER BY date DESC`
      );

      const uniqueDates = Array.from(
        new Set(
          workoutRows
            .map((row) => normalizeDate(row.date))
            .filter(Boolean)
        )
      );

      const currentStreak = calculateCurrentStreak(uniqueDates);

      setData({
        name,
        workoutsThisWeek,
        totalWorkouts,
        activeSeconds,
        calories,
        lastWorkoutDate: lastRow?.date || null,
        lastWorkoutTitle,
        currentStreak,
      });
    } catch (error) {
      console.error('Failed to load home data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
    }, [])
  );

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';

    return 'Good evening';
  };

  const displayName = data.name
    ? `${getGreeting()}, ${data.name}`
    : getGreeting();

  /*
   * Weekly goal is 5 workouts.
   *
   * The actual number is always shown.
   * The visual bar is capped at 100%.
   */
  const weeklyProgress = Math.min(
    data.workoutsThisWeek / 5,
    1
  );

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <ThemedText style={styles.loadingText}>
          Loading BheemAI...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: width < 380 ? 16 : 20,
          },
        ]}
      >

        {/* ===========================================================
            HEADER
        =========================================================== */}

        <View style={styles.header}>

          <View style={styles.headerText}>
            <ThemedText style={styles.brand}>
              BHEEMAI
            </ThemedText>

            <ThemedText
              type="title"
              style={styles.greeting}
            >
              {displayName}
            </ThemedText>

            <ThemedText style={styles.subtitle}>
              Train smart. Get stronger.
            </ThemedText>
          </View>

          {/* IMPORTANT:
              Absolute positioning prevents the B logo
              from being pushed outside the screen.
          */}

          <View style={styles.brandMark}>
            <ThemedText style={styles.brandMarkText}>
              B
            </ThemedText>
          </View>

        </View>


        {/* ===========================================================
            TODAY'S MISSION
        =========================================================== */}

        <View style={styles.missionCard}>

          <View style={styles.missionHeader}>

            <ThemedText style={styles.missionLabel}>
              TODAY'S MISSION
            </ThemedText>

            <View style={styles.aiBadge}>
              <ThemedText style={styles.aiBadgeText}>
                AI
              </ThemedText>
            </View>

          </View>

          <ThemedText style={styles.missionTitle}>
            Ready to train?
          </ThemedText>

          <ThemedText style={styles.missionText}>
            BheemAI will build today's workout around your
            goals, equipment, recent training and available
            time.
          </ThemedText>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() =>
              router.push('/(tabs)/workout')
            }
          >
            <ThemedText style={styles.primaryButtonText}>
              Generate Today's Workout
            </ThemedText>
          </TouchableOpacity>

        </View>


        {/* ===========================================================
            YOUR PROGRESS
        =========================================================== */}

        <ThemedText style={styles.sectionTitle}>
          YOUR PROGRESS
        </ThemedText>

        <View style={styles.statsGrid}>

          {/* STREAK */}

          <View style={styles.statCard}>
            <ThemedText style={styles.statIcon}>
              🔥
            </ThemedText>

            <ThemedText style={styles.statNumber}>
              {data.currentStreak}
            </ThemedText>

            <ThemedText style={styles.statLabel}>
              Day streak
            </ThemedText>
          </View>


          {/* WORKOUTS */}

          <View style={styles.statCard}>
            <ThemedText style={styles.statIcon}>
              💪
            </ThemedText>

            <ThemedText style={styles.statNumber}>
              {data.totalWorkouts}
            </ThemedText>

            <ThemedText style={styles.statLabel}>
              Workouts
            </ThemedText>
          </View>


          {/* ACTIVE TIME */}

          <View style={styles.statCard}>
            <ThemedText style={styles.statIcon}>
              ⏱
            </ThemedText>

            <ThemedText style={styles.statNumber}>
              {formatHours(data.activeSeconds)}
            </ThemedText>

            <ThemedText style={styles.statLabel}>
              Active time
            </ThemedText>
          </View>


          {/* CALORIES */}

          <View style={styles.statCard}>
            <ThemedText style={styles.statIcon}>
              ⚡
            </ThemedText>

            <ThemedText style={styles.statNumber}>
              {Math.round(data.calories).toLocaleString()}
            </ThemedText>

            <ThemedText style={styles.statLabel}>
              Calories
            </ThemedText>
          </View>

        </View>


        {/* ===========================================================
            THIS WEEK
        =========================================================== */}

        <View style={styles.weekCard}>

          <View style={styles.weekInfo}>

            <ThemedText style={styles.weekLabel}>
              THIS WEEK
            </ThemedText>

            <ThemedText style={styles.weekNumber}>
              {data.workoutsThisWeek}
            </ThemedText>

            <ThemedText style={styles.weekDescription}>
              {data.workoutsThisWeek === 1
                ? 'workout completed'
                : 'workouts completed'}
            </ThemedText>

          </View>


          <View style={styles.weekProgressContainer}>

            <View style={styles.weekProgressTrack}>

              <View
                style={[
                  styles.weekProgressFill,
                  {
                    width: `${weeklyProgress * 100}%`,
                  },
                ]}
              />

            </View>

            <ThemedText style={styles.weekGoal}>
              Goal: 5 workouts
            </ThemedText>

          </View>

        </View>


        {/* ===========================================================
            LAST WORKOUT
        =========================================================== */}

        {data.lastWorkoutDate ? (
          <>
            <ThemedText style={styles.sectionTitle}>
              LAST WORKOUT
            </ThemedText>

            <TouchableOpacity
              style={styles.lastWorkoutCard}
              activeOpacity={0.8}
              onPress={() =>
                router.push('/(tabs)/progress')
              }
            >

              <View style={styles.lastWorkoutIcon}>
                <ThemedText
                  style={styles.lastWorkoutIconText}
                >
                  ✓
                </ThemedText>
              </View>

              <View style={styles.lastWorkoutContent}>

                <ThemedText
                  style={styles.lastWorkoutTitle}
                  numberOfLines={2}
                >
                  {data.lastWorkoutTitle || 'Workout'}
                </ThemedText>

                <ThemedText style={styles.lastWorkoutDate}>
                  {formatRelativeDate(
                    data.lastWorkoutDate
                  )}
                </ThemedText>

              </View>

              <ThemedText style={styles.arrow}>
                ›
              </ThemedText>

            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyWorkoutCard}>

            <ThemedText style={styles.emptyWorkoutTitle}>
              Your first workout is waiting.
            </ThemedText>

            <ThemedText style={styles.emptyWorkoutText}>
              Complete your first session and your progress
              will appear here.
            </ThemedText>

          </View>
        )}


        {/* ===========================================================
            AI COACH
        =========================================================== */}

        <View style={styles.coachCard}>

          <View style={styles.coachIcon}>
            <ThemedText style={styles.coachIconText}>
              B
            </ThemedText>
          </View>

          <View style={styles.coachContent}>

            <ThemedText style={styles.coachTitle}>
              Your AI Coach
            </ThemedText>

            <ThemedText style={styles.coachText}>
              Your workouts adapt to your history, recovery,
              measurements, equipment and goals.
            </ThemedText>

          </View>

        </View>


        {/* ===========================================================
            PROFILE SETUP
        =========================================================== */}

        {!data.name && (
          <TouchableOpacity
            style={styles.setupCard}
            activeOpacity={0.8}
            onPress={() =>
              router.push('/(tabs)/profile')
            }
          >

            <View style={styles.setupContent}>

              <ThemedText style={styles.setupTitle}>
                Complete your profile
              </ThemedText>

              <ThemedText style={styles.setupText}>
                Add your goals, equipment and training
                preferences for more personalized workouts.
              </ThemedText>

            </View>

            <ThemedText style={styles.setupArrow}>
              ›
            </ThemedText>

          </TouchableOpacity>
        )}


        {/* FOOTER */}

        <ThemedText style={styles.footerText}>
          BheemAI · Free AI Fitness Coach
        </ThemedText>

      </ScrollView>
    </ThemedView>
  );
}


/* =====================================================================
   HELPERS
===================================================================== */

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}


function normalizeDate(dateString: string): string {
  if (!dateString) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  const parsed = new Date(dateString);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return toLocalDateString(parsed);
}


function calculateCurrentStreak(
  dates: string[]
): number {

  if (dates.length === 0) {
    return 0;
  }

  const uniqueDates = Array.from(
    new Set(dates)
  ).sort((a, b) => b.localeCompare(a));

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const todayString =
    toLocalDateString(today);

  const yesterday = new Date(today);

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  const yesterdayString =
    toLocalDateString(yesterday);

  if (
    uniqueDates[0] !== todayString &&
    uniqueDates[0] !== yesterdayString
  ) {
    return 0;
  }

  let streak = 0;

  let expectedDate =
    uniqueDates[0] === todayString
      ? new Date(today)
      : new Date(yesterday);

  for (const dateString of uniqueDates) {

    const expectedString =
      toLocalDateString(expectedDate);

    if (dateString !== expectedString) {
      break;
    }

    streak++;

    expectedDate.setDate(
      expectedDate.getDate() - 1
    );
  }

  return streak;
}


function formatHours(
  seconds: number
): string {

  if (!seconds || seconds <= 0) {
    return '0m';
  }

  const hours = Math.floor(
    seconds / 3600
  );

  const minutes = Math.floor(
    (seconds % 3600) / 60
  );

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}


function formatRelativeDate(
  dateStr: string
): string {

  const normalized =
    normalizeDate(dateStr);

  if (!normalized) {
    return dateStr;
  }

  const [
    year,
    month,
    day,
  ] = normalized
    .split('-')
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  const today = new Date();

  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (today.getTime() -
      date.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return 'Today';
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (
    diffDays > 1 &&
    diffDays < 7
  ) {
    return `${diffDays} days ago`;
  }

  if (
    diffDays >= 7 &&
    diffDays < 14
  ) {
    return 'Last week';
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );
}


/* =====================================================================
   STYLES
===================================================================== */

const styles = StyleSheet.create({

  container: {
    flex: 1,
  },

  content: {
    paddingTop: 54,
    paddingBottom: 42,
  },


  /* ================================================================
     LOADING
  ================================================================ */

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 12,
    opacity: 0.6,
  },


  /* ================================================================
     HEADER
  ================================================================ */

  header: {
    minHeight: 150,
    position: 'relative',
    marginBottom: 20,
  },

  /*
   * The text gets its own width.
   * This prevents the long greeting from pushing
   * the B logo outside the screen.
   */

  headerText: {
    paddingRight: 68,
  },

  brand: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3.5,
    color: '#F28C18',
    marginBottom: 10,
  },

  greeting: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '800',
    marginBottom: 7,
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.58,
  },

  brandMark: {
    position: 'absolute',
    right: 0,
    top: 0,

    width: 48,
    height: 48,

    borderRadius: 14,

    backgroundColor: '#F28C18',

    alignItems: 'center',
    justifyContent: 'center',
  },

  brandMarkText: {
    color: '#080808',
    fontSize: 27,
    fontWeight: '900',
  },


  /* ================================================================
     TODAY'S MISSION
  ================================================================ */

  missionCard: {
    backgroundColor: '#151515',

    borderRadius: 20,

    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,

    marginBottom: 28,

    borderWidth: 1,
    borderColor: '#292929',
  },

  missionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    marginBottom: 16,
  },

  missionLabel: {
    color: '#F28C18',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },

  aiBadge: {
    width: 44,
    height: 44,

    borderWidth: 1,
    borderColor: '#F28C18',

    borderRadius: 10,

    alignItems: 'center',
    justifyContent: 'center',
  },

  aiBadgeText: {
    color: '#F28C18',
    fontSize: 12,
    fontWeight: '800',
  },

  missionTitle: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',

    marginBottom: 8,
  },

  missionText: {
    fontSize: 15,
    lineHeight: 22,

    opacity: 0.63,

    marginBottom: 20,
  },

  primaryButton: {
    backgroundColor: '#F28C18',

    borderRadius: 13,

    minHeight: 58,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 14,
  },

  primaryButtonText: {
    color: '#080808',

    fontSize: 16,
    fontWeight: '800',

    textAlign: 'center',
  },


  /* ================================================================
     SECTION HEADINGS
  ================================================================ */

  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.7,

    opacity: 0.52,

    marginBottom: 12,
  },


  /* ================================================================
     PROGRESS STATS
  ================================================================ */

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',

    justifyContent: 'space-between',

    marginBottom: 24,
  },

  statCard: {
    width: '48.2%',

    minHeight: 126,

    borderRadius: 17,

    borderWidth: 1,
    borderColor: '#292929',

    padding: 16,

    justifyContent: 'center',

    marginBottom: 10,
  },

  statIcon: {
    fontSize: 21,

    marginBottom: 5,
  },

  statNumber: {
    fontSize: 27,
    lineHeight: 31,

    fontWeight: '800',

    marginBottom: 4,
  },

  statLabel: {
    fontSize: 13,

    opacity: 0.53,
  },


  /* ================================================================
     THIS WEEK
  ================================================================ */

  weekCard: {
    minHeight: 135,

    borderRadius: 18,

    borderWidth: 1,
    borderColor: '#292929',

    paddingHorizontal: 18,
    paddingVertical: 18,

    marginBottom: 28,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  weekInfo: {
    flex: 1,

    minWidth: 105,
  },

  weekLabel: {
    fontSize: 12,

    fontWeight: '800',

    letterSpacing: 1.5,

    opacity: 0.5,

    marginBottom: 3,
  },

  weekNumber: {
    fontSize: 36,

    lineHeight: 40,

    fontWeight: '900',
  },

  weekDescription: {
    fontSize: 13,

    opacity: 0.55,
  },

  weekProgressContainer: {
    width: '48%',

    alignItems: 'flex-end',

    paddingTop: 10,
  },

  weekProgressTrack: {
    width: '100%',

    height: 9,

    backgroundColor: '#333333',

    borderRadius: 10,

    overflow: 'hidden',

    marginBottom: 9,
  },

  weekProgressFill: {
    height: '100%',

    backgroundColor: '#F28C18',

    borderRadius: 10,
  },

  weekGoal: {
    fontSize: 12,

    opacity: 0.52,
  },


  /* ================================================================
     LAST WORKOUT
  ================================================================ */

  lastWorkoutCard: {
    minHeight: 105,

    borderRadius: 18,

    borderWidth: 1,
    borderColor: '#292929',

    paddingHorizontal: 16,
    paddingVertical: 15,

    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 18,
  },

  lastWorkoutIcon: {
    width: 48,
    height: 48,

    borderRadius: 14,

    backgroundColor: '#F28C18',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 14,
  },

  lastWorkoutIconText: {
    color: '#080808',

    fontSize: 23,

    fontWeight: '900',
  },

  lastWorkoutContent: {
    flex: 1,

    paddingRight: 8,
  },

  lastWorkoutTitle: {
    fontSize: 15,

    lineHeight: 20,

    fontWeight: '700',
  },

  lastWorkoutDate: {
    fontSize: 12,

    opacity: 0.5,

    marginTop: 5,
  },

  arrow: {
    fontSize: 31,

    lineHeight: 35,

    opacity: 0.42,
  },


  /* ================================================================
     EMPTY WORKOUT
  ================================================================ */

  emptyWorkoutCard: {
    borderRadius: 18,

    borderWidth: 1,
    borderColor: '#292929',

    padding: 18,

    marginBottom: 18,
  },

  emptyWorkoutTitle: {
    fontSize: 16,

    fontWeight: '700',

    marginBottom: 5,
  },

  emptyWorkoutText: {
    fontSize: 13,

    lineHeight: 19,

    opacity: 0.55,
  },


  /* ================================================================
     AI COACH
  ================================================================ */

  coachCard: {
    backgroundColor: '#151515',

    borderRadius: 18,

    borderWidth: 1,
    borderColor: '#292929',

    padding: 18,

    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 16,
  },

  coachIcon: {
    width: 48,
    height: 48,

    borderRadius: 14,

    backgroundColor: '#F28C18',

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 14,
  },

  coachIconText: {
    color: '#080808',

    fontSize: 25,

    fontWeight: '900',
  },

  coachContent: {
    flex: 1,
  },

  coachTitle: {
    fontSize: 16,

    fontWeight: '800',

    marginBottom: 5,
  },

  coachText: {
    fontSize: 13,

    lineHeight: 19,

    opacity: 0.58,
  },


  /* ================================================================
     PROFILE SETUP
  ================================================================ */

  setupCard: {
    borderWidth: 1,

    borderColor: '#F28C18',

    borderRadius: 18,

    padding: 17,

    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 25,
  },

  setupContent: {
    flex: 1,
  },

  setupTitle: {
    fontSize: 15,

    fontWeight: '800',

    marginBottom: 5,
  },

  setupText: {
    fontSize: 12,

    lineHeight: 18,

    opacity: 0.6,
  },

  setupArrow: {
    color: '#F28C18',

    fontSize: 30,

    marginLeft: 10,
  },


  /* ================================================================
     FOOTER
  ================================================================ */

  footerText: {
    textAlign: 'center',

    fontSize: 11,

    opacity: 0.3,

    marginTop: 3,
  },
});