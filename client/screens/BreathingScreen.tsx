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
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ScreenOrientation from "expo-screen-orientation";
import { Audio } from "expo-av";
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
import { getApiUrl } from "@/lib/query-client";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import BreathingCircle from "@/components/BreathingCircle";
import { WelcomeSection } from "@/components/WelcomeSection";
import { FocusTimer } from "@/components/FocusTimer";
import { useTheme } from "@/hooks/useTheme";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { useAudio } from "@/contexts/AudioContext";
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
  audioUrl?: string;
}

export default function BreathingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { currentAffirmation, isPlaying: isAudioPlaying, playAffirmation, togglePlayPause, breathingAffirmation, requestHighlightAffirmation } = useAudio();
  const { selectedMusic, setSelectedMusic, startBackgroundMusic, stopBackgroundMusic, isPlaying: isMusicPlaying } = useBackgroundMusic();
  const queryClient = useQueryClient();

  const [selectedTechnique, setSelectedTechnique] = useState<BreathingTechnique>(BREATHING_TECHNIQUES[0]);
  const [selectedDuration, setSelectedDuration] = useState(180);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [showTechniqueSelector, setShowTechniqueSelector] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showLandscapeMode, setShowLandscapeMode] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showFocusTimer, setShowFocusTimer] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCompletedNaturally = useRef(false);
  const affirmationSoundRef = useRef<Audio.Sound | null>(null);

  // Fetch affirmations for background display
  const { data: affirmations = [] } = useQuery<Affirmation[]>({
    queryKey: ["/api/affirmations"],
  });

  // Get background affirmation for breathing - prioritize user's selected breathing affirmation
  const backgroundAffirmation = React.useMemo(() => {
    // First priority: user's explicitly selected breathing affirmation
    if (breathingAffirmation) return breathingAffirmation;
    
    // Fallback: time-based suggestion
    if (affirmations.length === 0) return null;
    const hour = new Date().getHours();
    let targetCategory = "Confidence";
    if (hour >= 5 && hour < 12) targetCategory = "Confidence";
    else if (hour >= 12 && hour < 17) targetCategory = "Career";
    else if (hour >= 17 && hour < 21) targetCategory = "Health";
    else targetCategory = "Sleep";
    
    const categoryMatch = affirmations.find(a => a.category === targetCategory);
    return categoryMatch || affirmations[0];
  }, [affirmations, breathingAffirmation]);

  // Alias for compatibility
  const suggestedAffirmation = backgroundAffirmation;

  // Quick play handler for WelcomeSection
  const handleQuickPlay = async () => {
    const affirmationToPlay = currentAffirmation || suggestedAffirmation;
    if (affirmationToPlay) {
      if (currentAffirmation?.id === affirmationToPlay.id) {
        await togglePlayPause();
      } else {
        await playAffirmation(affirmationToPlay as any);
      }
    }
  };

  const remainingTime = selectedDuration - elapsedTime;
  const totalCycles = getCyclesForDuration(selectedTechnique, selectedDuration);

  // Handle orientation changes - auto-enter landscape mode when device is tilted
  useEffect(() => {
    const checkOrientation = async () => {
      const orientation = await ScreenOrientation.getOrientationAsync();
      const isLandscapeOrientation = 
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsLandscape(isLandscapeOrientation);
    };

    checkOrientation();

    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const newOrientation = event.orientationInfo.orientation;
      const isLandscapeOrientation = 
        newOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        newOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      
      setIsLandscape(isLandscapeOrientation);
      
      // Auto-enter landscape fullscreen mode when device is tilted to landscape
      if (isLandscapeOrientation && !showLandscapeMode) {
        setShowLandscapeMode(true);
      }
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, [showLandscapeMode]);

  // Allow free rotation - don't lock orientation in landscape mode
  useEffect(() => {
    // Unlock orientation to allow natural device rotation
    ScreenOrientation.unlockAsync();
  }, [showLandscapeMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (isPlaying && isMusicPlaying) {
        stopBackgroundMusic();
      }
      if (affirmationSoundRef.current) {
        affirmationSoundRef.current.unloadAsync();
      }
    };
  }, []);

  // Affirmation audio playback functions
  const startAffirmationLoop = useCallback(async () => {
    if (!backgroundAffirmation?.audioUrl) return;
    
    try {
      // Unload any existing sound
      if (affirmationSoundRef.current) {
        await affirmationSoundRef.current.unloadAsync();
        affirmationSoundRef.current = null;
      }
      
      const audioUri = `${getApiUrl()}${backgroundAffirmation.audioUrl}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { 
          shouldPlay: true, 
          isLooping: true,
          volume: 1.0,
        }
      );
      affirmationSoundRef.current = sound;
    } catch (error) {
      console.error('Error playing affirmation loop:', error);
    }
  }, [backgroundAffirmation]);

  const stopAffirmationLoop = useCallback(async () => {
    if (affirmationSoundRef.current) {
      try {
        await affirmationSoundRef.current.stopAsync();
        await affirmationSoundRef.current.unloadAsync();
      } catch (error) {
        console.error('Error stopping affirmation:', error);
      }
      affirmationSoundRef.current = null;
    }
  }, []);

  const pauseAffirmationLoop = useCallback(async () => {
    if (affirmationSoundRef.current) {
      try {
        await affirmationSoundRef.current.pauseAsync();
      } catch (error) {
        console.error('Error pausing affirmation:', error);
      }
    }
  }, []);

  const resumeAffirmationLoop = useCallback(async () => {
    if (affirmationSoundRef.current) {
      try {
        await affirmationSoundRef.current.playAsync();
      } catch (error) {
        console.error('Error resuming affirmation:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => {
          if (prev >= selectedDuration - 1) {
            sessionCompletedNaturally.current = true;
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
    
    // Start audio based on selected sources (both can be enabled)
    if (musicEnabled) {
      if (selectedMusic === 'none') {
        // No music selected, default to rain
        await setSelectedMusic('rain');
      } else {
        await startBackgroundMusic();
      }
    }
    if (voiceEnabled) {
      await startAffirmationLoop();
    }
  };

  const handlePause = async () => {
    setIsPlaying(false);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    
    if (isMusicPlaying) {
      await stopBackgroundMusic();
    }
    if (voiceEnabled) {
      await pauseAffirmationLoop();
    }
  };

  const handleResume = async () => {
    setIsPlaying(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    
    if (musicEnabled) {
      if (selectedMusic === 'none') {
        await setSelectedMusic('rain');
      } else {
        await startBackgroundMusic();
      }
    }
    if (voiceEnabled) {
      await resumeAffirmationLoop();
    }
  };

  const handleStop = async () => {
    const wasNaturalCompletion = sessionCompletedNaturally.current;
    const completedDuration = elapsedTime;
    sessionCompletedNaturally.current = false;
    
    setIsPlaying(false);
    setElapsedTime(0);
    setCyclesCompleted(0);
    setShowLandscapeMode(false);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    
    if (wasNaturalCompletion && completedDuration > 0) {
      try {
        await apiRequest('POST', '/api/breathing-sessions', {
          techniqueId: selectedTechnique.id,
          durationSeconds: completedDuration,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/breathing-sessions/today'] });
        queryClient.invalidateQueries({ queryKey: ['/api/breathing-sessions/streak'] });
      } catch (error) {
        console.error('Error recording breathing session:', error);
      }
      setShowFocusTimer(true);
    } else {
      if (isMusicPlaying) {
        await stopBackgroundMusic();
      }
      if (voiceEnabled) {
        await stopAffirmationLoop();
      }
    }
  };

  const handleFocusTimerClose = async () => {
    setShowFocusTimer(false);
    if (isMusicPlaying) {
      await stopBackgroundMusic();
    }
    if (voiceEnabled) {
      await stopAffirmationLoop();
    }
  };

  const handleFocusTimerComplete = async (minutes: number) => {
    setShowFocusTimer(false);
    if (isMusicPlaying) {
      await stopBackgroundMusic();
    }
    if (voiceEnabled) {
      await stopAffirmationLoop();
    }
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
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

  const enterFullscreen = () => {
    setShowLandscapeMode(true);
    // Orientation lock is handled by the useEffect
    if (!isPlaying) {
      handleStart();
    }
  };

  const exitFullscreen = () => {
    setShowLandscapeMode(false);
    // Orientation lock is handled by the useEffect
    handleStop();
  };

  // Fullscreen Mode - responsive to orientation
  if (showLandscapeMode) {
    const screenWidth = Dimensions.get("window").width;
    const screenHeight = Dimensions.get("window").height;
    const isCurrentlyLandscape = screenWidth > screenHeight;
    const circleSize = isCurrentlyLandscape 
      ? Math.min(screenHeight - 80, 320)
      : Math.min(screenWidth * 0.7, 260);

    // Portrait fullscreen layout
    if (!isCurrentlyLandscape) {
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

            {/* Portrait layout: vertical stack with proper spacing */}
            <View style={[
              styles.portraitFullscreenWrapper,
              { 
                paddingTop: insets.top + Spacing.xl,
                paddingBottom: insets.bottom + Spacing.xl,
              }
            ]}>
              {/* Top section - technique info */}
              <View style={styles.portraitTopSection}>
                <Text style={[styles.landscapeTechniqueName, { color: selectedTechnique.color }]}>
                  {selectedTechnique.name}
                </Text>
                <Text style={styles.landscapePhaseLabel}>
                  {selectedTechnique.benefits}
                </Text>
              </View>

              {/* Center section - breathing circle (takes remaining space) */}
              <View style={styles.portraitCenterSection}>
                <BreathingCircle
                  technique={selectedTechnique}
                  isPlaying={isPlaying}
                  onCycleComplete={handleCycleComplete}
                  hapticsEnabled={hapticsEnabled}
                  size={circleSize}
                />
              </View>

              {/* Bottom section - stats and controls */}
              <View style={styles.portraitBottomSection}>
                <View style={styles.portraitStatsRow}>
                  <View style={styles.portraitStatItem}>
                    <Text style={styles.landscapeStatLabel}>Time Left</Text>
                    <Text style={styles.landscapeStatValue}>{formatTime(remainingTime)}</Text>
                  </View>
                  <View style={styles.portraitStatItem}>
                    <Text style={styles.landscapeStatLabel}>Cycles</Text>
                    <Text style={styles.landscapeStatValue}>{cyclesCompleted}/{totalCycles}</Text>
                  </View>
                </View>
                
                <View style={styles.portraitControlsRow}>
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

    // Landscape fullscreen layout
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

          {/* Landscape layout: horizontal row */}
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
                size={circleSize}
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

  // Portrait Mode - Main Screen (Fixed Layout - No Scroll)
  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.fixedContent,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + 90,
          },
        ]}
      >
        {/* Welcome Section at Top - hidden during breathing session */}
        {!isPlaying ? (
          <Animated.View entering={FadeIn.duration(600)} style={styles.welcomeWrapper}>
            <WelcomeSection
              userName={user?.name}
              lastPlayedAffirmation={currentAffirmation}
              suggestedAffirmation={suggestedAffirmation as any}
              onQuickPlay={handleQuickPlay}
              onSettingsPress={() => navigation.navigate("Main", { screen: "SettingsTab" })}
              isPlaying={isAudioPlaying}
            />
          </Animated.View>
        ) : null}

        {/* Technique Selector Card - Compact */}
        {!isPlaying ? (
          <Animated.View entering={FadeIn.delay(100).duration(600)} style={styles.techniqueWrapper}>
            <Pressable
              onPress={() => setShowTechniqueSelector(true)}
              style={[styles.techniqueCard, { backgroundColor: theme.cardBackground }, Shadows.medium]}
            >
              <View style={styles.techniqueCardContent}>
                <View style={[styles.techniqueIconSmall, { backgroundColor: `${selectedTechnique.color}30` }]}>
                  <Feather name={selectedTechnique.icon as any} size={22} color={selectedTechnique.color} />
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
          </Animated.View>
        ) : null}

        {/* Breathing Circle - Hero Element */}
        <Animated.View 
          entering={FadeIn.delay(200).duration(800)} 
          style={styles.circleSection}
        >
          <View style={styles.circleContainer}>
            <BreathingCircle
              technique={selectedTechnique}
              isPlaying={isPlaying}
              onCycleComplete={handleCycleComplete}
              hapticsEnabled={hapticsEnabled}
              size={isPlaying ? 300 : 260}
            />
          </View>

        </Animated.View>

        {/* Control Buttons - Horizontal below circle */}
        {!isPlaying ? (
          <Animated.View 
            entering={FadeIn.delay(350).duration(400)}
            style={styles.controlButtonsHorizontal}
          >
            <Pressable 
              onPress={() => setHapticsEnabled(!hapticsEnabled)} 
              style={[styles.secondaryControlButton, { backgroundColor: hapticsEnabled ? `${ACCENT_GOLD}20` : theme.backgroundSecondary, borderColor: hapticsEnabled ? ACCENT_GOLD : theme.border }, Shadows.small]}
            >
              <Feather name="smartphone" size={18} color={hapticsEnabled ? ACCENT_GOLD : theme.textSecondary} />
              <ThemedText type="caption" style={{ marginTop: 2, fontSize: 9, color: hapticsEnabled ? ACCENT_GOLD : theme.textSecondary }}>Haptics</ThemedText>
            </Pressable>
            <Pressable onPress={handleStart} testID="button-start-breathing">
              <LinearGradient
                colors={[selectedTechnique.color, `${selectedTechnique.color}CC`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.primaryPlayButton, Shadows.large]}
              >
                <Feather name="play" size={28} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Start</Text>
              </LinearGradient>
            </Pressable>
            <Pressable 
              onPress={enterFullscreen} 
              style={[styles.secondaryControlButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }, Shadows.small]}
            >
              <Feather name="maximize-2" size={18} color={theme.text} />
              <ThemedText type="caption" style={{ marginTop: 2, fontSize: 9 }}>Expand</ThemedText>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Bottom Options Panel */}
        {!isPlaying ? (
          <Animated.View entering={FadeIn.delay(400).duration(600)} style={styles.bottomPanel}>
            {/* Duration Row */}
            <View style={styles.optionRow}>
              <View style={styles.optionLabelContainer}>
                <Feather name="clock" size={16} color={ACCENT_GOLD} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 6 }}>Duration</ThemedText>
              </View>
              <View style={styles.optionPillsRow}>
                {DURATION_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setSelectedDuration(option.value);
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                    }}
                    style={[
                      styles.optionPill,
                      {
                        backgroundColor: selectedDuration === option.value ? ACCENT_GOLD : 'transparent',
                        borderColor: selectedDuration === option.value ? ACCENT_GOLD : theme.border,
                      },
                    ]}
                    testID={`duration-${option.value}`}
                  >
                    <Text style={[styles.optionPillText, { color: selectedDuration === option.value ? "#FFFFFF" : theme.text }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Audio Row */}
            <View style={styles.optionRow}>
              <View style={styles.optionLabelContainer}>
                <Feather name="volume-2" size={16} color={ACCENT_GOLD} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 6 }}>Audio</ThemedText>
              </View>
              <View style={styles.optionPillsRow}>
                <Pressable
                  onPress={() => {
                    setMusicEnabled(false);
                    setVoiceEnabled(false);
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                  }}
                  style={[
                    styles.optionPill,
                    { 
                      backgroundColor: (!musicEnabled && !voiceEnabled) ? ACCENT_GOLD : 'transparent',
                      borderColor: (!musicEnabled && !voiceEnabled) ? ACCENT_GOLD : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionPillText, { color: (!musicEnabled && !voiceEnabled) ? "#FFFFFF" : theme.text }]}>Off</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (musicEnabled) {
                      // Already enabled - navigate to sound library to change selection
                      navigation.navigate('SoundLibrary');
                    } else {
                      // Enable music
                      setMusicEnabled(true);
                      navigation.navigate('SoundLibrary');
                    }
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                  }}
                  onLongPress={() => {
                    // Long press toggles music off
                    setMusicEnabled(false);
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
                  }}
                  style={[
                    styles.optionPill,
                    { 
                      backgroundColor: musicEnabled ? ACCENT_GOLD : 'transparent',
                      borderColor: musicEnabled ? ACCENT_GOLD : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionPillText, { color: musicEnabled ? "#FFFFFF" : theme.text }]} numberOfLines={1}>
                    {selectedMusic !== 'none' 
                      ? BACKGROUND_MUSIC_OPTIONS.find(o => o.id === selectedMusic)?.name || 'Music'
                      : 'Music'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (voiceEnabled) {
                      // Already enabled - navigate to Affirm tab to show selected affirmation
                      if (breathingAffirmation) {
                        requestHighlightAffirmation(breathingAffirmation.id);
                        navigation.navigate("Main", { screen: "AffirmTab" });
                      } else {
                        navigation.navigate("Main", { screen: "AffirmTab" });
                      }
                    } else {
                      // Enable voice
                      setVoiceEnabled(true);
                    }
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                  }}
                  onLongPress={() => {
                    // Long press toggles voice off
                    setVoiceEnabled(false);
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
                  }}
                  style={[
                    styles.optionPill,
                    { 
                      backgroundColor: voiceEnabled ? ACCENT_GOLD : 'transparent',
                      borderColor: voiceEnabled ? ACCENT_GOLD : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionPillText, { color: voiceEnabled ? "#FFFFFF" : theme.text }]}>Voice</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        ) : null}

      </View>

      {/* Playing Controls - Horizontal row at bottom during active session */}
      {isPlaying ? (
        <Animated.View 
          entering={FadeIn.duration(400)} 
          style={[styles.playingControlsBottom, { paddingBottom: insets.bottom + 100 }]}
        >
          {/* Stats Row - Above controls */}
          <View style={styles.activeStatsRow}>
            <View style={styles.statItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Time Left
              </ThemedText>
              <ThemedText type="h2" style={{ color: theme.text }}>{formatTime(remainingTime)}</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                Cycles
              </ThemedText>
              <ThemedText type="h2" style={{ color: theme.text }}>
                {cyclesCompleted}/{totalCycles}
              </ThemedText>
            </View>
          </View>
          <View style={styles.playingControlsRow}>
            <Pressable
              onPress={handleStop}
              style={[styles.playingSecondaryButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }, Shadows.small]}
              testID="button-stop-breathing"
            >
              <Feather name="square" size={20} color={theme.text} />
              <ThemedText type="caption" style={{ marginTop: 4 }}>Stop</ThemedText>
            </Pressable>
            <Pressable
              onPress={isPlaying ? handlePause : handleResume}
              testID="button-pause-breathing"
            >
              <LinearGradient
                colors={[selectedTechnique.color, `${selectedTechnique.color}CC`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.playingPrimaryButton, Shadows.large]}
              >
                <Feather name="pause" size={32} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={() => setShowLandscapeMode(true)}
              style={[styles.playingSecondaryButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }, Shadows.small]}
            >
              <Feather name="maximize-2" size={20} color={theme.text} />
              <ThemedText type="caption" style={{ marginTop: 4 }}>Expand</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

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

      {/* Focus Timer Modal */}
      <FocusTimer
        visible={showFocusTimer}
        onClose={handleFocusTimerClose}
        onComplete={handleFocusTimerComplete}
        continueAudio={musicEnabled || voiceEnabled}
      />

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  welcomeWrapper: {
    marginBottom: Spacing.sm,
  },
  techniqueWrapper: {
    marginBottom: 0,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },

  // Circle Section
  circleSection: {
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: Spacing.md,
  },
  circleContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  circleControlButtons: {
    position: "absolute",
    right: -70,
    alignItems: "center",
    gap: Spacing.sm,
  },
  controlButtonsRight: {
    position: "absolute",
    right: Spacing.lg,
    top: 380,
    alignItems: "center",
    gap: Spacing.sm,
  },
  controlButtonsHorizontal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.xl * 2.5,
    marginBottom: Spacing.xl,
  },
  primaryPlayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  secondaryControlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  activeStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
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

  // Bottom Options Panel
  bottomPanel: {
    gap: Spacing.md,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  optionLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 90,
  },
  optionPillsRow: {
    flex: 1,
    flexDirection: "row",
    gap: Spacing.xs,
  },
  optionPill: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: "center",
  },
  optionPillText: {
    fontWeight: "600",
    fontSize: 13,
  },


  // Floating Buttons
  fullscreenButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineControlButtons: {
    alignSelf: "flex-end",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    marginTop: -Spacing.xl * 2,
  },
  floatingControlSection: {
    position: "absolute",
    right: Spacing.lg,
    zIndex: 10,
  },
  floatingStartButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingPlayingControls: {
    alignItems: "center",
    gap: Spacing.md,
  },
  floatingControlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  playingControlsBottom: {
    paddingHorizontal: Spacing.lg,
  },
  playingControlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xl,
  },
  playingSecondaryButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  playingPrimaryButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
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
  landscapeStatsRow: {
    alignItems: "center",
  },
  // Portrait fullscreen mode styles
  portraitFullscreenWrapper: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  portraitTopSection: {
    alignItems: "center",
  },
  portraitCenterSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  portraitBottomSection: {
    alignItems: "center",
    gap: Spacing.lg,
  },
  portraitStatsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl * 3,
  },
  portraitStatItem: {
    alignItems: "center",
  },
  portraitControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
});
