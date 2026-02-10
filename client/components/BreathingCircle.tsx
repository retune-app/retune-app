import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Text, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

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

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function AnimatedRing({
  size,
  color,
  ringIndex,
  totalRings,
  progress,
  isPlaying,
  idlePulse,
}: {
  size: number;
  color: string;
  ringIndex: number;
  totalRings: number;
  progress: SharedValue<number>;
  isPlaying: boolean;
  idlePulse: SharedValue<number>;
}) {
  const fraction = (ringIndex + 1) / totalRings;
  const ringDiameter = size * (0.38 + fraction * 0.62);
  const baseOpacity = 0.06 + (1 - fraction) * 0.12;
  const expandedOpacity = 0.15 + (1 - fraction) * 0.25;
  const borderW = ringIndex === 0 ? 2 : 1.5 - ringIndex * 0.15;

  const animStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const scaleRange = 0.04 + fraction * 0.08;
    const s = interpolate(p, [0, 1], [1 - scaleRange, 1 + scaleRange * 0.5]);
    const o = interpolate(p, [0, 1], [baseOpacity, expandedOpacity]);
    const idleS = isPlaying ? 1 : idlePulse.value;
    return {
      transform: [{ scale: s * idleS }],
      opacity: o,
    };
  });

  return (
    <Animated.View
      style={[
        styles.ring,
        animStyle,
        {
          width: ringDiameter,
          height: ringDiameter,
          borderRadius: ringDiameter / 2,
          borderWidth: borderW,
          borderColor: color,
        },
      ]}
    />
  );
}

function CoreOrb({
  size,
  color,
  progress,
  isPlaying,
  idlePulse,
}: {
  size: number;
  color: string;
  progress: SharedValue<number>;
  isPlaying: boolean;
  idlePulse: SharedValue<number>;
}) {
  const orbSize = size * 0.32;

  const orbStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const s = interpolate(p, [0, 1], [0.7, 1.0]);
    const o = interpolate(p, [0, 1], [0.25, 0.65]);
    const idleS = isPlaying ? 1 : idlePulse.value;
    return {
      transform: [{ scale: s * idleS }],
      opacity: o,
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const s = interpolate(p, [0, 1], [0.75, 1.15]);
    const o = interpolate(p, [0, 1], [0.08, 0.2]);
    const idleS = isPlaying ? 1 : idlePulse.value;
    return {
      transform: [{ scale: s * idleS }],
      opacity: o,
    };
  });

  const glowSize = orbSize * 1.8;

  return (
    <>
      <Animated.View
        style={[
          styles.ring,
          glowStyle,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: hexToRgba(color, 0.15),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          orbStyle,
          {
            width: orbSize,
            height: orbSize,
            borderRadius: orbSize / 2,
            backgroundColor: color,
          },
        ]}
      />
    </>
  );
}

export default function BreathingCircle({
  technique,
  isPlaying,
  onPhaseChange,
  onCycleComplete,
  size = 280,
  hapticsEnabled = true,
  showContent = true,
}: BreathingCircleProps) {
  const progress = useSharedValue(0);
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
          withTiming(1.03, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.97, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
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
      progress.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) });
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

      const targetProgress = phaseName === "inhale" || phaseName === "holdIn" ? 1 : 0;

      progress.value = withTiming(targetProgress, {
        duration: phase.duration * 1000,
        easing: Easing.inOut(Easing.sin),
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

  const phaseColor = technique.color || ACCENT_GOLD;
  const ringCount = 5;

  const countdownFontSize = Math.round(size * 0.17);
  const phaseFontSize = Math.round(size * 0.055);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {Array.from({ length: ringCount }, (_, i) => (
        <AnimatedRing
          key={i}
          size={size}
          color={phaseColor}
          ringIndex={i}
          totalRings={ringCount}
          progress={progress}
          isPlaying={isPlaying}
          idlePulse={idlePulse}
        />
      ))}

      <CoreOrb
        size={size}
        color={phaseColor}
        progress={progress}
        isPlaying={isPlaying}
        idlePulse={idlePulse}
      />

      {showContent && isPlaying ? (
        <View style={styles.textOverlay} pointerEvents="none">
          <Text
            style={[
              styles.phaseLabel,
              {
                fontSize: phaseFontSize,
                letterSpacing: phaseFontSize * 0.2,
              },
            ]}
          >
            {PHASE_LABELS[currentPhase].toUpperCase()}
          </Text>
          <Text
            style={[
              styles.countdownNumber,
              {
                fontSize: countdownFontSize,
                lineHeight: countdownFontSize * 1.1,
              },
            ]}
          >
            {currentCountdown}
          </Text>
        </View>
      ) : null}
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
  },
  textOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  phaseLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontFamily: Platform.select({ ios: "System", android: "sans-serif-light", default: "sans-serif" }),
    fontWeight: "300",
    textAlign: "center",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  countdownNumber: {
    color: "#FFFFFF",
    fontFamily: Platform.select({ ios: "System", android: "sans-serif-thin", default: "sans-serif" }),
    fontWeight: "200",
    textAlign: "center",
    includeFontPadding: false,
  },
});
