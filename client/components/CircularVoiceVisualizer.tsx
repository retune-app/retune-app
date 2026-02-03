import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

interface CircularVoiceVisualizerProps {
  isActive?: boolean;
  size?: number;
}

function AnimatedRing({
  index,
  isActive,
  baseSize,
  ringCount,
  color,
}: {
  index: number;
  isActive: boolean;
  baseSize: number;
  ringCount: number;
  color: string;
}) {
  const progress = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  
  const ringSize = baseSize - index * 28;
  const opacity = 0.15 + (index / ringCount) * 0.25;
  
  useEffect(() => {
    if (isActive) {
      const delay = index * 120;
      const duration = 800 + index * 100;
      
      progress.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        )
      );
      
      pulseScale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1.08, { duration: duration * 0.5, easing: Easing.out(Easing.ease) }),
            withTiming(1, { duration: duration * 0.5, easing: Easing.in(Easing.ease) })
          ),
          -1,
          false
        )
      );
    } else {
      progress.value = withTiming(0, { duration: 400 });
      pulseScale.value = withTiming(1, { duration: 400 });
    }
  }, [isActive, index]);

  const animatedStyle = useAnimatedStyle(() => {
    const dynamicOpacity = interpolate(progress.value, [0, 0.5, 1], [opacity * 0.6, opacity, opacity * 0.6]);
    const borderWidth = interpolate(progress.value, [0, 0.5, 1], [1.5, 3, 1.5]);
    
    return {
      transform: [{ scale: pulseScale.value }],
      opacity: dynamicOpacity,
      borderWidth,
    };
  });

  if (ringSize <= 40) return null;

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

function CenterGlow({
  isActive,
  size,
  color,
}: {
  isActive: boolean;
  size: number;
  color: string;
}) {
  const glowOpacity = useSharedValue(0.3);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(0.3, { duration: 600, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
      glowScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      glowOpacity.value = withTiming(0.3, { duration: 400 });
      glowScale.value = withTiming(1, { duration: 400 });
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.centerGlow,
        {
          width: size * 0.35,
          height: size * 0.35,
          borderRadius: size * 0.175,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export function CircularVoiceVisualizer({
  isActive = false,
  size = 200,
}: CircularVoiceVisualizerProps) {
  const { theme } = useTheme();
  const ringCount = 6;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {Array.from({ length: ringCount }).map((_, index) => (
        <AnimatedRing
          key={index}
          index={index}
          isActive={isActive}
          baseSize={size}
          ringCount={ringCount}
          color={theme.primary}
        />
      ))}
      <CenterGlow isActive={isActive} size={size} color={theme.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
  },
  centerGlow: {
    position: "absolute",
  },
});
