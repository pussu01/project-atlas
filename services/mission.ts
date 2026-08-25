import * as SQLite from 'expo-sqlite';

export type MissionAction = 'profile' | 'workout';

export type TodaysMission = {
  title: string;
  message: string;
  action: MissionAction;
  buttonText: string;
};

type ProfileRow = {
  name: string | null;
};

type WorkoutHistoryRow = {
  id: number;
  date: string;
  workout_json: string;
};

type MeasurementRow = {
  date: string;
};

function getDateDifferenceInHours(dateString: string): number {
  const workoutDate = new Date(dateString);
  const now = new Date();

  return (now.getTime() - workoutDate.getTime()) / (1000 * 60 * 60);
}

export async function getTodaysMission(): Promise<TodaysMission> {
  const db = await SQLite.openDatabaseAsync('atlas.db');

  // ------------------------------------------------------------
  // 1. Check whether the user has created a profile
  // ------------------------------------------------------------

  const profile = await db.getFirstAsync<ProfileRow>(
    'SELECT name FROM profile WHERE id = 1'
  );

  if (!profile || !profile.name) {
    return {
      title: "Today's Mission",
      message: 'Set up your Atlas profile so your workouts can be personalized.',
      action: 'profile',
      buttonText: 'Set Up Profile',
    };
  }

  // ------------------------------------------------------------
  // 2. Get the most recently completed workout
  // ------------------------------------------------------------

  const lastWorkout = await db.getFirstAsync<WorkoutHistoryRow>(
    `SELECT id, date, workout_json
     FROM workout_history
     ORDER BY id DESC
     LIMIT 1`
  );

  // ------------------------------------------------------------
  // 3. New user — no completed workout yet
  // ------------------------------------------------------------

  if (!lastWorkout) {
    return {
      title: "Today's Mission",
      message: 'Start your fitness journey by completing your first workout.',
      action: 'workout',
      buttonText: 'Start Workout',
    };
  }

  // ------------------------------------------------------------
  // 4. Check how recently the last workout was completed
  // ------------------------------------------------------------

  const hoursSinceLastWorkout = getDateDifferenceInHours(
    lastWorkout.date
  );

  // ------------------------------------------------------------
  // 5. Recovery rule
  // ------------------------------------------------------------

  if (
    hoursSinceLastWorkout >= 0 &&
    hoursSinceLastWorkout <= 48
  ) {
    return {
      title: "Today's Mission",
      message:
        'Give your recently trained muscles time to recover. Today’s workout should focus on a different area.',
      action: 'workout',
      buttonText: "View Today's Workout",
    };
  }

  // ------------------------------------------------------------
  // 6. Workout is overdue
  // ------------------------------------------------------------

  const latestMeasurement = await db.getFirstAsync<MeasurementRow>(
    `SELECT date
     FROM measurements
     ORDER BY id DESC
     LIMIT 1`
  );

  let measurementReminder = '';

  if (latestMeasurement) {
    const measurementDate = new Date(latestMeasurement.date);
    const now = new Date();

    const daysSinceMeasurement =
      (now.getTime() - measurementDate.getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysSinceMeasurement >= 7) {
      measurementReminder =
        ' When convenient, remember to update your body measurements too.';
    }
  }

  return {
    title: "Today's Mission",
    message:
      `Get back into action and complete today's workout.${measurementReminder}`,
    action: 'workout',
    buttonText: 'Start Workout',
  };
}