import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";

import { ThemedText } from "@/components/ThemedText";
import BreathingCircle from "@/components/BreathingCircle";
import { useTheme } from "@/hooks/useTheme";
import { useBackgroundMusic, BACKGROUND_MUSIC_OPTIONS, type BackgroundMusicType } from "@/contexts/BackgroundMusicContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import {
  BREATHING_TECHNIQUES,
  DURATION_OPTIONS,
  getTotalCycleDuration,
  getCyclesForDuration,
  type BreathingTechnique,
  type BreathPhase,
} from "@shared/breathingTechniques";

const ACCENT_GOLD = "#C9A227";

export default function BreathingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { selectedMusic, setSelectedMusic, startBackgroundMusic, stopBackgroundMusic, isPlaying: isMusicPlaying } = useBackgroundMusic();

  const [selectedTechnique, setSelectedTechnique] = useState<BreathingTechnique>(BREATHING_TECHNIQUES[0]);
  const [selectedDuration, setSelectedDuration] = useState(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wasPlayingMusicRef = useRef(false);

  const remainingTime = selectedDuration - elapsedTime;
  const totalCycles = getCyclesForDuration(selectedTechnique, selectedDuration);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (isPlaying && isMusicPlaying) {
        stopBackgroundMusic();
      }
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => {
          if (prev >= selectedDuration - 1) {
            handleStop();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, selectedDuration]);

  const handleStart = async () => {
    setIsPlaying(true);
    setElapsedTime(0);
    setCyclesCompleted(0);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    
    if (selectedMusic !== 'none') {
      await startBackgroundMusic();
    }
  };

  const handlePause = async () => {
    setIsPlaying(false);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    
    if (isMusicPlaying) {
      await stopBackgroundMusic();
    }
  };

  const handleResume = async () => {
    setIsPlaying(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    
    if (selectedMusic !== 'none') {
      await startBackgroundMusic();
    }
  };

  const handleStop = async () => {
    setIsPlaying(false);
    setElapsedTime(0);
    setCyclesCompleted(0);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    
    if (isMusicPlaying) {
      await stopBackgroundMusic();
    }
  };

  const handleCycleComplete = () => {
    setCyclesCompleted((prev) => prev + 1);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const selectTechnique = (technique: BreathingTechnique) => {
    if (!isPlaying) {
      setSelectedTechnique(technique);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.techniqueSection}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Choose Technique
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.techniqueCards}
        >
          {BREATHING_TECHNIQUES.map((technique) => (
            <Pressable
              key={technique.id}
              onPress={() => selectTechnique(technique)}
              style={[
                styles.techniqueCard,
                {
                  backgroundColor:
                    selectedTechnique.id === technique.id
                      ? `${technique.color}20`
                      : theme.cardBackground,
                  borderColor:
                    selectedTechnique.id === technique.id
                      ? technique.color
                      : theme.border,
                },
                Shadows.small,
              ]}
              testID={`technique-${technique.id}`}
            >
              <View
                style={[
                  styles.techniqueIcon,
                  { backgroundColor: `${technique.color}30` },
                ]}
              >
                <Feather
                  name={technique.icon as any}
                  size={24}
                  color={technique.color}
                />
              </View>
              <ThemedText type="body" style={styles.techniqueName}>
                {technique.name}
              </ThemedText>
              <ThemedText
                type="caption"
                style={[styles.techniqueDesc, { color: theme.textSecondary }]}
              >
                {technique.description}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.circleSection}>
        <BreathingCircle
          technique={selectedTechnique}
          isPlaying={isPlaying}
          onCycleComplete={handleCycleComplete}
          hapticsEnabled={hapticsEnabled}
          size={280}
        />

        {isPlaying ? (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Time Left
              </ThemedText>
              <ThemedText type="h3">{formatTime(remainingTime)}</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Cycles
              </ThemedText>
              <ThemedText type="h3">
                {cyclesCompleted}/{totalCycles}
              </ThemedText>
            </View>
          </View>
        ) : null}
      </View>

      {!isPlaying ? (
        <>
          <View style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Duration
            </ThemedText>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setSelectedDuration(option.value);
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                  }}
                  style={[
                    styles.durationButton,
                    {
                      backgroundColor:
                        selectedDuration === option.value
                          ? ACCENT_GOLD
                          : theme.backgroundSecondary,
                      borderColor:
                        selectedDuration === option.value
                          ? ACCENT_GOLD
                          : theme.border,
                    },
                  ]}
                  testID={`duration-${option.value}`}
                >
                  <Text
                    style={[
                      styles.durationText,
                      {
                        color:
                          selectedDuration === option.value
                            ? "#FFFFFF"
                            : theme.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Background Sound
            </ThemedText>
            <View style={styles.soundRow}>
              {BACKGROUND_MUSIC_OPTIONS.map((sound) => {
                const iconName = sound.id === 'none' ? 'volume-x' : 
                  sound.id === 'theta' || sound.id === 'alpha' || sound.id === 'delta' || sound.id === 'beta' ? 'radio' : 'activity';
                return (
                  <Pressable
                    key={sound.id}
                    onPress={() => {
                      setSelectedMusic(sound.id);
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                    }}
                    style={[
                      styles.soundButton,
                      {
                        backgroundColor:
                          selectedMusic === sound.id
                            ? `${ACCENT_GOLD}20`
                            : theme.backgroundSecondary,
                        borderColor:
                          selectedMusic === sound.id ? ACCENT_GOLD : theme.border,
                      },
                    ]}
                    testID={`sound-${sound.id}`}
                  >
                    <Feather
                      name={iconName as any}
                      size={20}
                      color={selectedMusic === sound.id ? ACCENT_GOLD : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.soundText,
                        {
                          color:
                            selectedMusic === sound.id ? ACCENT_GOLD : theme.text,
                        },
                      ]}
                    >
                      {sound.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Pressable
              onPress={() => setHapticsEnabled(!hapticsEnabled)}
              style={[styles.settingRow, { backgroundColor: theme.cardBackground }]}
            >
              <View style={styles.settingInfo}>
                <Feather name="smartphone" size={20} color={theme.text} />
                <ThemedText type="body" style={{ marginLeft: Spacing.md }}>
                  Haptic Feedback
                </ThemedText>
              </View>
              <View
                style={[
                  styles.toggle,
                  {
                    backgroundColor: hapticsEnabled ? ACCENT_GOLD : theme.backgroundSecondary,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    {
                      transform: [{ translateX: hapticsEnabled ? 20 : 0 }],
                    },
                  ]}
                />
              </View>
            </Pressable>
          </View>
        </>
      ) : null}

      <View style={styles.controlSection}>
        {!isPlaying ? (
          <Pressable onPress={handleStart} testID="button-start-breathing">
            <LinearGradient
              colors={[selectedTechnique.color, `${selectedTechnique.color}CC`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.startButton, Shadows.medium]}
            >
              <Feather name="play" size={28} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Start Breathing</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={styles.playingControls}>
            <Pressable
              onPress={handleStop}
              style={[styles.controlButton, { backgroundColor: theme.backgroundSecondary }]}
              testID="button-stop-breathing"
            >
              <Feather name="square" size={24} color={theme.text} />
            </Pressable>
            <Pressable
              onPress={isPlaying ? handlePause : handleResume}
              testID="button-pause-breathing"
            >
              <LinearGradient
                colors={[selectedTechnique.color, `${selectedTechnique.color}CC`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.pauseButton, Shadows.medium]}
              >
                <Feather name="pause" size={28} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  techniqueSection: {
    marginBottom: Spacing.xl,
  },
  techniqueCards: {
    gap: Spacing.md,
    paddingRight: Spacing.lg,
  },
  techniqueCard: {
    width: 160,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  techniqueIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  techniqueName: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  techniqueDesc: {
    fontSize: 12,
  },
  circleSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  durationRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  durationButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
  },
  durationText: {
    fontWeight: "600",
    fontSize: 14,
  },
  soundRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  soundButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  soundText: {
    fontSize: 13,
    fontWeight: "500",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 4,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  controlSection: {
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.full,
    gap: Spacing.md,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  playingControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
