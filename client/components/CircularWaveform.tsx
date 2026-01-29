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

interface CircularWaveformProps {
  isActive?: boolean;
  barCount?: number;
  style?: ViewStyle;
  size?: number;
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
  const scale = useSharedValue(0.3);

  useEffect(() => {
    if (isActive) {
      const delay = (index % 6) * 60;
      const minScale = 0.2 + Math.random() * 0.15;
      const maxScale = 0.6 + Math.random() * 0.4;
      const duration = 280 + Math.random() * 180;

      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(maxScale, { duration, easing: Easing.inOut(Easing.sine) }),
            withTiming(minScale, { duration, easing: Easing.inOut(Easing.sine) })
          ),
          -1,
          true
        )
      );
    } else {
      scale.value = withTiming(0.3, { duration: 400 });
    }
  }, [isActive, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
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

export function CircularWaveform({
  isActive = false,
  barCount = 32,
  style,
  size = 200,
}: CircularWaveformProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <View style={styles.waveContainer}>
        {Array.from({ length: barCount }).map((_, index) => (
          <WaveBar
            key={index}
            index={index}
            isActive={isActive}
            color={theme.primary}
            totalBars={barCount}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 80,
    gap: 3,
  },
  bar: {
    width: 4,
    height: 80,
    borderRadius: BorderRadius.xs,
  },
});
