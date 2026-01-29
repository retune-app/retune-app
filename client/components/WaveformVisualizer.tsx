import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withDelay,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius } from "@/constants/theme";

interface WaveformVisualizerProps {
  isActive?: boolean;
  barCount?: number;
  style?: ViewStyle;
  color?: string;
}

function WaveBar({
  index,
  isActive,
  color,
  totalBars,
}: {
  index: number;
  isActive: boolean;
  color: string;
  totalBars: number;
}) {
  const height = useSharedValue(0.3);

  useEffect(() => {
    if (isActive) {
      const delay = index * 80;
      const minHeight = 0.2 + Math.random() * 0.2;
      const maxHeight = 0.6 + Math.random() * 0.4;
      const duration = 300 + Math.random() * 200;

      height.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(maxHeight, { duration, easing: Easing.inOut(Easing.ease) }),
            withTiming(minHeight, { duration, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    } else {
      height.value = withTiming(0.3, { duration: 300 });
    }
  }, [isActive, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: height.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

export function WaveformVisualizer({
  isActive = false,
  barCount = 32,
  style,
  color,
}: WaveformVisualizerProps) {
  const { theme } = useTheme();
  const barColor = color || theme.primary;

  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: barCount }).map((_, index) => (
        <WaveBar
          key={index}
          index={index}
          isActive={isActive}
          color={barColor}
          totalBars={barCount}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 80,
    gap: 3,
  },
  bar: {
    width: 4,
    height: "100%",
    borderRadius: BorderRadius.xs,
  },
});
