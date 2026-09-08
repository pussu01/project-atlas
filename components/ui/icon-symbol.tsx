import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import {
  OpaqueColorValue,
  type StyleProp,
  type TextStyle,
} from 'react-native';

type IconMapping = Record<
  SymbolViewProps['name'],
  ComponentProps<typeof MaterialIcons>['name']
>;

type IconSymbolName = keyof typeof MAPPING;

/**
 * Maps the SF Symbol names used by BheemAI
 * to Material Icons for Android/web.
 */
const MAPPING = {
  'house.fill': 'home',

  // Workout
  'figure.strengthtraining.traditional': 'fitness-center',

  // Progress
  'chart.bar.fill': 'bar-chart',

  // Profile
  'person.fill': 'person',

  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
} as IconMapping;

/**
 * Cross-platform icon component.
 *
 * iOS uses SF Symbols.
 * Android/web use Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  );
}