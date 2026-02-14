import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  interpolate,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export default function RecordButton({ isRecording, onPress, disabled }: RecordButtonProps) {
  const pulse = useSharedValue(1);
  const innerScale = useSharedValue(1);

  useEffect(() => {
    if (isRecording) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        false
      );
      innerScale.value = withTiming(0.85, { duration: 200 });
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 300 });
      innerScale.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.3], [0.3, 0]),
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.wrapper,
        { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
      ]}
    >
      {isRecording && (
        <Animated.View style={[styles.pulseRing, pulseStyle]} />
      )}
      <Animated.View
        style={[
          styles.button,
          { backgroundColor: isRecording ? Colors.accentRed : Colors.accent },
          innerStyle,
        ]}
      >
        <Ionicons
          name={isRecording ? "stop" : "mic"}
          size={32}
          color="#FFFFFF"
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentRed,
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.15)",
    elevation: 6,
  },
});
