import React, { useEffect, useRef, useMemo } from "react";
import { View, StyleSheet, Text, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
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

function lightenHex(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, Math.round(r + (255 - r) * amount));
  g = Math.min(255, Math.round(g + (255 - g) * amount));
  b = Math.min(255, Math.round(b + (255 - b) * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function dimHex(hex: string, amount: number): string {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.round(r * (1 - amount));
  g = Math.round(g * (1 - amount));
  b = Math.round(b * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
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

  const hapticIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopHapticPulses = () => {
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
  };

  const startHapticPulses = (phaseName: string) => {
    stopHapticPulses();
    if (!hapticsEnabledRef.current) return;

    if (phaseName === "inhale") {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (e) {}
      hapticIntervalRef.current = setInterval(() => {
        if (!hapticsEnabledRef.current) return;
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (e) {}
      }, 300);
    } else if (phaseName === "exhale") {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
      hapticIntervalRef.current = setInterval(() => {
        if (!hapticsEnabledRef.current) return;
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
      }, 800);
    } else {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
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
          withTiming(1.04, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.96, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
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
      stopHapticPulses();
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
      runOnJS(startHapticPulses)(phaseName);

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
      stopHapticPulses();
    };
  }, [isPlaying, technique]);

  const phaseColor = technique.color || ACCENT_GOLD;

  const colorDim = useMemo(() => dimHex(phaseColor, 0.55), [phaseColor]);
  const colorBright = useMemo(() => lightenHex(phaseColor, 0.35), [phaseColor]);
  const colorBase = useMemo(() => {
    const r = parseInt(phaseColor.slice(1, 3), 16);
    const g = parseInt(phaseColor.slice(3, 5), 16);
    const b = parseInt(phaseColor.slice(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }, [phaseColor]);

  const outerHaloStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const s = interpolate(p, [0, 1], [0.85, 1.2]);
    const o = interpolate(p, [0, 1], [0.04, 0.18]);
    const idleS = isPlaying ? 1 : idlePulse.value;
    const borderC = interpolateColor(p, [0, 0.5, 1], [colorDim, colorBase, colorBright]);
    return { transform: [{ scale: s * idleS }], opacity: o, borderColor: borderC };
  });

  const ring3Style = useAnimatedStyle(() => {
    const p = progress.value;
    const s = interpolate(p, [0, 1], [0.82, 1.1]);
    const o = interpolate(p, [0, 1], [0.06, 0.28]);
    const idleS = isPlaying ? 1 : idlePulse.value;
    const borderC = interpolateColor(p, [0, 0.5, 1], [colorDim, colorBase, colorBright]);
    return { transform: [{ scale: s * idleS }], opacity: o, borderColor: borderC };
  });

  const ring2Style = useAnimatedStyle(() => {
    const p = progress.value;
    const s = interpolate(p, [0, 1], [0.78, 1.02]);
    const o = interpolate(p, [0, 1], [0.08, 0.35]);
    const idleS = isPlaying ? 1 : idlePulse.value;
    const borderC = interpolateColor(p, [0, 0.4, 1], [colorDim, colorBase, colorBright]);
    return { transform: [{ scale: s * idleS }], opacity: o, borderColor: borderC };
  });

  const ring1Style = useAnimatedStyle(() => {
    const p = progress.value;
    const s = interpolate(p, [0, 1], [0.75, 0.95]);
    const o = interpolate(p, [0, 1], [0.1, 0.45]);
    const idleS = isPlaying ? 1 : idlePulse.value;
    const borderC = interpolateColor(p, [0, 0.3, 1], [colorDim, colorBase, colorBright]);
    return { transform: [{ scale: s * idleS }], opacity: o, borderColor: borderC };
  });

  const glowStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const s = interpolate(p, [0, 1], [0.55, 0.92]);
    const o = interpolate(p, [0, 1], [0.12, 0.45]);
    const idleS = isPlaying ? 1 : idlePulse.value;
    const bgC = interpolateColor(p, [0, 0.5, 1], [colorDim, colorBase, colorBright]);
    return { transform: [{ scale: s * idleS }], opacity: o, backgroundColor: bgC };
  });

  const coreStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const s = interpolate(p, [0, 1], [0.5, 0.82]);
    const o = interpolate(p, [0, 1], [0.35, 0.9]);
    const idleS = isPlaying ? 1 : idlePulse.value;
    return { transform: [{ scale: s * idleS }], opacity: o };
  });

  const phaseTextStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const s = interpolate(p, [0, 1], [1.15, 0.82]);
    const o = interpolate(p, [0, 1], [1.0, 0.7]);
    return {
      transform: [{ scale: s }],
      opacity: o,
    };
  });

  const haloD = size * 1.05;
  const r3D = size * 0.92;
  const r2D = size * 0.78;
  const r1D = size * 0.65;
  const glowD = size * 0.72;
  const coreD = size * 0.55;

  const countdownFontSize = Math.round(size * 0.16);
  const phaseFontSize = Math.round(size * 0.05);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.centered,
          outerHaloStyle,
          {
            width: haloD,
            height: haloD,
            borderRadius: haloD / 2,
            borderWidth: 1.5,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.centered,
          ring3Style,
          {
            width: r3D,
            height: r3D,
            borderRadius: r3D / 2,
            borderWidth: 1.5,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.centered,
          ring2Style,
          {
            width: r2D,
            height: r2D,
            borderRadius: r2D / 2,
            borderWidth: 2,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.centered,
          ring1Style,
          {
            width: r1D,
            height: r1D,
            borderRadius: r1D / 2,
            borderWidth: 2.5,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.centered,
          glowStyle,
          {
            width: glowD,
            height: glowD,
            borderRadius: glowD / 2,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.centered,
          coreStyle,
          {
            width: coreD,
            height: coreD,
            borderRadius: coreD / 2,
            overflow: "hidden",
          },
        ]}
      >
        <LinearGradient
          colors={[
            hexToRgba(phaseColor, 0.95),
            hexToRgba(phaseColor, 0.6),
            hexToRgba(phaseColor, 0.3),
          ]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {showContent && isPlaying ? (
        <View style={styles.textOverlay} pointerEvents="none">
          <Animated.Text
            style={[
              styles.phaseLabel,
              {
                fontSize: phaseFontSize,
                letterSpacing: phaseFontSize * 0.18,
              },
              (currentPhase === "holdIn" || currentPhase === "holdOut") ? styles.phaseLabelBold : undefined,
              phaseTextStyle,
            ]}
          >
            {PHASE_LABELS[currentPhase].toUpperCase()}
          </Animated.Text>
          <Text
            style={[
              styles.countdownNumber,
              {
                fontSize: countdownFontSize,
                lineHeight: countdownFontSize * 1.15,
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
  centered: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  textOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  phaseLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "300",
    textAlign: "center",
    marginBottom: 2,
  },
  phaseLabelBold: {
    fontWeight: "700",
  },
  countdownNumber: {
    color: "#FFFFFF",
    fontWeight: "200",
    textAlign: "center",
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
});
