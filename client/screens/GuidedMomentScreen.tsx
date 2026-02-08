import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Modal,
  Dimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import {
  BackgroundMusicType,
  BACKGROUND_MUSIC_OPTIONS,
  getSoundsByCategory,
  useBackgroundMusic,
  BackgroundMusicOption,
} from "@/contexts/BackgroundMusicContext";

const ACCENT_GOLD = "#C9A227";
const GOLD_LIGHT = "#E5C95C";
const NAVY = "#0F1C3F";
const NAVY_MID = "#1A2D4F";

const MOOD_SOUND_MAP: Record<string, BackgroundMusicType> = {
  calm: "ocean-waves-beach",
  stressed: "rain-soft",
  tired: "meditation-morning-mist",
  energized: "binaural-beta",
  anxious: "meditation-singing-bowls",
  grateful: "forest-night",
};

const MOOD_LABELS: Record<string, string> = {
  calm: "Calm",
  stressed: "Stressed",
  tired: "Tired",
  energized: "Energized",
  anxious: "Anxious",
  grateful: "Grateful",
};

const CATEGORY_COLORS: Record<string, string> = {
  rain: "#4FC3F7",
  ocean: "#29B6F6",
  forest: "#66BB6A",
  meditation: "#E040FB",
  solfeggio: "#C9A227",
  binaural: "#9C27B0",
  noise: "#78909C",
};

const CATEGORY_LABELS: Record<string, string> = {
  rain: "Rain",
  ocean: "Ocean",
  forest: "Forest & Birds",
  meditation: "Meditation",
  solfeggio: "Solfeggio",
  binaural: "Binaural",
  noise: "Noise",
};

type PlayerState = "idle" | "generating" | "ready" | "playing" | "paused" | "finished" | "error";

interface GeneratedMoment {
  script: string;
  audioBase64: string;
  duration: number;
  wordTimings: Array<{ word: string; startMs: number; endMs: number }>;
  disclaimer: string;
}

type ScreenPhase = "selection" | "player";

interface CategorySection {
  key: string;
  label: string;
  color: string;
  sounds: BackgroundMusicOption[];
}

export type GuidedMomentScreenParams = {
  mood: string;
  timeOfDay: string;
};

