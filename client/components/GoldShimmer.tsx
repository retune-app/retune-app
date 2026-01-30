import React, { useEffect } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

interface GoldShimmerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  shimmerWidth?: number;
  duration?: number;
  enabled?: boolean;
}

export function GoldShimmer({
  children,
  style,
  shimmerWidth = 100,
  duration = 2000,
  enabled = true,
}: GoldShimmerProps) {
  const shimmerPosition = useSharedValue(-1);

  useEffect(() => {
    if (enabled) {
      shimmerPosition.value = withRepeat(
        withTiming(1, {
          duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        false
      );
    } else {
      shimmerPosition.value = -1;
    }
  }, [enabled, duration]);

  const shimmerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: interpolate(
            shimmerPosition.value,
            [-1, 1],
            [-shimmerWidth * 2, shimmerWidth * 2]
          ),
        },
      ],
      opacity: interpolate(
        shimmerPosition.value,
        [-1, -0.5, 0, 0.5, 1],
        [0, 0.6, 0.8, 0.6, 0]
      ),
    };
  });

  return (
    <Animated.View style={[styles.container, style]}>
      {children}
      {enabled && (
        <Animated.View style={[styles.shimmerOverlay, shimmerStyle]}>
          <LinearGradient
            colors={[
              "transparent",
              "rgba(229, 201, 92, 0.3)",
              "rgba(255, 215, 0, 0.5)",
              "rgba(229, 201, 92, 0.3)",
              "transparent",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.gradient, { width: shimmerWidth }]}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

interface GoldGlowProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: "subtle" | "medium" | "strong";
  enabled?: boolean;
}

export function GoldGlow({
  children,
  style,
  intensity = "medium",
  enabled = true,
}: GoldGlowProps) {
  const glowOpacity = useSharedValue(0.3);

  const opacityRange = {
    subtle: [0.2, 0.4],
    medium: [0.3, 0.6],
    strong: [0.4, 0.8],
  };

  useEffect(() => {
    if (enabled) {
      const [min, max] = opacityRange[intensity];
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(max, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(min, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      glowOpacity.value = opacityRange[intensity][0];
    }
  }, [enabled, intensity]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.glowContainer,
        {
          shadowColor: "#E5C95C",
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: intensity === "strong" ? 12 : intensity === "medium" ? 8 : 4,
          elevation: intensity === "strong" ? 8 : intensity === "medium" ? 5 : 3,
        },
        glowStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    pointerEvents: "none",
  },
  gradient: {
    height: "100%",
  },
  glowContainer: {},
});
