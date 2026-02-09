import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Audio } from "expo-av";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

const ACCENT_GOLD = "#C9A227";
const GOLD_LIGHT = "#E5C95C";
const NAVY = "#0F1C3F";
const PURPLE_SOFT = "#7B68EE";

interface GuidedMomentPlayerProps {
  mood: string;
  timeOfDay: string;
  onClose: () => void;
  visible: boolean;
}

type PlayerState = "idle" | "generating" | "ready" | "playing" | "paused" | "finished" | "error";

interface GeneratedMoment {
  script: string;
  audioBase64: string;
  duration: number;
  wordTimings: Array<{ word: string; startMs: number; endMs: number }>;
  disclaimer: string;
}

export function GuidedMomentPlayer({ mood, timeOfDay, onClose, visible }: GuidedMomentPlayerProps) {
  const { theme } = useTheme();
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [moment, setMoment] = useState<GeneratedMoment | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPosition, setCurrentPosition] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  const pulseAnim = useSharedValue(1);
  const progressAnim = useSharedValue(0);

  useEffect(() => {
    if (playerState === "playing") {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 300 });
    }
  }, [playerState]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  const cleanup = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      cleanup();
      setPlayerState("idle");
      setMoment(null);
      setCurrentPosition(0);
      progressAnim.value = 0;
    }
  }, [visible]);

  useEffect(() => {
    return () => { cleanup(); };
  }, []);

  const generateMoment = useCallback(async () => {
    setPlayerState("generating");
    setErrorMessage("");

    try {
      const url = new URL("/api/guided-moments/generate", getApiUrl()).toString();
      const result = await apiRequest("POST", url, {
        mood,
        timeOfDay,
        usePersonalVoice: false,
        duration: 1,
      });
      const data = await result.json();

      if (data.error) {
        setErrorMessage(data.error);
        setPlayerState("error");
        return;
      }

      setMoment(data);
      setPlayerState("ready");
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    } catch (error: any) {
      setErrorMessage("Something went wrong. Please try again.");
      setPlayerState("error");
    }
  }, [mood, timeOfDay]);

  const playAudio = useCallback(async () => {
    if (!moment?.audioBase64) return;

    try {
      await cleanup();

      const uri = `data:audio/mp3;base64,${moment.audioBase64}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 200 },
        (status) => {
          if (status.isLoaded) {
            setCurrentPosition(status.positionMillis || 0);
            if (status.durationMillis && status.durationMillis > 0) {
              progressAnim.value = (status.positionMillis || 0) / status.durationMillis;
            }
            if (status.didJustFinish) {
              setPlayerState("finished");
              progressAnim.value = withTiming(1, { duration: 300 });
              try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
            }
          }
        }
      );

      soundRef.current = sound;
      setPlayerState("playing");
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    } catch (error) {
      console.error("Error playing guided moment audio:", error);
      setErrorMessage("Could not play audio. Please try again.");
      setPlayerState("error");
    }
  }, [moment, cleanup]);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlayerState("paused");
        } else {
          await soundRef.current.playAsync();
          setPlayerState("playing");
        }
      }
    } catch (e) {}
  }, []);

  const handleClose = useCallback(async () => {
    await cleanup();
    onClose();
  }, [cleanup, onClose]);

  const getVisibleWords = useCallback(() => {
    if (!moment?.wordTimings || moment.wordTimings.length === 0) {
      if (!moment?.script) return [];
      const words = moment.script.split(/\s+/);
      const totalDuration = (moment.duration || 60) * 1000;
      const avgDuration = totalDuration / words.length;
      return words.map((word, i) => ({
        word,
        visible: currentPosition >= i * avgDuration,
      }));
    }

    return moment.wordTimings.map((wt) => ({
      word: wt.word,
      visible: currentPosition >= wt.startMs,
    }));
  }, [moment, currentPosition]);

  if (!visible) return null;

  const moodLabels: Record<string, string> = {
    calm: "Calm",
    stressed: "Stressed",
    tired: "Tired",
    energized: "Energized",
    anxious: "Anxious",
    grateful: "Grateful",
  };

  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.container, { backgroundColor: `${NAVY}F2` }]}>
      {playerState === "idle" ? (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.offerCard}>
          <View style={[styles.iconCircle, { backgroundColor: `${PURPLE_SOFT}20` }]}>
            <Feather name="headphones" size={28} color={PURPLE_SOFT} />
          </View>
          <ThemedText type="h3" style={[styles.offerTitle, { color: theme.text }]}>
            Your Micro-Meditation
          </ThemedText>
          <ThemedText type="body" style={[styles.offerBody, { color: theme.textSecondary }]}>
            A personalized mindfulness exercise just for you, based on how you are feeling right now.
          </ThemedText>
          <Pressable onPress={generateMoment} testID="button-start-guided-moment">
            <LinearGradient
              colors={[ACCENT_GOLD, GOLD_LIGHT] as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.generateButton}
            >
              <Feather name="play" size={18} color={NAVY} />
              <ThemedText type="body" style={styles.generateButtonText}>
                Begin
              </ThemedText>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={handleClose} style={styles.skipButton}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Skip for now
            </ThemedText>
          </Pressable>
        </Animated.View>
      ) : playerState === "generating" ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.generatingCard}>
          <ActivityIndicator size="large" color={ACCENT_GOLD} />
          <ThemedText type="body" style={[styles.generatingText, { color: theme.text }]}>
            Crafting your micro-meditation...
          </ThemedText>
          <ThemedText type="caption" style={[styles.generatingSubtext, { color: theme.textSecondary }]}>
            Generating your personalized audio
          </ThemedText>
        </Animated.View>
      ) : playerState === "error" ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.errorCard}>
          <Feather name="alert-circle" size={32} color="#E85D5D" />
          <ThemedText type="body" style={[styles.errorText, { color: theme.text }]}>
            {errorMessage}
          </ThemedText>
          <Pressable onPress={generateMoment} style={[styles.retryButton, { borderColor: `${ACCENT_GOLD}40` }]}>
            <ThemedText type="caption" style={{ color: ACCENT_GOLD }}>Try Again</ThemedText>
          </Pressable>
          <Pressable onPress={handleClose} style={styles.skipButton}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Close</ThemedText>
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(400)} style={styles.playerCard}>
          <View style={styles.playerHeader}>
            <View style={styles.moodBadge}>
              <ThemedText type="caption" style={styles.moodBadgeText}>
                {moodLabels[mood] || mood} {"\u00B7"} {timeOfDay}
              </ThemedText>
            </View>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <Animated.View style={[styles.circleContainer, pulseStyle]}>
            <Pressable
              onPress={playerState === "ready" ? playAudio : playerState === "finished" ? playAudio : togglePlayPause}
              style={[styles.playCircle, { borderColor: `${ACCENT_GOLD}40` }]}
              testID="button-guided-moment-play"
            >
              <Feather
                name={playerState === "playing" ? "pause" : "play"}
                size={32}
                color={ACCENT_GOLD}
                style={playerState !== "playing" ? { marginLeft: 3 } : undefined}
              />
            </Pressable>
          </Animated.View>

          <View style={[styles.progressBar, { backgroundColor: `${ACCENT_GOLD}15` }]}>
            <Animated.View style={[styles.progressFill, { backgroundColor: ACCENT_GOLD }, progressStyle]} />
          </View>

          <ThemedText type="caption" style={[styles.statusText, { color: theme.textSecondary }]}>
            {playerState === "ready" ? "Tap to begin" :
             playerState === "playing" ? "Breathe and Listen" :
             playerState === "paused" ? "Paused" :
             "Complete"}
          </ThemedText>

          {(playerState === "playing" || playerState === "paused" || playerState === "finished") && moment?.script ? (
            <ScrollView style={styles.scriptScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.scriptContainer}>
                {getVisibleWords().map((item, index) => (
                  <ThemedText
                    key={index}
                    type="body"
                    style={[
                      styles.scriptWord,
                      {
                        color: item.visible ? theme.text : `${theme.text}30`,
                      },
                    ]}
                  >
                    {item.word}{" "}
                  </ThemedText>
                ))}
              </View>
            </ScrollView>
          ) : null}

          {moment?.disclaimer ? (
            <ThemedText type="caption" style={[styles.disclaimer, { color: `${theme.textSecondary}80` }]}>
              {moment.disclaimer}
            </ThemedText>
          ) : null}

          {playerState === "finished" ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.finishedActions}>
              <Pressable onPress={playAudio} style={[styles.replayButton, { borderColor: `${ACCENT_GOLD}30` }]}>
                <Feather name="rotate-ccw" size={16} color={ACCENT_GOLD} />
                <ThemedText type="caption" style={{ color: ACCENT_GOLD, marginLeft: 6 }}>Replay</ThemedText>
              </Pressable>
              <Pressable onPress={handleClose} style={[styles.doneButton]}>
                <LinearGradient
                  colors={[ACCENT_GOLD, GOLD_LIGHT] as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.doneButtonGradient}
                >
                  <ThemedText type="caption" style={{ color: NAVY, fontWeight: "700" }}>Done</ThemedText>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          ) : null}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginTop: Spacing.md,
  },
  offerCard: {
    alignItems: "center",
    padding: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  offerTitle: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  offerBody: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  generateButtonText: {
    color: NAVY,
    fontWeight: "700",
    fontSize: 16,
  },
  skipButton: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  generatingCard: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: Spacing.lg,
  },
  generatingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    fontWeight: "600",
  },
  generatingSubtext: {
    marginTop: Spacing.xs,
    fontSize: 13,
  },
  errorCard: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: Spacing.lg,
  },
  errorText: {
    marginTop: Spacing.md,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  playerCard: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  playerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: Spacing.md,
  },
  moodBadge: {
    backgroundColor: `${PURPLE_SOFT}20`,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  moodBadgeText: {
    color: PURPLE_SOFT,
    fontSize: 12,
    fontWeight: "600",
  },
  circleContainer: {
    marginVertical: Spacing.lg,
  },
  playCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${ACCENT_GOLD}08`,
  },
  progressBar: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  statusText: {
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  scriptScroll: {
    maxHeight: 160,
    width: "100%",
    marginTop: Spacing.sm,
  },
  scriptContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.xs,
  },
  scriptWord: {
    fontSize: 15,
    lineHeight: 24,
  },
  disclaimer: {
    fontSize: 10,
    textAlign: "center",
    marginTop: Spacing.md,
    fontStyle: "italic",
  },
  finishedActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  doneButton: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  doneButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
