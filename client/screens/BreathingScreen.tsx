import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Text,
  Dimensions,
  Modal,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ScreenOrientation from "expo-screen-orientation";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
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
} from "@shared/breathingTechniques";

const ACCENT_GOLD = "#C9A227";

interface Affirmation {
  id: number;
  title: string;
  script: string;
  category: string;
}

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
  const [showTechniqueSelector, setShowTechniqueSelector] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showLandscapeMode, setShowLandscapeMode] = useState(false);
  const [audioSource, setAudioSource] = useState<'none' | 'music' | 'affirmation'>('none');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch affirmations for background display
  const { data: affirmations = [] } = useQuery<Affirmation[]>({
    queryKey: ["/api/affirmations"],
  });

  // Get a random affirmation or the first one
  const backgroundAffirmation = affirmations.length > 0 
    ? affirmations[Math.floor(Math.random() * Math.min(affirmations.length, 5))]
    : null;

  const remainingTime = selectedDuration - elapsedTime;
  const totalCycles = getCyclesForDuration(selectedTechnique, selectedDuration);

  // Handle orientation changes
  useEffect(() => {
    const checkOrientation = async () => {
      const orientation = await ScreenOrientation.getOrientationAsync();
      setIsLandscape(
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
      );
    };

    checkOrientation();

    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const newOrientation = event.orientationInfo.orientation;
      setIsLandscape(
        newOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        newOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
      );
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, []);

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
    
    // Start background music if selected
    if (audioSource === 'music' && selectedMusic !== 'none') {
      await startBackgroundMusic();
    }
    // TODO: Add affirmation playback when audioSource === 'affirmation'
  };

  const handlePause = async () => {
    setIsPlaying(false);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    
    if (isMusicPlaying) {
      await stopBackgroundMusic();
    }
    // TODO: Pause affirmation playback
  };

  const handleResume = async () => {
    setIsPlaying(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    
    if (audioSource === 'music' && selectedMusic !== 'none') {
      await startBackgroundMusic();
    }
    // TODO: Resume affirmation playback
  };

  const handleStop = async () => {
    setIsPlaying(false);
    setElapsedTime(0);
    setCyclesCompleted(0);
    setShowLandscapeMode(false);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    
    if (isMusicPlaying) {
      await stopBackgroundMusic();
    }
    // TODO: Stop affirmation playback
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
      setShowTechniqueSelector(false);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    }
  };

  const enterFullscreen = async () => {
    setShowLandscapeMode(true);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    handleStart();
  };

  const exitFullscreen = async () => {
    setShowLandscapeMode(false);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    handleStop();
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { greeting: "Good morning", suggestion: "Start your day with calm focus" };
    if (hour < 17) return { greeting: "Good afternoon", suggestion: "Take a mindful pause" };
    if (hour < 21) return { greeting: "Good evening", suggestion: "Unwind and relax" };
    return { greeting: "Good night", suggestion: "Prepare for restful sleep" };
  };

  const { greeting, suggestion } = getTimeOfDay();

  // Landscape Fullscreen Mode
  if (showLandscapeMode) {
    return (
      <Modal
        visible={showLandscapeMode}
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={["landscape-left", "landscape-right", "portrait"]}
        presentationStyle="fullScreen"
      >
        <StatusBar hidden />
        <View style={[styles.landscapeContainer, { backgroundColor: theme.navy }]}>

          {/* Close button */}
          <Pressable
            onPress={exitFullscreen}
            style={[styles.landscapeCloseButton, { top: insets.top + 16 }]}
          >
            <BlurView intensity={40} tint="dark" style={styles.blurButton}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </BlurView>
          </Pressable>

          {/* Main content - centered breathing circle */}
          <View style={styles.landscapeContent}>
            {/* Left side - technique info */}
            <View style={styles.landscapeSidePanel}>
              <Text style={[styles.landscapeTechniqueName, { color: selectedTechnique.color }]}>
                {selectedTechnique.name}
              </Text>
              <Text style={styles.landscapePhaseLabel}>
                {selectedTechnique.benefits}
              </Text>
            </View>

            {/* Center - breathing circle */}
            <View style={styles.landscapeCircleContainer}>
              <BreathingCircle
                technique={selectedTechnique}
                isPlaying={isPlaying}
                onCycleComplete={handleCycleComplete}
                hapticsEnabled={hapticsEnabled}
                size={Math.min(Dimensions.get("window").height - 80, 320)}
              />
            </View>

            {/* Right side - stats and controls */}
            <View style={styles.landscapeSidePanel}>
              <View style={styles.landscapeStats}>
                <Text style={styles.landscapeStatLabel}>Time Left</Text>
                <Text style={styles.landscapeStatValue}>{formatTime(remainingTime)}</Text>
              </View>
              <View style={styles.landscapeStats}>
                <Text style={styles.landscapeStatLabel}>Cycles</Text>
                <Text style={styles.landscapeStatValue}>{cyclesCompleted}/{totalCycles}</Text>
              </View>
              
              <View style={styles.landscapeControlsRow}>
                <Pressable
                  onPress={handleStop}
                  style={styles.landscapeStopButton}
                >
                  <Feather name="square" size={20} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={isPlaying ? handlePause : handleResume}
                >
                  <LinearGradient
                    colors={[selectedTechnique.color, `${selectedTechnique.color}CC`]}
                    style={styles.landscapePlayButton}
                  >
                    <Feather name={isPlaying ? "pause" : "play"} size={24} color="#FFFFFF" />
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Portrait Mode - Main Screen
  return (
    <ThemedView style={styles.container}>
      {/* Affirmation background */}
      {backgroundAffirmation ? (
        <View style={styles.affirmationBackground}>
          <LinearGradient
            colors={[`${theme.navy}00`, theme.navy, theme.navy]}
            style={styles.affirmationGradient}
          />
          <Text style={[styles.affirmationBgText, { color: `${theme.text}10` }]}>
            {backgroundAffirmation.script}
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.welcomeSection}>
          <ThemedText type="h2" style={styles.greeting}>{greeting}</ThemedText>
          <ThemedText type="body" style={[styles.suggestion, { color: theme.textSecondary }]}>
            {suggestion}
          </ThemedText>
        </Animated.View>

        {/* Breathing Circle - Hero Element */}
        <Animated.View 
          entering={FadeIn.delay(200).duration(800)} 
          style={styles.circleSection}
        >
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
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
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
        </Animated.View>

        {/* Technique Selector Card */}
        {!isPlaying ? (
          <Animated.View entering={FadeIn.delay(400).duration(600)}>
            <Pressable
              onPress={() => setShowTechniqueSelector(true)}
              style={[styles.techniqueCard, { backgroundColor: theme.cardBackground }, Shadows.medium]}
            >
              <View style={styles.techniqueCardContent}>
                <View style={[styles.techniqueIconSmall, { backgroundColor: `${selectedTechnique.color}30` }]}>
                  <Feather name={selectedTechnique.icon as any} size={24} color={selectedTechnique.color} />
                </View>
                <View style={styles.techniqueCardInfo}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {selectedTechnique.name}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {selectedTechnique.benefits}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </Pressable>

            {/* Duration Pills */}
            <View style={styles.durationSection}>
              <ThemedText type="small" style={[styles.durationLabel, { color: theme.textSecondary }]}>
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
                      styles.durationPill,
                      {
                        backgroundColor: selectedDuration === option.value ? ACCENT_GOLD : theme.backgroundSecondary,
                        borderColor: selectedDuration === option.value ? ACCENT_GOLD : theme.border,
                      },
                    ]}
                    testID={`duration-${option.value}`}
                  >
                    <Text
                      style={[
                        styles.durationPillText,
                        { color: selectedDuration === option.value ? "#FFFFFF" : theme.text },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Audio Source Selector */}
            <View style={styles.audioSourceSection}>
              <ThemedText type="small" style={[styles.durationLabel, { color: theme.textSecondary }]}>
                Background Audio
              </ThemedText>
              <View style={[styles.audioSourceToggle, { backgroundColor: theme.backgroundSecondary }]}>
                <Pressable
                  onPress={() => {
                    setAudioSource('none');
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                  }}
                  style={[
                    styles.audioSourceOption,
                    audioSource === 'none' && styles.audioSourceOptionActive,
                    audioSource === 'none' && { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Feather name="volume-x" size={16} color={audioSource === 'none' ? ACCENT_GOLD : theme.textSecondary} />
                  <Text style={[styles.audioSourceText, { color: audioSource === 'none' ? theme.text : theme.textSecondary }]}>
                    None
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAudioSource('music');
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                  }}
                  style={[
                    styles.audioSourceOption,
                    audioSource === 'music' && styles.audioSourceOptionActive,
                    audioSource === 'music' && { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Feather name="music" size={16} color={audioSource === 'music' ? ACCENT_GOLD : theme.textSecondary} />
                  <Text style={[styles.audioSourceText, { color: audioSource === 'music' ? theme.text : theme.textSecondary }]}>
                    Music
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setAudioSource('affirmation');
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                  }}
                  style={[
                    styles.audioSourceOption,
                    audioSource === 'affirmation' && styles.audioSourceOptionActive,
                    audioSource === 'affirmation' && { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Feather name="mic" size={16} color={audioSource === 'affirmation' ? ACCENT_GOLD : theme.textSecondary} />
                  <Text style={[styles.audioSourceText, { color: audioSource === 'affirmation' ? theme.text : theme.textSecondary }]}>
                    Affirmation
                  </Text>
                </Pressable>
              </View>
              
              {/* Music Type Selector - only show when Music is selected */}
              {audioSource === 'music' ? (
                <View style={styles.musicTypeRow}>
                  {BACKGROUND_MUSIC_OPTIONS.filter(m => m.id !== 'none').map((option) => (
                    <Pressable
                      key={option.id}
                      onPress={() => {
                        setSelectedMusic(option.id);
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                      }}
                      style={[
                        styles.musicTypePill,
                        {
                          backgroundColor: selectedMusic === option.id ? `${ACCENT_GOLD}30` : 'transparent',
                          borderColor: selectedMusic === option.id ? ACCENT_GOLD : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.musicTypePillText,
                          { color: selectedMusic === option.id ? ACCENT_GOLD : theme.textSecondary },
                        ]}
                      >
                        {option.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {/* Control Buttons */}
        <Animated.View 
          entering={FadeIn.delay(600).duration(600)} 
          style={styles.controlSection}
        >
          {!isPlaying ? (
            <View style={styles.startButtons}>
              <Pressable onPress={handleStart} testID="button-start-breathing">
                <LinearGradient
                  colors={[selectedTechnique.color, `${selectedTechnique.color}CC`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.startButton, Shadows.medium]}
                >
                  <Feather name="play" size={24} color="#FFFFFF" />
                  <Text style={styles.startButtonText}>Start</Text>
                </LinearGradient>
              </Pressable>

              <Pressable 
                onPress={enterFullscreen} 
                style={[styles.fullscreenButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="maximize-2" size={20} color={theme.text} />
              </Pressable>
            </View>
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
              <Pressable
                onPress={() => setShowLandscapeMode(true)}
                style={[styles.controlButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Feather name="maximize-2" size={20} color={theme.text} />
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* Current Affirmation Preview */}
        {backgroundAffirmation && !isPlaying ? (
          <Animated.View 
            entering={FadeIn.delay(800).duration(600)}
            style={[styles.affirmationPreview, { backgroundColor: theme.cardBackground }]}
          >
            <View style={styles.affirmationPreviewHeader}>
              <Feather name="book-open" size={16} color={ACCENT_GOLD} />
              <ThemedText type="caption" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                Current Affirmation
              </ThemedText>
            </View>
            <ThemedText type="body" numberOfLines={2} style={styles.affirmationPreviewText}>
              {backgroundAffirmation.title}
            </ThemedText>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Technique Selection Modal */}
      <Modal
        visible={showTechniqueSelector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTechniqueSelector(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowTechniqueSelector(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHandle} />
            <ThemedText type="h3" style={styles.modalTitle}>
              Choose Your Breathing Technique
            </ThemedText>
            <ThemedText type="body" style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Each technique offers unique benefits for your mind and body
            </ThemedText>

            {BREATHING_TECHNIQUES.map((technique) => (
              <Pressable
                key={technique.id}
                onPress={() => selectTechnique(technique)}
                style={[
                  styles.techniqueOption,
                  {
                    backgroundColor: selectedTechnique.id === technique.id
                      ? `${technique.color}20`
                      : theme.cardBackground,
                    borderColor: selectedTechnique.id === technique.id
                      ? technique.color
                      : theme.border,
                  },
                ]}
              >
                <View style={[styles.techniqueOptionIcon, { backgroundColor: `${technique.color}30` }]}>
                  <Feather name={technique.icon as any} size={28} color={technique.color} />
                </View>
                <View style={styles.techniqueOptionInfo}>
                  <ThemedText type="body" style={{ fontWeight: "700" }}>
                    {technique.name}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                    {technique.pattern}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: technique.color, marginTop: 4 }}>
                    {technique.benefits}
                  </ThemedText>
                </View>
                {selectedTechnique.id === technique.id ? (
                  <Feather name="check-circle" size={24} color={technique.color} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
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
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  
  // Welcome Section
  welcomeSection: {
    marginBottom: Spacing.xl,
  },
  greeting: {
    marginBottom: Spacing.xs,
  },
  suggestion: {
    fontSize: 16,
  },

  // Affirmation Background
  affirmationBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    overflow: "hidden",
  },
  affirmationGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  affirmationBgText: {
    fontSize: 48,
    fontWeight: "800",
    lineHeight: 56,
    padding: Spacing.lg,
  },

  // Circle Section
  circleSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
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
    marginHorizontal: Spacing.lg,
  },

  // Technique Card
  techniqueCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  techniqueCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  techniqueIconSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  techniqueCardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },

  // Duration
  durationSection: {
    marginBottom: Spacing.lg,
  },
  durationLabel: {
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  durationRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  durationPill: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
  },
  durationPillText: {
    fontWeight: "600",
    fontSize: 14,
  },

  // Audio Source Selector
  audioSourceSection: {
    marginBottom: Spacing.lg,
  },
  audioSourceToggle: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.sm,
  },
  audioSourceOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  audioSourceOptionActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  audioSourceText: {
    fontSize: 13,
    fontWeight: "600",
  },
  musicTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  musicTypePill: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  musicTypePillText: {
    fontSize: 12,
    fontWeight: "500",
  },

  // Control Section
  controlSection: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  startButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
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
  fullscreenButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
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

  // Affirmation Preview
  affirmationPreview: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  affirmationPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  affirmationPreviewText: {
    fontWeight: "500",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 48,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    marginBottom: Spacing.sm,
  },
  modalSubtitle: {
    marginBottom: Spacing.xl,
  },
  techniqueOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginBottom: Spacing.md,
  },
  techniqueOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  techniqueOptionInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },

  // Landscape Mode
  landscapeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  landscapeAffirmationBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
    opacity: 0.1,
  },
  landscapeAffirmationText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 44,
  },
  landscapeCloseButton: {
    position: "absolute",
    right: 24,
    zIndex: 10,
  },
  blurButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  landscapeContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 48,
  },
  landscapeSidePanel: {
    width: 180,
    alignItems: "center",
  },
  landscapeTechniqueName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  landscapePhaseLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  landscapeCircleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  landscapeStats: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  landscapeStatLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  landscapeStatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  landscapeControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  landscapeStopButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  landscapePlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
