import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  useWindowDimensions,
  Platform,
} from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { Audio } from "expo-av";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import JourneyStepBar from "@/components/JourneyStepBar";
import { journeyNavigationRef } from "@/navigation/journeyNavigationRef";
import Slider from "@react-native-community/slider";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getAuthToken } from "@/lib/auth-token";
import { useAuth } from "@/contexts/AuthContext";
import {
  BackgroundMusicType,
  BACKGROUND_MUSIC_OPTIONS,
  getSoundsByCategory,
  useBackgroundMusic,
  BackgroundMusicOption,
} from "@/contexts/BackgroundMusicContext";
import { RSVPDisplay, WordTiming } from "@/components/RSVPDisplay";

const ACCENT_GOLD = "#C9A227";
const GOLD_LIGHT = "#E5C95C";
const NAVY = "#0F1C3F";
const NAVY_MID = "#1A2D4F";

const DURATION_OPTIONS = [
  { value: 1, label: "1 min" },
  { value: 2, label: "2 min" },
  { value: 3, label: "3 min" },
];

const MOOD_SOUND_MAP: Record<string, Record<string, BackgroundMusicType>> = {
  calm: {
    morning: "ocean-waves-beach",
    afternoon: "ocean-waves-beach",
    evening: "meditation-gentle-chimes",
    night: "meditation-deep-drone",
  },
  stressed: {
    morning: "rain-soft",
    afternoon: "rain-calming",
    evening: "meditation-singing-bowls",
    night: "binaural-delta",
  },
  tired: {
    morning: "forest-birds-morning",
    afternoon: "binaural-alpha",
    evening: "meditation-gentle-chimes",
    night: "meditation-deep-drone",
  },
  energized: {
    morning: "binaural-beta",
    afternoon: "binaural-beta",
    evening: "meditation-forest-melody",
    night: "meditation-gentle-chimes",
  },
  anxious: {
    morning: "meditation-singing-bowls",
    afternoon: "rain-soft",
    evening: "meditation-singing-bowls",
    night: "binaural-delta",
  },
  grateful: {
    morning: "forest-birds-morning",
    afternoon: "forest-rain-birds",
    evening: "meditation-forest-melody",
    night: "forest-night",
  },
  sad: {
    morning: "rain-soft",
    afternoon: "rain-calming",
    evening: "meditation-singing-bowls",
    night: "meditation-deep-drone",
  },
  overwhelmed: {
    morning: "meditation-singing-bowls",
    afternoon: "rain-soft",
    evening: "meditation-gentle-chimes",
    night: "binaural-delta",
  },
  confident: {
    morning: "binaural-beta",
    afternoon: "binaural-alpha",
    evening: "meditation-forest-melody",
    night: "meditation-gentle-chimes",
  },
  focused: {
    morning: "binaural-beta",
    afternoon: "binaural-alpha",
    evening: "binaural-alpha",
    night: "meditation-gentle-chimes",
  },
  joyful: {
    morning: "forest-birds-morning",
    afternoon: "forest-rain-birds",
    evening: "meditation-forest-melody",
    night: "forest-night",
  },
};

const MOOD_LABELS: Record<string, string> = {
  calm: "Calm",
  stressed: "Stressed",
  tired: "Tired",
  energized: "Energized",
  anxious: "Anxious",
  grateful: "Grateful",
  sad: "Sad",
  overwhelmed: "Overwhelmed",
  confident: "Confident",
  focused: "Focused",
  joyful: "Joyful",
};

