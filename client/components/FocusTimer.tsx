import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Modal } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

const ACCENT_GOLD = "#C9A227";

const FOCUS_DURATIONS = [
  { minutes: 5, label: "5 min", description: "Quick focus" },
  { minutes: 10, label: "10 min", description: "Short session" },
  { minutes: 15, label: "15 min", description: "Standard" },
  { minutes: 25, label: "25 min", description: "Pomodoro" },
];

interface FocusTimerProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (minutes: number) => void;
  continueAudio?: boolean;
}

export function FocusTimer({ visible, onClose, onComplete, continueAudio = false }: FocusTimerProps) {
  const { theme } = useTheme();
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseValue = useSharedValue(0);

  useEffect(() => {
    if (isRunning && !isPaused) {
      pulseValue.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    } else {
      pulseValue.value = withTiming(0, { duration: 300 });
    }
  }, [isRunning, isPaused]);

  useEffect(() => {
    if (isRunning && !isPaused && remainingTime > 0) {
      timerRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, isPaused, remainingTime]);

  const handleTimerComplete = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRunning(false);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    onComplete(selectedDuration || 0);
  };

  const handleStartTimer = (minutes: number) => {
    setSelectedDuration(minutes);
    setRemainingTime(minutes * 60);
    setIsRunning(true);
    setIsPaused(false);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
  };

  const handlePauseResume = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRunning(false);
    setRemainingTime(0);
    setSelectedDuration(null);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
  };

  const handleClose = () => {
    handleStop();
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseValue.value, [0, 1], [0.4, 0.8]),
    transform: [{ scale: interpolate(pulseValue.value, [0, 1], [1, 1.15]) }],
  }));

  const progress = selectedDuration ? 1 - (remainingTime / (selectedDuration * 60)) : 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={[styles.overlay, { backgroundColor: theme.backgroundRoot + "F5" }]}>
        <View style={styles.container}>
          {!isRunning ? (
            <>
              <View style={styles.header}>
                <ThemedText type="h2" style={styles.title}>
                  Continue with Focus?
                </ThemedText>
                <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {continueAudio ? "Your ambient sounds will continue playing" : "Select a focus duration"}
                </ThemedText>
              </View>

              <View style={styles.durationsGrid}>
                {FOCUS_DURATIONS.map((duration) => (
                  <Pressable
                    key={duration.minutes}
                    onPress={() => handleStartTimer(duration.minutes)}
                    style={({ pressed }) => [
                      styles.durationCard,
                      { 
                        backgroundColor: theme.cardBackground,
                        opacity: pressed ? 0.8 : 1,
                      },
                      Shadows.medium,
                    ]}
                  >
                    <ThemedText type="h2" style={{ color: ACCENT_GOLD }}>
                      {duration.label}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {duration.description}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={handleClose}
                style={[styles.skipButton, { borderColor: theme.border }]}
              >
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  Skip for now
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.timerContainer}>
                <View style={styles.timerCircleContainer}>
                  <Animated.View 
                    style={[
                      styles.timerPulse,
                      { backgroundColor: ACCENT_GOLD },
                      pulseStyle,
                    ]} 
                  />
                  <View style={[styles.timerCircle, { backgroundColor: theme.cardBackground }]}>
                    <ThemedText type="h1" style={styles.timerText}>
                      {formatTime(remainingTime)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {isPaused ? "Paused" : "Focusing"}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${progress * 100}%`,
                          backgroundColor: ACCENT_GOLD,
                        }
                      ]} 
                    />
                  </View>
                </View>

                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                  {selectedDuration} minute focus session
                </ThemedText>
              </View>

              <View style={styles.controlsRow}>
                <Pressable
                  onPress={handleStop}
                  style={[styles.controlButton, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
                <Pressable onPress={handlePauseResume}>
                  <LinearGradient
                    colors={[ACCENT_GOLD, `${ACCENT_GOLD}CC`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.mainControlButton}
                  >
                    <Feather 
                      name={isPaused ? "play" : "pause"} 
                      size={28} 
                      color="#FFFFFF" 
                    />
                  </LinearGradient>
                </Pressable>
                <View style={styles.controlButtonPlaceholder} />
              </View>
            </>
          )}
        </View>
      </View>
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
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
  },
  durationsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  durationCard: {
    width: 140,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  skipButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  timerCircleContainer: {
    width: 220,
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  timerPulse: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.large,
  },
  timerText: {
    fontSize: 48,
    fontWeight: "700",
  },
  progressBarContainer: {
    width: "100%",
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonPlaceholder: {
    width: 56,
    height: 56,
  },
  mainControlButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.large,
  },
});
