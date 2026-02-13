import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface WaveformVisualizerProps {
  isRecording: boolean;
  barCount?: number;
}

function WaveBar({ index, isRecording }: { index: number; isRecording: boolean }) {
  const height = useSharedValue(8);

  useEffect(() => {
    if (isRecording) {
      const minH = 6 + Math.random() * 8;
      const maxH = 20 + Math.random() * 30;
      const duration = 300 + Math.random() * 400;
      height.value = withDelay(
        index * 50,
        withRepeat(
          withSequence(
            withTiming(maxH, { duration, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
            withTiming(minH, { duration: duration * 0.8, easing: Easing.bezier(0.4, 0, 0.2, 1) })
          ),
          -1,
          true
        )
      );
    } else {
      cancelAnimation(height);
      height.value = withTiming(8, { duration: 400 });
    }
  }, [isRecording]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: isRecording ? Colors.accent : Colors.textTertiary,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function WaveformVisualizer({
  isRecording,
  barCount = 30,
}: WaveformVisualizerProps) {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <View style={styles.container}>
      {bars.map((i) => (
        <WaveBar key={i} index={i} isRecording={isRecording} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 60,
    paddingHorizontal: 20,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    minHeight: 4,
  },
});
