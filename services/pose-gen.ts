import { getGeminiApiKey } from './gemini-key';
import {
  getMovementSpec,
  MovementSpec,
} from './pose-motion';

export type Keypoint = {
  x: number;
  y: number;
};

export type PoseFrame = {
  head: Keypoint;
  neck: Keypoint;

  leftShoulder: Keypoint;
  rightShoulder: Keypoint;

  leftElbow: Keypoint;
  rightElbow: Keypoint;

  leftWrist: Keypoint;
  rightWrist: Keypoint;

  leftHip: Keypoint;
  rightHip: Keypoint;

  leftKnee: Keypoint;
  rightKnee: Keypoint;

  leftAnkle: Keypoint;
  rightAnkle: Keypoint;
};

export type ExercisePoseSet = {
  exerciseName: string;
  view: 'front' | 'side' | 'three-quarter';
  frames: PoseFrame[];
};

const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 300;

const MAX_ATTEMPTS = 3;

const MIN_BONE_LENGTH = 18;
const MAX_BONE_LENGTH = 85;

function distance(
  a: Keypoint,
  b: Keypoint
): number {
  return Math.sqrt(
    (a.x - b.x) ** 2 +
    (a.y - b.y) ** 2
  );
}

function isPointValid(
  point: Keypoint
): boolean {
  return (
    !!point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= CANVAS_WIDTH &&
    point.y >= 0 &&
    point.y <= CANVAS_HEIGHT
  );
}

function isBoneValid(
  a: Keypoint,
  b: Keypoint
): boolean {
  if (!isPointValid(a) || !isPointValid(b)) {
    return false;
  }

  const length = distance(a, b);

  return (
    length >= MIN_BONE_LENGTH &&
    length <= MAX_BONE_LENGTH
  );
}

function isFrameValid(
  frame: PoseFrame
): boolean {
  if (!frame) {
    return false;
  }

  const bones: [
    Keypoint,
    Keypoint
  ][] = [
    [frame.head, frame.neck],

    [frame.neck, frame.leftShoulder],
    [frame.neck, frame.rightShoulder],

    [frame.leftShoulder, frame.leftElbow],
    [frame.leftElbow, frame.leftWrist],

    [frame.rightShoulder, frame.rightElbow],
    [frame.rightElbow, frame.rightWrist],

    [frame.leftShoulder, frame.leftHip],
    [frame.rightShoulder, frame.rightHip],

    [frame.leftHip, frame.leftKnee],
    [frame.leftKnee, frame.leftAnkle],

    [frame.rightHip, frame.rightKnee],
    [frame.rightKnee, frame.rightAnkle],
  ];

  return bones.every(
    ([a, b]) => isBoneValid(a, b)
  );
}

function angle(
  a: Keypoint,
  b: Keypoint,
  c: Keypoint
): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;

  const cbx = c.x - b.x;
  const cby = c.y - b.y;

  const dot =
    abx * cbx +
    aby * cby;

  const magAB = Math.sqrt(
    abx * abx +
    aby * aby
  );

  const magCB = Math.sqrt(
    cbx * cbx +
    cby * cby
  );

  if (magAB === 0 || magCB === 0) {
    return 180;
  }

  const cosine =
    dot / (magAB * magCB);

  const clamped = Math.max(
    -1,
    Math.min(1, cosine)
  );

  return (
    Math.acos(clamped) *
    (180 / Math.PI)
  );
}

function elbowAngle(
  frame: PoseFrame,
  side: 'left' | 'right'
): number {
  if (side === 'left') {
    return angle(
      frame.leftShoulder,
      frame.leftElbow,
      frame.leftWrist
    );
  }

  return angle(
    frame.rightShoulder,
    frame.rightElbow,
    frame.rightWrist
  );
}

function kneeAngle(
  frame: PoseFrame,
  side: 'left' | 'right'
): number {
  if (side === 'left') {
    return angle(
      frame.leftHip,
      frame.leftKnee,
      frame.leftAnkle
    );
  }

  return angle(
    frame.rightHip,
    frame.rightKnee,
    frame.rightAnkle
  );
}

function average(
  a: number,
  b: number
): number {
  return (a + b) / 2;
}

/*
 * Validate that the exercise actually MOVES.
 * Bone-length validation alone is insufficient because
 * Gemini can return five almost-identical poses.
 */
