import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo } from "react";
import { View, StyleSheet, Pressable, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { HeaderButton } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { RSVPDisplay, WordTiming, RSVPFontSize } from "@/components/RSVPDisplay";
import { IconButton } from "@/components/IconButton";
import { useTheme } from "@/hooks/useTheme";
import { useAudio } from "@/contexts/AudioContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Affirmation } from "@shared/schema";

const AUTO_REPLAY_KEY = "@settings/autoReplay";
const RSVP_ENABLED_KEY = "@settings/rsvpEnabled";
const RSVP_FONT_SIZE_KEY = "@settings/rsvpFontSize";
const RSVP_HIGHLIGHT_KEY = "@settings/rsvpHighlight";
const SHOW_SCRIPT_KEY = "@settings/showScript";

type PlayerRouteProp = RouteProp<RootStackParamList, "Player">;
type PlayerNavigationProp = NativeStackNavigationProp<RootStackParamList, "Player">;

export default function PlayerScreen() {
  const route = useRoute<PlayerRouteProp>();
  const navigation = useNavigation<PlayerNavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const { affirmationId, isNew = false } = route.params;

  const {
    currentAffirmation,
    isPlaying,
    position,
    duration,
    autoReplay,
    playbackSpeed,
    playAffirmation,
    togglePlayPause,
    setAutoReplay,
    setPlaybackSpeed,
    stop,
  } = useAudio();
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [rsvpFontSize, setRsvpFontSize] = useState<RSVPFontSize>("M");
  const [rsvpHighlight, setRsvpHighlight] = useState(false);
  const [showRsvpSettings, setShowRsvpSettings] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const rotation = useSharedValue(0);

  const { data: affirmation, isLoading } = useQuery<Affirmation>({
    queryKey: ["/api/affirmations", affirmationId],
  });

  const isCurrentlyPlaying = currentAffirmation?.id === affirmationId && isPlaying;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (currentAffirmation?.id === affirmationId) {
        await stop();
      }
      await apiRequest("DELETE", `/api/affirmations/${affirmationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to delete affirmation");
    },
  });

  const autoSaveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/affirmations/${affirmationId}/auto-save`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations", affirmationId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved", "Affirmation saved to your library with an AI-generated title!");
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to save affirmation");
    },
  });

  const handleSave = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    autoSaveMutation.mutate();
  }, [autoSaveMutation]);

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Affirmation",
      `Are you sure you want to delete "${affirmation?.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  }, [affirmation?.title, deleteMutation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        isNew ? (
          <HeaderButton
            onPress={handleSave}
            testID="button-save-affirmation"
          >
            <Feather 
              name="save" 
              size={22} 
              color={autoSaveMutation.isPending ? theme.textSecondary : theme.primary} 
            />
          </HeaderButton>
        ) : (
          <HeaderButton
            onPress={() => navigation.goBack()}
            testID="button-back"
          >
            <Feather name="arrow-left" size={22} color={theme.text} />
          </HeaderButton>
        )
      ),
      headerRight: () => (
        <HeaderButton
          onPress={handleDelete}
          testID="button-delete-affirmation"
        >
          <Feather name="trash-2" size={22} color="#E53935" />
        </HeaderButton>
      ),
    });
  }, [navigation, handleSave, handleDelete, autoSaveMutation.isPending, theme, isNew]);

  useEffect(() => {
    AsyncStorage.getItem(AUTO_REPLAY_KEY).then((value) => {
      if (value !== null) {
        setAutoReplay(value === "true");
      }
    });
    AsyncStorage.getItem(RSVP_ENABLED_KEY).then((value) => {
      if (value !== null) {
        setRsvpEnabled(value === "true");
      }
    });
    AsyncStorage.getItem(RSVP_FONT_SIZE_KEY).then((value) => {
      if (value !== null && ["S", "M", "L", "XL"].includes(value)) {
        setRsvpFontSize(value as RSVPFontSize);
      }
    });
    AsyncStorage.getItem(RSVP_HIGHLIGHT_KEY).then((value) => {
      if (value !== null) {
        setRsvpHighlight(value === "true");
      }
    });
    AsyncStorage.getItem(SHOW_SCRIPT_KEY).then((value) => {
      if (value !== null) {
        setShowScript(value === "true");
      }
    });
  }, []);

  const wordTimings: WordTiming[] = useMemo(() => {
    const generateFallbackTimings = () => {
      if (!affirmation?.script) return [];
      const words = affirmation.script.split(/\s+/).filter(w => w.length > 0);
      const durationMs = (affirmation.duration || 30) * 1000;
      const avgWordDurationMs = durationMs / words.length;
      return words.map((word, index) => ({
        word,
        startMs: Math.round(index * avgWordDurationMs),
        endMs: Math.round((index + 1) * avgWordDurationMs),
      }));
    };

    if (!affirmation?.wordTimings) {
      return generateFallbackTimings();
    }
    
    try {
      const parsed = JSON.parse(affirmation.wordTimings);
      
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return generateFallbackTimings();
      }
      
      // Check for corrupted data - any word containing "undefined" or invalid timing
      const hasCorruptedData = parsed.some((item: any) => {
        if (!item || typeof item.word !== 'string') return true;
        if (item.word.includes('undefined')) return true;
        if (typeof item.startMs !== 'number' || isNaN(item.startMs)) return true;
        if (typeof item.endMs !== 'number' || isNaN(item.endMs)) return true;
        return false;
      });
      
      if (hasCorruptedData) {
        console.log('Detected corrupted word timings, using fallback');
        return generateFallbackTimings();
      }
      
      return parsed;
    } catch {
      return generateFallbackTimings();
    }
  }, [affirmation?.wordTimings, affirmation?.script, affirmation?.duration]);

  const handleToggleRsvp = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !rsvpEnabled;
    setRsvpEnabled(newValue);
    await AsyncStorage.setItem(RSVP_ENABLED_KEY, String(newValue));
  };

  const handleChangeFontSize = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const sizes: RSVPFontSize[] = ["S", "M", "L", "XL"];
    const currentIndex = sizes.indexOf(rsvpFontSize);
    const nextSize = sizes[(currentIndex + 1) % sizes.length];
    setRsvpFontSize(nextSize);
    await AsyncStorage.setItem(RSVP_FONT_SIZE_KEY, nextSize);
  };

  const handleToggleHighlight = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !rsvpHighlight;
    setRsvpHighlight(newValue);
    await AsyncStorage.setItem(RSVP_HIGHLIGHT_KEY, String(newValue));
  };

  const handleToggleScript = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !showScript;
    setShowScript(newValue);
    await AsyncStorage.setItem(SHOW_SCRIPT_KEY, String(newValue));
  };

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/affirmations/${affirmationId}/favorite`, {
        isFavorite: !affirmation?.isFavorite,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations", affirmationId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  useEffect(() => {
    if (isCurrentlyPlaying) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 8000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = withTiming(0, { duration: 500 });
    }
  }, [isCurrentlyPlaying]);

  const discAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handlePlayPause = async () => {
    if (!affirmation) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (currentAffirmation?.id === affirmationId) {
      await togglePlayPause();
    } else {
      await playAffirmation(affirmation);
    }
  };

  const handleAutoReplay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newAutoReplay = !autoReplay;
    setAutoReplay(newAutoReplay);
    await AsyncStorage.setItem(AUTO_REPLAY_KEY, String(newAutoReplay));
  };

  const handleSpeedChange = async () => {
    const speeds = [0.8, 1, 1.25, 1.5];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFavorite = () => {
    favoriteMutation.mutate();
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const displayPosition = currentAffirmation?.id === affirmationId ? position : 0;
  const displayDuration = currentAffirmation?.id === affirmationId ? duration : 0;
  const progress = displayDuration > 0 ? displayPosition / displayDuration : 0;
  
  // Add offset to compensate for audio position latency and UI rendering delay
  // Higher playback speeds need more forward offset since words change faster
  const rsvpPositionOffset = 100 * playbackSpeed; // ms ahead to look
  const rsvpPosition = displayPosition + rsvpPositionOffset;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.visualizerContainer}>
          {rsvpEnabled ? (
            <RSVPDisplay
              wordTimings={wordTimings}
              currentPositionMs={rsvpPosition}
              isPlaying={isCurrentlyPlaying}
              fontSize={rsvpFontSize}
              showHighlight={rsvpHighlight}
            />
          ) : (
            <>
              <Animated.View style={[styles.disc, discAnimatedStyle]}>
                <LinearGradient
                  colors={theme.gradient.hero as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.discGradient}
                >
                  <View style={[styles.discCenter, { backgroundColor: theme.backgroundRoot }]} />
                </LinearGradient>
              </Animated.View>
              <WaveformVisualizer
                isActive={isCurrentlyPlaying}
                barCount={40}
                style={styles.waveform}
                color={theme.primary}
              />
            </>
          )}
        </View>

        <View style={styles.infoContainer}>
          <ThemedText type="h2" style={styles.title} numberOfLines={2}>
            {affirmation?.title || "Loading..."}
          </ThemedText>

          <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSecondary }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: theme.primary },
                ]}
              />
            </View>
            <View style={styles.timeContainer}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatTime(displayPosition)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatTime(displayDuration)}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={handleAutoReplay}
            style={({ pressed }) => [
              styles.secondaryControl,
              { opacity: pressed ? 0.7 : 1, backgroundColor: autoReplay ? theme.primary + "20" : "transparent" },
            ]}
            testID="button-auto-replay"
          >
            <Feather
              name="repeat"
              size={24}
              color={autoReplay ? theme.primary : theme.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={handlePlayPause}
            testID="button-play-pause"
          >
            <LinearGradient
              colors={theme.gradient.primary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.playButton, Shadows.large]}
            >
              <Feather
                name={isCurrentlyPlaying ? "pause" : "play"}
                size={32}
                color="#FFFFFF"
                style={{ marginLeft: isCurrentlyPlaying ? 0 : 4 }}
              />
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={handleSpeedChange}
            style={({ pressed }) => [
              styles.secondaryControl,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            testID="button-speed"
          >
            <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
              {playbackSpeed}x
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <IconButton
            icon={affirmation?.isFavorite ? "heart" : "heart"}
            size={24}
            color={affirmation?.isFavorite ? theme.accent : theme.textSecondary}
            onPress={handleFavorite}
            testID="button-favorite"
          />
          <IconButton
            icon="share"
            size={24}
            color={theme.textSecondary}
            onPress={() => Alert.alert("Share", "Sharing coming soon!")}
            testID="button-share"
          />
        </View>

        <View style={[styles.rsvpSettings, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.rsvpSettingsRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              RSVP Mode
            </ThemedText>
            <Pressable
              onPress={handleToggleRsvp}
              style={[
                styles.rsvpToggle,
                { backgroundColor: rsvpEnabled ? theme.primary : theme.backgroundTertiary },
              ]}
              testID="button-toggle-rsvp"
            >
              <View
                style={[
                  styles.rsvpToggleKnob,
                  { 
                    backgroundColor: "#FFFFFF",
                    transform: [{ translateX: rsvpEnabled ? 20 : 2 }],
                  },
                ]}
              />
            </Pressable>
          </View>

          {rsvpEnabled ? (
            <>
              <View style={styles.rsvpSettingsRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Font Size
                </ThemedText>
                <View style={styles.fontSizeButtons}>
                  {(["S", "M", "L", "XL"] as RSVPFontSize[]).map((size) => (
                    <Pressable
                      key={size}
                      onPress={() => {
                        setRsvpFontSize(size);
                        AsyncStorage.setItem(RSVP_FONT_SIZE_KEY, size);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={[
                        styles.fontSizeButton,
                        {
                          backgroundColor:
                            rsvpFontSize === size ? theme.primary : theme.backgroundTertiary,
                        },
                      ]}
                      testID={`button-font-size-${size}`}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: rsvpFontSize === size ? "#FFFFFF" : theme.text,
                          fontWeight: "600",
                        }}
                      >
                        {size}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.rsvpSettingsRow}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Highlight Focus
                </ThemedText>
                <Pressable
                  onPress={handleToggleHighlight}
                  style={[
                    styles.rsvpToggle,
                    { backgroundColor: rsvpHighlight ? theme.primary : theme.backgroundTertiary },
                  ]}
                  testID="button-toggle-highlight"
                >
                  <View
                    style={[
                      styles.rsvpToggleKnob,
                      { 
                        backgroundColor: "#FFFFFF",
                        transform: [{ translateX: rsvpHighlight ? 20 : 2 }],
                      },
                    ]}
                  />
                </Pressable>
              </View>
            </>
          ) : null}

          <View style={styles.rsvpSettingsRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Show Script
            </ThemedText>
            <Pressable
              onPress={handleToggleScript}
              style={[
                styles.rsvpToggle,
                { backgroundColor: showScript ? theme.primary : theme.backgroundTertiary },
              ]}
              testID="button-toggle-script"
            >
              <View
                style={[
                  styles.rsvpToggleKnob,
                  { 
                    backgroundColor: "#FFFFFF",
                    transform: [{ translateX: showScript ? 20 : 2 }],
                  },
                ]}
              />
            </Pressable>
          </View>
        </View>

        {showScript && affirmation?.script ? (
          <View style={[styles.scriptPreview, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              SCRIPT
            </ThemedText>
            <ThemedText type="body" style={{ lineHeight: 24 }}>
              {affirmation.script}
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  visualizerContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  disc: {
    width: 180,
    height: 180,
    borderRadius: 90,
    marginBottom: Spacing["2xl"],
  },
  discGradient: {
    flex: 1,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  discCenter: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  waveform: {
    width: "100%",
    height: 60,
  },
  infoContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  progressContainer: {
    width: "100%",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing["4xl"],
    marginBottom: Spacing["3xl"],
  },
  secondaryControl: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing["2xl"],
    marginBottom: Spacing["2xl"],
  },
  scriptPreview: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  rsvpSettings: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  rsvpSettingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rsvpToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
  },
  rsvpToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  fontSizeButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  fontSizeButton: {
    width: 36,
    height: 28,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
});
