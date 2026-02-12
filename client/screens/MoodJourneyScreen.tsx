import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  StatusBar,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import BreathingCircle from "@/components/BreathingCircle";
import { MeditationIcon } from "@/components/MeditationIcon";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  BREATHING_TECHNIQUES,
  getTotalCycleDuration,
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
  calm: { id: "calm", label: "Calm", icon: "sun", color: "#50C9B0" },
  stressed: { id: "stressed", label: "Stressed", icon: "cloud", color: "#E85D5D" },
  tired: { id: "tired", label: "Tired", icon: "moon", color: "#7B68EE" },
  energized: { id: "energized", label: "Energized", icon: "zap", color: "#F5A623" },
  anxious: { id: "anxious", label: "Anxious", icon: "wind", color: "#4FC3F7" },
  grateful: { id: "grateful", label: "Grateful", icon: "heart", color: "#C9A227" },
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

const BREATHING_DURATION_SECONDS = 180;

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
        advanceToNextStep();
      }
    }, [currentStepIndex])
  );

  const startCurrentStep = useCallback(() => {
    if (!currentStep) {
      setPhase("complete");
      return;
    }

    if (currentStep.type === "breathe") {
      setPhase("breathing");
      setBreathingTimeLeft(BREATHING_DURATION_SECONDS);
      setCyclesCompleted(0);
      setTimeout(() => setBreathingPlaying(true), 800);
    } else if (currentStep.type === "meditate") {
      setPhase("navigating-meditation");
      setTimeout(() => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          returningFromStepRef.current = true;
          navigation.navigate("GuidedMoment", {
            mood: currentStep.mood || journey.targetMood,
            timeOfDay: currentStep.timeOfDay || getTimeOfDay(),
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
            });
          } else {
            navigation.navigate("Create");
          }
        }
      }, 1500);
    }
  }, [currentStep, currentStepIndex, navigation, journey]);

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

    if (step.type === "breathe") {
      setPhase("breathing");
      setBreathingTimeLeft(BREATHING_DURATION_SECONDS);
      setCyclesCompleted(0);
      setTimeout(() => setBreathingPlaying(true), 800);
    } else if (step.type === "meditate") {
      setPhase("navigating-meditation");
      setTimeout(() => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          returningFromStepRef.current = true;
          navigation.navigate("GuidedMoment", {
            mood: step.mood || journey.targetMood,
            timeOfDay: step.timeOfDay || getTimeOfDay(),
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
            });
          } else {
            navigation.navigate("Create");
          }
        }
      }, 1500);
    }
  }, [journey, navigation]);

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

  const toggleControls = useCallback(() => {
    setShowControls((prev) => {
      const next = !prev;
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      if (next) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
          controlsTimeoutRef.current = null;
        }, 4000);
      }
      return next;
    });
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
    navigation.navigate("Main" as any);
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
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              entering={FadeIn.delay(400 + i * 200).duration(400)}
              style={[styles.introConnectDot, { backgroundColor: `${ACCENT_GOLD}40` }]}
            />
          ))}
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

  const renderBreathing = () => {
    const technique = getBreathingTechnique();
    return (
      <Animated.View
        entering={FadeIn.duration(600)}
        exiting={FadeOut.duration(400)}
        style={styles.breathingContainer}
      >
        <Pressable onPress={toggleControls} style={styles.breathingPressable}>
          {showControls ? (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
              {renderStepProgress()}
              <ThemedText type="caption" style={[styles.stepLabel, { color: ACCENT_GOLD, marginTop: Spacing.md }]}>
                {`Step ${currentStepIndex + 1} of ${journey.steps.length}`}
              </ThemedText>
              <ThemedText type="h3" style={[styles.breathingTitle, { color: theme.text }]}>
                {technique.name}
              </ThemedText>
              <ThemedText type="caption" style={[styles.breathingNote, { color: theme.textSecondary }]}>
                {currentStep?.note || technique.description}
              </ThemedText>
            </Animated.View>
          ) : null}

          <View style={styles.breathingCircleWrapper}>
            <BreathingCircle
              technique={technique}
              isPlaying={breathingPlaying}
              onCycleComplete={() => setCyclesCompleted((c) => c + 1)}
              size={220}
            />
          </View>

          {showControls ? (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.breathingBottomControls}>
              <ThemedText type="h2" style={[styles.timerText, { color: theme.text }]}>
                {formatTime(breathingTimeLeft)}
              </ThemedText>

              <View style={styles.breathingControls}>
                <Pressable
                  onPress={() => {
                    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                    setBreathingPlaying(!breathingPlaying);
                  }}
                  style={[styles.controlButton, { backgroundColor: `${ACCENT_GOLD}15` }]}
                  testID="button-breathing-toggle"
                >
                  <Feather
                    name={breathingPlaying ? "pause" : "play"}
                    size={20}
                    color={ACCENT_GOLD}
                  />
                </Pressable>
                <Pressable
                  onPress={handleSkipBreathing}
                  style={[styles.skipButton, { borderColor: `${theme.textSecondary}30` }]}
                  testID="button-skip-breathing"
                >
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {breathingTimeLeft < BREATHING_DURATION_SECONDS ? "Done" : "Skip"}
                  </ThemedText>
                  <Feather name="chevron-right" size={14} color={theme.textSecondary} />
                </Pressable>
              </View>
            </Animated.View>
          ) : null}
        </Pressable>
      </Animated.View>
    );
  };

  const renderTransition = () => (
    <Animated.View
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(400)}
      style={styles.centeredContent}
    >
      <Animated.View style={pulseStyle}>
        <View style={[styles.transitionCircle, { backgroundColor: `${ACCENT_GOLD}15` }]}>
          <Feather name="arrow-right" size={28} color={ACCENT_GOLD} />
        </View>
      </Animated.View>
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
      <Animated.View style={pulseStyle}>
        <View style={[styles.transitionCircle, { backgroundColor: `${ACCENT_GOLD}15` }]}>
          {phase === "navigating-meditation" ? (
            <MeditationIcon size={28} color={ACCENT_GOLD} />
          ) : (
            <Feather
              name={currentStep?.affirmationId ? "headphones" : "plus-circle"}
              size={28}
              color={ACCENT_GOLD}
            />
          )}
        </View>
      </Animated.View>
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
              style={[styles.arcDot, { backgroundColor: ACCENT_GOLD }]}
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

      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        {phase !== "intro" && phase !== "complete" && (phase !== "breathing" || showControls) ? (
          <Pressable
            onPress={handleEndJourney}
            style={styles.closeButton}
            testID="button-exit-journey"
          >
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        {phase === "intro" ? renderIntro() : null}
        {phase === "breathing" ? renderBreathing() : null}
        {phase === "transition" ? renderTransition() : null}
        {phase === "navigating-meditation" || phase === "navigating-listen"
          ? renderNavigating()
          : null}
        {phase === "complete" ? renderComplete() : null}
      </View>
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
  stepLabel: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: Spacing.xs,
  },
  breathingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  breathingPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  breathingBottomControls: {
    alignItems: "center",
  },
  breathingTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  breathingNote: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: Spacing.lg,
  },
  breathingCircleWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing.xl,
  },
  timerText: {
    textAlign: "center",
    fontWeight: "300",
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    marginBottom: Spacing.sm,
  },
  breathingControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButton: {
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