function movementIsValid(
  poseSet: ExercisePoseSet,
  spec: MovementSpec | null
): boolean {
  if (!spec) {
    /*
     * Unknown exercises still need meaningful movement.
     */
    const first = poseSet.frames[0];
    const middle = poseSet.frames[2];

    const displacement =
      distance(
        first.leftWrist,
        middle.leftWrist
      ) +
      distance(
        first.rightWrist,
        middle.rightWrist
      ) +
      distance(
        first.leftKnee,
        middle.leftKnee
      ) +
      distance(
        first.rightKnee,
        middle.rightKnee
      );

    return displacement > 35;
  }

  const start = poseSet.frames[0];
  const middle = poseSet.frames[2];
  const end = poseSet.frames[4];

  const key =
    spec.canonicalName.toLowerCase();

  /*
   * SQUAT
   */
  if (key === 'bodyweight squat') {
    const startKnee = average(
      kneeAngle(start, 'left'),
      kneeAngle(start, 'right')
    );

    const middleKnee = average(
      kneeAngle(middle, 'left'),
      kneeAngle(middle, 'right')
    );

    const hipDrop =
      average(
        middle.leftHip.y,
        middle.rightHip.y
      ) -
      average(
        start.leftHip.y,
        start.rightHip.y
      );

    return (
      startKnee - middleKnee > 20 &&
      hipDrop > 20
    );
  }

  /*
   * PUSH-UP
   */
  if (key === 'push-up') {
    const startElbow = average(
      elbowAngle(start, 'left'),
      elbowAngle(start, 'right')
    );

    const middleElbow = average(
      elbowAngle(middle, 'left'),
      elbowAngle(middle, 'right')
    );

    return (
      startElbow - middleElbow > 20
    );
  }

  /*
   * REVERSE LUNGE
   */
  if (key === 'reverse lunge') {
    const startLeft =
      kneeAngle(start, 'left');

    const startRight =
      kneeAngle(start, 'right');

    const middleLeft =
      kneeAngle(middle, 'left');

    const middleRight =
      kneeAngle(middle, 'right');

    const leftChange =
      startLeft - middleLeft;

    const rightChange =
      startRight - middleRight;

    return (
      Math.max(
        leftChange,
        rightChange
      ) > 20
    );
  }

  /*
   * JUMPING JACK
   */
  if (key === 'jumping jack') {
    const startWristY =
      average(
        start.leftWrist.y,
        start.rightWrist.y
      );

    const middleWristY =
      average(
        middle.leftWrist.y,
        middle.rightWrist.y
      );

    const startAnkleDistance =
      distance(
        start.leftAnkle,
        start.rightAnkle
      );

    const middleAnkleDistance =
      distance(
        middle.leftAnkle,
        middle.rightAnkle
      );

    return (
      startWristY -
        middleWristY >
        35 &&
      middleAnkleDistance -
        startAnkleDistance >
        25
    );
  }

  /*
   * DUMBBELL BICEPS CURL
   */
  if (
    key ===
    'dumbbell biceps curl'
  ) {
    const startElbow =
      average(
        elbowAngle(start, 'left'),
        elbowAngle(start, 'right')
      );

    const middleElbow =
      average(
        elbowAngle(middle, 'left'),
        elbowAngle(middle, 'right')
      );

    return (
      startElbow -
        middleElbow >
        25
    );
  }

  return true;
}

function poseSetIsValid(
  poseSet: ExercisePoseSet,
  spec: MovementSpec | null
): boolean {
  if (!poseSet) {
    return false;
  }

  if (
    poseSet.frames.length !== 5
  ) {
    return false;
  }

  if (
    poseSet.view !==
      'front' &&
    poseSet.view !==
      'side' &&
    poseSet.view !==
      'three-quarter'
  ) {
    return false;
  }

  if (
    !poseSet.frames.every(
      isFrameValid
    )
  ) {
    return false;
  }

  return movementIsValid(
    poseSet,
    spec
  );
}

