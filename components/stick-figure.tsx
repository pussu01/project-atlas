import Svg, { Line, Circle } from 'react-native-svg';
import {
  PoseFrame,
  POSE_CANVAS,
} from '@/services/pose-gen';

type Props = {
  frame: PoseFrame;
  size?: number;
};

const BONES: [
  keyof PoseFrame,
  keyof PoseFrame
][] = [
  // Head → neck
  ['head', 'neck'],

  // Shoulders
  ['neck', 'leftShoulder'],
  ['neck', 'rightShoulder'],

  // Left arm
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],

  // Right arm
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],

  // Torso
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],

  // Left leg
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],

  // Right leg
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
];

export default function StickFigure({
  frame,
  size = 150,
}: Props) {
  const scale =
    size / POSE_CANVAS.height;

  const width =
    POSE_CANVAS.width * scale;

  const height =
    POSE_CANVAS.height * scale;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${POSE_CANVAS.width} ${POSE_CANVAS.height}`}
    >
      {BONES.map(([a, b], index) => (
        <Line
          key={index}
          x1={frame[a].x}
          y1={frame[a].y}
          x2={frame[b].x}
          y2={frame[b].y}
          stroke="#ffffff"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}

      <Circle
        cx={frame.head.x}
        cy={frame.head.y}
        r={14}
        fill="#ffffff"
      />
    </Svg>
  );
}