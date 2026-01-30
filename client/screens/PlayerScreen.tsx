import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { View, StyleSheet, Pressable, Alert, ScrollView, Modal, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { HeaderButton } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { RSVPDisplay, WordTiming, RSVPFontSize } from "@/components/RSVPDisplay";
import { IconButton } from "@/components/IconButton";
import { AmbientSoundMixer } from "@/components/AmbientSoundMixer";
import { useTheme } from "@/hooks/useTheme";
import { useAudio } from "@/contexts/AudioContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Affirmation } from "@shared/schema";

const AUTO_REPLAY_KEY = "@settings/autoReplay";
const RSVP_ENABLED_KEY = "@settings/rsvpEnabled";
const SETTINGS_VERSION_KEY = "@settings/version";
const CURRENT_SETTINGS_VERSION = "2"; // Increment to reset defaults
const RSVP_FONT_SIZE_KEY = "@settings/rsvpFontSize";
const RSVP_HIGHLIGHT_KEY = "@settings/rsvpHighlight";
const SHOW_SCRIPT_KEY = "@settings/showScript";
const HAPTIC_ENABLED_KEY = "@settings/hapticEnabled";

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
  const [isLandscape, setIsLandscape] = useState(false);
  const [isInFullscreenMode, setIsInFullscreenMode] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const prevLandscapeRef = useRef(false);

  const { data: affirmation, isLoading } = useQuery<Affirmation>({
    queryKey: ["/api/affirmations", affirmationId],
  });

  // Haptic feedback setting
  const [hapticEnabled, setHapticEnabled] = useState(true);

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
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: () => {
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHasSaved(true);
      Alert.alert("Saved", "Affirmation saved to your library with an AI-generated title!");
    },
    onError: () => {
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to save affirmation");
    },
  });

  const handleSave = useCallback(() => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    autoSaveMutation.mutate();
  }, [autoSaveMutation, hapticEnabled]);

  const handleDelete = useCallback(() => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        isNew && !hasSaved ? (
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
  }, [navigation, handleSave, handleDelete, autoSaveMutation.isPending, theme, isNew, hasSaved]);

  useEffect(() => {
    const loadSettings = async () => {
      // Check if we need to reset settings to new defaults
      const storedVersion = await AsyncStorage.getItem(SETTINGS_VERSION_KEY);
      if (storedVersion !== CURRENT_SETTINGS_VERSION) {
        // Reset RSVP and Show Script to new defaults
        await AsyncStorage.setItem(RSVP_ENABLED_KEY, "true");
        await AsyncStorage.setItem(SHOW_SCRIPT_KEY, "false");
        await AsyncStorage.setItem(SETTINGS_VERSION_KEY, CURRENT_SETTINGS_VERSION);
        setRsvpEnabled(true);
        setShowScript(false);
      } else {
        // Load saved settings
        const rsvpValue = await AsyncStorage.getItem(RSVP_ENABLED_KEY);
        if (rsvpValue !== null) {
          setRsvpEnabled(rsvpValue === "true");
        }
        const showScriptValue = await AsyncStorage.getItem(SHOW_SCRIPT_KEY);
        if (showScriptValue !== null) {
          setShowScript(showScriptValue === "true");
        }
      }

      // Load other settings normally
      const autoReplayValue = await AsyncStorage.getItem(AUTO_REPLAY_KEY);
      if (autoReplayValue !== null) {
        setAutoReplay(autoReplayValue === "true");
      }
      const fontSizeValue = await AsyncStorage.getItem(RSVP_FONT_SIZE_KEY);
      if (fontSizeValue !== null && ["S", "M", "L", "XL"].includes(fontSizeValue)) {
        setRsvpFontSize(fontSizeValue as RSVPFontSize);
      }
      const highlightValue = await AsyncStorage.getItem(RSVP_HIGHLIGHT_KEY);
      if (highlightValue !== null) {
        setRsvpHighlight(highlightValue === "true");
      }
      const hapticValue = await AsyncStorage.getItem(HAPTIC_ENABLED_KEY);
      if (hapticValue !== null) {
        setHapticEnabled(hapticValue === "true");
      }
    };

    loadSettings();
  }, []);

  // Lock orientation to portrait on unmount only
  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // Control orientation - keep unlocked in fullscreen so user can tilt to exit
  useEffect(() => {
    console.log('Orientation effect - isInFullscreenMode:', isInFullscreenMode);
    if (isInFullscreenMode) {
      // Keep orientation unlocked so user can tilt back to portrait to exit
      ScreenOrientation.unlockAsync();
    } else if (!isCurrentlyPlaying || !rsvpEnabled) {
      // Lock to portrait when not playing or Focus Mode is off
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
    // When playing with Focus Mode but not in fullscreen, leave unlocked (handled by other effect)
  }, [isInFullscreenMode, isCurrentlyPlaying, rsvpEnabled]);

  // Unlock orientation when Focus Mode is on and playing (to allow entering fullscreen)
  useEffect(() => {
    if (rsvpEnabled && isCurrentlyPlaying && !isInFullscreenMode) {
      console.log('Unlocking orientation to allow fullscreen entry');
      ScreenOrientation.unlockAsync();
    }
  }, [rsvpEnabled, isCurrentlyPlaying, isInFullscreenMode]);

  // Listen for orientation changes
  useEffect(() => {
    const checkOrientation = async () => {
      const orientation = await ScreenOrientation.getOrientationAsync();
      const landscape = 
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsLandscape(landscape);
    };
    
    checkOrientation();
    
    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const orientation = event.orientationInfo.orientation;
      const landscape = 
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsLandscape(landscape);
    });
    
    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, []);

  // Handle orientation changes - enter/exit fullscreen based on rotation
  useEffect(() => {
    const wasLandscape = prevLandscapeRef.current;
    const justRotatedToLandscape = isLandscape && !wasLandscape;
    const justRotatedToPortrait = !isLandscape && wasLandscape;
    
    // Update prev ref for next run
    prevLandscapeRef.current = isLandscape;
    
    // Exit fullscreen when rotating back to portrait
    if (justRotatedToPortrait && isInFullscreenMode) {
      console.log('Exiting fullscreen mode - rotated to portrait');
      setIsInFullscreenMode(false);
      return;
    }
    
    // Enter fullscreen if user just rotated TO landscape while playing
    if (justRotatedToLandscape && rsvpEnabled && isCurrentlyPlaying && !isInFullscreenMode) {
      console.log('Entering fullscreen mode - rotated to landscape while playing');
      setIsInFullscreenMode(true);
    }
  }, [isLandscape, rsvpEnabled, isCurrentlyPlaying, isInFullscreenMode]);

  // Debug: track fullscreen state changes
  useEffect(() => {
    console.log('Fullscreen state:', { isInFullscreenMode, rsvpEnabled, isLandscape, isCurrentlyPlaying });
  }, [isInFullscreenMode, rsvpEnabled, isLandscape, isCurrentlyPlaying]);

  // Show fullscreen when in fullscreen mode (stays up even when paused)
  const showFullscreenFocus = isInFullscreenMode && rsvpEnabled;

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
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !rsvpEnabled;
    setRsvpEnabled(newValue);
    await AsyncStorage.setItem(RSVP_ENABLED_KEY, String(newValue));
  };

  const handleChangeFontSize = async () => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const sizes: RSVPFontSize[] = ["S", "M", "L", "XL"];
    const currentIndex = sizes.indexOf(rsvpFontSize);
    const nextSize = sizes[(currentIndex + 1) % sizes.length];
    setRsvpFontSize(nextSize);
    await AsyncStorage.setItem(RSVP_FONT_SIZE_KEY, nextSize);
  };

  const handleToggleHighlight = async () => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !rsvpHighlight;
    setRsvpHighlight(newValue);
    await AsyncStorage.setItem(RSVP_HIGHLIGHT_KEY, String(newValue));
  };

  const handleToggleScript = async () => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !showScript;
    setShowScript(newValue);
    await AsyncStorage.setItem(SHOW_SCRIPT_KEY, String(newValue));
  };

  const handleToggleHaptic = async () => {
    const newValue = !hapticEnabled;
    setHapticEnabled(newValue);
    await AsyncStorage.setItem(HAPTIC_ENABLED_KEY, String(newValue));
    if (newValue) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handlePlayPause = async () => {
    if (!affirmation) return;

    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (currentAffirmation?.id === affirmationId) {
      await togglePlayPause();
    } else {
      await playAffirmation(affirmation);
    }
  };

  const handleAutoReplay = async () => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newAutoReplay = !autoReplay;
    setAutoReplay(newAutoReplay);
    await AsyncStorage.setItem(AUTO_REPLAY_KEY, String(newAutoReplay));
  };

  const handleSpeedChange = async () => {
    const speeds = [0.8, 1, 1.25, 1.5];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      <StatusBar style={showFullscreenFocus ? "light" : "auto"} hidden={showFullscreenFocus} />
      
      {/* Fullscreen Landscape Focus Mode - tilt back to portrait to exit */}
      <Modal
        visible={showFullscreenFocus}
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={["landscape-left", "landscape-right", "portrait"]}
        presentationStyle="fullScreen"
      >
        <View style={[styles.fullscreenContainer, { backgroundColor: theme.navy }]}>
          <Pressable 
            style={styles.fullscreenTapArea}
            onPress={() => {
              console.log('Fullscreen tap - toggling playback');
              togglePlayPause();
            }}
          >
            <View pointerEvents="none">
              <RSVPDisplay
                wordTimings={wordTimings}
                currentPositionMs={rsvpPosition}
                isPlaying={isCurrentlyPlaying}
                fontSize="XL"
                showHighlight={rsvpHighlight}
                forceDarkMode={true}
              />
            </View>
            {!isCurrentlyPlaying ? (
              <View style={styles.fullscreenPlayHint} pointerEvents="none">
                <View style={[styles.fullscreenPlayButton, { backgroundColor: theme.primary }]}>
                  <Feather name="play" size={32} color="#FFFFFF" />
                </View>
                <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
                  Tap to resume
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        </View>
      </Modal>

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
            <WaveformVisualizer
              isActive={isCurrentlyPlaying}
              barCount={40}
              color={theme.primary}
            />
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
          <AmbientSoundMixer compact />
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
              Focus Mode
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
                        if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

          <View style={styles.rsvpSettingsRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Haptic Feedback
            </ThemedText>
            <Pressable
              onPress={handleToggleHaptic}
              style={[
                styles.rsvpToggle,
                { backgroundColor: hapticEnabled ? theme.primary : theme.backgroundTertiary },
              ]}
              testID="button-toggle-haptic"
            >
              <View
                style={[
                  styles.rsvpToggleKnob,
                  { 
                    backgroundColor: "#FFFFFF",
                    transform: [{ translateX: hapticEnabled ? 20 : 2 }],
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
    backgroundColor: "transparent",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  visualizerContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["3xl"],
    minHeight: 120,
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
  fullscreenContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenTapArea: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["4xl"],
  },
  fullscreenHint: {
    position: "absolute",
    bottom: Spacing.xl,
    alignItems: "center",
  },
  fullscreenPlayHint: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenCloseButton: {
    position: "absolute",
    top: Spacing.xl,
    right: Spacing.xl,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  });