const MOOD_RING_COLORS: Record<string, { primary: string; secondary: string }> = {
  calm: { primary: "#50C9B0", secondary: "#3BA89A" },
  stressed: { primary: "#E85D5D", secondary: "#C94A4A" },
  tired: { primary: "#7B68EE", secondary: "#6552CC" },
  energized: { primary: "#F5A623", secondary: "#D4901F" },
  anxious: { primary: "#4FC3F7", secondary: "#3AADE0" },
  grateful: { primary: "#C9A227", secondary: "#A88920" },
  sad: { primary: "#7986CB", secondary: "#5C6BC0" },
  overwhelmed: { primary: "#FF7043", secondary: "#E64A19" },
  confident: { primary: "#FF6B6B", secondary: "#E55555" },
  focused: { primary: "#42A5F5", secondary: "#1E88E5" },
  joyful: { primary: "#FFB74D", secondary: "#FFA726" },
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

type VoiceIcon = "female" | "male" | "person";

const VOICE_OPTIONS: { id: string; label: string; description: string; icon: VoiceIcon }[] = [
  { id: "hume_lotus", label: "Lotus", description: "Female Guide", icon: "female" },
  { id: "hume_sage", label: "Sage", description: "Male Guide", icon: "male" },
];

const VOICE_STORAGE_KEY = "@retuned/guided-moment-voice";
const CONTROLS_AUTO_HIDE_MS = 3000;

type PlayerState = "idle" | "generating" | "ready" | "playing" | "paused" | "finished" | "error";

interface GeneratedMoment {
  script: string;
  audioBase64: string;
  duration: number;
  wordTimings: Array<{ word: string; startMs: number; endMs: number }>;
  disclaimer: string;
}

interface CategorySection {
  key: string;
  label: string;
  color: string;
  sounds: BackgroundMusicOption[];
}

export type GuidedMomentScreenParams = {
  mood: string;
  timeOfDay: string;
  journeyContext?: { currentStep: number; totalSteps: number; stepLabels: string[] };
};

export default function GuidedMomentScreen({ route, navigation }: NativeStackScreenProps<any, "GuidedMoment">) {
  const { mood, timeOfDay, journeyContext } = (route.params as GuidedMomentScreenParams) || { mood: "calm", timeOfDay: "morning" };
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { user } = useAuth();
  const {
    selectedMusic,
    setSelectedMusic,
    volume: bgVolume,
    setVolume: setBgVolume,
    startBackgroundMusic,
    stopBackgroundMusic,
    pauseBackgroundMusic,
    resumeBackgroundMusic,
    isPlaying: isBgPlaying,
  } = useBackgroundMusic();

  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [moment, setMoment] = useState<GeneratedMoment | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPosition, setCurrentPosition] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState<number>(journeyContext ? 2 : 1);
  const [selectedSound, setSelectedSound] = useState<BackgroundMusicType>(
    MOOD_SOUND_MAP[mood]?.[timeOfDay] || MOOD_SOUND_MAP[mood]?.["morning"] || "ocean-waves-beach"
  );
  const [selectedVoice, setSelectedVoice] = useState("hume_lotus");
  const [voicePreferenceLoaded, setVoicePreferenceLoaded] = useState(false);
  const [showSoundSwitcher, setShowSoundSwitcher] = useState(false);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [voiceVolume, setVoiceVolume] = useState(0.8);
  const [countdown, setCountdown] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoPlayRef = useRef(false);
  const playAudioRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const abortControllerRef = useRef<AbortController | null>(null);
  const cachedScriptRef = useRef<{ script: string; disclaimer: string; duration: number } | null>(null);
  const scriptFetchingRef = useRef(false);

  const breathScale = useSharedValue(0.7);
  const breathOpacity = useSharedValue(0.3);
  const progressAnim = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);
  const generatingPulse = useSharedValue(0);
  const centerContentOpacity = useSharedValue(1);
  const centerContentScale = useSharedValue(1);

  const ringSize = isLandscape ? Math.min(height * 0.75, width * 0.55) : Math.min(width - 64, height * 0.42);

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

  const { data: voiceStatus } = useQuery<{ hasPersonalVoice: boolean }>({
    queryKey: ["/api/voice-samples/status"],
    staleTime: 0,
    refetchOnMount: "always",
  });
  const hasPersonalVoice = user?.hasVoiceSample === true || voiceStatus?.hasPersonalVoice === true;
  const allVoiceOptions = useMemo(() => {
    const opts = [...VOICE_OPTIONS];
    if (hasPersonalVoice) {
      opts.push({ id: "personal", label: "Inner Voice", description: "Your Cloned Voice", icon: "person" as const });
    }
    return opts;
  }, [hasPersonalVoice]);

  useEffect(() => {
    AsyncStorage.getItem(VOICE_STORAGE_KEY).then((stored) => {
      if (stored && allVoiceOptions.some((v) => v.id === stored)) {
        setSelectedVoice(stored);
      } else if (hasPersonalVoice && !stored) {
        setSelectedVoice("personal");
      }
      setVoicePreferenceLoaded(true);
    }).catch(() => {
      setVoicePreferenceLoaded(true);
    });
  }, [allVoiceOptions, hasPersonalVoice]);

  useEffect(() => {
    AsyncStorage.getItem('@retuned_voice_volume').then((saved) => {
      if (saved) setVoiceVolume(parseFloat(saved));
    });
  }, []);

  useEffect(() => {
    if (playerState === "playing") {
      breathScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.7, { duration: 4000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      breathOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 4000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      breathScale.value = withTiming(0.7, { duration: 600 });
      breathOpacity.value = withTiming(0.3, { duration: 600 });
    }
  }, [playerState]);

  useEffect(() => {
    if (playerState === "generating") {
      generatingPulse.value = 0;
      generatingPulse.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      generatingPulse.value = withTiming(0, { duration: 300 });
    }
  }, [playerState]);

  useEffect(() => {
    if (playerState === "playing") {
      centerContentOpacity.value = withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) });
      centerContentScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
      resetControlsTimer();
    } else if (playerState === "idle" || playerState === "generating") {
      centerContentOpacity.value = 1;
      centerContentScale.value = 1;
      showControls();
    } else {
      showControls();
    }
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [playerState]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      if (autoPlayRef.current) {
        autoPlayRef.current = false;
        playAudioRef.current();
      }
      return;
    }
    if (countdown === 1) {
      centerContentOpacity.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.ease) });
      centerContentScale.value = withTiming(0.8, { duration: 800, easing: Easing.out(Easing.ease) });
    }
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    controlsOpacity.value = withTiming(1, { duration: 250 });
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
  }, []);

  const hideControls = useCallback(() => {
    setControlsVisible(false);
    controlsOpacity.value = withTiming(0, { duration: 400 });
  }, []);

  const resetControlsTimer = useCallback(() => {
    showControls();
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (playerState === "playing") {
        hideControls();
      }
    }, CONTROLS_AUTO_HIDE_MS);
  }, [playerState, showControls, hideControls]);

  const handleScreenTap = useCallback(() => {
    if (playerState === "playing" || playerState === "paused") {
      if (controlsVisible) {
        hideControls();
      } else {
        resetControlsTimer();
      }
    }
  }, [playerState, controlsVisible, hideControls, resetControlsTimer]);

  const mainCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
    opacity: breathOpacity.value,
  }));

  const innerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breathScale.value, [0.7, 1], [0.85, 1.1]) }],
    opacity: interpolate(breathScale.value, [0.7, 1], [0.15, 0.4]),
  }));

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breathScale.value, [0.7, 1], [1.0, 1.15]) }],
    opacity: interpolate(breathScale.value, [0.7, 1], [0.08, 0.2]),
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  const controlsFadeStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const generatingPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(generatingPulse.value, [0, 1], [0.6, 1.2]) }],
    opacity: interpolate(generatingPulse.value, [0, 0.5, 1], [0.3, 0.8, 0.3]),
  }));

  const centerContentAnimStyle = useAnimatedStyle(() => ({
    opacity: centerContentOpacity.value,
    transform: [{ scale: centerContentScale.value }],
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

  const prefetchScript = useCallback(async (duration: number, signal?: AbortSignal) => {
    if (scriptFetchingRef.current) return;
    scriptFetchingRef.current = true;
    try {
      const url = new URL("/api/guided-moments/script", getApiUrl()).toString();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const authToken = getAuthToken();
      if (authToken) headers["X-Auth-Token"] = authToken;
      const result = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ mood, timeOfDay, duration, dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()] }),
        credentials: "include",
        signal,
      });
      const data = await result.json();
      if (data.error) return;
      cachedScriptRef.current = { script: data.script, disclaimer: data.disclaimer, duration };
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    } finally {
      scriptFetchingRef.current = false;
    }
  }, [mood, timeOfDay]);

  const generateAudioFromScript = useCallback(async (script: string, disclaimer: string, voiceId: string, signal?: AbortSignal) => {
    const isPersonal = voiceId === "personal";
    const url = new URL("/api/guided-moments/audio", getApiUrl()).toString();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const authToken = getAuthToken();
    if (authToken) headers["X-Auth-Token"] = authToken;
    const result = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        script,
        usePersonalVoice: isPersonal,
        voiceId: isPersonal ? undefined : voiceId,
        mood,
      }),
      credentials: "include",
      signal,
    });
    const data = await result.json();
    if (data.error) throw new Error(data.error);
    return { ...data, script, disclaimer };
  }, [mood]);

  useEffect(() => {
    if (voicePreferenceLoaded) {
      beginGeneration();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      cleanupVoice();
      stopBackgroundMusic();
    };
  }, [voicePreferenceLoaded]);

  const handleClose = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
    await cleanupVoice();
    await stopBackgroundMusic();
    setPlayerState("idle");
    cachedScriptRef.current = null;
    scriptFetchingRef.current = false;
    if (journeyContext) {
      journeyNavigationRef.action = 'complete';
      navigation.goBack();
    } else {
      navigation.navigate("Main", { screen: "BreatheTab" } as any);
    }
  }, [cleanupVoice, stopBackgroundMusic, navigation, journeyContext]);

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

  const beginGeneration = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    setPlayerState("generating");
    setErrorMessage("");
    progressAnim.value = 0;

    const autoSound = MOOD_SOUND_MAP[mood]?.[timeOfDay] || MOOD_SOUND_MAP[mood]?.["morning"] || "ocean-waves-beach";
    setSelectedSound(autoSound);
    if (autoSound !== "none") {
      await setSelectedMusic(autoSound);
    }

    try {
      if (!cachedScriptRef.current || cachedScriptRef.current.duration !== selectedDuration) {
        await prefetchScript(selectedDuration, controller.signal);
      }
      if (!cachedScriptRef.current) {
        setErrorMessage("Could not generate meditation script. Please try again.");
        setPlayerState("error");
        return;
      }

      const { script, disclaimer } = cachedScriptRef.current;
      const data = await generateAudioFromScript(script, disclaimer, selectedVoice, controller.signal);

      if (controller.signal.aborted) return;

      setMoment(data);
      setPlayerState("ready");
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      autoPlayRef.current = true;
      setCountdown(3);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      setErrorMessage(error?.message || "Something went wrong. Please try again.");
      setPlayerState("error");
    }
  }, [mood, timeOfDay, selectedVoice, selectedDuration, setSelectedMusic, startBackgroundMusic, prefetchScript, generateAudioFromScript]);

  const durationChangeRef = useRef(selectedDuration);
  useEffect(() => {
    if (durationChangeRef.current !== selectedDuration && (playerState === "generating" || playerState === "ready")) {
      durationChangeRef.current = selectedDuration;
      cachedScriptRef.current = null;
      beginGeneration();
    }
    durationChangeRef.current = selectedDuration;
  }, [selectedDuration]);

  const playAudio = useCallback(async () => {
    if (!moment?.audioBase64) return;

    try {
      await cleanupVoice();
      setCurrentPosition(0);
      progressAnim.value = 0;

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      const uri = `data:audio/mp3;base64,${moment.audioBase64}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 100, volume: voiceVolume },
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
  }, [moment, cleanupVoice, voiceVolume]);

  playAudioRef.current = playAudio;

  const handleVoiceVolumeChange = useCallback(async (value: number) => {
    setVoiceVolume(value);
    await AsyncStorage.setItem('@retuned_voice_volume', value.toString());
    if (soundRef.current) {
      try {
        await soundRef.current.setVolumeAsync(value);
      } catch (e) {}
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          await pauseBackgroundMusic();
          setPlayerState("paused");
        } else {
          await soundRef.current.playAsync();
          await resumeBackgroundMusic();
          setPlayerState("playing");
        }
      }
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    } catch (e) {}
  }, [pauseBackgroundMusic, resumeBackgroundMusic]);

  const handlePlayAction = useCallback(() => {
    if (playerState === "ready" || playerState === "finished") {
      playAudio();
    } else {
      togglePlayPause();
    }
    resetControlsTimer();
  }, [playerState, playAudio, togglePlayPause, resetControlsTimer]);

  const handleVoiceSelect = useCallback(async (voiceId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setSelectedVoice(voiceId);
    await AsyncStorage.setItem(VOICE_STORAGE_KEY, voiceId).catch(() => {});
    setShowVoiceSelector(false);

    await cleanupVoice();
    setMoment(null);
    setPlayerState("generating");
    setErrorMessage("");
    progressAnim.value = 0;
    
    try {
      if (!cachedScriptRef.current || cachedScriptRef.current.duration !== selectedDuration) {
        await prefetchScript(selectedDuration, controller.signal);
      }
      if (!cachedScriptRef.current) {
        setErrorMessage("Could not generate meditation script. Please try again.");
        setPlayerState("error");
        return;
      }

      const { script, disclaimer } = cachedScriptRef.current;
      const data = await generateAudioFromScript(script, disclaimer, voiceId, controller.signal);

      if (controller.signal.aborted) return;

      setMoment(data);
      setPlayerState("ready");
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      autoPlayRef.current = true;
      setCountdown(3);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      setErrorMessage(error?.message || "Something went wrong. Please try again.");
      setPlayerState("error");
    }
  }, [mood, timeOfDay, cleanupVoice, selectedDuration, prefetchScript, generateAudioFromScript]);

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

  const currentVoiceOption = allVoiceOptions.find((v) => v.id === selectedVoice) || VOICE_OPTIONS[0];

  const isCountingDown = playerState === "ready" && countdown !== null && countdown > 0;

  const renderBreathingRings = () => {
    const moodColors = MOOD_RING_COLORS[mood] || { primary: ACCENT_GOLD, secondary: `${ACCENT_GOLD}99` };

    return (
    <View style={[styles.ringsContainer, { width: ringSize, height: ringSize }]}>
      <Animated.View
        style={[
          styles.outerRing,
          outerRingStyle,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderColor: moodColors.primary,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.innerGlow,
          innerGlowStyle,
          {
            width: ringSize * 0.85,
            height: ringSize * 0.85,
            borderRadius: ringSize * 0.425,
            backgroundColor: moodColors.primary,
          },
        ]}
      />

      <Animated.View
        style={[
          mainCircleStyle,
          styles.mainCircle,
          {
            width: ringSize * 0.7,
            height: ringSize * 0.7,
            borderRadius: ringSize * 0.35,
          },
        ]}
      >
        <LinearGradient
          colors={[moodColors.primary, moodColors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradientCircle,
            {
              width: ringSize * 0.7,
              height: ringSize * 0.7,
              borderRadius: ringSize * 0.35,
            },
          ]}
        />
      </Animated.View>

      <Animated.View style={[styles.ringsCenterContent, centerContentAnimStyle]}>
        {isCountingDown ? (
          <Text style={styles.countdownInsideRings}>
            {countdown}
          </Text>
        ) : playerState === "generating" ? (
          <View style={styles.centerTextContainer}>
            <Animated.View style={[styles.generatingPulse, generatingPulseStyle, { borderColor: moodColors.primary }]} />
          </View>
        ) : playerState === "error" ? (
          <View style={styles.centerTextContainer}>
            <Feather name="alert-circle" size={28} color="#E85D5D" />
          </View>
        ) : (playerState === "playing" || playerState === "paused") && moment?.wordTimings ? (
          <View style={[styles.rsvpInsideRings, { width: ringSize * 0.52 }]}>
            <RSVPDisplay
              wordTimings={moment.wordTimings}
              currentPositionMs={currentPosition}
              isPlaying={playerState === "playing"}
              fontSize="S"
              showHighlight={false}
              forceDarkMode={true}
              ambient={true}
            />
          </View>
        ) : playerState === "finished" ? (
          <Pressable
            onPress={handlePlayAction}
            style={styles.playIconCenter}
            testID="button-guided-moment-play"
          >
            <Feather
              name="play"
              size={36}
              color="#FFFFFF"
              style={{ marginLeft: 4 }}
            />
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
  };

  const renderControls = () => (
    <Animated.View
      style={[
        styles.controlsOverlay,
        controlsFadeStyle,
        {
          paddingTop: journeyContext ? (insets.top + 70) : (insets.top + Spacing.sm),
          paddingBottom: insets.bottom + Spacing.sm,
        },
      ]}
      pointerEvents={controlsVisible ? "box-none" : "none"}
    >
      <View style={styles.topControls} pointerEvents="auto">
        <View style={styles.topLeft}>
          <View style={styles.moodBadge}>
            <ThemedText type="caption" style={styles.moodBadgeText}>
              {MOOD_LABELS[mood] || mood}
            </ThemedText>
          </View>
        </View>
        <View style={styles.topRight}>
          {(playerState === "playing" || playerState === "paused" || playerState === "ready") ? (
            <>
              {isLandscape && (playerState === "playing" || playerState === "paused") ? (
                <Pressable
                  onPress={handlePlayAction}
                  style={styles.controlBtn}
                  testID="button-guided-moment-toggle-landscape"
                >
                  <Feather
                    name={playerState === "playing" ? "pause" : "play"}
                    size={18}
                    color={ACCENT_GOLD}
                    style={playerState !== "playing" ? { marginLeft: 2 } : undefined}
                  />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => { setShowVoiceSelector(true); resetControlsTimer(); }}
                style={styles.controlBtn}
                testID="button-voice-selector"
              >
                <Ionicons name={currentVoiceOption.icon} size={18} color={ACCENT_GOLD} />
              </Pressable>
              <Pressable
                onPress={() => { setShowSoundSwitcher(true); resetControlsTimer(); }}
                style={styles.controlBtn}
                testID="button-sound-switcher"
              >
                <Feather name="music" size={18} color={ACCENT_GOLD} />
              </Pressable>
            </>
          ) : null}
          {!journeyContext ? (
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={styles.closeButton}
              testID="button-close-player"
            >
              <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
            </Pressable>
          ) : null}
        </View>
      </View>

    </Animated.View>
  );

  const renderBottomStatus = () => {
    const shouldAlwaysShow = playerState === "generating" || playerState === "ready" || playerState === "error" || playerState === "idle";

    return (
    <Animated.View
      style={[
        styles.bottomStatusOverlay,
        { paddingBottom: insets.bottom + Spacing.lg },
        shouldAlwaysShow ? undefined : controlsFadeStyle,
      ]}
      pointerEvents={shouldAlwaysShow || controlsVisible ? "box-none" : "none"}
    >
      {!isLandscape ? (
        <View style={styles.bottomStatusSection} pointerEvents="none">
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, progressBarStyle]} />
          </View>
          {playerState === "generating" ? (
            <ThemedText type="caption" style={styles.statusLabel}>
              {"Crafting your micro-meditation..."}
            </ThemedText>
          ) : playerState === "error" ? (
            <ThemedText type="caption" style={[styles.statusLabel, { color: "#E85D5D" }]}>
              {errorMessage || "Something went wrong"}
            </ThemedText>
          ) : playerState === "ready" ? (
            <ThemedText type="caption" style={styles.statusLabel}>
              {countdown !== null && countdown > 0 ? "Get ready..." : "Starting..."}
            </ThemedText>
          ) : playerState === "playing" ? (
            <ThemedText type="caption" style={styles.statusLabel}>
              {"Breathe and Listen"}
            </ThemedText>
          ) : playerState === "paused" ? (
            <ThemedText type="caption" style={styles.statusLabel}>
              {"Paused"}
            </ThemedText>
          ) : playerState === "finished" ? (
            <ThemedText type="caption" style={styles.statusLabel}>
              {"Complete"}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {playerState !== "generating" ? (
        <View pointerEvents="auto" style={{ alignItems: "center" }}>
          {!isLandscape && (playerState === "playing" || playerState === "paused") ? (
            <Pressable
              onPress={handlePlayAction}
              style={styles.bottomPlayBtn}
              testID="button-guided-moment-toggle"
            >
              <Feather
                name={playerState === "playing" ? "pause" : "play"}
                size={22}
                color={ACCENT_GOLD}
                style={playerState !== "playing" ? { marginLeft: 2 } : undefined}
              />
            </Pressable>
          ) : null}

          {playerState === "finished" ? (
            <View style={styles.finishedSection}>
              {moment?.disclaimer ? (
                <ThemedText type="caption" style={styles.disclaimer}>
                  {moment.disclaimer}
                </ThemedText>
              ) : null}
              <View style={styles.finishedActions}>
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
              </View>
            </View>
          ) : null}

          {playerState === "error" ? (
            <View style={styles.finishedActions}>
              <Pressable
                onPress={beginGeneration}
                style={styles.replayButton}
                testID="button-retry-guided-moment"
              >
                <Feather name="refresh-cw" size={16} color={ACCENT_GOLD} />
                <ThemedText type="caption" style={{ color: ACCENT_GOLD, marginLeft: 6 }}>
                  {"Try Again"}
                </ThemedText>
              </Pressable>
              <Pressable onPress={handleClose}>
                <View style={[styles.doneButtonGradient, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                  <ThemedText type="caption" style={{ color: "rgba(255,255,255,0.6)", fontWeight: "600" }}>
                    {"Close"}
                  </ThemedText>
                </View>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
  };

  return (
    <LinearGradient
      colors={[NAVY, NAVY_MID] as [string, string]}
      style={styles.container}
    >
      {journeyContext ? (
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 51 }, controlsFadeStyle]} pointerEvents={controlsVisible ? "box-none" : "none"}>
          <JourneyStepBar
            currentStep={journeyContext.currentStep}
            totalSteps={journeyContext.totalSteps}
            stepLabels={journeyContext.stepLabels}
            onPrevious={() => { journeyNavigationRef.action = 'back'; navigation.goBack(); }}
            onSkip={() => { journeyNavigationRef.action = 'skip'; navigation.goBack(); }}
            showSkip={journeyContext.currentStep < journeyContext.totalSteps - 1}
            showEndJourney={journeyContext.currentStep >= journeyContext.totalSteps - 1}
            onEndJourney={() => { journeyNavigationRef.action = 'complete'; (navigation as any).navigate("Main"); }}
            showPrevious={true}
          />
        </Animated.View>
      ) : null}
      <Pressable
        style={styles.tapArea}
        onPress={handleScreenTap}
        testID="guided-moment-tap-area"
      >
        {playerState === "generating" ? (
          <ThemedText type="caption" style={styles.aboveRingsStatusText}>
            {"Preparing your meditation..."}
          </ThemedText>
        ) : null}
        <View style={isLandscape ? styles.landscapeLayout : styles.portraitLayout}>
          <View style={styles.ringsArea}>
            {!journeyContext && (playerState === "idle" || playerState === "generating" || playerState === "ready") && isLandscape ? (
              <View style={styles.durationRow}>
                {DURATION_OPTIONS.map((opt) => {
                  const isSelected = selectedDuration === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                        setSelectedDuration(opt.value);
                      }}
                      style={[
                        styles.durationPill,
                        isSelected
                          ? { backgroundColor: ACCENT_GOLD, borderColor: ACCENT_GOLD }
                          : { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.3)" },
                      ]}
                      testID={`button-duration-${opt.value}`}
                    >
                      <ThemedText
                        type="caption"
                        style={[
                          styles.durationPillText,
                          { color: isSelected ? "#FFFFFF" : "rgba(255,255,255,0.8)" },
                        ]}
                      >
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {renderBreathingRings()}
          </View>

          {!isLandscape && !journeyContext ? (
            <View style={[styles.durationRowBelow, (playerState !== "idle" && playerState !== "generating" && playerState !== "ready") ? { opacity: 0 } : undefined]} pointerEvents={(playerState === "idle" || playerState === "generating" || playerState === "ready") ? "auto" : "none"}>
              {DURATION_OPTIONS.map((opt) => {
                const isSelected = selectedDuration === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                      setSelectedDuration(opt.value);
                    }}
                    style={[
                      styles.durationPill,
                      isSelected
                        ? { backgroundColor: ACCENT_GOLD, borderColor: ACCENT_GOLD }
                        : { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.3)" },
                    ]}
                    testID={`button-duration-${opt.value}`}
                  >
                    <ThemedText
                      type="caption"
                      style={[
                        styles.durationPillText,
                        { color: isSelected ? "#FFFFFF" : "rgba(255,255,255,0.8)" },
                      ]}
                    >
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

        </View>
      </Pressable>

      {renderControls()}
      {renderBottomStatus()}

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
            style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.md }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText type="h4" style={styles.modalTitle}>
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

            {selectedSound !== 'none' ? (
              <View style={styles.volumeSliderRow}>
                <Feather name="volume-1" size={14} color="rgba(255,255,255,0.5)" />
                <Slider
                  style={styles.volumeSlider}
                  minimumValue={0}
                  maximumValue={1}
                  value={bgVolume}
                  onValueChange={setBgVolume}
                  minimumTrackTintColor={ACCENT_GOLD}
                  maximumTrackTintColor="rgba(255,255,255,0.15)"
                  thumbTintColor={ACCENT_GOLD}
                />
                <Feather name="volume-2" size={14} color="rgba(255,255,255,0.5)" />
              </View>
            ) : null}

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalNoSound}>
                {renderNoSoundTile(handleSwitchSoundDuringPlayback, true)}
              </View>
              {categories.map((category) => (
                <View key={category.key} style={styles.modalCategory}>
                  <ThemedText
                    type="caption"
                    style={[styles.modalCategoryLabel, { color: category.color }]}
                  >
                    {category.label}
                  </ThemedText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.modalRow}
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

      <Modal
        visible={showVoiceSelector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowVoiceSelector(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowVoiceSelector(false)}
        >
          <Pressable
            style={[styles.voiceModalContent, { paddingBottom: insets.bottom + Spacing.md }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <ThemedText type="h4" style={styles.modalTitle}>
                {"Meditation Voice"}
              </ThemedText>
              <Pressable
                onPress={() => setShowVoiceSelector(false)}
                hitSlop={12}
                testID="button-close-voice-selector"
              >
                <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>

            <ThemedText type="caption" style={styles.voiceNote}>
              {"Switching voice will regenerate your guided moment"}
            </ThemedText>

            <View style={styles.volumeSliderRow}>
              <Feather name="volume-1" size={14} color="rgba(255,255,255,0.5)" />
              <Slider
                style={styles.volumeSlider}
                minimumValue={0}
                maximumValue={1}
                value={voiceVolume}
                onValueChange={handleVoiceVolumeChange}
                minimumTrackTintColor={ACCENT_GOLD}
                maximumTrackTintColor="rgba(255,255,255,0.15)"
                thumbTintColor={ACCENT_GOLD}
              />
              <Feather name="volume-2" size={14} color="rgba(255,255,255,0.5)" />
            </View>

            <View style={styles.voiceList}>
              {allVoiceOptions.map((voice) => {
                const isActive = selectedVoice === voice.id;
                return (
                  <Pressable
                    key={voice.id}
                    onPress={() => handleVoiceSelect(voice.id)}
                    style={[
                      styles.voiceOption,
                      isActive ? styles.voiceOptionActive : null,
                    ]}
                    testID={`button-voice-${voice.id}`}
                  >
                    <View style={[
                      styles.voiceIconCircle,
                      { backgroundColor: isActive ? `${ACCENT_GOLD}30` : "rgba(255,255,255,0.08)" },
                    ]}>
                      <Ionicons
                        name={voice.icon}
                        size={20}
                        color={isActive ? ACCENT_GOLD : "rgba(255,255,255,0.5)"}
                      />
                    </View>
                    <View style={styles.voiceTextCol}>
                      <ThemedText type="body" style={[
                        styles.voiceLabel,
                        { color: isActive ? ACCENT_GOLD : "rgba(255,255,255,0.9)" },
                      ]}>
                        {voice.label}
                      </ThemedText>
                      <ThemedText type="caption" style={styles.voiceDesc}>
                        {voice.description}
                      </ThemedText>
                    </View>
                    {isActive ? (
                      <Feather name="check-circle" size={20} color={ACCENT_GOLD} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tapArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  portraitLayout: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  landscapeLayout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: Spacing.xxl,
  },
  ringsArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  aboveRingsStatusText: {
    position: "absolute",
    top: 140,
    left: 0,
    right: 0,
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    textAlign: "center",
  },
  ringsContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  outerRing: {
    position: "absolute",
    borderWidth: 2,
  },
  innerGlow: {
    position: "absolute",
  },
  mainCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  gradientCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringsCenterContent: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  centerTextContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerStatusText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  generatingPulse: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  durationRowBelow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  durationRowTop: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  durationRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  durationPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  durationPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rsvpInsideRings: {
    alignItems: "center",
    justifyContent: "center",
    height: "60%",
  },
  playIconCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
  },
  progressSection: {
    width: "80%",
    alignItems: "center",
    marginTop: Spacing.xxl + Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  bottomStatusSection: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    width: "100%",
  },
  progressBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: ACCENT_GOLD,
  },
  statusLabel: {
    color: "rgba(255,255,255,0.5)",
    marginTop: Spacing.md,
    fontSize: 13,
  },
  countdownLabel: {
    fontSize: 32,
    fontWeight: "700",
    color: ACCENT_GOLD,
    marginTop: Spacing.md,
  },
  countdownInsideRings: {
    fontSize: 48,
    fontFamily: "Nunito_700Bold",
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    pointerEvents: "box-none",
  },
  bottomStatusOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  moodBadge: {
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
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${ACCENT_GOLD}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomControls: {
    alignItems: "center",
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  bottomPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: `${ACCENT_GOLD}40`,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${NAVY}E0`,
  },
  finishedSection: {
    alignItems: "center",
    gap: Spacing.md,
  },
  finishedActions: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "center",
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
  disclaimer: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: NAVY_MID,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.md,
    maxHeight: "65%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    color: "rgba(255,255,255,0.9)",
  },
  modalScroll: {
    paddingHorizontal: Spacing.lg,
  },
  modalNoSound: {
    marginBottom: Spacing.md,
  },
  modalCategory: {
    marginBottom: Spacing.md,
  },
  modalCategoryLabel: {
    fontWeight: "700",
    fontSize: 11,
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  modalRow: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  voiceModalContent: {
    backgroundColor: NAVY_MID,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.md,
  },
  voiceNote: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  voiceList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  voiceOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  voiceOptionActive: {
    backgroundColor: `${ACCENT_GOLD}12`,
    borderColor: `${ACCENT_GOLD}30`,
  },
  voiceIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  voiceTextCol: {
    flex: 1,
  },
  voiceLabel: {
    fontWeight: "600",
    fontSize: 15,
  },
  voiceDesc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  volumeSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  volumeSlider: {
    flex: 1,
    height: 30,
  },
});
