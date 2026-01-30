import React, { useEffect } from "react";
import { StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";

interface BreathingPulseProps {
  children: React.ReactNode;
  style?: ViewStyle;
  duration?: number;
  scaleRange?: [number, number];
  enabled?: boolean;
  glowColor?: string;
}

export function BreathingPulse({
  children,
  style,
  duration = 4000,
  scaleRange = [1, 1.05],
  enabled = true,
  glowColor = "#E5C95C",
}: BreathingPulseProps) {
  const breathProgress = useSharedValue(0);

  useEffect(() => {
    if (enabled) {
      breathProgress.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(0, {
            duration: duration / 2,
            easing: Easing.inOut(Easing.sin),
          })
        ),
        -1,
        false
      );
    } else {
      breathProgress.value = 0;
    }
  }, [enabled, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(breathProgress.value, [0, 1], scaleRange);
    const shadowOpacity = interpolate(breathProgress.value, [0, 1], [0.15, 0.35]);
    const shadowRadius = interpolate(breathProgress.value, [0, 1], [4, 12]);

    return {
      transform: [{ scale }],
      shadowOpacity,
      shadowRadius,
    };
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        },
        animatedStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface PulseRingProps {
  size: number;
  color?: string;
  duration?: number;
  enabled?: boolean;
  style?: ViewStyle;
}

export function PulseRing({
  size,
  color = "#E5C95C",
  duration = 2000,
  enabled = true,
  style,
}: PulseRingProps) {
  const pulseProgress = useSharedValue(0);

  useEffect(() => {
    if (enabled) {
      pulseProgress.value = withRepeat(
        withTiming(1, {
          duration,
          easing: Easing.out(Easing.ease),
        }),
        -1,
        false
      );
    } else {
      pulseProgress.value = 0;
    }
  }, [enabled, duration]);

  const ringStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseProgress.value, [0, 1], [1, 1.8]);
    const opacity = interpolate(pulseProgress.value, [0, 0.5, 1], [0.6, 0.3, 0]);

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
        },
        ringStyle,
        style,
      ]}
    />
  );
}

interface BreathingPlayButtonProps {
  size: number;
  isPlaying: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function BreathingPlayButton({
  size,
  isPlaying,
  children,
  style,
}: BreathingPlayButtonProps) {
  return (
    <Animated.View style={[styles.playButtonContainer, style]}>
      {!isPlaying && (
        <>
          <PulseRing size={size} enabled={!isPlaying} duration={2500} />
          <PulseRing
            size={size}
            enabled={!isPlaying}
            duration={2500}
            style={{ position: "absolute" }}
          />
        </>
      )}
      <BreathingPulse
        enabled={isPlaying}
        duration={3000}
        scaleRange={[1, 1.03]}
      >
        {children}
      </BreathingPulse>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {},
  ring: {
    position: "absolute",
    borderWidth: 2,
  },
  playButtonContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});
