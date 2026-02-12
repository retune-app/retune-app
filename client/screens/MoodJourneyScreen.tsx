import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  StatusBar,
  Text,
  Modal,
  ScrollView,
  PanResponder,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  SlideInRight,
  SlideOutLeft,
  interpolate,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ScreenOrientation from "expo-screen-orientation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Slider from "@react-native-community/slider";
import { journeyNavigationRef } from "@/navigation/journeyNavigationRef";
import { useBackgroundMusic, getSoundsByCategory, type BackgroundMusicType, type BackgroundMusicOption } from "@/contexts/BackgroundMusicContext";
import FullscreenBreathingLayout from "@/components/FullscreenBreathingLayout";
import JourneyStepBar from "@/components/JourneyStepBar";
import { MeditationIcon } from "@/components/MeditationIcon";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  BREATHING_TECHNIQUES,
  getTotalCycleDuration,
  getCyclesForDuration,
  type BreathingTechnique,
} from "@shared/breathingTechniques";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const ACCENT_GOLD = "#C9A227";
const GOLD_LIGHT = "#E5C95C";
const NAVY = "#0F1C3F";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface MoodInfo {
  id: string;
  label: string;
  icon: string;
  color: string;
}

const MOOD_MAP: Record<string, MoodInfo> = {
  stressed: { id: "stressed", label: "Stressed", icon: "cloud", color: "#E85D5D" },
  anxious: { id: "anxious", label: "Anxious", icon: "wind", color: "#4FC3F7" },
  tired: { id: "tired", label: "Tired", icon: "moon", color: "#7B68EE" },
  sad: { id: "sad", label: "Sad", icon: "cloud-rain", color: "#7986CB" },
  overwhelmed: { id: "overwhelmed", label: "Overwhelmed", icon: "loader", color: "#FF7043" },
  calm: { id: "calm", label: "Calm", icon: "sun", color: "#50C9B0" },
  energized: { id: "energized", label: "Energized", icon: "zap", color: "#F5A623" },
  grateful: { id: "grateful", label: "Grateful", icon: "heart", color: "#C9A227" },
  confident: { id: "confident", label: "Confident", icon: "shield", color: "#FF6B6B" },
  focused: { id: "focused", label: "Focused", icon: "target", color: "#42A5F5" },
  joyful: { id: "joyful", label: "Joyful", icon: "star", color: "#FFB74D" },
};

interface JourneyStep {
  type: string;
  techniqueId?: string;
  techniqueName?: string;
  duration?: number;
  note: string;
  affirmationId?: number | null;
  affirmationTitle?: string | null;
  isInnerVoice?: boolean;
  hasClonedVoice?: boolean;
  hasAnyAffirmations?: boolean;
  suggestedTheme?: string | null;
  mood?: string;
  timeOfDay?: string;
}

interface JourneyData {
  acknowledgment: string;
  currentMood: string;
  targetMood: string;
  steps: JourneyStep[];
}

type JourneyPhase =
  | "intro"
  | "breathing"
  | "transition"
  | "navigating-meditation"
  | "navigating-listen"
  | "complete";

type Props = NativeStackScreenProps<RootStackParamList, "MoodJourney">;

const BREATHING_DURATION_SECONDS = 120;

function getStepLabel(type: string): string {
  if (type === "breathe") return "Breathe";
  if (type === "meditate") return "Meditate";
  if (type === "listen") return "Listen";
  return type;
}

