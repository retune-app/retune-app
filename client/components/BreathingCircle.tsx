import React, { useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
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
}

const ACCENT_GOLD = "#C9A227";

// Phase colors for visual transitions
const PHASE_COLORS = {
  inhale: "#5BA8A0",    // Warm teal - energizing
  holdIn: "#C9A227",    // Golden - grounding
  exhale: "#4A7C9B",    // Cool blue - calming
  holdOut: "#6B8E9F",   // Neutral blue-gray
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function BreathingCircle({
  technique,
  isPlaying,
  onPhaseChange,
  onCycleComplete,
  size = 280,
  hapticsEnabled = true,
}: BreathingCircleProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0.3);
  const glowIntensity = useSharedValue(0.2);
  const luminosity = useSharedValue(0.5);
  const phaseColorProgress = useSharedValue(0);
  const cycleProgress = useSharedValue(0);
  const [currentPhase, setCurrentPhase] = React.useState<BreathPhase>("inhale");
  const [currentCountdown, setCurrentCountdown] = React.useState(0);
  const [totalCycleTime, setTotalCycleTime] = React.useState(0);
  const [elapsedInCycle, setElapsedInCycle] = React.useState(0);

  // Calculate total cycle time
  useEffect(() => {
    const total = technique.phases.reduce((sum, p) => sum + p.duration, 0);
    setTotalCycleTime(total);
  }, [technique]);

  const triggerHaptic = () => {
    if (hapticsEnabled) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
    }
  };

  const updatePhaseState = (phase: BreathPhase, count: number, elapsed: number) => {
    setCurrentPhase(phase);
    setCurrentCountdown(count);
    setElapsedInCycle(elapsed);
    onPhaseChange?.(phase, count);
  };

  useEffect(() => {
    if (!isPlaying) {
      scale.value = withTiming(0.6, { duration: 500 });
      opacity.value = withTiming(0.3, { duration: 500 });
      glowIntensity.value = withTiming(0.2, { duration: 500 });
      luminosity.value = withTiming(0.5, { duration: 500 });
      cycleProgress.value = withTiming(0, { duration: 500 });
      return;
    }

    let intervalId: NodeJS.Timeout;
    let currentPhaseIdx = 0;
    let currentCountdownVal = technique.phases[0].duration;
    let totalElapsed = 0;

    const runBreathCycle = () => {
      const phase = technique.phases[currentPhaseIdx];
      const phaseName = phase.phase;

      runOnJS(updatePhaseState)(phaseName, currentCountdownVal, totalElapsed);
      runOnJS(triggerHaptic)();

      // Scale animation - expand on inhale, contract on exhale
      const targetScale = phaseName === "inhale" || phaseName === "holdIn" ? 1 : 0.6;
      const targetOpacity = phaseName === "inhale" || phaseName === "holdIn" ? 0.9 : 0.4;
      
      // Glow intensity - brighter during inhale, softer during exhale
      const targetGlow = phaseName === "inhale" ? 0.6 : 
                         phaseName === "holdIn" ? 0.5 :
                         phaseName === "exhale" ? 0.25 : 0.2;
      
      // Luminosity - brightness follows breath (full lungs = bright)
      const targetLuminosity = phaseName === "inhale" || phaseName === "holdIn" ? 0.9 : 0.4;

      // Phase color transition
      const phaseColorValue = phaseName === "inhale" ? 0 :
                              phaseName === "holdIn" ? 1 :
                              phaseName === "exhale" ? 2 : 3;

      scale.value = withTiming(targetScale, {
        duration: phase.duration * 1000,
        easing: Easing.inOut(Easing.ease),
      });

      opacity.value = withTiming(targetOpacity, {
        duration: phase.duration * 1000,
        easing: Easing.inOut(Easing.ease),
      });

      glowIntensity.value = withTiming(targetGlow, {
        duration: phase.duration * 1000,
        easing: Easing.inOut(Easing.ease),
      });

      luminosity.value = withTiming(targetLuminosity, {
        duration: phase.duration * 1000,
        easing: Easing.inOut(Easing.ease),
      });

      phaseColorProgress.value = withTiming(phaseColorValue, {
        duration: 600,
        easing: Easing.inOut(Easing.ease),
      });
    };

    runBreathCycle();

    intervalId = setInterval(() => {
      currentCountdownVal--;
      totalElapsed++;

      // Update cycle progress
      const total = technique.phases.reduce((sum, p) => sum + p.duration, 0);
      cycleProgress.value = withTiming((totalElapsed % total) / total, {
        duration: 900,
        easing: Easing.linear,
      });

      if (currentCountdownVal <= 0) {
        currentPhaseIdx++;

        if (currentPhaseIdx >= technique.phases.length) {
          currentPhaseIdx = 0;
          totalElapsed = 0;
          runOnJS(() => onCycleComplete?.())();
        }

        currentCountdownVal = technique.phases[currentPhaseIdx].duration;
        runBreathCycle();
      } else {
        runOnJS(updatePhaseState)(technique.phases[currentPhaseIdx].phase, currentCountdownVal, totalElapsed);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isPlaying, technique]);

  // Animated styles
  const animatedCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scale.value, [0.6, 1], [0.85, 1.05]) }],
    opacity: interpolate(glowIntensity.value, [0.2, 0.6], [0.15, 0.4]),
  }));

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scale.value, [0.6, 1], [1.0, 1.12]) }],
    opacity: interpolate(scale.value, [0.6, 1], [0.15, 0.35]),
  }));

  // Breathing glow pulse - outer aura
  const glowPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(glowIntensity.value, [0.2, 0.6], [1.1, 1.25]) }],
    opacity: glowIntensity.value,
  }));

  // Inner luminosity - center brightness
  const luminosityStyle = useAnimatedStyle(() => ({
    opacity: luminosity.value,
  }));

  // Phase color interpolation
  const phaseColorStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      phaseColorProgress.value,
      [0, 1, 2, 3],
      [PHASE_COLORS.inhale, PHASE_COLORS.holdIn, PHASE_COLORS.exhale, PHASE_COLORS.holdOut]
    );
    return { backgroundColor };
  });

  // Progress arc
  const circumference = 2 * Math.PI * (size * 0.48);
  const progressArcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - cycleProgress.value),
  }));

  const phaseColor = technique.color || ACCENT_GOLD;

  // Proportional sizing
  const outerGlowSize = size * 1.15;
  const blurRingSize = size * 0.92;
  const innerGlowSize = size * 0.78;
  const mainCircleSize = size * 0.62;
  const luminositySize = size * 0.58;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Layer 1: Breathing Glow Pulse - soft outer aura */}
      <Animated.View
        style={[
          styles.glowPulse,
          glowPulseStyle,
          {
            width: outerGlowSize,
            height: outerGlowSize,
            borderRadius: outerGlowSize / 2,
            backgroundColor: phaseColor,
          },
        ]}
      />

      {/* Layer 2: Progress Arc */}
      <View style={[styles.progressArcContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} style={styles.progressSvg}>
          <Defs>
            <RadialGradient id="ringGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={phaseColor} stopOpacity="0.3" />
              <Stop offset="70%" stopColor={phaseColor} stopOpacity="0.1" />
              <Stop offset="100%" stopColor={phaseColor} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.48}
            stroke={`${phaseColor}20`}
            strokeWidth={size * 0.012}
            fill="none"
          />
          {/* Progress arc */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.48}
            stroke={phaseColor}
            strokeWidth={size * 0.015}
            fill="none"
            strokeDasharray={circumference}
            animatedProps={progressArcProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
      </View>

      {/* Layer 3: Outer Ring with animation */}
      <Animated.View
        style={[
          styles.outerRing,
          outerRingStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: phaseColor,
            borderWidth: size * 0.008,
          },
        ]}
      />

      {/* Layer 4: Blurred middle ring for depth */}
      <View style={[styles.blurRingContainer, { width: blurRingSize, height: blurRingSize, borderRadius: blurRingSize / 2 }]}>
        <BlurView intensity={8} tint="dark" style={styles.blurRing}>
          <Animated.View
            style={[
              styles.blurRingInner,
              innerGlowStyle,
              {
                width: blurRingSize,
                height: blurRingSize,
                borderRadius: blurRingSize / 2,
                backgroundColor: `${phaseColor}40`,
              },
            ]}
          />
        </BlurView>
      </View>

      {/* Layer 5: Inner glow with gradient depth */}
      <Animated.View
        style={[
          styles.innerGlow,
          innerGlowStyle,
          phaseColorStyle,
          {
            width: innerGlowSize,
            height: innerGlowSize,
            borderRadius: innerGlowSize / 2,
          },
        ]}
      />

      {/* Layer 6: Main breathing circle */}
      <Animated.View
        style={[
          animatedCircleStyle,
          styles.mainCircle,
          {
            width: mainCircleSize,
            height: mainCircleSize,
            borderRadius: mainCircleSize / 2,
          },
        ]}
      >
        <LinearGradient
          colors={[
            PHASE_COLORS[currentPhase],
            `${PHASE_COLORS[currentPhase]}CC`,
            `${PHASE_COLORS[currentPhase]}99`,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradientCircle,
            {
              width: mainCircleSize,
              height: mainCircleSize,
              borderRadius: mainCircleSize / 2,
            },
          ]}
        >
          {/* Inner luminosity overlay */}
          <Animated.View
            style={[
              styles.luminosityOverlay,
              luminosityStyle,
              {
                width: luminositySize,
                height: luminositySize,
                borderRadius: luminositySize / 2,
              },
            ]}
          />
          <View style={styles.textContainer}>
            <ThemedText
              type="body"
              style={[styles.phaseText, { color: "#FFFFFF", fontSize: size * 0.065 }]}
            >
              {PHASE_LABELS[currentPhase]}
            </ThemedText>
            <Text style={[styles.countdownText, { fontSize: size * 0.15 }]}>
              {currentCountdown}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  glowPulse: {
    position: "absolute",
    opacity: 0.2,
  },
  progressArcContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  progressSvg: {
    position: "absolute",
  },
  outerRing: {
    position: "absolute",
  },
  blurRingContainer: {
    position: "absolute",
    overflow: "hidden",
  },
  blurRing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  blurRingInner: {
    position: "absolute",
  },
  innerGlow: {
    position: "absolute",
  },
  mainCircle: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gradientCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  luminosityOverlay: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  phaseText: {
    textAlign: "center",
    marginBottom: 4,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  countdownText: {
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
