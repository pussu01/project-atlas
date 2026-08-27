export type MovementSpec = {
  canonicalName: string;
  view: 'front' | 'side' | 'three-quarter';

  description: string;

  startPosition: string;
  earlyPosition: string;
  middlePosition: string;
  latePosition: string;
  endPosition: string;

  primaryMovement: string;
  secondaryMovement: string;

  fixedPoints: string;
};

const SPECS: Record<string, MovementSpec> = {
  'bodyweight squat': {
    canonicalName: 'Bodyweight Squat',
    view: 'side',

    description:
      'A controlled squat in which the hips and knees bend to lower the body and then extend to return to standing.',

    startPosition:
      'Standing upright with feet approximately shoulder-width apart.',

    earlyPosition:
      'Beginning the descent: hips move slightly backward and downward, knees begin bending, torso leans slightly forward.',

    middlePosition:
      'Bottom of the squat: hips are substantially lower, knees are clearly flexed, thighs are approximately parallel to the floor or slightly above it, torso remains controlled.',

    latePosition:
      'Ascending from the bottom: hips and knees are extending and the body is moving upward.',

    endPosition:
      'Returned to the same upright standing position as the start.',

    primaryMovement:
      'Substantial hip flexion/extension and knee flexion/extension.',

    secondaryMovement:
      'Moderate controlled forward torso lean during descent followed by return to upright.',

    fixedPoints:
      'Feet remain approximately fixed on the ground throughout the repetition.',
  },

  'push-up': {
    canonicalName: 'Push-up',
    view: 'side',

    description:
      'A push-up performed from a high plank position by bending and extending the elbows while maintaining a relatively rigid body line.',

    startPosition:
      'High plank: hands on the floor, arms extended, body forming a relatively straight line from shoulders through hips to ankles.',

    earlyPosition:
      'Beginning descent: elbows start bending and the chest moves toward the floor while the torso remains relatively rigid.',

    middlePosition:
      'Bottom position: elbows are substantially bent, chest is close to the floor, hips remain aligned with the shoulders and ankles.',

    latePosition:
      'Ascending: elbows extend and the chest moves away from the floor while the body remains relatively straight.',

    endPosition:
      'Returned to the high plank position with arms extended.',

    primaryMovement:
      'Elbow flexion/extension with coordinated shoulder movement.',

    secondaryMovement:
      'Small vertical movement of the rigid torso as one unit.',

    fixedPoints:
      'Hands and feet remain approximately fixed relative to the floor.',
  },

  'reverse lunge': {
    canonicalName: 'Reverse Lunge',
    view: 'three-quarter',

    description:
      'A reverse lunge in which one leg steps backward while both knees bend, followed by a return to the standing position.',

    startPosition:
      'Standing upright with feet together or approximately hip-width apart.',

    earlyPosition:
      'One leg begins moving backward while the front knee starts bending.',

    middlePosition:
      'Deep lunge: rear leg is extended backward, front knee is substantially bent, rear knee is lowered toward the floor, torso remains upright.',

    latePosition:
      'Rear leg moves forward while both knees extend and the body rises.',

    endPosition:
      'Returned to the original standing stance.',

    primaryMovement:
      'Large knee and hip flexion on the front leg with supporting movement of the rear leg.',

    secondaryMovement:
      'Rear foot moves backward and then returns forward.',

    fixedPoints:
      'The torso remains relatively upright and stable compared with the legs.',
  },

  'jumping jack': {
    canonicalName: 'Jumping Jack',
    view: 'front',

    description:
      'A jumping jack in which the arms move from the sides to overhead while the legs move apart, then return together.',

    startPosition:
      'Standing upright with feet together and arms down beside the body.',

    earlyPosition:
      'Beginning the jump: arms move outward and upward while the legs begin separating.',

    middlePosition:
      'Open position: arms are overhead or near overhead and feet are clearly separated laterally.',

    latePosition:
      'Returning: arms move downward and legs move back toward the center.',

    endPosition:
      'Returned to standing with feet together and arms at the sides.',

    primaryMovement:
      'Shoulder abduction/elevation and lateral separation of the legs.',

    secondaryMovement:
      'Small coordinated knee and ankle flexion associated with the jump.',

    fixedPoints:
      'Body remains approximately centered on the canvas; the figure should not drift sideways.',
  },

  'dumbbell biceps curl': {
    canonicalName: 'Dumbbell Biceps Curl',
    view: 'three-quarter',

    description:
      'A standing dumbbell curl in which the elbows remain close to the torso while the forearms rotate upward toward the shoulders and return downward.',

    startPosition:
      'Standing upright with arms hanging beside the torso and elbows close to the body.',

    earlyPosition:
      'Beginning the curl: elbows remain near the torso while the forearms begin rotating upward.',

    middlePosition:
      'Top of the curl: forearms are substantially raised toward the shoulders while the upper arms remain approximately stationary.',

    latePosition:
      'Lowering the dumbbells: forearms rotate downward while elbows remain close to the torso.',

    endPosition:
      'Returned to the starting position with arms lowered.',

    primaryMovement:
      'Elbow flexion followed by elbow extension.',

    secondaryMovement:
      'Minimal movement of the upper arms and shoulders.',

    fixedPoints:
      'Torso remains upright and elbows remain close to the sides of the body.',
  },
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function getMovementSpec(
  exerciseName: string
): MovementSpec | null {
  const key = normalize(exerciseName);

  if (SPECS[key]) {
    return SPECS[key];
  }

  // Useful aliases.
  if (key === 'squat') {
    return SPECS['bodyweight squat'];
  }

  if (key === 'push up' || key === 'pushup') {
    return SPECS['push-up'];
  }

  if (key === 'lunge') {
    return SPECS['reverse lunge'];
  }

  if (
    key === 'bicep curl' ||
    key === 'dumbbell curl'
  ) {
    return SPECS['dumbbell biceps curl'];
  }

  if (
    key === 'jumping jacks' ||
    key === 'jump jack'
  ) {
    return SPECS['jumping jack'];
  }

  return null;
}

export function getSupportedMovementNames(): string[] {
  return Object.values(SPECS).map(
    spec => spec.canonicalName
  );
}