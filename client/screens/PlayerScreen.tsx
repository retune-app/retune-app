import React, { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { View, StyleSheet, Pressable, Alert, ScrollView, Modal } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { ThemedModal } from "@/components/ThemedModal";
import { useTheme } from "@/hooks/useTheme";
import { useAudio, preloadAudioToCache, clearCachedAudio } from "@/contexts/AudioContext";
import { useBackgroundMusic } from "@/contexts/BackgroundMusicContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { getVoiceDisplayName, VOICE_ID_TO_NAME, AI_VOICES } from "@shared/voiceMapping";
import JourneyStepBar from "@/components/JourneyStepBar";
import { journeyNavigationRef } from "@/navigation/journeyNavigationRef";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Affirmation } from "@shared/schema";

const AUTO_REPLAY_KEY = "@settings/autoReplay";
const SHOW_SCRIPT_KEY = "@settings/showScript";

type PlayerRouteProp = RouteProp<RootStackParamList, "Player">;
type PlayerNavigationProp = NativeStackNavigationProp<RootStackParamList, "Player">;

export default function PlayerScreen() {
  const route = useRoute<PlayerRouteProp>();
  const navigation = useNavigation<PlayerNavigationProp>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const { affirmationId, isNew = false, autoPlay = false, journeyContext } = route.params;

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
    breathingAffirmation,
    setBreathingAffirmation,
  } = useAudio();
  const { selectedMusic, setSelectedMusic, stopBackgroundMusic } = useBackgroundMusic();
  const previousMusicRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {};
  }, []);

  useEffect(() => {
    if (!journeyContext) return;
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      stop();
    });
    return unsubscribe;
  }, [journeyContext, navigation, stop]);

  const rsvpEnabled = true;
  const rsvpFontSize: RSVPFontSize = "XL";
  const rsvpHighlight = true;
  const [showRsvpSettings, setShowRsvpSettings] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isInFullscreenMode, setIsInFullscreenMode] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const prevLandscapeRef = useRef(false);

  const { data: affirmation, isLoading } = useQuery<Affirmation>({
    queryKey: ["/api/affirmations", affirmationId],
  });

  // Query for user's voice status (whether they have a personal voice set up)
  const { data: voiceStatus } = useQuery<{ hasPersonalVoice: boolean; hasClonedVoice: boolean }>({
    queryKey: ["/api/voice-samples/status"],
    staleTime: 30000,
  });

  const { data: voicePrefs } = useQuery<{
    preferredFemaleVoiceId: string;
    preferredMaleVoiceId: string;
  }>({
    queryKey: ["/api/voice-preferences"],
    staleTime: 60000,
  });

  const femaleVoiceName = voicePrefs?.preferredFemaleVoiceId
    ? (VOICE_ID_TO_NAME[voicePrefs.preferredFemaleVoiceId] || AI_VOICES.female[0].name)
    : AI_VOICES.female[0].name;
  const maleVoiceName = voicePrefs?.preferredMaleVoiceId
    ? (VOICE_ID_TO_NAME[voicePrefs.preferredMaleVoiceId] || AI_VOICES.male[0].name)
    : AI_VOICES.male[0].name;

  // Voice regeneration state
  const [isRegeneratingVoice, setIsRegeneratingVoice] = useState(false);

  const autoPlayedRef = useRef(false);

  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showVoiceSetupModal, setShowVoiceSetupModal] = useState(false);

  const isCurrentlyPlaying = currentAffirmation?.id === affirmationId && isPlaying;

  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsOpacity = useSharedValue(0);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const controlsFadeStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const isLastJourneyStep = journeyContext ? journeyContext.currentStep === journeyContext.totalSteps - 1 : false;

  const hideControls = useCallback(() => {
    setControlsVisible(false);
    controlsOpacity.value = withTiming(0, { duration: 400 });
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    controlsOpacity.value = withTiming(1, { duration: 250 });
  }, []);

  const toggleControls = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (controlsVisible) {
      hideControls();
    } else {
      showControls();
      controlsTimerRef.current = setTimeout(hideControls, 3000);
    }
  }, [controlsVisible, showControls, hideControls]);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    showControls();
    controlsTimerRef.current = setTimeout(hideControls, 3000);
  }, [showControls, hideControls]);

  const tapStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const scrolledRef = useRef(false);

  const handleTouchStart = useCallback((e: any) => {
    scrolledRef.current = false;
    const touch = e.nativeEvent;
    tapStartRef.current = { x: touch.pageX, y: touch.pageY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: any) => {
    if (!tapStartRef.current || scrolledRef.current) return;
    const touch = e.nativeEvent;
    const dx = Math.abs(touch.pageX - tapStartRef.current.x);
    const dy = Math.abs(touch.pageY - tapStartRef.current.y);
    const dt = Date.now() - tapStartRef.current.time;
    tapStartRef.current = null;
    if (dx < 10 && dy < 10 && dt < 300) {
      toggleControls();
    }
  }, [toggleControls]);

  useEffect(() => {
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, []);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (currentAffirmation?.id === affirmationId) {
        await stop();
      }
      await apiRequest("DELETE", `/api/affirmations/${affirmationId}`);
    },
    onSuccess: () => {
      // If deleted affirmation was the breathing affirmation, fall back to next available
      if (breathingAffirmation?.id === affirmationId) {
        const allAffirmations = queryClient.getQueryData<Affirmation[]>(["/api/affirmations"]) || [];
        const remaining = allAffirmations.filter(a => a.id !== affirmationId);
        if (remaining.length > 0) {
          setBreathingAffirmation(remaining[0]);
        } else {
          setBreathingAffirmation(null);
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      navigation.goBack();
    },
    onError: () => {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (e) {}
      setErrorMessage("We couldn't delete this affirmation. Please try again.");
      setShowErrorModal(true);
    },
  });

  const autoSaveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/affirmations/${affirmationId}/auto-save`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations", affirmationId] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      setHasSaved(true);
      setShowSaveSuccessModal(true);
    },
    onError: () => {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (e) {}
      setErrorMessage("We couldn't save this affirmation. Please try again.");
      setShowErrorModal(true);
    },
  });

  // Regenerate voice mutation
  const regenerateVoiceMutation = useMutation({
    mutationFn: async ({ voiceType, voiceGender }: { voiceType: "personal" | "ai"; voiceGender?: "male" | "female" }) => {
      setIsRegeneratingVoice(true);
      const response = await apiRequest("POST", `/api/affirmations/${affirmationId}/regenerate-voice`, {
        voiceType,
        voiceGender,
      });
      return response.json();
    },
    onSuccess: async (updatedAffirmation) => {
      await clearCachedAudio(affirmationId);
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations", affirmationId] });
      setIsRegeneratingVoice(false);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      if (updatedAffirmation) {
        await playAffirmation(updatedAffirmation);
      }
    },
    onError: (error: any) => {
      setIsRegeneratingVoice(false);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (e) {}
      const errStr = error?.message || "";
      if (errStr.includes("QUOTA_EXCEEDED") || errStr.includes("quota")) {
        setErrorMessage("Your voice cloning credits have been used up. Please switch to an AI voice or wait for credits to reset.");
      } else if (errStr.includes("VOICE_ROTATED")) {
        setErrorMessage("Your Inner Voice has expired. Please re-record your voice sample in Settings, or switch to an AI voice.");
      } else if (errStr.includes("PERSONAL_VOICE_FAILED")) {
        setErrorMessage("Could not generate audio with your Inner Voice. Try again or switch to an AI voice.");
      } else {
        setErrorMessage("We couldn't regenerate the audio. Please try again.");
      }
      setShowErrorModal(true);
    },
  });

  const journeyVoiceCheckedRef = useRef(false);
  useEffect(() => {
    if (!journeyContext?.journeyVoiceId || !affirmation || journeyVoiceCheckedRef.current || isRegeneratingVoice) return;
    journeyVoiceCheckedRef.current = true;
    const jVoiceType = journeyContext.journeyVoiceType || "ai";
    const jVoiceId = journeyContext.journeyVoiceId;
    const affVoiceType = affirmation.voiceType || "ai";
    const needsRegeneration =
      (jVoiceType === "personal" && affVoiceType !== "personal") ||
      (jVoiceType === "ai" && affVoiceType === "personal");
    if (needsRegeneration) {
      autoPlayedRef.current = true;
      const gender = jVoiceId.includes("orion") || jVoiceId.includes("atlas") || jVoiceId.includes("sage") || jVoiceId.includes("summit") || jVoiceId.includes("bodhi") ? "male" : "female";
      regenerateVoiceMutation.mutate({ voiceType: jVoiceType, voiceGender: jVoiceType === "ai" ? gender : undefined });
    }
  }, [affirmation, journeyContext, isRegeneratingVoice]);

  // Handle voice switch
  const handleVoiceSwitch = useCallback((voiceType: "personal" | "ai", voiceGender?: "male" | "female") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (voiceType === "personal" && !voiceStatus?.hasClonedVoice) {
      setShowVoiceSetupModal(true);
      return;
    }
    
    stop();
    regenerateVoiceMutation.mutate({ voiceType, voiceGender });
  }, [voiceStatus, stop, regenerateVoiceMutation, navigation]);

  // Get current voice display text
  const getCurrentVoiceLabel = () => {
    if (!affirmation) return "Loading...";
    if (affirmation.voiceType === "personal") return "Inner Voice";
    const voiceName = getVoiceDisplayName(affirmation.voiceType, affirmation.voiceGender, affirmation.aiVoiceId);
    return voiceName;
  };

  const handleSave = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    autoSaveMutation.mutate();
  }, [autoSaveMutation]);

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowDeleteModal(true);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (autoPlay && affirmation && !autoPlayedRef.current) {
      autoPlayedRef.current = true;
      playAffirmation(affirmation);
    }
  }, [autoPlay, affirmation]);

  useEffect(() => {
    if (affirmation?.audioUrl && currentAffirmation?.id !== affirmation.id) {
      preloadAudioToCache(affirmation.audioUrl, affirmation.id);
    }
  }, [affirmation?.audioUrl, affirmation?.id, currentAffirmation?.id]);

  useEffect(() => {
    const allKeys = [SHOW_SCRIPT_KEY, AUTO_REPLAY_KEY];
    AsyncStorage.multiGet(allKeys).then((results) => {
      const map = new Map(results);
      const showScriptValue = map.get(SHOW_SCRIPT_KEY);
      if (showScriptValue !== null && showScriptValue !== undefined) setShowScript(showScriptValue === "true");
      const autoReplayValue = map.get(AUTO_REPLAY_KEY);
      if (autoReplayValue !== null && autoReplayValue !== undefined) setAutoReplay(autoReplayValue === "true");
    });
  }, []);

  const mountedRef = useRef(true);
  const orientationLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    ScreenOrientation.unlockAsync();
    return () => {
      mountedRef.current = false;
      if (orientationLockTimeoutRef.current) {
        clearTimeout(orientationLockTimeoutRef.current);
        orientationLockTimeoutRef.current = null;
      }
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  useEffect(() => {
    const checkOrientation = async () => {
      const orientation = await ScreenOrientation.getOrientationAsync();
      const landscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      if (mountedRef.current) setIsLandscape(landscape);
    };

    checkOrientation();

    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const orientation = event.orientationInfo.orientation;
      const landscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      if (mountedRef.current) setIsLandscape(landscape);
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;

    const wasLandscape = prevLandscapeRef.current;
    const justRotatedToLandscape = isLandscape && !wasLandscape;
    const justRotatedToPortrait = !isLandscape && wasLandscape;
    prevLandscapeRef.current = isLandscape;

    if (justRotatedToPortrait && isInFullscreenMode) {
      setIsInFullscreenMode(false);
    } else if (justRotatedToLandscape && rsvpEnabled && isCurrentlyPlaying && !isInFullscreenMode) {
      setIsInFullscreenMode(true);
    }

    if (orientationLockTimeoutRef.current) {
      clearTimeout(orientationLockTimeoutRef.current);
      orientationLockTimeoutRef.current = null;
    }

    orientationLockTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      ScreenOrientation.unlockAsync();
      orientationLockTimeoutRef.current = null;
    }, 100);
  }, [isLandscape, rsvpEnabled, isCurrentlyPlaying, isInFullscreenMode]);


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
        return generateFallbackTimings();
      }
      
      let lastEnd = 0;
      const fixed = parsed.map((item: any, idx: number) => {
        let startMs = item.startMs;
        let endMs = item.endMs;
        if (startMs < lastEnd) startMs = lastEnd;
        if (endMs <= startMs) {
          const nextStart = idx + 1 < parsed.length ? parsed[idx + 1].startMs : startMs + 200;
          endMs = Math.max(startMs + 50, Math.min(startMs + 200, nextStart));
        }
        lastEnd = endMs;
        return { word: item.word, startMs, endMs };
      });
      
      return fixed;
    } catch {
      return generateFallbackTimings();
    }
  }, [affirmation?.wordTimings, affirmation?.script, affirmation?.duration]);

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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/affirmations", affirmationId] });
      const previous = queryClient.getQueryData(["/api/affirmations", affirmationId]);
      queryClient.setQueryData(["/api/affirmations", affirmationId], (old: any) =>
        old ? { ...old, isFavorite: !old.isFavorite } : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/affirmations", affirmationId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations", affirmationId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

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
  
  const rsvpPositionOffset = 200 * playbackSpeed;
  const rsvpPosition = displayDuration > 0
    ? Math.min(displayPosition + rsvpPositionOffset, displayDuration - 1)
    : displayPosition + rsvpPositionOffset;


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
              togglePlayPause();
            }}
          >
            <View pointerEvents="none">
              <RSVPDisplay
                wordTimings={wordTimings}
                currentPositionMs={rsvpPosition}
                isPlaying={isCurrentlyPlaying}
                fontSize="LANDSCAPE"
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

      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 51 }, controlsFadeStyle]} pointerEvents={controlsVisible ? "box-none" : "none"}>
        {journeyContext ? (
          <JourneyStepBar
            currentStep={journeyContext.currentStep}
            totalSteps={journeyContext.totalSteps}
            stepLabels={journeyContext.stepLabels}
            onPrevious={async () => { await stop(); journeyNavigationRef.action = 'back'; navigation.goBack(); }}
            showSkip={false}
            showPrevious={true}
            showEndJourney={true}
            onEndJourney={async () => { await stop(); journeyNavigationRef.action = 'complete'; (navigation as any).navigate("Main", { screen: "AffirmTab" }); }}
          />
        ) : (
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.backgroundDefault }}>
            <Pressable
              onPress={() => {
                if (isNew && !hasSaved) {
                  handleSave();
                } else {
                  navigation.goBack();
                }
              }}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }}
              testID={isNew && !hasSaved ? "button-save-affirmation" : "button-back"}
            >
              <Feather
                name={isNew && !hasSaved ? "save" : "arrow-left"}
                size={22}
                color={isNew && !hasSaved ? (autoSaveMutation.isPending ? theme.textSecondary : "#4CAF50") : theme.text}
              />
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: theme.primary, marginRight: 8 }} />
              <ThemedText type="caption" style={{ color: theme.primary, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '600', fontSize: 11 }}>
                My Affirmation
              </ThemedText>
            </View>

            <Pressable
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  (navigation as any).navigate("Main", { screen: "AffirmTab" });
                }
              }}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }}
              testID="button-close-affirmation"
            >
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          </View>
        )}
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 70, paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => { scrolledRef.current = true; resetControlsTimer(); }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <View style={styles.visualizerContainer}>
          {rsvpEnabled ? (
            <RSVPDisplay
              wordTimings={wordTimings}
              currentPositionMs={rsvpPosition}
              isPlaying={isCurrentlyPlaying}
              fontSize={rsvpFontSize}
              showHighlight={false}
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
          <Pressable
            onPress={async () => {
              if (affirmation) {
                await stop();
                await setBreathingAffirmation(affirmation);
                navigation.navigate("Main" as any, {
                  screen: "BreatheTab",
                  params: { screen: "Breathing", params: { autoStart: true } },
                });
              }
            }}
            style={[styles.breatheButton, { backgroundColor: theme.backgroundSecondary }]}
            testID="button-breathe"
          >
            <Feather name="wind" size={20} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 6, fontWeight: "600" }}>
              Breathe
            </ThemedText>
          </Pressable>
          <AmbientSoundMixer compact />
        </View>

        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.settingsCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="mic" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>
                Voice
              </ThemedText>
            </View>
            {isRegeneratingVoice ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="loader" size={12} color={theme.gold} />
                <ThemedText type="small" style={{ color: theme.gold, marginLeft: 4, fontSize: 12 }}>
                  Generating...
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="small" style={{ color: theme.gold, fontWeight: '700', fontSize: 12 }}>
                {getCurrentVoiceLabel()}
              </ThemedText>
            )}
          </View>
          <View style={styles.voiceOptions}>
            <Pressable
              onPress={() => handleVoiceSwitch("personal")}
              disabled={isRegeneratingVoice}
              style={[
                styles.voiceOption,
                {
                  backgroundColor: affirmation?.voiceType === "personal" ? theme.primary : theme.backgroundTertiary,
                  opacity: isRegeneratingVoice ? 0.5 : 1,
                  borderWidth: affirmation?.voiceType === "personal" ? 0 : 1,
                  borderColor: theme.backgroundTertiary,
                },
              ]}
              testID="button-voice-personal"
            >
              <Feather name="user" size={14} color={affirmation?.voiceType === "personal" ? "#FFFFFF" : theme.text} />
              <ThemedText
                type="small"
                style={{
                  color: affirmation?.voiceType === "personal" ? "#FFFFFF" : theme.text,
                  marginLeft: 6,
                  fontWeight: affirmation?.voiceType === "personal" ? '700' : '500',
                }}
              >
                Inner Voice
              </ThemedText>
              {!voiceStatus?.hasClonedVoice ? (
                <Feather name="alert-circle" size={12} color={theme.accent} style={{ marginLeft: 4 }} />
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => handleVoiceSwitch("ai", "female")}
              disabled={isRegeneratingVoice}
              style={[
                styles.voiceOption,
                {
                  backgroundColor: affirmation?.voiceType === "ai" && affirmation?.voiceGender === "female" ? theme.primary : theme.backgroundTertiary,
                  opacity: isRegeneratingVoice ? 0.5 : 1,
                  borderWidth: affirmation?.voiceType === "ai" && affirmation?.voiceGender === "female" ? 0 : 1,
                  borderColor: theme.backgroundTertiary,
                },
              ]}
              testID="button-voice-ai-female"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Feather
                  name="user"
                  size={13}
                  color={affirmation?.voiceType === "ai" && affirmation?.voiceGender === "female" ? "#FFFFFF" : theme.text}
                />
                <ThemedText
                  type="small"
                  style={{
                    color: affirmation?.voiceType === "ai" && affirmation?.voiceGender === "female" ? "#FFFFFF" : theme.text,
                    fontWeight: affirmation?.voiceType === "ai" && affirmation?.voiceGender === "female" ? '700' : '500',
                  }}
                >
                  {femaleVoiceName}
                </ThemedText>
              </View>
            </Pressable>
            <Pressable
              onPress={() => handleVoiceSwitch("ai", "male")}
              disabled={isRegeneratingVoice}
              style={[
                styles.voiceOption,
                {
                  backgroundColor: affirmation?.voiceType === "ai" && affirmation?.voiceGender === "male" ? theme.primary : theme.backgroundTertiary,
                  opacity: isRegeneratingVoice ? 0.5 : 1,
                  borderWidth: affirmation?.voiceType === "ai" && affirmation?.voiceGender === "male" ? 0 : 1,
                  borderColor: theme.backgroundTertiary,
                },
              ]}
              testID="button-voice-ai-male"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Feather
                  name="user"
                  size={13}
                  color={affirmation?.voiceType === "ai" && affirmation?.voiceGender === "male" ? "#FFFFFF" : theme.text}
                />
                <ThemedText
                  type="small"
                  style={{
                    color: affirmation?.voiceType === "ai" && affirmation?.voiceGender === "male" ? "#FFFFFF" : theme.text,
                    fontWeight: affirmation?.voiceType === "ai" && affirmation?.voiceGender === "male" ? '700' : '500',
                  }}
                >
                  {maleVoiceName}
                </ThemedText>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundSecondary }]}>
          <View style={styles.settingsCardRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Feather name="file-text" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>
                Read Along
              </ThemedText>
            </View>
            <Pressable
              onPress={handleToggleScript}
              style={[
                styles.toggleTrack,
                { backgroundColor: showScript ? theme.primary : theme.backgroundTertiary },
              ]}
              testID="button-toggle-script"
            >
              <View
                style={[
                  styles.toggleKnob,
                  { 
                    backgroundColor: "#FFFFFF",
                    transform: [{ translateX: showScript ? 22 : 2 }],
                  },
                ]}
              />
            </Pressable>
          </View>
        </View>

        {showScript && affirmation?.script ? (
          <View style={[styles.scriptPreview, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.scriptHeaderRow}>
              <View style={styles.scriptTitleRow}>
                <Feather name="file-text" size={16} color={theme.primary} />
                <ThemedText type="h4" style={{ marginLeft: Spacing.xs }} numberOfLines={1}>
                  {affirmation.title}
                </ThemedText>
              </View>
              {(() => {
                const wordCount = affirmation.script.split(/\s+/).filter(Boolean).length;
                const label = wordCount < 80 ? "Short" : wordCount < 150 ? "Medium" : "Long";
                return (
                  <View style={{ backgroundColor: theme.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                    <ThemedText type="caption" style={{ color: theme.primary, fontWeight: '600' }}>
                      {label}
                    </ThemedText>
                  </View>
                );
              })()}
            </View>
            <View style={[styles.scriptDivider, { backgroundColor: theme.primary + '30' }]} />
            {affirmation.script
              .split(/(?<=\.)\s+/)
              .filter((line: string) => line.trim().length > 0)
              .map((line: string, index: number, arr: string[]) => (
                <ThemedText
                  key={index}
                  type="body"
                  style={{
                    lineHeight: 26,
                    fontSize: 16,
                    marginBottom: index < arr.length - 1 ? Spacing.md : 0,
                  }}
                >
                  {line.trim()}
                </ThemedText>
              ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <ThemedModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        type="delete"
        title="Remove this affirmation?"
        highlightText={affirmation?.title}
        message="This action cannot be undone."
        buttons={[
          {
            text: "Keep",
            onPress: () => setShowDeleteModal(false),
            style: "secondary",
          },
          {
            text: "Remove",
            onPress: () => {
              setShowDeleteModal(false);
              deleteMutation.mutate();
            },
            style: "destructive",
          },
        ]}
      />

      {/* Save Success Modal */}
      <ThemedModal
        visible={showSaveSuccessModal}
        onClose={() => setShowSaveSuccessModal(false)}
        type="success"
        title="Added to Your Library"
        message="Your affirmation has been saved and is ready to inspire you."
        buttons={[
          {
            text: "Continue",
            onPress: () => setShowSaveSuccessModal(false),
            style: "primary",
          },
        ]}
        autoDismiss={3000}
      />

      {/* Error Modal */}
      <ThemedModal
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        type="warning"
        title="Something went wrong"
        message={errorMessage}
        buttons={[
          {
            text: "OK",
            onPress: () => setShowErrorModal(false),
            style: "primary",
          },
        ]}
      />

      {/* Voice Setup Modal */}
      <ThemedModal
        visible={showVoiceSetupModal}
        onClose={() => setShowVoiceSetupModal(false)}
        type="info"
        title="Record Your Voice"
        message="Create a personalized experience by recording your own voice. It only takes a minute."
        buttons={[
          {
            text: "Not Now",
            onPress: () => setShowVoiceSetupModal(false),
            style: "secondary",
          },
          {
            text: "Record",
            onPress: () => {
              setShowVoiceSetupModal(false);
              navigation.navigate("VoiceSetup" as never);
            },
            style: "primary",
          },
        ]}
      />

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
    marginTop: Spacing.xl,
    marginBottom: Spacing["3xl"],
    minHeight: 120,
  },
  infoContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  myAffirmationBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  bannerAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  bannerText: {
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "600",
    fontSize: 11,
  },
  title: {
    textAlign: "center",
    fontSize: 20,
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
  breatheButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  scriptPreview: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  scriptHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  scriptTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scriptDivider: {
    height: 1,
    width: "100%",
    marginBottom: Spacing.md,
  },
  settingsCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  settingsCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  settingsCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  voiceOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  voiceOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
