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

function RadialBar({
  index,
  isActive,
  color,
  angle,
  centerX,
  centerY,
  innerRadius,
}: {
  index: number;
  isActive: boolean;
  color: string;
  angle: number;
  centerX: number;
  centerY: number;
  innerRadius: number;
}) {
  const scale = useSharedValue(0.4);
  const baseHeight = 30;

  useEffect(() => {
    if (isActive) {
      const delay = (index % 8) * 50;
      const minScale = 0.3 + Math.random() * 0.2;
      const maxScale = 0.7 + Math.random() * 0.5;
      const duration = 250 + Math.random() * 150;

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
      scale.value = withTiming(0.4, { duration: 400 });
    }
  }, [isActive, index]);

  const angleRad = (angle * Math.PI) / 180;
  const x = centerX + Math.cos(angleRad) * innerRadius - 2;
  const y = centerY + Math.sin(angleRad) * innerRadius - baseHeight / 2;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: color,
          height: baseHeight,
          position: "absolute",
          left: x,
          top: y,
          transform: [{ rotate: `${angle + 90}deg` }],
        },
        animatedStyle,
      ]}
    />
  );
}

export function CircularWaveform({
  isActive = false,
  barCount = 24,
  style,
  size = 200,
}: CircularWaveformProps) {
  const { theme } = useTheme();
  const centerX = size / 2;
  const centerY = size / 2;
  const innerRadius = size * 0.25;

  const bars = Array.from({ length: barCount }).map((_, index) => {
    const angle = (360 / barCount) * index - 90;
    return (
      <RadialBar
        key={index}
        index={index}
        isActive={isActive}
        color={theme.primary}
        angle={angle}
        centerX={centerX}
        centerY={centerY}
        innerRadius={innerRadius}
      />
    );
  });

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <View style={[styles.centerDot, { backgroundColor: theme.primary + "30" }]} />
      {bars}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    width: 4,
    borderRadius: BorderRadius.xs,
    transformOrigin: "center bottom",
  },
  centerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: "absolute",
  },
});
