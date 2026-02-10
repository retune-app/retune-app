import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import type { BreathPhase, BreathingTechnique } from "@shared/breathingTechniques";
import { PHASE_LABELS } from "@shared/breathingTechniques";

interface BreathingCircleProps {
  technique: BreathingTechnique;
  isPlaying: boolean;
  onPhaseChange?: (phase: BreathPhase, countdown: number) => void;
  onCycleComplete?: () => void;
  size?: number;
  hapticsEnabled?: boolean;
  showContent?: boolean;
}

const ACCENT_GOLD = "#C9A227";

export default function BreathingCircle({
  technique,
  isPlaying,
  onPhaseChange,
  onCycleComplete,
  size = 280,
  hapticsEnabled = true,
  showContent = true,
}: BreathingCircleProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0.3);
  const phaseIndex = useSharedValue(0);
  const countdown = useSharedValue(0);
  const idlePulse = useSharedValue(1);
  const [currentPhase, setCurrentPhase] = React.useState<BreathPhase>("inhale");
  const [currentCountdown, setCurrentCountdown] = React.useState(0);
  const hapticsEnabledRef = useRef(hapticsEnabled);

  useEffect(() => {
    hapticsEnabledRef.current = hapticsEnabled;
  }, [hapticsEnabled]);

  const triggerHaptic = () => {
    if (hapticsEnabledRef.current) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
    }
  };

  const updatePhaseState = (phase: BreathPhase, count: number) => {
    setCurrentPhase(phase);
    setCurrentCountdown(count);
    onPhaseChange?.(phase, count);
  };

  useEffect(() => {
    if (!isPlaying) {
      idlePulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.98, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      idlePulse.value = withTiming(1, { duration: 300 });
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      scale.value = withTiming(0.6, { duration: 500 });
      opacity.value = withTiming(0.3, { duration: 500 });
      return;
    }

    let intervalId: NodeJS.Timeout;
    let currentPhaseIdx = 0;
    let currentCountdownVal = technique.phases[0].duration;

    const runBreathCycle = () => {
      const phase = technique.phases[currentPhaseIdx];
      const phaseName = phase.phase;

      runOnJS(updatePhaseState)(phaseName, currentCountdownVal);
      runOnJS(triggerHaptic)();

      const targetScale = phaseName === "inhale" || phaseName === "holdIn" ? 1 : 0.6;
      const targetOpacity = phaseName === "inhale" || phaseName === "holdIn" ? 0.8 : 0.3;

      scale.value = withTiming(targetScale, {
        duration: phase.duration * 1000,
        easing: Easing.inOut(Easing.ease),
      });

      opacity.value = withTiming(targetOpacity, {
        duration: phase.duration * 1000,
        easing: Easing.inOut(Easing.ease),
      });
    };

    runBreathCycle();

    intervalId = setInterval(() => {
      currentCountdownVal--;

      if (currentCountdownVal <= 0) {
        currentPhaseIdx++;

        if (currentPhaseIdx >= technique.phases.length) {
          currentPhaseIdx = 0;
          runOnJS(() => onCycleComplete?.())();
        }

        currentCountdownVal = technique.phases[currentPhaseIdx].duration;
        runBreathCycle();
      } else {
        runOnJS(updatePhaseState)(technique.phases[currentPhaseIdx].phase, currentCountdownVal);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isPlaying, technique]);

  const animatedCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const idlePulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: idlePulse.value }],
  }));

  const midRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scale.value, [0.6, 1], [0.9, 1.08]) }],
    opacity: interpolate(scale.value, [0.6, 1], [0.1, 0.35]),
  }));

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scale.value, [0.6, 1], [1.0, 1.15]) }],
    opacity: interpolate(scale.value, [0.6, 1], [0.08, 0.25]),
  }));

  const phaseColor = technique.color || ACCENT_GOLD;

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, !isPlaying ? idlePulseStyle : undefined]}>
      <Animated.View
        style={[
          styles.outerRing,
          outerRingStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: phaseColor,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.midRing,
          midRingStyle,
          {
            width: size * 0.75,
            height: size * 0.75,
            borderRadius: size * 0.375,
            borderColor: phaseColor,
          },
        ]}
      />

      <Animated.View
        style={[
          animatedCircleStyle,
          styles.mainCircle,
          {
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: size * 0.25,
            overflow: "hidden",
          },
        ]}
      >
        <LinearGradient
          colors={[phaseColor, `${phaseColor}BB`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradientCircle,
            {
              width: size * 0.5,
              height: size * 0.5,
              borderRadius: size * 0.25,
              overflow: "hidden",
            },
          ]}
        >
          {showContent && isPlaying ? (
            <View style={styles.textContainer}>
              <ThemedText
                type="h2"
                style={[styles.phaseText, {
                  color: "#FFFFFF",
                  textShadowColor: "rgba(0,0,0,0.35)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 3,
                }]}
              >
                {PHASE_LABELS[currentPhase]}
              </ThemedText>
              <Text style={[styles.countdownText, {
                textShadowColor: "rgba(0,0,0,0.35)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }]}>{currentCountdown}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  outerRing: {
    position: "absolute",
    borderWidth: 2,
  },
  midRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
  mainCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  gradientCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  phaseText: {
    textAlign: "center",
    marginBottom: 8,
  },
  countdownText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
