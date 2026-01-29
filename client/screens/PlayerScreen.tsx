import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
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
import { IconButton } from "@/components/IconButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Affirmation } from "@shared/schema";

type PlayerRouteProp = RouteProp<RootStackParamList, "Player">;

export default function PlayerScreen() {
  const route = useRoute<PlayerRouteProp>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const { affirmationId } = route.params;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const rotation = useSharedValue(0);

  const { data: affirmation, isLoading } = useQuery<Affirmation>({
    queryKey: ["/api/affirmations", affirmationId],
  });

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
    if (isPlaying) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 8000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = withTiming(0, { duration: 500 });
    }
  }, [isPlaying]);

  const discAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const loadSound = useCallback(async () => {
    if (affirmation?.audioUrl) {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: `${getApiUrl()}${affirmation.audioUrl}` },
          { shouldPlay: false, isLooping },
          (status) => {
            if (status.isLoaded) {
              setPosition(status.positionMillis || 0);
              setDuration(status.durationMillis || 0);
              if (status.didJustFinish && !isLooping) {
                setIsPlaying(false);
              }
            }
          }
        );
        setSound(newSound);
      } catch (error) {
        console.error("Error loading sound:", error);
      }
    }
  }, [affirmation?.audioUrl, isLooping]);

  useEffect(() => {
    loadSound();
    return () => {
      sound?.unloadAsync();
    };
  }, [affirmation?.audioUrl]);

  const handlePlayPause = async () => {
    if (!sound) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  const handleLoop = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newLooping = !isLooping;
    setIsLooping(newLooping);
    if (sound) {
      await sound.setIsLoopingAsync(newLooping);
    }
  };

  const handleSpeedChange = async () => {
    const speeds = [0.8, 1, 1.25, 1.5];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (sound) {
      await sound.setRateAsync(nextSpeed, true);
    }
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

  const progress = duration > 0 ? position / duration : 0;

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
      >
        <View style={styles.visualizerContainer}>
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
            isActive={isPlaying}
            barCount={40}
            style={styles.waveform}
            color={theme.primary}
          />
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
                {formatTime(position)}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatTime(duration)}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={handleLoop}
            style={({ pressed }) => [
              styles.secondaryControl,
              { opacity: pressed ? 0.7 : 1, backgroundColor: isLooping ? theme.primary + "20" : "transparent" },
            ]}
            testID="button-loop"
          >
            <Feather
              name="repeat"
              size={24}
              color={isLooping ? theme.primary : theme.textSecondary}
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
                name={isPlaying ? "pause" : "play"}
                size={32}
                color="#FFFFFF"
                style={{ marginLeft: isPlaying ? 0 : 4 }}
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

        {affirmation?.script ? (
          <View style={[styles.scriptPreview, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              SCRIPT
            </ThemedText>
            <ThemedText type="body" style={{ lineHeight: 24 }} numberOfLines={4}>
              {affirmation.script}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
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
  },
});
