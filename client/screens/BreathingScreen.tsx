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
  Alert,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ScreenOrientation from "expo-screen-orientation";
import { Audio } from "expo-av";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import Slider from "@react-native-community/slider";
import Svg, { Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

const PROGRESS_INDICATOR_KEY = "@settings/progressIndicator";
const DEFAULT_BREATHING_TECHNIQUE_KEY = "@breathing/defaultTechnique";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import BreathingCircle from "@/components/BreathingCircle";
import { WelcomeSection } from "@/components/WelcomeSection";
import { MoodCheckin } from "@/components/MoodCheckin";
import { useTheme } from "@/hooks/useTheme";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { useAudio } from "@/contexts/AudioContext";
import { useBackgroundMusic, BACKGROUND_MUSIC_OPTIONS, type BackgroundMusicType, getSoundsByCategory, type BackgroundMusicOption } from "@/contexts/BackgroundMusicContext";
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
  const [showLandscapeMode, setShowLandscapeMode] = useState(false);
  const { width: rawWidth, height: rawHeight } = useWindowDimensions();
  const SCREEN_WIDTH = showLandscapeMode ? rawWidth : Math.min(rawWidth, rawHeight);
  const SCREEN_HEIGHT = showLandscapeMode ? rawHeight : Math.max(rawWidth, rawHeight);
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { currentAffirmation, isPlaying: isAudioPlaying, playAffirmation, togglePlayPause, breathingAffirmation, requestHighlightAffirmation, stop: stopAffirmationAudio } = useAudio();
  const { selectedMusic, setSelectedMusic, startBackgroundMusic, stopBackgroundMusic, isPlaying: isMusicPlaying, volume, setVolume, setDucked } = useBackgroundMusic();
  const queryClient = useQueryClient();

  const [selectedTechnique, setSelectedTechnique] = useState<BreathingTechnique>(BREATHING_TECHNIQUES[0]);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('@settings/hapticFeedback').then((value) => {
        if (value !== null) {
          setHapticsEnabled(value === 'true');
        }
      });
    }, [])
  );
  const [showTechniqueSelector, setShowTechniqueSelector] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const [progressIndicatorEnabled, setProgressIndicatorEnabled] = useState(true);

  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const countdownScale = useSharedValue(0.5);
  const countdownOpacityVal = useSharedValue(0);

  const ripple1Scale = useSharedValue(1);
  const ripple1Opacity = useSharedValue(0);
  const ripple2Scale = useSharedValue(1);
  const ripple2Opacity = useSharedValue(0);
  const ripple3Scale = useSharedValue(1);
  const ripple3Opacity = useSharedValue(0);

  const [showTechniqueInfo, setShowTechniqueInfo] = useState(false);
  const [showMoodCheckin, setShowMoodCheckin] = useState(false);

  const [voiceVolume, setVoiceVolume] = useState(0.8);

  const [showSoundSwitcher, setShowSoundSwitcher] = useState(false);

  const categories = React.useMemo(() => {
    const byCategory = getSoundsByCategory();
    const order: Array<keyof ReturnType<typeof getSoundsByCategory>> = [
      "rain", "ocean", "forest", "meditation", "solfeggio", "binaural", "noise",
    ];
    return order.map((key) => ({
      key,
      label: { rain: "Rain", ocean: "Ocean", forest: "Forest & Birds", meditation: "Meditation", solfeggio: "Solfeggio", binaural: "Binaural", noise: "Noise" }[key] || key,
      color: { rain: "#4FC3F7", ocean: "#29B6F6", forest: "#66BB6A", meditation: "#E040FB", solfeggio: "#C9A227", binaural: "#9C27B0", noise: "#78909C" }[key] || "#999",
      sounds: byCategory[key],
    }));
  }, []);

  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsOpacity = useSharedValue(1);

  const fullscreenProgress = useSharedValue(0);
  const fullscreenTransitionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fullscreenProgress.value, [0, 0.4, 1], [0, 0.6, 1]),
    transform: [{ scale: interpolate(fullscreenProgress.value, [0, 1], [0.92, 1]) }],
  }));

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

  // Quick play handler for WelcomeSection
  const handleQuickPlay = async () => {
    const affirmationToPlay = currentAffirmation || backgroundAffirmation;
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
  const progressPercent = selectedDuration > 0 ? Math.round((elapsedTime / selectedDuration) * 100) : 0;

  useFocusEffect(
    useCallback(() => {
      if (!showLandscapeMode) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
      return () => {
        ScreenOrientation.unlockAsync();
      };
    }, [showLandscapeMode])
  );

  useEffect(() => {
    if (showLandscapeMode) {
      ScreenOrientation.unlockAsync();

      const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
        const newOrientation = event.orientationInfo.orientation;
        const isLandscapeOrientation =
          newOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          newOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
        setIsLandscape(isLandscapeOrientation);
      });

      return () => {
        ScreenOrientation.removeOrientationChangeListener(subscription);
      };
    } else {
      setIsLandscape(false);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, [showLandscapeMode]);

  // Load progress indicator setting - refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(PROGRESS_INDICATOR_KEY).then((value) => {
        if (value !== null) {
          setProgressIndicatorEnabled(value === "true");
        }
      });
    }, [])
  );

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

  // Load saved default breathing technique on mount
  useEffect(() => {
    const loadDefaultTechnique = async () => {
      try {
        const savedTechniqueId = await AsyncStorage.getItem(DEFAULT_BREATHING_TECHNIQUE_KEY);
        if (savedTechniqueId) {
          const technique = BREATHING_TECHNIQUES.find(t => t.id === savedTechniqueId);
          if (technique) {
            setSelectedTechnique(technique);
          }
        }
      } catch (error) {
        console.error('Error loading default technique:', error);
      }
    };
    loadDefaultTechnique();
  }, []);

  // Affirmation audio playback functions
  const startAffirmationLoop = useCallback(async () => {
    if (!backgroundAffirmation?.audioUrl) return;
    
    try {
      if (affirmationSoundRef.current) {
        try { await affirmationSoundRef.current.unloadAsync(); } catch {}
        affirmationSoundRef.current = null;
      }
      
      const audioUri = `${getApiUrl()}${backgroundAffirmation.audioUrl}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { 
          shouldPlay: true, 
          isLooping: true,
          volume: voiceVolume,
        }
      );
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('error' in status && status.error) {
          console.warn('Affirmation playback issue, will retry:', status.error);
          sound.unloadAsync().catch(() => {});
          affirmationSoundRef.current = null;
        }
      });
      
      affirmationSoundRef.current = sound;
    } catch (error) {
      console.warn('Could not play affirmation loop, skipping:', error);
    }
  }, [backgroundAffirmation]);

  const handleSwitchSoundDuringPlayback = useCallback(async (soundId: BackgroundMusicType) => {
    if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} }
    
    if (soundId === 'none') {
      setMusicEnabled(false);
      await setDucked(false);
      await stopBackgroundMusic();
    } else {
      setMusicEnabled(true);
      if (voiceEnabled) {
        await setDucked(true);
      }
      await setSelectedMusic(soundId);
      if (isPlaying) {
        await startBackgroundMusic();
      }
    }
  }, [hapticsEnabled, setSelectedMusic, startBackgroundMusic, stopBackgroundMusic, isPlaying, voiceEnabled, setDucked]);

  const renderSoundTile = useCallback((
    sound: BackgroundMusicOption,
    isSelected: boolean,
    onPress: (id: BackgroundMusicType) => void,
  ) => {
    const tileSize = 88;
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
          size={20}
          color={isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.6)"}
        />
        <ThemedText
          type="caption"
          style={{
            color: isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.7)",
            fontSize: 10,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {sound.name}
        </ThemedText>
      </Pressable>
    );
  }, []);

  const renderNoSoundTile = useCallback((
    onPress: (id: BackgroundMusicType) => void,
  ) => {
    const isSelected = !musicEnabled;
    const tileSize = 88;
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
          size={20}
          color={isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.6)"}
        />
        <ThemedText
          type="caption"
          style={{
            color: isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.7)",
            fontSize: 10,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {"No sound"}
        </ThemedText>
      </Pressable>
    );
  }, [musicEnabled]);

  const renderSoundSwitcherModal = useCallback(() => (
    <Modal
      visible={showSoundSwitcher}
      animationType="slide"
      transparent
      onRequestClose={() => setShowSoundSwitcher(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setShowSoundSwitcher(false)}
      >
        <Pressable
          style={[styles.soundSwitcherContent, { paddingBottom: insets.bottom + Spacing.md }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHandle} />
          <View style={styles.soundSwitcherHeader}>
            <ThemedText type="h4" style={{ color: "#fff", fontSize: 17 }}>
              Switch Sound
            </ThemedText>
            <Pressable
              onPress={() => setShowSoundSwitcher(false)}
              hitSlop={12}
              testID="button-close-sound-switcher"
            >
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>

          <View style={styles.soundVolumeRow}>
            <Feather name="volume-1" size={14} color="rgba(255,255,255,0.5)" />
            <Slider
              style={{ flex: 1, marginHorizontal: 8 }}
              minimumValue={0}
              maximumValue={1}
              value={volume}
              onValueChange={(val: number) => setVolume(val)}
              minimumTrackTintColor={ACCENT_GOLD}
              maximumTrackTintColor="rgba(255,255,255,0.15)"
              thumbTintColor={ACCENT_GOLD}
            />
            <Feather name="volume-2" size={14} color="rgba(255,255,255,0.5)" />
          </View>

          <ScrollView
            style={{ maxHeight: 340 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              {renderNoSoundTile(handleSwitchSoundDuringPlayback)}
            </View>
            {categories.map((category) => (
              <View key={category.key} style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <ThemedText
                  type="caption"
                  style={{ color: category.color, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}
                >
                  {category.label}
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {category.sounds.map((sound) =>
                    renderSoundTile(
                      sound,
                      musicEnabled && selectedMusic === sound.id,
                      handleSwitchSoundDuringPlayback,
                    )
                  )}
                </ScrollView>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  ), [showSoundSwitcher, musicEnabled, volume, selectedMusic, categories, insets.bottom, handleSwitchSoundDuringPlayback, renderSoundTile, renderNoSoundTile, setVolume, voiceEnabled]);

  const stopAffirmationLoop = useCallback(async () => {
    if (affirmationSoundRef.current) {
      try {
        await affirmationSoundRef.current.stopAsync();
        await affirmationSoundRef.current.unloadAsync();
      } catch {}
      affirmationSoundRef.current = null;
    }
  }, []);

  const pauseAffirmationLoop = useCallback(async () => {
    if (affirmationSoundRef.current) {
      try {
        await affirmationSoundRef.current.pauseAsync();
      } catch {}
    }
  }, []);

  const resumeAffirmationLoop = useCallback(async () => {
    if (affirmationSoundRef.current) {
      try {
        await affirmationSoundRef.current.playAsync();
      } catch {}
    }
  }, []);

  const handleSessionVolumeChange = useCallback(async (val: number) => {
    const rounded = Math.round(val * 100) / 100;
    if (musicEnabled) {
      setVolume(rounded);
    }
    if (voiceEnabled && affirmationSoundRef.current) {
      setVoiceVolume(rounded);
      try {
        await affirmationSoundRef.current.setVolumeAsync(rounded);
      } catch {}
    }
    if (!musicEnabled && !voiceEnabled) {
      setVolume(rounded);
      setVoiceVolume(rounded);
    }
  }, [musicEnabled, voiceEnabled, setVolume]);

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
    await stopAffirmationAudio();
    
    setIsPlaying(true);
    setElapsedTime(0);
    setCyclesCompleted(0);
    if (hapticsEnabled) { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {} }
    
    if (musicEnabled && voiceEnabled) {
      await setDucked(true);
    }
    if (musicEnabled) {
      await startBackgroundMusic();
    }
    if (voiceEnabled) {
      await startAffirmationLoop();
    }
  };

  const handlePause = async () => {
    setIsPlaying(false);
    if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {} }
    
    await setDucked(false);
    if (isMusicPlaying) {
      await stopBackgroundMusic();
    }
    if (voiceEnabled) {
      await pauseAffirmationLoop();
    }
  };

  const handleResume = async () => {
    setIsPlaying(true);
    if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} }
    
    if (musicEnabled && voiceEnabled) {
      await setDucked(true);
    }
    if (musicEnabled) {
      await startBackgroundMusic();
    }
    if (voiceEnabled) {
      await resumeAffirmationLoop();
    }
  };

  const handleStop = async () => {
    const wasNaturalCompletion = sessionCompletedNaturally.current;
    sessionCompletedNaturally.current = false;
    
    setIsPlaying(false);
    setElapsedTime(0);
    setCyclesCompleted(0);
    setShowLandscapeMode(false);
    controlsOpacity.value = 1;
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (hapticsEnabled) { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {} }
    
    await setDucked(false);
    if (isMusicPlaying) {
      await stopBackgroundMusic();
    }
    if (voiceEnabled) {
      await stopAffirmationLoop();
    }
    
    if (wasNaturalCompletion) {
      setShowCompletionAnimation(true);
      setTimeout(() => {
        setShowCompletionAnimation(false);
      }, 2500);
    }
  };

  const handleCycleComplete = () => {
    setCyclesCompleted((prev) => prev + 1);
    if (hapticsEnabled) { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {} }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const selectTechnique = async (technique: BreathingTechnique) => {
    if (!isPlaying) {
      setSelectedTechnique(technique);
      setShowTechniqueSelector(false);
      if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} }
      
      // Save as the last selected technique
      try {
        await AsyncStorage.setItem(DEFAULT_BREATHING_TECHNIQUE_KEY, technique.id);
      } catch (error) {
        console.error('Error saving technique:', error);
      }
    }
  };

  const handleLongPressTechnique = (technique: BreathingTechnique) => {
    if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {} }
    Alert.alert(
      "Set as Default",
      `Always start with "${technique.name}" when you open the app?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Set as Default", 
          onPress: async () => {
            try {
              await AsyncStorage.setItem(DEFAULT_BREATHING_TECHNIQUE_KEY, technique.id);
              setSelectedTechnique(technique);
              setShowTechniqueSelector(false);
              if (hapticsEnabled) { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {} }
            } catch (error) {
              console.error('Error setting default technique:', error);
            }
          }
        },
      ]
    );
  };

  const exitFullscreen = () => {
    fullscreenProgress.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    setTimeout(() => {
      setShowLandscapeMode(false);
      controlsOpacity.value = 1;
      setControlsVisible(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      handleStop();
      fullscreenProgress.value = 0;
    }, 500);
  };

  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    controlsOpacity.value = withTiming(1, { duration: 250 });
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      controlsOpacity.value = withTiming(0, { duration: 500 });
      setControlsVisible(false);
    }, 3000);
  }, []);

  const toggleControls = useCallback(() => {
    if (controlsVisible) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsOpacity.value = withTiming(0, { duration: 500 });
      setControlsVisible(false);
    } else {
      resetControlsTimer();
    }
  }, [controlsVisible, resetControlsTimer]);

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const countdownAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countdownScale.value }],
    opacity: countdownOpacityVal.value,
  }));

  useEffect(() => {
    if (!isPlaying && countdownValue === null) {
      const duration = 3600;
      const startRipple = (scaleVal: { value: number }, opacityVal: { value: number }, delay: number) => {
        scaleVal.value = 1;
        opacityVal.value = 0;
        scaleVal.value = withDelay(delay, withRepeat(
          withTiming(1.35, { duration, easing: Easing.out(Easing.quad) }),
          -1, false
        ));
        opacityVal.value = withDelay(delay, withRepeat(
          withSequence(
            withTiming(0.25, { duration: duration * 0.12, easing: Easing.out(Easing.ease) }),
            withTiming(0, { duration: duration * 0.88, easing: Easing.in(Easing.ease) }),
          ),
          -1, false
        ));
      };
      startRipple(ripple1Scale, ripple1Opacity, 0);
      startRipple(ripple2Scale, ripple2Opacity, 1200);
      startRipple(ripple3Scale, ripple3Opacity, 2400);
    } else {
      ripple1Opacity.value = withTiming(0, { duration: 400 });
      ripple2Opacity.value = withTiming(0, { duration: 400 });
      ripple3Opacity.value = withTiming(0, { duration: 400 });
    }
  }, [isPlaying, countdownValue]);

  const ripple1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple1Scale.value }],
    opacity: ripple1Opacity.value,
  }));
  const ripple2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple2Scale.value }],
    opacity: ripple2Opacity.value,
  }));
  const ripple3Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple3Scale.value }],
    opacity: ripple3Opacity.value,
  }));

  const handleStartWithCountdown = useCallback(async () => {
    if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (e) {} }
    
    for (let i = 3; i >= 1; i--) {
      setCountdownValue(i);
      countdownScale.value = 0.8;
      countdownOpacityVal.value = 0;
      countdownScale.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) });
      countdownOpacityVal.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
      
      await new Promise(resolve => setTimeout(resolve, 700));
      countdownOpacityVal.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) });
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setCountdownValue(null);
    
    fullscreenProgress.value = 0;
    setShowLandscapeMode(true);
    fullscreenProgress.value = withSpring(1, { damping: 20, stiffness: 60, mass: 1 });
    await handleStart();
  }, [handleStart, hapticsEnabled]);

  useEffect(() => {
    if (showLandscapeMode && isPlaying) {
      resetControlsTimer();
    } else if (!isPlaying && showLandscapeMode) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsOpacity.value = withTiming(1, { duration: 250 });
      setControlsVisible(true);
    }
  }, [showLandscapeMode, isPlaying]);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // Fullscreen Mode - responsive to orientation
  if (showLandscapeMode) {
    const screenWidth = Dimensions.get("window").width;
    const screenHeight = Dimensions.get("window").height;
    const isCurrentlyLandscape = screenWidth > screenHeight;
    const circleSize = isCurrentlyLandscape 
      ? Math.min(screenHeight - 80, 320)
      : Math.min(screenWidth * 0.7, 260);

    // Portrait fullscreen layout - clean, centered design for max focus
    const portraitCircleSize = Math.min(screenWidth * 0.85, screenHeight * 0.45);
    
    if (!isCurrentlyLandscape) {
      return (
        <Modal
          visible={showLandscapeMode}
          animationType="none"
          statusBarTranslucent
          supportedOrientations={["landscape-left", "landscape-right", "portrait"]}
          presentationStyle="fullScreen"
        >
          <StatusBar hidden />
          <Animated.View style={[{ flex: 1 }, fullscreenTransitionStyle]}>
          <Pressable style={[styles.landscapeContainer, { backgroundColor: theme.navy }]} onPress={toggleControls}>
            <View style={[
              styles.portraitFullscreenWrapper,
              { 
                paddingTop: insets.top + Spacing.md,
                paddingBottom: insets.bottom + Spacing.lg,
              }
            ]}>
              <Animated.View style={[styles.fsTopControls, controlsAnimatedStyle]} pointerEvents={controlsVisible ? 'auto' : 'none'} onStartShouldSetResponder={() => true}>
                <View style={styles.fsTopLeft}>
                  <Text style={[styles.fsTechniqueBadge, { backgroundColor: `${selectedTechnique.color}20`, color: selectedTechnique.color }]}>
                    {selectedTechnique.name}
                  </Text>
                </View>
                <View style={styles.fsTopRight}>
                  <Pressable
                    onPress={() => { resetControlsTimer(); setShowSoundSwitcher(true); }}
                    style={[styles.fsControlBtn, { backgroundColor: `${selectedTechnique.color}20` }]}
                  >
                    <Feather name="music" size={18} color={selectedTechnique.color} />
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      resetControlsTimer();
                      const newVol = voiceVolume > 0.05 ? 0 : 0.7;
                      setVoiceVolume(newVol);
                      if (affirmationSoundRef.current) {
                        try { await affirmationSoundRef.current.setVolumeAsync(newVol); } catch {}
                      }
                    }}
                    style={[styles.fsControlBtn, { backgroundColor: `${selectedTechnique.color}20`, opacity: voiceEnabled ? 1 : 0.4 }]}
                    disabled={!voiceEnabled}
                  >
                    <Feather name={voiceEnabled && voiceVolume > 0.05 ? "mic" : "mic-off"} size={18} color={selectedTechnique.color} />
                  </Pressable>
                  <Pressable onPress={() => { resetControlsTimer(); exitFullscreen(); }} style={styles.fsCloseBtn}>
                    <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
                  </Pressable>
                </View>
              </Animated.View>

              <View style={styles.portraitCenterSection}>
                {progressIndicatorEnabled ? (
                  <View style={styles.progressRingContainer}>
                    <Svg 
                      width={portraitCircleSize + 40} 
                      height={portraitCircleSize + 40}
                      style={styles.progressRing}
                    >
                      <Circle
                        cx={(portraitCircleSize + 40) / 2}
                        cy={(portraitCircleSize + 40) / 2}
                        r={(portraitCircleSize + 20) / 2}
                        stroke={`${selectedTechnique.color}15`}
                        strokeWidth={3}
                        fill="transparent"
                      />
                      <Circle
                        cx={(portraitCircleSize + 40) / 2}
                        cy={(portraitCircleSize + 40) / 2}
                        r={(portraitCircleSize + 20) / 2}
                        stroke={selectedTechnique.color}
                        strokeWidth={3}
                        fill="transparent"
                        strokeDasharray={`${Math.PI * (portraitCircleSize + 20)}`}
                        strokeDashoffset={Math.PI * (portraitCircleSize + 20) * (1 - progressPercent / 100)}
                        strokeLinecap="round"
                        rotation="-90"
                        origin={`${(portraitCircleSize + 40) / 2}, ${(portraitCircleSize + 40) / 2}`}
                      />
                    </Svg>
                  </View>
                ) : null}
                <BreathingCircle
                  technique={selectedTechnique}
                  isPlaying={isPlaying}
                  onCycleComplete={handleCycleComplete}
                  hapticsEnabled={hapticsEnabled}
                  size={portraitCircleSize}
                />
              </View>

              <Animated.View style={[styles.fsBottomControls, controlsAnimatedStyle]} pointerEvents={controlsVisible ? 'auto' : 'none'} onStartShouldSetResponder={() => true}>
                <View style={styles.fsCenterControls}>
                  <Pressable
                    onPress={() => { resetControlsTimer(); (isPlaying ? handlePause : handleResume)(); }}
                  >
                    <LinearGradient
                      colors={[selectedTechnique.color, `${selectedTechnique.color}CC`]}
                      style={styles.portraitPlayButton}
                    >
                      <Feather name={isPlaying ? "pause" : "play"} size={28} color="#FFFFFF" />
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => { resetControlsTimer(); handleStop(); }}
                    style={[styles.landscapeStopButton, { position: 'absolute', right: -60 }]}
                  >
                    <Feather name="square" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>

                <View style={styles.portraitStatsRow}>
                  <View style={styles.portraitStatItem}>
                    <Text style={styles.landscapeStatLabel}>Time Left</Text>
                    <Text style={styles.landscapeStatValue}>{formatTime(remainingTime)}</Text>
                  </View>
                  <View style={styles.portraitStatItem}>
                    <Text style={styles.landscapeStatLabel}>Progress</Text>
                    <Text style={[styles.landscapeStatValue, { color: selectedTechnique.color }]}>{progressPercent}%</Text>
                  </View>
                  <View style={styles.portraitStatItem}>
                    <Text style={styles.landscapeStatLabel}>Cycles</Text>
                    <Text style={styles.landscapeStatValue}>{cyclesCompleted}/{totalCycles}</Text>
                  </View>
                </View>
              </Animated.View>
            </View>
          </Pressable>
          </Animated.View>
          {renderSoundSwitcherModal()}
        </Modal>
      );
    }

    // Landscape fullscreen layout
    return (
      <Modal
        visible={showLandscapeMode}
        animationType="none"
        statusBarTranslucent
        supportedOrientations={["landscape-left", "landscape-right", "portrait"]}
        presentationStyle="fullScreen"
      >
        <StatusBar hidden />
        <Animated.View style={[{ flex: 1 }, fullscreenTransitionStyle]}>
        <Pressable style={[styles.landscapeContainer, { backgroundColor: theme.navy }]} onPress={toggleControls}>

          <Animated.View style={[styles.landscapeCloseButton, { top: insets.top + 4 }, controlsAnimatedStyle]} pointerEvents={controlsVisible ? 'auto' : 'none'}>
            <Pressable onPress={() => { resetControlsTimer(); exitFullscreen(); }}>
              <BlurView intensity={40} tint="dark" style={styles.blurButton}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </BlurView>
            </Pressable>
          </Animated.View>

          <View style={[styles.landscapeContent, { paddingLeft: Math.max(insets.left, 48), paddingRight: Math.max(insets.right, 48) }]}>
            <Animated.View style={[styles.landscapeSidePanel, controlsAnimatedStyle]} pointerEvents={controlsVisible ? 'auto' : 'none'} onStartShouldSetResponder={() => true}>
              <Text style={[styles.landscapeTechniqueName, { color: selectedTechnique.color }]}>
                {selectedTechnique.name}
              </Text>
              <Text style={styles.landscapePhaseLabel}>
                {selectedTechnique.benefits}
              </Text>
            </Animated.View>

            <View style={styles.landscapeCircleContainer}>
              {progressIndicatorEnabled ? (
                <View style={styles.progressRingContainer}>
                  <Svg 
                    width={circleSize + 40} 
                    height={circleSize + 40}
                    style={styles.progressRing}
                  >
                    <Circle
                      cx={(circleSize + 40) / 2}
                      cy={(circleSize + 40) / 2}
                      r={(circleSize + 20) / 2}
                      stroke={`${selectedTechnique.color}15`}
                      strokeWidth={3}
                      fill="transparent"
                    />
                    <Circle
                      cx={(circleSize + 40) / 2}
                      cy={(circleSize + 40) / 2}
                      r={(circleSize + 20) / 2}
                      stroke={selectedTechnique.color}
                      strokeWidth={3}
                      fill="transparent"
                      strokeDasharray={`${Math.PI * (circleSize + 20)}`}
                      strokeDashoffset={Math.PI * (circleSize + 20) * (1 - progressPercent / 100)}
                      strokeLinecap="round"
                      rotation="-90"
                      origin={`${(circleSize + 40) / 2}, ${(circleSize + 40) / 2}`}
                    />
                  </Svg>
                </View>
              ) : null}
              <BreathingCircle
                technique={selectedTechnique}
                isPlaying={isPlaying}
                onCycleComplete={handleCycleComplete}
                hapticsEnabled={hapticsEnabled}
                size={circleSize}
              />
            </View>

            <Animated.View style={[styles.landscapeSidePanel, controlsAnimatedStyle]} pointerEvents={controlsVisible ? 'auto' : 'none'} onStartShouldSetResponder={() => true}>
              <View style={styles.landscapeStats}>
                <Text style={styles.landscapeStatLabel}>Time Left</Text>
                <Text style={styles.landscapeStatValue}>{formatTime(remainingTime)}</Text>
              </View>
              <View style={styles.landscapeStats}>
                <Text style={styles.landscapeStatLabel}>Progress</Text>
                <Text style={[styles.landscapeStatValue, { color: selectedTechnique.color }]}>{progressPercent}%</Text>
              </View>
              <View style={styles.landscapeStats}>
                <Text style={styles.landscapeStatLabel}>Cycles</Text>
                <Text style={styles.landscapeStatValue}>{cyclesCompleted}/{totalCycles}</Text>
              </View>
              
              <View style={styles.landscapeControlsRow}>
                <Pressable
                  onPress={() => { resetControlsTimer(); (isPlaying ? handlePause : handleResume)(); }}
                >
                  <LinearGradient
                    colors={[selectedTechnique.color, `${selectedTechnique.color}CC`]}
                    style={styles.landscapePlayButton}
                  >
                    <Feather name={isPlaying ? "pause" : "play"} size={24} color="#FFFFFF" />
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => { resetControlsTimer(); handleStop(); }}
                  style={styles.landscapeStopButton}
                >
                  <Feather name="square" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </Pressable>
        </Animated.View>
        {renderSoundSwitcherModal()}
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
        {/* Welcome Section at Top */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.welcomeWrapper}>
          <WelcomeSection
            userName={user?.name}
            lastPlayedAffirmation={currentAffirmation}
            suggestedAffirmation={backgroundAffirmation as any}
            onQuickPlay={handleQuickPlay}
            onSettingsPress={() => navigation.navigate("Main", { screen: "SettingsTab" })}
            onMoodPress={() => setShowMoodCheckin(true)}
            isPlaying={isAudioPlaying}
          />
        </Animated.View>

        {/* Technique Selector Card - Compact */}
        <Animated.View entering={FadeIn.delay(100).duration(600)} style={styles.techniqueWrapper}>
          <Pressable
            onPress={() => setShowTechniqueSelector(true)}
            style={[styles.techniqueCard, { backgroundColor: theme.cardBackground, borderWidth: 2, borderColor: `${selectedTechnique.color}60` }, Shadows.medium]}
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
          <Pressable
            testID="button-technique-info"
            onPress={() => {
              if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} }
              setShowTechniqueInfo(true);
            }}
            style={[
              styles.techniqueInfoButton,
              {
                backgroundColor: `${selectedTechnique.color}14`,
                borderWidth: 1,
                borderColor: `${selectedTechnique.color}26`,
              },
            ]}
          >
            <Feather name="info" size={18} color={`${selectedTechnique.color}66`} />
          </Pressable>
        </Animated.View>

        {/* Breathing Circle - Hero Element */}
        <Animated.View 
          entering={FadeIn.delay(200).duration(800)} 
          style={styles.circleSection}
        >
          <View style={styles.circleContainer}>
            {!isPlaying ? (
              <>
                <Animated.View style={[{
                  position: 'absolute',
                  width: 220,
                  height: 220,
                  borderRadius: 110,
                  borderWidth: 1,
                  borderColor: selectedTechnique.color,
                }, ripple1Style]} />
                <Animated.View style={[{
                  position: 'absolute',
                  width: 220,
                  height: 220,
                  borderRadius: 110,
                  borderWidth: 1,
                  borderColor: selectedTechnique.color,
                }, ripple2Style]} />
                <Animated.View style={[{
                  position: 'absolute',
                  width: 220,
                  height: 220,
                  borderRadius: 110,
                  borderWidth: 0.5,
                  borderColor: selectedTechnique.color,
                }, ripple3Style]} />
              </>
            ) : null}
            <BreathingCircle
              technique={selectedTechnique}
              isPlaying={isPlaying}
              onCycleComplete={handleCycleComplete}
              hapticsEnabled={hapticsEnabled}
              size={260}
              showContent={countdownValue === null}
            />
            {!isPlaying && countdownValue === null ? (
              <Pressable
                onPress={handleStartWithCountdown}
                testID="button-start-breathing"
                style={{
                  position: 'absolute',
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <LinearGradient
                  colors={[selectedTechnique.color, `${selectedTechnique.color}CC`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: selectedTechnique.color,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                >
                  <Feather name="play" size={32} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            ) : null}
            {countdownValue !== null ? (
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                  countdownAnimatedStyle,
                ]}
              >
                <Text style={{
                  fontSize: 32,
                  fontWeight: '700',
                  color: 'rgba(255,255,255,0.85)',
                  letterSpacing: 2,
                }}>
                  {countdownValue}
                </Text>
              </Animated.View>
            ) : null}
          </View>


        </Animated.View>

        {/* Bottom Options Panel */}
        <Animated.View entering={FadeIn.delay(400).duration(600)} style={styles.bottomPanel}>
          {/* Duration Row */}
          <View style={styles.optionRow}>
            <View style={styles.optionLabelContainer}>
              <Feather name="clock" size={16} color={selectedTechnique.color} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 6 }}>Duration</ThemedText>
            </View>
            <View style={styles.optionPillsRow}>
              {DURATION_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    setSelectedDuration(option.value);
                    if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} }
                  }}
                  style={[
                    styles.optionPill,
                    {
                      backgroundColor: selectedDuration === option.value ? selectedTechnique.color : 'transparent',
                      borderColor: selectedDuration === option.value ? selectedTechnique.color : `${ACCENT_GOLD}50`,
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
              <Feather name="volume-2" size={16} color={selectedTechnique.color} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 6 }}>Audio</ThemedText>
            </View>
            <View style={styles.optionPillsRow}>
              <Pressable
                onPress={() => {
                  setMusicEnabled(false);
                  setVoiceEnabled(false);
                  if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} }
                }}
                style={[
                  styles.optionPillFixed,
                  { 
                    backgroundColor: (!musicEnabled && !voiceEnabled) ? selectedTechnique.color : 'transparent',
                    borderColor: (!musicEnabled && !voiceEnabled) ? selectedTechnique.color : `${ACCENT_GOLD}50`,
                  },
                ]}
              >
                <Text style={[styles.optionPillText, { color: (!musicEnabled && !voiceEnabled) ? "#FFFFFF" : theme.text }]}>Off</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (musicEnabled) {
                    navigation.navigate('SoundLibrary');
                  } else {
                    setMusicEnabled(true);
                    navigation.navigate('SoundLibrary');
                  }
                  if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} }
                }}
                onLongPress={() => {
                  setMusicEnabled(false);
                  if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {} }
                }}
                style={[
                  styles.optionPill,
                  { 
                    backgroundColor: musicEnabled ? selectedTechnique.color : 'transparent',
                    borderColor: musicEnabled ? selectedTechnique.color : `${ACCENT_GOLD}50`,
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
                    if (breathingAffirmation) {
                      requestHighlightAffirmation(breathingAffirmation.id);
                      navigation.navigate("Main", { screen: "AffirmTab" });
                    } else {
                      navigation.navigate("Main", { screen: "AffirmTab" });
                    }
                  } else {
                    setVoiceEnabled(true);
                  }
                  if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {} }
                }}
                onLongPress={() => {
                  setVoiceEnabled(false);
                  if (hapticsEnabled) { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {} }
                }}
                style={[
                  styles.optionPillFixed,
                  { 
                    backgroundColor: voiceEnabled ? selectedTechnique.color : 'transparent',
                    borderColor: voiceEnabled ? selectedTechnique.color : `${ACCENT_GOLD}50`,
                  },
                ]}
              >
                <Text style={[styles.optionPillText, { color: voiceEnabled ? "#FFFFFF" : theme.text }]}>Voice</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

      </View>

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
                onLongPress={() => handleLongPressTechnique(technique)}
                delayLongPress={500}
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

      {/* Technique Info Modal */}
      <Modal
        visible={showTechniqueInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTechniqueInfo(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { justifyContent: "center", alignItems: "center" }]}
          onPress={() => setShowTechniqueInfo(false)}
        >
          <View
            style={[
              styles.techniqueInfoModalContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHandle} />

            <View style={[styles.techniqueInfoIconCircle, { backgroundColor: `${selectedTechnique.color}20` }]}>
              <Feather name={selectedTechnique.icon as any} size={32} color={selectedTechnique.color} />
            </View>

            <ThemedText type="h3" style={{ textAlign: "center", marginTop: Spacing.md }}>
              {selectedTechnique.name}
            </ThemedText>
            <ThemedText type="caption" style={{ color: selectedTechnique.color, textAlign: "center", marginTop: Spacing.xs }}>
              {selectedTechnique.pattern}
            </ThemedText>

            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}>
              {selectedTechnique.description}
            </ThemedText>

            <View style={[styles.techniqueInfoScienceTip, { backgroundColor: `${selectedTechnique.color}10`, borderColor: `${selectedTechnique.color}20` }]}>
              <Feather name="info" size={14} color={selectedTechnique.color} style={{ marginTop: 2 }} />
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1, fontStyle: "italic", lineHeight: 18 }}>
                {selectedTechnique.scienceTip}
              </ThemedText>
            </View>

            <View style={styles.techniqueInfoBenefitsList}>
              {selectedTechnique.detailedBenefits.map((benefit, index) => (
                <View key={index} style={styles.techniqueInfoBenefitRow}>
                  <View style={[styles.techniqueInfoBenefitIcon, { backgroundColor: `${selectedTechnique.color}15` }]}>
                    <Feather name={benefit.icon as any} size={16} color={selectedTechnique.color} />
                  </View>
                  <ThemedText type="body" style={{ flex: 1 }}>
                    {benefit.text}
                  </ThemedText>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => setShowTechniqueInfo(false)}
              style={[styles.techniqueInfoDismissButton, { backgroundColor: `${selectedTechnique.color}15` }]}
            >
              <ThemedText type="body" style={{ color: selectedTechnique.color, fontWeight: "600" }}>
                Got it
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Completion Animation Modal */}
      <Modal
        visible={showCompletionAnimation}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.completionOverlay}>
          <Animated.View 
            entering={FadeIn.duration(400)}
            style={styles.completionContent}
          >
            <View style={[styles.completionIconContainer, { backgroundColor: `${selectedTechnique.color}20` }]}>
              <Feather name="check-circle" size={64} color={selectedTechnique.color} />
            </View>
            <ThemedText type="h2" style={styles.completionTitle}>Well Done!</ThemedText>
            <ThemedText type="body" style={styles.completionSubtitle}>
              {formatTime(selectedDuration)} of mindful breathing completed
            </ThemedText>
          </Animated.View>
        </View>
      </Modal>

      <MoodCheckin
        visible={showMoodCheckin}
        onClose={() => setShowMoodCheckin(false)}
        onStartBreathing={(techniqueId) => {
          const technique = BREATHING_TECHNIQUES.find(t => t.id === techniqueId);
          if (technique) {
            setSelectedTechnique(technique);
            AsyncStorage.setItem(DEFAULT_BREATHING_TECHNIQUE_KEY, technique.id).catch(() => {});
            setTimeout(() => handleStartWithCountdown(), 300);
          }
        }}
        onStartAffirmations={() => {
          navigation.navigate("Main", { screen: "AffirmTab" });
        }}
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
    justifyContent: "center",
  },
  circleContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  progressRingContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  progressRing: {
    position: "absolute",
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
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  startButtonShadow: {
    borderRadius: 44,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  primaryPlayButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  secondaryControlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
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
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    alignItems: "center",
  },
  optionPillFixed: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    alignItems: "center",
  },
  optionPillText: {
    fontWeight: "600",
    fontSize: 13,
    letterSpacing: 0.3,
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
  completionOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 28, 63, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  completionContent: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  completionIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  completionTitle: {
    color: "#FFFFFF",
    marginBottom: Spacing.sm,
  },
  completionSubtitle: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
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
  portraitPlayButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
    zIndex: 1,
  },
  fsTopControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    zIndex: 10,
  },
  fsTopLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  fsTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  fsTechniqueBadge: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: "hidden",
    letterSpacing: 0.5,
  },
  fsControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  fsCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  fsCenterControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  fsBottomControls: {
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
  techniqueInfoButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  techniqueInfoModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xxl,
    paddingBottom: 48,
    maxWidth: "85%",
    alignSelf: "center",
    width: "100%",
    borderRadius: 20,
    marginBottom: Spacing.xl,
  },
  techniqueInfoIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  techniqueInfoScienceTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  techniqueInfoBenefitsList: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  techniqueInfoBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  techniqueInfoBenefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  techniqueInfoDismissButton: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: "center",
  },
  soundTile: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  soundSwitcherContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 28, 63, 0.97)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
  },
  soundSwitcherHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  soundVolumeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
});
