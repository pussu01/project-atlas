import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';

type Props = {
  frameXml: string[];
  size?: number;
  autoPlay?: boolean;
  frameDurationMs?: number;
};

export default function ExerciseIllustration({
  frameXml,
  size = 100,
  autoPlay = true,
  frameDurationMs = 900,
}: Props) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!autoPlay || frameXml.length <= 1) return;

    const interval = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frameXml.length);
    }, frameDurationMs);

    return () => clearInterval(interval);
  }, [autoPlay, frameXml.length, frameDurationMs]);

  const xml = frameXml[frameIndex];
  if (!xml) return null;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});