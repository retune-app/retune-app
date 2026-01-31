import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Text, Modal } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { BREATHING_TECHNIQUES, PHASE_LABELS, type BreathPhase } from "@shared/breathingTechniques";

const ACCENT_GOLD = "#C9A227";
const QUICK_BREATH_CYCLES = 3;

interface QuickBreathingModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function QuickBreathingModal({
  visible,
  onClose,
  onComplete,
}: QuickBreathingModalProps) {
  const { theme, isDark } = useTheme();
  const [isBreathing, setIsBreathing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<BreathPhase>("inhale");
  const [countdown, setCountdown] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0.3);

  const technique = BREATHING_TECHNIQUES.find(t => t.id === "coherent") || BREATHING_TECHNIQUES[0];

  useEffect(() => {
    if (!visible) {
      setIsBreathing(false);
      setCyclesCompleted(0);
      setCurrentPhase("inhale");
      setCountdown(0);
      scale.value = 0.6;
      opacity.value = 0.3;
    }
  }, [visible]);

  useEffect(() => {
    if (!isBreathing) return;

    let currentPhaseIdx = 0;
    let currentCountdown = technique.phases[0].duration;

    const runPhase = () => {
      const phase = technique.phases[currentPhaseIdx];
      setCurrentPhase(phase.phase);
      setCountdown(currentCountdown);

      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}

      const targetScale = phase.phase === "inhale" ? 1 : 0.6;
      const targetOpacity = phase.phase === "inhale" ? 0.8 : 0.3;

      scale.value = withTiming(targetScale, {
        duration: phase.duration * 1000,
        easing: Easing.inOut(Easing.ease),
      });

      opacity.value = withTiming(targetOpacity, {
        duration: phase.duration * 1000,
        easing: Easing.inOut(Easing.ease),
      });
    };

    runPhase();

    const intervalId = setInterval(() => {
      currentCountdown--;

      if (currentCountdown <= 0) {
        currentPhaseIdx++;

        if (currentPhaseIdx >= technique.phases.length) {
          currentPhaseIdx = 0;
          setCyclesCompleted(prev => {
            const newCount = prev + 1;
            if (newCount >= QUICK_BREATH_CYCLES) {
              setIsBreathing(false);
              try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
              setTimeout(() => {
                onComplete();
              }, 500);
            }
            return newCount;
          });
        }

        currentCountdown = technique.phases[currentPhaseIdx].duration;
        runPhase();
      } else {
        setCountdown(currentCountdown);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isBreathing, technique]);

  const handleStart = () => {
    setIsBreathing(true);
    setCyclesCompleted(0);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
  };

  const handleSkip = () => {
    setIsBreathing(false);
    onComplete();
  };

  const animatedCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.header}>
            <ThemedText type="h3">Breathe First</ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ThemedText type="small" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Take {QUICK_BREATH_CYCLES} deep breaths to center yourself before your affirmation
          </ThemedText>

          <View style={styles.circleContainer}>
            <Animated.View style={[styles.circle, animatedCircleStyle]}>
              <LinearGradient
                colors={[ACCENT_GOLD, `${ACCENT_GOLD}99`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.circleGradient}
              >
                <ThemedText type="h3" style={styles.phaseText}>
                  {isBreathing ? PHASE_LABELS[currentPhase] : "Ready"}
                </ThemedText>
                {isBreathing ? (
                  <Text style={styles.countdownText}>{countdown}</Text>
                ) : null}
              </LinearGradient>
            </Animated.View>
          </View>

          {isBreathing ? (
            <View style={styles.progressContainer}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Breath {cyclesCompleted + 1} of {QUICK_BREATH_CYCLES}
              </ThemedText>
              <View style={styles.progressDots}>
                {Array.from({ length: QUICK_BREATH_CYCLES }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressDot,
                      {
                        backgroundColor: i < cyclesCompleted ? ACCENT_GOLD : theme.border,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.buttons}>
            {!isBreathing ? (
              <>
                <Pressable onPress={handleSkip} style={[styles.skipButton, { borderColor: theme.border }]}>
                  <Text style={[styles.skipButtonText, { color: theme.textSecondary }]}>Skip</Text>
                </Pressable>
                <Pressable onPress={handleStart}>
                  <LinearGradient
                    colors={[ACCENT_GOLD, `${ACCENT_GOLD}CC`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.startButton, Shadows.small]}
                  >
                    <Feather name="wind" size={20} color="#FFFFFF" />
                    <Text style={styles.startButtonText}>Begin</Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={handleSkip} style={[styles.skipButton, { borderColor: theme.border }]}>
                <Text style={[styles.skipButtonText, { color: theme.textSecondary }]}>Skip & Play</Text>
              </Pressable>
            )}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  container: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  circleContainer: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  circle: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  circleGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseText: {
    color: "#FFFFFF",
    textAlign: "center",
  },
  countdownText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: Spacing.xs,
  },
  progressContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  progressDots: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  buttons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  skipButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