export default function MoodJourneyScreen({ route, navigation }: Props) {
  const { journey } = route.params as { journey: JourneyData };
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isPlaying: isMusicPlaying, startBackgroundMusic, stopBackgroundMusic, selectedMusic, setSelectedMusic, volume, setVolume } = useBackgroundMusic();
  const toggleMusic = useCallback(async () => {
    if (isMusicPlaying) {
      await stopBackgroundMusic();
    } else {
      await startBackgroundMusic();
    }
  }, [isMusicPlaying, startBackgroundMusic, stopBackgroundMusic]);

  const journeyStepLabels = journey.steps.map((s: any) => getStepLabel(s.type));

  const [phase, setPhase] = useState<JourneyPhase>("intro");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [breathingPlaying, setBreathingPlaying] = useState(false);
  const [breathingTimeLeft, setBreathingTimeLeft] = useState(BREATHING_DURATION_SECONDS);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const breathingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasNavigatedRef = useRef(false);
  const returningFromStepRef = useRef(false);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const controlsOpacity = useSharedValue(0);

  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [showSoundSwitcher, setShowSoundSwitcher] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const countdownScale = useSharedValue(0.8);
  const countdownOpacityVal = useSharedValue(0);

  useEffect(() => {
    AsyncStorage.getItem("@settings/hapticsEnabled").then((val) => {
      if (val !== null) setHapticsEnabled(val === "true");
    });
  }, []);

  useEffect(() => {
    setMusicEnabled(isMusicPlaying);
  }, [isMusicPlaying]);

  useEffect(() => {
    if (phase === "breathing") {
      ScreenOrientation.unlockAsync();
      const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
        const o = event.orientationInfo.orientation;
        setIsLandscape(
          o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
        );
      });
      return () => {
        ScreenOrientation.removeOrientationChangeListener(subscription);
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsLandscape(false);
      };
    } else {
      setIsLandscape(false);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, [phase]);

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

  const handleSwitchSound = useCallback(async (soundId: BackgroundMusicType) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    if (soundId === 'none') {
      setMusicEnabled(false);
      await stopBackgroundMusic();
    } else {
      setMusicEnabled(true);
      await setSelectedMusic(soundId, breathingPlaying);
    }
  }, [setSelectedMusic, stopBackgroundMusic, breathingPlaying]);

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
        style={{
          width: tileSize, height: tileSize,
          backgroundColor: isSelected ? `${ACCENT_GOLD}20` : "rgba(255,255,255,0.06)",
          borderColor: isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.1)",
          borderWidth: 1.5, borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 6,
        }}
      >
        <Feather name={sound.icon as any} size={20} color={isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.6)"} />
        <Text style={{ color: isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.7)", fontSize: 10, textAlign: "center", marginTop: 4 }}>
          {sound.name}
        </Text>
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
        style={{
          width: tileSize, height: tileSize,
          backgroundColor: isSelected ? `${ACCENT_GOLD}20` : "rgba(255,255,255,0.06)",
          borderColor: isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.1)",
          borderWidth: 1.5, borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 6,
        }}
      >
        <Feather name="volume-x" size={20} color={isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.6)"} />
        <Text style={{ color: isSelected ? ACCENT_GOLD : "rgba(255,255,255,0.7)", fontSize: 10, textAlign: "center", marginTop: 4 }}>
          No sound
        </Text>
      </Pressable>
    );
  }, [musicEnabled]);

  const soundSheetTranslateY = useSharedValue(0);

  const soundSheetPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        soundSheetTranslateY.value = gestureState.dy;
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 80 || gestureState.vy > 0.5) {
        soundSheetTranslateY.value = withTiming(500, { duration: 250 }, () => {});
        setTimeout(() => {
          setShowSoundSwitcher(false);
          soundSheetTranslateY.value = 0;
        }, 250);
      } else {
        soundSheetTranslateY.value = withTiming(0, { duration: 200 });
      }
    },
  }), []);

  const soundSheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: soundSheetTranslateY.value }],
  }));

  const renderSoundSwitcherModal = () => (
    <Modal
      visible={showSoundSwitcher}
      animationType="slide"
      transparent
      onRequestClose={() => setShowSoundSwitcher(false)}
    >
      <Pressable
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
        onPress={() => setShowSoundSwitcher(false)}
      >
        <Animated.View
          style={[{
            backgroundColor: "#1A1A2E",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 8,
            maxHeight: "65%",
          }, { paddingBottom: insets.bottom + Spacing.md }, soundSheetAnimatedStyle]}
          {...soundSheetPanResponder.panHandlers}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 0 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 12 }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 }}>
            <ThemedText type="h4" style={{ color: "#fff", fontSize: 17 }}>
              Switch Sound
            </ThemedText>
            <Pressable onPress={() => setShowSoundSwitcher(false)} hitSlop={12}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 }}>
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
              {renderNoSoundTile(handleSwitchSound)}
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
                      handleSwitchSound,
                    )
                  )}
                </ScrollView>
              </View>
            ))}
          </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );

  const currentMoodInfo = MOOD_MAP[journey.currentMood] || MOOD_MAP.calm;
  const targetMoodInfo = MOOD_MAP[journey.targetMood] || MOOD_MAP.grateful;
  const currentStep = journey.steps[currentStepIndex];

  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.95, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const flowDot0 = useSharedValue(0.2);
  const flowDot1 = useSharedValue(0.2);
  const flowDot2 = useSharedValue(0.2);
  const flowDot3 = useSharedValue(0.2);
  const flowDot4 = useSharedValue(0.2);

  useEffect(() => {
    const dur = 600;
    const ease = Easing.inOut(Easing.sin);
    const pulse = withRepeat(
      withSequence(
        withTiming(0.9, { duration: dur, easing: ease }),
        withTiming(0.2, { duration: dur, easing: ease }),
        withTiming(0.2, { duration: 2000 - dur * 2 })
      ),
      -1
    );
    flowDot0.value = withDelay(0, pulse);
    flowDot1.value = withDelay(300, pulse);
    flowDot2.value = withDelay(600, pulse);
    flowDot3.value = withDelay(900, pulse);
    flowDot4.value = withDelay(1200, pulse);
  }, []);

  const flowDotStyle0 = useAnimatedStyle(() => ({ opacity: flowDot0.value }));
  const flowDotStyle1 = useAnimatedStyle(() => ({ opacity: flowDot1.value }));
  const flowDotStyle2 = useAnimatedStyle(() => ({ opacity: flowDot2.value }));
  const flowDotStyle3 = useAnimatedStyle(() => ({ opacity: flowDot3.value }));
  const flowDotStyle4 = useAnimatedStyle(() => ({ opacity: flowDot4.value }));

  const flowDotStyles = [flowDotStyle0, flowDotStyle1, flowDotStyle2, flowDotStyle3, flowDotStyle4];

  const countdownAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countdownScale.value }],
    opacity: countdownOpacityVal.value,
  }));

  const controlsAnimStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase("intro");
      startCurrentStep();
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (returningFromStepRef.current) {
        returningFromStepRef.current = false;
        hasNavigatedRef.current = false;
        const action = journeyNavigationRef.action;
        journeyNavigationRef.action = 'complete';
        if (action === 'back') {
          handleGoBack();
        } else {
          advanceToNextStep();
        }
      }
    }, [currentStepIndex])
  );

  const startCurrentStep = useCallback(() => {
    if (!currentStep) {
      setPhase("complete");
      return;
    }

    const jCtx = { currentStep: currentStepIndex, totalSteps: journey.steps.length, stepLabels: journeyStepLabels };

    if (currentStep.type === "breathe") {
      setPhase("breathing");
      setBreathingTimeLeft(BREATHING_DURATION_SECONDS);
      setCyclesCompleted(0);

      (async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
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
        setBreathingPlaying(true);
      })();
    } else if (currentStep.type === "meditate") {
      setPhase("navigating-meditation");
      setTimeout(() => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          returningFromStepRef.current = true;
          navigation.navigate("GuidedMoment", {
            mood: currentStep.mood || journey.targetMood,
            timeOfDay: currentStep.timeOfDay || getTimeOfDay(),
            journeyContext: jCtx,
          });
        }
      }, 1500);
    } else if (currentStep.type === "listen") {
      setPhase("navigating-listen");
      setTimeout(() => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          returningFromStepRef.current = true;
          if (currentStep.affirmationId) {
            navigation.navigate("Player", {
              affirmationId: currentStep.affirmationId,
              autoPlay: true,
              journeyContext: jCtx,
            });
          } else {
            navigation.navigate("Create");
          }
        }
      }, 1500);
    }
  }, [currentStep, currentStepIndex, navigation, journey, journeyStepLabels]);

  const advanceToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= journey.steps.length) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      setPhase("complete");
    } else {
      setCurrentStepIndex(nextIndex);
      setPhase("transition");
      setTimeout(() => {
        startNextStep(nextIndex);
      }, 2500);
    }
  }, [currentStepIndex, journey.steps.length]);

  const startNextStep = useCallback((stepIndex: number) => {
    const step = journey.steps[stepIndex];
    if (!step) {
      setPhase("complete");
      return;
    }

    const jCtx = { currentStep: stepIndex, totalSteps: journey.steps.length, stepLabels: journeyStepLabels };

    if (step.type === "breathe") {
      setPhase("breathing");
      setBreathingTimeLeft(BREATHING_DURATION_SECONDS);
      setCyclesCompleted(0);

      (async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
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
        setBreathingPlaying(true);
      })();
    } else if (step.type === "meditate") {
      setPhase("navigating-meditation");
      setTimeout(() => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          returningFromStepRef.current = true;
          navigation.navigate("GuidedMoment", {
            mood: step.mood || journey.targetMood,
            timeOfDay: step.timeOfDay || getTimeOfDay(),
            journeyContext: jCtx,
          });
        }
      }, 1500);
    } else if (step.type === "listen") {
      setPhase("navigating-listen");
      setTimeout(() => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          returningFromStepRef.current = true;
          if (step.affirmationId) {
            navigation.navigate("Player", {
              affirmationId: step.affirmationId,
              autoPlay: true,
              journeyContext: jCtx,
            });
          } else {
            navigation.navigate("Create");
          }
        }
      }, 1500);
    }
  }, [journey, navigation, journeyStepLabels]);

  useEffect(() => {
    if (phase === "breathing" && breathingPlaying) {
      breathingTimerRef.current = setInterval(() => {
        setBreathingTimeLeft((prev) => {
          if (prev <= 1) {
            setBreathingPlaying(false);
            if (breathingTimerRef.current) {
              clearInterval(breathingTimerRef.current);
              breathingTimerRef.current = null;
            }
            setTimeout(() => advanceToNextStep(), 1000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current);
        breathingTimerRef.current = null;
      }
    };
  }, [phase, breathingPlaying]);

  const handleSkipBreathing = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setBreathingPlaying(false);
    if (breathingTimerRef.current) {
      clearInterval(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }
    advanceToNextStep();
  }, [advanceToNextStep]);

  const handleGoBack = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    if (currentStepIndex <= 0) {
      navigation.goBack();
      return;
    }
    setBreathingPlaying(false);
    if (breathingTimerRef.current) {
      clearInterval(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }
    const prevIndex = currentStepIndex - 1;
    setCurrentStepIndex(prevIndex);
    setShowControls(false);
    hasNavigatedRef.current = false;
    startNextStep(prevIndex);
  }, [currentStepIndex, navigation, startNextStep]);

  const handleSkipStep = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setBreathingPlaying(false);
    if (breathingTimerRef.current) {
      clearInterval(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }
    setShowControls(false);
    hasNavigatedRef.current = false;
    advanceToNextStep();
  }, [advanceToNextStep]);

  const toggleControls = useCallback(() => {
    setShowControls((prev) => {
      const next = !prev;
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      controlsOpacity.value = withTiming(next ? 1 : 0, { duration: 200 });
      if (next) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
          controlsOpacity.value = withTiming(0, { duration: 200 });
          controlsTimeoutRef.current = null;
        }, 4000);
      }
      return next;
    });
  }, []);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      controlsOpacity.value = withTiming(0, { duration: 200 });
      controlsTimeoutRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const handleEndJourney = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    (navigation as any).navigate("Main", { screen: "AffirmTab" });
  }, [navigation]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getBreathingTechnique = (): BreathingTechnique => {
    const step = journey.steps[currentStepIndex];
    const id = step?.techniqueId || "box";
    return BREATHING_TECHNIQUES.find((t) => t.id === id) || BREATHING_TECHNIQUES[0];
  };

  const getTransitionMessage = (): string => {
    const nextStep = journey.steps[currentStepIndex + 1];
    if (!nextStep) return "Your journey is almost complete...";
    if (nextStep.type === "meditate") return "Beautiful. Now let's settle your mind...";
    if (nextStep.type === "listen") return "Time to hear words that resonate...";
    if (nextStep.type === "breathe") return "Let's ground your body first...";
    return "Moving to the next step...";
  };

  const getNavigatingMessage = (): string => {
    if (phase === "navigating-meditation") return "Opening your guided moment...";
    if (phase === "navigating-listen") {
      if (currentStep?.affirmationId) return "Preparing your affirmation...";
      return "Let's create something meaningful...";
    }
    return "Preparing...";
  };

  const renderStepProgress = () => (
    <View style={styles.stepProgressRow}>
      {journey.steps.map((step, i) => {
        const isActive = i === currentStepIndex;
        const isDone = i < currentStepIndex;
        const stepMood = step.type === "breathe" ? currentMoodInfo : targetMoodInfo;
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: isDone ? ACCENT_GOLD : `${theme.textSecondary}30` },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.stepIndicator,
                {
                  backgroundColor: isDone
                    ? `${ACCENT_GOLD}20`
                    : isActive
                    ? `${ACCENT_GOLD}15`
                    : `${theme.textSecondary}10`,
                  borderColor: isDone
                    ? ACCENT_GOLD
                    : isActive
                    ? `${ACCENT_GOLD}60`
                    : "transparent",
                  borderWidth: isDone || isActive ? 1 : 0,
                },
              ]}
            >
              {step.type === "meditate" ? (
                <MeditationIcon
                  size={14}
                  color={isDone ? ACCENT_GOLD : isActive ? ACCENT_GOLD : theme.textSecondary}
                />
              ) : (
                <Feather
                  name={(step.type === "breathe" ? "wind" : "headphones") as any}
                  size={14}
                  color={isDone ? ACCENT_GOLD : isActive ? ACCENT_GOLD : theme.textSecondary}
                />
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );

  const renderIntro = () => (
    <Animated.View
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(400)}
      style={styles.centeredContent}
    >
      <View style={styles.introMoodRow}>
        <View style={[styles.introMoodCircle, { backgroundColor: `${currentMoodInfo.color}20` }]}>
          <Feather name={currentMoodInfo.icon as any} size={32} color={currentMoodInfo.color} />
        </View>
        <View style={styles.introDots}>
          {[0, 1, 2, 3].map((i) => {
            const t = i / 3;
            const r1 = parseInt(currentMoodInfo.color.slice(1, 3), 16);
            const g1 = parseInt(currentMoodInfo.color.slice(3, 5), 16);
            const b1 = parseInt(currentMoodInfo.color.slice(5, 7), 16);
            const r2 = parseInt(targetMoodInfo.color.slice(1, 3), 16);
            const g2 = parseInt(targetMoodInfo.color.slice(3, 5), 16);
            const b2 = parseInt(targetMoodInfo.color.slice(5, 7), 16);
            const r = Math.round(r1 + (r2 - r1) * t);
            const g = Math.round(g1 + (g2 - g1) * t);
            const b = Math.round(b1 + (b2 - b1) * t);
            const dotColor = `rgb(${r},${g},${b})`;
            return (
              <Animated.View
                key={i}
                entering={FadeIn.delay(400 + i * 200).duration(400)}
                style={[styles.introConnectDot, { backgroundColor: dotColor }, flowDotStyles[i]]}
              />
            );
          })}
        </View>
        <Animated.View entering={FadeIn.delay(1000).duration(600)}>
          <View style={[styles.introMoodCircle, { backgroundColor: `${targetMoodInfo.color}20` }]}>
            <Feather name={targetMoodInfo.icon as any} size={32} color={targetMoodInfo.color} />
          </View>
        </Animated.View>
      </View>
      <Animated.View entering={FadeIn.delay(800).duration(600)}>
        <ThemedText type="h3" style={[styles.introTitle, { color: theme.text }]}>
          {`${currentMoodInfo.label}  to  ${targetMoodInfo.label}`}
        </ThemedText>
        <ThemedText type="body" style={[styles.introSubtitle, { color: theme.textSecondary }]}>
          Your journey begins now
        </ThemedText>
      </Animated.View>
    </Animated.View>
  );

  const renderCountdownOverlay = useCallback((fontSize: number = 48) => {
    if (countdownValue === null) return null;
    return (
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
          fontSize,
          fontWeight: '700',
          color: 'rgba(255,255,255,0.85)',
          letterSpacing: 2,
        }}>
          {countdownValue}
        </Text>
      </Animated.View>
    );
  }, [countdownValue, countdownAnimatedStyle]);

  const renderProgressRing = useCallback((ringSize: number) => {
    const technique = getBreathingTechnique();
    const progressPercent = Math.round(((BREATHING_DURATION_SECONDS - breathingTimeLeft) / BREATHING_DURATION_SECONDS) * 100);
    const padding = 24;
    const totalSize = ringSize + padding;
    const radius = (ringSize + padding / 2) / 2;
    const circumference = Math.PI * (ringSize + padding / 2);
    return (
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={totalSize} height={totalSize} style={{ position: 'absolute' }}>
          <Circle
            cx={totalSize / 2}
            cy={totalSize / 2}
            r={radius}
            stroke={`${technique.color}15`}
            strokeWidth={3}
            fill="transparent"
          />
          <Circle
            cx={totalSize / 2}
            cy={totalSize / 2}
            r={radius}
            stroke={technique.color}
            strokeWidth={3}
            fill="transparent"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={circumference * (1 - progressPercent / 100)}
            strokeLinecap="round"
            rotation="-90"
            origin={`${totalSize / 2}, ${totalSize / 2}`}
          />
        </Svg>
      </View>
    );
  }, [breathingTimeLeft, getBreathingTechnique]);

  const renderBreathing = () => {
    const technique = getBreathingTechnique();

    return (
      <Animated.View entering={FadeIn.duration(600)} exiting={FadeOut.duration(400)} style={styles.breathingContainer}>
        {!isLandscape ? (
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 51 }, controlsAnimStyle]} pointerEvents={showControls ? "box-none" : "none"}>
            <JourneyStepBar
              currentStep={currentStepIndex}
              totalSteps={journey.steps.length}
              stepLabels={journeyStepLabels}
              onPrevious={handleGoBack}
              onSkip={currentStepIndex < journey.steps.length - 1 ? handleSkipStep : undefined}
              showSkip={currentStepIndex < journey.steps.length - 1}
              showPrevious={true}
            />
            <View style={[styles.journeyMusicButton, { top: insets.top + 70 }]}>
              <Pressable
                onPress={() => { resetControlsTimer(); setShowSoundSwitcher(true); }}
                style={[styles.musicToggleBtn, isMusicPlaying ? { backgroundColor: `${ACCENT_GOLD}30`, borderColor: `${ACCENT_GOLD}50` } : undefined]}
                hitSlop={8}
              >
                <Feather name="music" size={16} color={isMusicPlaying ? ACCENT_GOLD : "rgba(255,255,255,0.6)"} />
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
        <FullscreenBreathingLayout
          technique={technique}
          isPlaying={breathingPlaying}
          onTogglePlay={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
            setBreathingPlaying(!breathingPlaying);
          }}
          onClose={handleEndJourney}
          onCycleComplete={() => setCyclesCompleted((c) => c + 1)}
          controlsOpacity={controlsOpacity}
          controlsVisible={showControls}
          onToggleControls={toggleControls}
          resetControlsTimer={resetControlsTimer}
          insets={insets}
          backgroundColor={NAVY}
          showContent={countdownValue === null}
          hapticsEnabled={hapticsEnabled}
          hideTopControls={!isLandscape}
          renderTopRightExtra={() => (
            <Pressable
              onPress={() => { resetControlsTimer(); setShowSoundSwitcher(true); }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }}
            >
              <Feather name="music" size={18} color="#FFFFFF" />
            </Pressable>
          )}
          stats={[
            { label: "Time Left", value: formatTime(breathingTimeLeft) },
            { label: "Progress", value: `${Math.round(((BREATHING_DURATION_SECONDS - breathingTimeLeft) / BREATHING_DURATION_SECONDS) * 100)}%`, color: technique.color || ACCENT_GOLD },
            { label: "Cycles", value: `${cyclesCompleted}` },
          ]}
          renderProgressRing={(size) => renderProgressRing(size)}
          renderCircleOverlay={(size) => renderCountdownOverlay(size)}
        />
      </Animated.View>
    );
  };

  const renderTransition = () => (
    <Animated.View
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(400)}
      style={styles.centeredContent}
    >
      <ThemedText type="h3" style={[styles.transitionText, { color: theme.text }]}>
        {getTransitionMessage()}
      </ThemedText>
      {renderStepProgress()}
    </Animated.View>
  );

  const renderNavigating = () => (
    <Animated.View
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(400)}
      style={styles.centeredContent}
    >
      <ThemedText type="h3" style={[styles.transitionText, { color: theme.text }]}>
        {getNavigatingMessage()}
      </ThemedText>
      {renderStepProgress()}
    </Animated.View>
  );

  const renderComplete = () => (
    <Animated.View
      entering={FadeIn.duration(800)}
      style={styles.completeContainer}
    >
      <View style={styles.completeMoodArc}>
        <View style={[styles.completeMoodCircle, { backgroundColor: `${currentMoodInfo.color}15` }]}>
          <Feather name={currentMoodInfo.icon as any} size={24} color={currentMoodInfo.color} />
        </View>
        <View style={styles.completeArcLine}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Animated.View
              key={i}
              entering={FadeIn.delay(200 + i * 100).duration(400)}
              style={[styles.arcDot, { backgroundColor: ACCENT_GOLD }, flowDotStyles[i]]}
            />
          ))}
        </View>
        <View style={[styles.completeMoodCircle, { backgroundColor: `${targetMoodInfo.color}15`, borderColor: `${targetMoodInfo.color}40`, borderWidth: 2 }]}>
          <Feather name={targetMoodInfo.icon as any} size={24} color={targetMoodInfo.color} />
        </View>
      </View>

      <Animated.View entering={FadeIn.delay(600).duration(600)}>
        <ThemedText type="h2" style={[styles.completeTitle, { color: theme.text }]}>
          Journey Complete
        </ThemedText>
        <ThemedText type="body" style={[styles.completeSubtitle, { color: theme.textSecondary }]}>
          {`You've moved from ${currentMoodInfo.label} toward ${targetMoodInfo.label}`}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(1000).duration(600)} style={styles.completeSteps}>
        {journey.steps.map((step, i) => (
          <View key={i} style={[styles.completedStep, { backgroundColor: `${ACCENT_GOLD}08` }]}>
            <View style={[styles.completedStepIcon, { backgroundColor: `${ACCENT_GOLD}15` }]}>
              {step.type === "meditate" ? (
                <MeditationIcon size={14} color={ACCENT_GOLD} />
              ) : (
                <Feather
                  name={(step.type === "breathe" ? "wind" : "headphones") as any}
                  size={14}
                  color={ACCENT_GOLD}
                />
              )}
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {getStepLabel(step.type)}
            </ThemedText>
            <Feather name="check" size={14} color={ACCENT_GOLD} />
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeIn.delay(1400).duration(600)} style={styles.completeActions}>
        <Pressable onPress={handleEndJourney} testID="button-journey-done">
          <LinearGradient
            colors={[ACCENT_GOLD, GOLD_LIGHT] as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.doneButton}
          >
            <ThemedText type="body" style={styles.doneButtonText}>
              Done
            </ThemedText>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[`${NAVY}`, `${theme.backgroundRoot}`] as [string, string]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
        style={StyleSheet.absoluteFillObject}
      />

      {phase !== "breathing" ? (
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          {phase !== "intro" && phase !== "complete" && phase !== "transition" && phase !== "navigating-meditation" && phase !== "navigating-listen" ? (
            <Pressable
              onPress={handleEndJourney}
              style={styles.closeButton}
              testID="button-exit-journey"
            >
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={[
        phase === "breathing" ? styles.breathingFullscreen : styles.content,
        phase !== "breathing" ? { paddingBottom: insets.bottom + Spacing.xl } : undefined,
      ]}>
        {phase === "intro" ? renderIntro() : null}
        {phase === "breathing" ? renderBreathing() : null}
        {phase === "transition" ? renderTransition() : null}
        {phase === "navigating-meditation" || phase === "navigating-listen"
          ? renderNavigating()
          : null}
        {phase === "complete" ? renderComplete() : null}
      </View>
      {renderSoundSwitcherModal()}
    </View>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  centeredContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
  },
  introMoodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  introMoodCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  introDots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  introConnectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  introTitle: {
    textAlign: "center",
    marginTop: Spacing.lg,
  },
  introSubtitle: {
    textAlign: "center",
    marginTop: Spacing.xs,
    fontSize: 14,
  },
  stepProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginVertical: Spacing.md,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  breathingFullscreen: {
    flex: 1,
  },
  breathingContainer: {
    flex: 1,
  },
  journeyMusicButton: {
    position: "absolute",
    right: Spacing.md,
    zIndex: 51,
  },
  musicToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNavLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
  },
  stepNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  stepNavButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  transitionCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  transitionText: {
    textAlign: "center",
    maxWidth: 260,
  },
  completeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
  },
  completeMoodArc: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  completeMoodCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  completeArcLine: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
  },
  arcDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.6,
  },
  completeTitle: {
    textAlign: "center",
  },
  completeSubtitle: {
    textAlign: "center",
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  completeSteps: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  completedStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  completedStepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  completeActions: {
    width: "100%",
    paddingHorizontal: Spacing.xl,
  },
  doneButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  doneButtonText: {
    color: NAVY,
    fontWeight: "700",
    fontSize: 16,
  },
});