function buildPrompt(
  exerciseName: string,
  spec: MovementSpec | null
): string {
  const movementSection = spec
    ? `
CANONICAL EXERCISE:
${spec.canonicalName}

RECOMMENDED VIEW:
${spec.view}

EXERCISE DESCRIPTION:
${spec.description}

START POSITION:
${spec.startPosition}

EARLY MOVEMENT:
${spec.earlyPosition}

MIDDLE / PEAK POSITION:
${spec.middlePosition}

LATE MOVEMENT:
${spec.latePosition}

END POSITION:
${spec.endPosition}

PRIMARY MOVEMENT:
${spec.primaryMovement}

SECONDARY MOVEMENT:
${spec.secondaryMovement}

FIXED / STABLE ELEMENTS:
${spec.fixedPoints}
`
    : `
No predefined Atlas movement specification exists for
this exercise.

Determine the correct biomechanics yourself.

Choose the most informative view and make the five
frames clearly represent one complete repetition.
`;

  return `
You are the biomechanics engine for a fitness application
called Atlas.

Generate structured 2D skeletal coordinates for ONE exercise.

Exercise:
"${exerciseName}"

${movementSection}

==================================================
MOST IMPORTANT RULE
==================================================

The five frames must show ONE REAL REPETITION.

Do not merely produce five different poses.

The movement must be obvious when the frames are viewed
in sequence:

START
→ EARLY
→ MIDDLE / PEAK
→ LATE
→ END

The END position should normally return to approximately
the same body configuration as START.

==================================================
SKELETON
==================================================

Use exactly these 14 anatomical keypoints:

head
neck

leftShoulder
rightShoulder

leftElbow
rightElbow

leftWrist
rightWrist

leftHip
rightHip

leftKnee
rightKnee

leftAnkle
rightAnkle

Every keypoint must be present in every frame.

==================================================
CANVAS
==================================================

Width: ${CANVAS_WIDTH}
Height: ${CANVAS_HEIGHT}

Origin:
top-left = 0,0

All coordinates must remain inside the canvas.

Leave reasonable margins around the person.

==================================================
BODY CONSISTENCY
==================================================

This is ONE PERSON moving.

Therefore:

- body proportions must remain constant
- head size must remain constant
- torso length must remain constant
- upper-arm length must remain constant
- forearm length must remain constant
- thigh length must remain constant
- lower-leg length must remain constant

Do NOT resize the person between frames.

Do NOT move the entire body randomly between frames.

==================================================
ANATOMICAL CONSTRAINTS
==================================================

Every connected bone must remain clearly visible.

Avoid collapsed joints.

Approximate segment lengths:

head → neck:
15–25 px

shoulder → elbow:
30–50 px

elbow → wrist:
30–50 px

shoulder → hip:
40–65 px

hip → knee:
45–65 px

knee → ankle:
45–65 px

Connected joints must never be nearly coincident.

==================================================
EXERCISE BIOMECHANICS
==================================================

The named exercise takes priority over generic pose
variation.

Move the joints that actually move in this exercise.

Do not introduce unrelated movement.

Keep stable joints stable.

For example:

A push-up must show elbow flexion.

A squat must show hip and knee flexion.

A biceps curl must show elbow flexion while the
upper arm remains relatively stable.

A jumping jack must show arms moving overhead and
legs moving apart.

A lunge must show asymmetric leg movement.

==================================================
FRAME REQUIREMENTS
==================================================

FRAME 1:
Clear starting position.

FRAME 2:
Movement has begun.

FRAME 3:
Most important/deepest/peak position.

FRAME 4:
Movement is returning.

FRAME 5:
Return to approximately the starting configuration.

Frames 1 and 5 should be similar unless the exercise
naturally has a different ending position.

==================================================
OUTPUT
==================================================

Return ONLY valid JSON.

No markdown.
No explanation.
No comments.

Exactly:

{
  "exerciseName": "${exerciseName}",
  "view": "${spec?.view || 'side'}",
  "frames": [
    {
      "head": {"x": 0, "y": 0},
      "neck": {"x": 0, "y": 0},
      "leftShoulder": {"x": 0, "y": 0},
      "rightShoulder": {"x": 0, "y": 0},
      "leftElbow": {"x": 0, "y": 0},
      "rightElbow": {"x": 0, "y": 0},
      "leftWrist": {"x": 0, "y": 0},
      "rightWrist": {"x": 0, "y": 0},
      "leftHip": {"x": 0, "y": 0},
      "rightHip": {"x": 0, "y": 0},
      "leftKnee": {"x": 0, "y": 0},
      "rightKnee": {"x": 0, "y": 0},
      "leftAnkle": {"x": 0, "y": 0},
      "rightAnkle": {"x": 0, "y": 0}
    }
  ]
}

The frames array MUST contain exactly FIVE objects.
`;
}

async function requestPoseFrames(
  exerciseName: string,
  apiKey: string
): Promise<ExercisePoseSet> {
  const spec =
    getMovementSpec(exerciseName);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(
                  exerciseName,
                  spec
                ),
              },
            ],
          },
        ],

        generationConfig: {
          responseMimeType:
            'application/json',

          temperature: 0.1,
        },
      }),
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        'Failed to generate pose data'
    );
  }

  const text =
    data?.candidates?.[0]
      ?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error(
      'No pose data returned from AI'
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      'AI returned an unexpected format.'
    );
  }
}

export async function generatePoseFrames(
  exerciseName: string
): Promise<ExercisePoseSet> {
  const apiKey =
    await getGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      'Gemini API key is not configured. Please add your Gemini API key in Profile.'
    );
  }

  const spec =
    getMovementSpec(exerciseName);

  let lastError: Error | null =
    null;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      const result =
        await requestPoseFrames(
          exerciseName,
          apiKey
        );

      if (
        poseSetIsValid(
          result,
          spec
        )
      ) {
        return result;
      }

      lastError = new Error(
        `Gemini generated a pose that did not pass Atlas biomechanical validation (attempt ${attempt}/${MAX_ATTEMPTS}).`
      );
    } catch (err: any) {
      lastError =
        err instanceof Error
          ? err
          : new Error(
              'Failed to generate pose data.'
            );
    }
  }

  throw (
    lastError ||
    new Error(
      'Atlas could not generate a valid exercise pose.'
    )
  );
}

export const POSE_CANVAS = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};