export default function GuidedMomentScreen({ route, navigation }: NativeStackScreenProps<any, "GuidedMoment">) {
  const { mood, timeOfDay } = (route.params as GuidedMomentScreenParams) || { mood: "calm", timeOfDay: "morning" };
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    selectedMusic,
    setSelectedMusic,
    startBackgroundMusic,
    stopBackgroundMusic,
    isPlaying: isBgPlaying,
  } = useBackgroundMusic();

  const [phase, setPhase] = useState<ScreenPhase>("selection");
  const [selectedSound, setSelectedSound] = useState<BackgroundMusicType>(
    MOOD_SOUND_MAP[mood] || "ocean-waves-beach"
  );
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [moment, setMoment] = useState<GeneratedMoment | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPosition, setCurrentPosition] = useState(0);
  const [showSoundSwitcher, setShowSoundSwitcher] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const pulseAnim = useSharedValue(1);
  const progressAnim = useSharedValue(0);

  const categories = useMemo<CategorySection[]>(() => {
    const byCategory = getSoundsByCategory();
    const order: Array<keyof ReturnType<typeof getSoundsByCategory>> = [
      "rain", "ocean", "forest", "meditation", "solfeggio", "binaural", "noise",
    ];
    return order.map((key) => ({
      key,
      label: CATEGORY_LABELS[key] || key,
      color: CATEGORY_COLORS[key] || "#999",
      sounds: byCategory[key],
    }));
  }, []);

  useEffect(() => {
    if (playerState === "playing") {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) })
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
    opacity: 0.15,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  const cleanupVoice = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupVoice();
      stopBackgroundMusic();
    };
  }, []);

  const handleClose = useCallback(async () => {
    await cleanupVoice();
    await stopBackgroundMusic();
    navigation.goBack();
  }, [cleanupVoice, stopBackgroundMusic, navigation]);

  const handleSelectSound = useCallback(async (soundId: BackgroundMusicType) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setSelectedSound(soundId);

    if (soundId === "none") {
      await stopBackgroundMusic();
      return;
    }

    await setSelectedMusic(soundId);
    await startBackgroundMusic();
  }, [setSelectedMusic, startBackgroundMusic, stopBackgroundMusic]);

  const handleSwitchSoundDuringPlayback = useCallback(async (soundId: BackgroundMusicType) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setSelectedSound(soundId);

    if (soundId === "none") {
      await stopBackgroundMusic();
    } else {
      await setSelectedMusic(soundId);
      await startBackgroundMusic();
    }
  }, [setSelectedMusic, startBackgroundMusic, stopBackgroundMusic]);

  const handleBeginGuidedMoment = useCallback(async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    setPhase("player");
    setPlayerState("generating");
    setErrorMessage("");

    if (selectedSound !== "none") {
      await setSelectedMusic(selectedSound);
      await startBackgroundMusic();
    }

    try {
      const url = new URL("/api/guided-moments/generate", getApiUrl()).toString();
      const result = await apiRequest("POST", url, {
        mood,
        timeOfDay,
        usePersonalVoice: false,
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
  }, [mood, timeOfDay, selectedSound, setSelectedMusic, startBackgroundMusic]);

  const playAudio = useCallback(async () => {
    if (!moment?.audioBase64) return;

    try {
      await cleanupVoice();

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      const uri = `data:audio/mp3;base64,${moment.audioBase64}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 150 },
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
      setErrorMessage("Could not play audio. Please try again.");
      setPlayerState("error");
    }
  }, [moment, cleanupVoice]);

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
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    } catch (e) {}
  }, []);

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

  const renderSoundTile = useCallback((
    sound: BackgroundMusicOption,
    isSelected: boolean,
    onPress: (id: BackgroundMusicType) => void,
    compact?: boolean
  ) => {
    const tileSize = compact ? 88 : 100;
    return (
      <Pressable
        key={sound.id}
        onPress={() => onPress(sound.id)}
        style={[
          styles.soundTile,
          {
            width: tileSize,
            height: tileSize,
            backgroundColor: isSelected ? `${ACCENT_GOLD}20` : "rgba(255,255,255,0.06)",
            borderColor: isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.1)",
          },
        ]}
        testID={`button-sound-${sound.id}`}
      >
        <Feather
          name={sound.icon as any}
          size={compact ? 20 : 24}
          color={isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.6)"}
        />
        <ThemedText
          type="caption"
          style={[
            styles.soundTileName,
            {
              color: isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.7)",
              fontSize: compact ? 10 : 11,
            },
          ]}
        >
          {sound.name}
        </ThemedText>
      </Pressable>
    );
  }, []);

  const renderNoSoundTile = useCallback((
    onPress: (id: BackgroundMusicType) => void,
    compact?: boolean
  ) => {
    const isSelected = selectedSound === "none";
    const tileSize = compact ? 88 : 100;
    return (
      <Pressable
        onPress={() => onPress("none" as BackgroundMusicType)}
        style={[
          styles.soundTile,
          {
            width: tileSize,
            height: tileSize,
            backgroundColor: isSelected ? `${ACCENT_GOLD}20` : "rgba(255,255,255,0.06)",
            borderColor: isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.1)",
          },
        ]}
        testID="button-sound-none"
      >
        <Feather
          name="volume-x"
          size={compact ? 20 : 24}
          color={isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.6)"}
        />
        <ThemedText
          type="caption"
          style={[
            styles.soundTileName,
            {
              color: isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.7)",
              fontSize: compact ? 10 : 11,
            },
          ]}
        >
          {"No sound"}
        </ThemedText>
      </Pressable>
    );
  }, [selectedSound]);

  if (phase === "selection") {
    return (
      <LinearGradient
        colors={[NAVY, NAVY_MID] as [string, string]}
        style={styles.container}
      >
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={styles.headerLeft}>
            <ThemedText type="h3" style={styles.headerTitle}>
              {"Choose Your Sound Bath"}
            </ThemedText>
            <View style={styles.moodBadge}>
              <ThemedText type="caption" style={styles.moodBadgeText}>
                {MOOD_LABELS[mood] || mood}
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={styles.closeButton}
            testID="button-close-guided-moment"
          >
            <Feather name="x" size={24} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.selectionScroll}
          contentContainerStyle={styles.selectionScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.noSoundRow}>
            {renderNoSoundTile(handleSelectSound)}
            <View style={styles.noSoundLabel}>
              <ThemedText type="small" style={styles.noSoundText}>
                {"Prefer silence? Select no sound for a quiet guided moment."}
              </ThemedText>
            </View>
          </View>

          {categories.map((category) => (
            <Animated.View
              key={category.key}
              entering={FadeIn.duration(300)}
              style={styles.categorySection}
            >
              <ThemedText
                type="small"
                style={[styles.categoryHeader, { color: category.color }]}
              >
                {category.label}
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {category.sounds.map((sound) =>
                  renderSoundTile(
                    sound,
                    selectedSound === sound.id,
                    handleSelectSound
                  )
                )}
              </ScrollView>
            </Animated.View>
          ))}
        </ScrollView>

        <View style={[styles.bottomAction, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Pressable onPress={handleBeginGuidedMoment} testID="button-begin-guided-moment">
            <LinearGradient
              colors={[ACCENT_GOLD, GOLD_LIGHT] as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.beginButton}
            >
              <Feather name="play" size={20} color={NAVY} />
              <ThemedText type="body" style={styles.beginButtonText}>
                {"Begin Guided Moment"}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[NAVY, NAVY_MID] as [string, string]}
      style={styles.container}
    >
      <Animated.View
        style={[styles.breathingCircleBg, pulseStyle]}
      >
        <View style={styles.breathingCircle} />
      </Animated.View>

      <View style={[styles.playerHeader, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.playerHeaderLeft}>
          <View style={styles.moodBadge}>
            <ThemedText type="caption" style={styles.moodBadgeText}>
              {MOOD_LABELS[mood] || mood}
            </ThemedText>
          </View>
          <ThemedText type="caption" style={styles.timeText}>
            {timeOfDay}
          </ThemedText>
        </View>
        <View style={styles.playerHeaderRight}>
          {(playerState === "playing" || playerState === "paused" || playerState === "ready") ? (
            <Pressable
              onPress={() => setShowSoundSwitcher(true)}
              hitSlop={12}
              style={styles.soundSwitcherBtn}
              testID="button-sound-switcher"
            >
              <Feather name="music" size={20} color={ACCENT_GOLD} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={styles.closeButton}
            testID="button-close-player"
          >
            <Feather name="x" size={24} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>
      </View>

      <View style={styles.playerContent}>
        {playerState === "generating" ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.generatingContainer}>
            <ActivityIndicator size="large" color={ACCENT_GOLD} />
            <ThemedText type="body" style={styles.generatingText}>
              {"Crafting your guided moment..."}
            </ThemedText>
            <ThemedText type="caption" style={styles.generatingSubtext}>
              {"Generating script and voice audio"}
            </ThemedText>
          </Animated.View>
        ) : playerState === "error" ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
            <Feather name="alert-circle" size={40} color="#E85D5D" />
            <ThemedText type="body" style={styles.errorText}>
              {errorMessage}
            </ThemedText>
            <Pressable
              onPress={handleBeginGuidedMoment}
              style={styles.retryButton}
              testID="button-retry-guided-moment"
            >
              <ThemedText type="caption" style={{ color: ACCENT_GOLD }}>
                {"Try Again"}
              </ThemedText>
            </Pressable>
            <Pressable onPress={handleClose} style={styles.dismissBtn}>
              <ThemedText type="caption" style={styles.dismissText}>
                {"Close"}
              </ThemedText>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(400)} style={styles.playerMain}>
            <Animated.View style={[styles.playCircleOuter, pulseStyle]}>
              <View style={styles.playCircleGlow} />
            </Animated.View>

            <Pressable
              onPress={
                playerState === "ready" || playerState === "finished"
                  ? playAudio
                  : togglePlayPause
              }
              style={styles.playCircle}
              testID="button-guided-moment-play"
            >
              <Feather
                name={playerState === "playing" ? "pause" : "play"}
                size={36}
                color={ACCENT_GOLD}
                style={playerState !== "playing" ? { marginLeft: 4 } : undefined}
              />
            </Pressable>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[styles.progressFill, progressStyle]}
                />
              </View>
            </View>

            <ThemedText type="caption" style={styles.statusText}>
              {playerState === "ready"
                ? "Tap to begin"
                : playerState === "playing"
                ? "Listening..."
                : playerState === "paused"
                ? "Paused"
                : "Complete"}
            </ThemedText>

            {(playerState === "playing" || playerState === "paused" || playerState === "finished") && moment?.script ? (
              <ScrollView
                style={styles.scriptScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scriptScrollContent}
              >
                <View style={styles.scriptContainer}>
                  {getVisibleWords().map((item, index) => (
                    <ThemedText
                      key={index}
                      type="body"
                      style={[
                        styles.scriptWord,
                        {
                          color: item.visible
                            ? "rgba(255,255,255,0.95)"
                            : "rgba(255,255,255,0.15)",
                        },
                      ]}
                    >
                      {item.word}{" "}
                    </ThemedText>
                  ))}
                </View>
              </ScrollView>
            ) : null}

            {playerState === "finished" ? (
              <Animated.View entering={FadeInUp.duration(400)} style={styles.finishedActions}>
                <Pressable
                  onPress={playAudio}
                  style={styles.replayButton}
                  testID="button-replay-guided-moment"
                >
                  <Feather name="rotate-ccw" size={16} color={ACCENT_GOLD} />
                  <ThemedText type="caption" style={{ color: ACCENT_GOLD, marginLeft: 6 }}>
                    {"Replay"}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={handleClose} testID="button-done-guided-moment">
                  <LinearGradient
                    colors={[ACCENT_GOLD, GOLD_LIGHT] as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.doneButtonGradient}
                  >
                    <ThemedText type="caption" style={{ color: NAVY, fontWeight: "700" }}>
                      {"Done"}
                    </ThemedText>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            ) : null}
          </Animated.View>
        )}
      </View>

      {moment?.disclaimer ? (
        <View style={[styles.disclaimerContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <ThemedText type="caption" style={styles.disclaimer}>
            {moment.disclaimer}
          </ThemedText>
        </View>
      ) : null}

      <Modal
        visible={showSoundSwitcher}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSoundSwitcher(false)}
      >
        <Pressable
          style={styles.switcherOverlay}
          onPress={() => setShowSoundSwitcher(false)}
        >
          <Pressable
            style={[styles.switcherContent, { paddingBottom: insets.bottom + Spacing.md }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.switcherHandle} />
            <View style={styles.switcherHeader}>
              <ThemedText type="h4" style={styles.switcherTitle}>
                {"Switch Sound"}
              </ThemedText>
              <Pressable
                onPress={() => setShowSoundSwitcher(false)}
                hitSlop={12}
                testID="button-close-sound-switcher"
              >
                <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.switcherScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.switcherNoSound}>
                {renderNoSoundTile(handleSwitchSoundDuringPlayback, true)}
              </View>
              {categories.map((category) => (
                <View key={category.key} style={styles.switcherCategory}>
                  <ThemedText
                    type="caption"
                    style={[styles.switcherCategoryLabel, { color: category.color }]}
                  >
                    {category.label}
                  </ThemedText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.switcherRow}
                  >
                    {category.sounds.map((sound) =>
                      renderSoundTile(
                        sound,
                        selectedSound === sound.id,
                        handleSwitchSoundDuringPlayback,
                        true
                      )
                    )}
                  </ScrollView>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  headerTitle: {
    color: "rgba(255,255,255,0.95)",
    marginBottom: Spacing.xs,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  moodBadge: {
    alignSelf: "flex-start",
    backgroundColor: `${ACCENT_GOLD}20`,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  moodBadgeText: {
    color: ACCENT_GOLD,
    fontSize: 11,
    fontWeight: "600",
  },
  selectionScroll: {
    flex: 1,
  },
  selectionScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  noSoundRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  noSoundLabel: {
    flex: 1,
  },
  noSoundText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    lineHeight: 18,
  },
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryHeader: {
    fontWeight: "700",
    fontSize: 13,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  categoryRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  soundTile: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  soundTileName: {
    textAlign: "center",
    fontWeight: "500",
    paddingHorizontal: 4,
  },
  bottomAction: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  beginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  beginButtonText: {
    color: NAVY,
    fontWeight: "700",
    fontSize: 17,
  },
  breathingCircleBg: {
    position: "absolute",
    top: "30%",
    left: "50%",
    marginLeft: -120,
    marginTop: -120,
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  breathingCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: ACCENT_GOLD,
  },
  playerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    zIndex: 2,
  },
  playerHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  playerHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  timeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  soundSwitcherBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${ACCENT_GOLD}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  playerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    zIndex: 2,
  },
  generatingContainer: {
    alignItems: "center",
  },
  generatingText: {
    color: "rgba(255,255,255,0.9)",
    marginTop: Spacing.lg,
    fontSize: 17,
    fontWeight: "600",
  },
  generatingSubtext: {
    color: "rgba(255,255,255,0.5)",
    marginTop: Spacing.xs,
    fontSize: 13,
  },
  errorContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    color: "rgba(255,255,255,0.9)",
    marginTop: Spacing.md,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${ACCENT_GOLD}40`,
  },
  dismissBtn: {
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  dismissText: {
    color: "rgba(255,255,255,0.5)",
  },
  playerMain: {
    alignItems: "center",
    width: "100%",
  },
  playCircleOuter: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  playCircleGlow: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: ACCENT_GOLD,
  },
  playCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: `${ACCENT_GOLD}60`,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${NAVY}E0`,
    zIndex: 3,
  },
  progressContainer: {
    width: "100%",
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  progressBar: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: ACCENT_GOLD,
  },
  statusText: {
    color: "rgba(255,255,255,0.5)",
    marginTop: Spacing.sm,
    fontSize: 13,
  },
  scriptScroll: {
    maxHeight: 180,
    width: "100%",
    marginTop: Spacing.lg,
  },
  scriptScrollContent: {
    paddingHorizontal: Spacing.sm,
  },
  scriptContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  scriptWord: {
    fontSize: 17,
    lineHeight: 28,
  },
  finishedActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${ACCENT_GOLD}30`,
  },
  doneButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimerContainer: {
    paddingHorizontal: Spacing.xxl,
    zIndex: 2,
  },
  disclaimer: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 14,
  },
  switcherOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  switcherContent: {
    backgroundColor: NAVY_MID,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.md,
    maxHeight: "65%",
  },
  switcherHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  switcherHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  switcherTitle: {
    color: "rgba(255,255,255,0.9)",
  },
  switcherScroll: {
    paddingHorizontal: Spacing.lg,
  },
  switcherNoSound: {
    marginBottom: Spacing.md,
  },
  switcherCategory: {
    marginBottom: Spacing.md,
  },
  switcherCategoryLabel: {
    fontWeight: "700",
    fontSize: 11,
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  switcherRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
});
