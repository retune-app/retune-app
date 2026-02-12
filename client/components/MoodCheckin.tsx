import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Animated, {
  FadeIn,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { MeditationIcon } from "@/components/MeditationIcon";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const ACCENT_GOLD = "#C9A227";
const GOLD_LIGHT = "#E5C95C";
const NAVY = "#0F1C3F";

interface MoodOption {
  id: string;
  label: string;
  icon: string;
  color: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  { id: "calm", label: "Calm", icon: "sun", color: "#50C9B0" },
  { id: "stressed", label: "Stressed", icon: "cloud", color: "#E85D5D" },
  { id: "tired", label: "Tired", icon: "moon", color: "#7B68EE" },
  { id: "energized", label: "Energized", icon: "zap", color: "#F5A623" },
  { id: "anxious", label: "Anxious", icon: "wind", color: "#4FC3F7" },
  { id: "grateful", label: "Grateful", icon: "heart", color: "#C9A227" },
];

const VALID_TARGET_MOODS: Record<string, string[]> = {
  calm: ["grateful", "energized"],
  stressed: ["calm", "grateful"],
  tired: ["energized", "calm"],
  energized: ["calm", "grateful"],
  anxious: ["calm", "grateful"],
  grateful: ["calm", "energized"],
};

const CHECKIN_PROMPTS = [
  { title: "Let's tune in", subtitle: "How does your world feel right now?" },
  { title: "A moment for you", subtitle: "What's your inner weather today?" },
  { title: "Pause and feel", subtitle: "No right answers, just honesty" },
  { title: "Check in with yourself", subtitle: "Where is your mind right now?" },
  { title: "Right here, right now", subtitle: "Name what you're carrying today" },
  { title: "Be honest with yourself", subtitle: "How are you really feeling?" },
  { title: "Your starting point", subtitle: "Every journey begins with awareness" },
];

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

interface MoodCheckinProps {
  onStartBreathing?: (techniqueId: string) => void;
  onStartAffirmations?: () => void;
  visible: boolean;
  onClose: () => void;
}

interface JourneyStep {
  type: string;
  techniqueId?: string;
  techniqueName?: string;
  note: string;
  affirmationId?: number | null;
}

interface JourneyResponse {
  journeyTitle?: string;
  acknowledgment: string;
  currentMood: string;
  targetMood: string;
  steps: JourneyStep[];
}

type Phase = "current" | "target" | "journey";

function getStepIcon(type: string): string {
  if (type === "breathe") return "wind";
  if (type === "listen") return "headphones";
  return "wind";
}

function StepIconComponent({ type, size, color }: { type: string; size: number; color: string }) {
  if (type === "meditate") {
    return <MeditationIcon size={size} color={color} />;
  }
  return <Feather name={getStepIcon(type) as any} size={size} color={color} />;
}

export function MoodCheckin({ visible, onClose }: MoodCheckinProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [phase, setPhase] = useState<Phase>("current");
  const [currentMood, setCurrentMood] = useState<MoodOption | null>(null);
  const [targetMood, setTargetMood] = useState<MoodOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [journeyResponse, setJourneyResponse] = useState<JourneyResponse | null>(null);
  const [checkinPrompt] = useState(() => CHECKIN_PROMPTS[Math.floor(Math.random() * CHECKIN_PROMPTS.length)]);
  const [targetPrompt, setTargetPrompt] = useState<{ title: string; subtitle: string } | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setPhase("current");
      setCurrentMood(null);
      setTargetMood(null);
      setIsLoading(false);
      setJourneyResponse(null);
      setTargetPrompt(null);
      setIsLoadingPrompt(false);
    }, 300);
  }, [onClose]);

  const handleCurrentMoodSelect = useCallback(async (mood: MoodOption) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setCurrentMood(mood);
    setPhase("target");
    setIsLoadingPrompt(true);

    try {
      const url = new URL("/api/mood-prompt", getApiUrl());
      const response = await apiRequest("POST", url.toString(), {
        currentMood: mood.id,
        timeOfDay: getTimeOfDay(),
      });
      const data = await response.json();
      setTargetPrompt(data);
    } catch (e) {
      setTargetPrompt({ title: "Where would you like to be?", subtitle: "Choose your destination" });
    } finally {
      setIsLoadingPrompt(false);
    }
  }, []);

  const handleTargetMoodSelect = useCallback(async (mood: MoodOption) => {
    if (!currentMood) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setTargetMood(mood);
    setPhase("journey");
    setIsLoading(true);

    try {
      const url = new URL("/api/mood-checkin", getApiUrl()).toString();
      const result = await apiRequest("POST", url, {
        mood: currentMood.id,
        targetMood: mood.id,
        timeOfDay: getTimeOfDay(),
      });
      const data = await result.json();
      setJourneyResponse(data);
    } catch (error) {
      setJourneyResponse({
        acknowledgment: "This moment is yours. Let's guide you gently.",
        currentMood: currentMood.id,
        targetMood: mood.id,
        steps: [
          {
            type: "breathe",
            techniqueId: "box",
            techniqueName: "Box Breathing",
            note: "Rhythmic breathing activates your vagus nerve, calming the body.",
          },
          {
            type: "meditate",
            note: "A guided meditation to settle into this moment.",
          },
          {
            type: "listen",
            note: "Create a personal affirmation that speaks to how you feel.",
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentMood]);

  const handleBackToPhase1 = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    setPhase("current");
    setCurrentMood(null);
    setTargetMood(null);
  }, []);

  const handleBeginJourney = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}
    if (journeyResponse) {
      handleClose();
      (navigation as any).navigate("MoodJourney", { journey: journeyResponse });
    }
  }, [journeyResponse, navigation, handleClose]);

  const handleSingleStep = useCallback((step: JourneyStep) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    handleClose();
    if (step.type === "breathe") {
      const singleJourney = {
        acknowledgment: journeyResponse?.acknowledgment || "",
        currentMood: journeyResponse?.currentMood || currentMood?.id || "calm",
        targetMood: journeyResponse?.targetMood || targetMood?.id || "calm",
        steps: [step],
      };
      (navigation as any).navigate("MoodJourney", { journey: singleJourney });
    } else if (step.type === "meditate") {
      navigation.navigate("GuidedMoment", {
        mood: journeyResponse?.targetMood || targetMood?.id || "calm",
        timeOfDay: getTimeOfDay(),
      });
    } else if (step.type === "listen") {
      if (step.affirmationId) {
        navigation.navigate("Player", { affirmationId: step.affirmationId, autoPlay: true });
      } else {
        navigation.navigate("Create");
      }
    }
  }, [journeyResponse, currentMood, targetMood, navigation, handleClose]);

  const getMoodById = (id: string): MoodOption | undefined =>
    MOOD_OPTIONS.find((m) => m.id === id);

  const renderMoodIndicator = () => {
    if (!currentMood) return null;
    return (
      <Pressable onPress={handleBackToPhase1} style={styles.journeyIndicator}>
        <View style={[styles.indicatorMoodCircle, { backgroundColor: `${currentMood.color}20` }]}>
          <Feather name={currentMood.icon as any} size={16} color={currentMood.color} />
        </View>
        <ThemedText type="caption" style={{ color: currentMood.color, fontWeight: "600" }}>
          {currentMood.label}
        </ThemedText>
        <Feather name="arrow-right" size={14} color={theme.textSecondary} style={styles.indicatorArrow} />
        <View style={[styles.indicatorTargetCircle, { borderColor: theme.textSecondary }]}>
          <ThemedText type="caption" style={{ color: theme.textSecondary, fontWeight: "700", fontSize: 11 }}>
            {"?"}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const renderJourneyHeader = () => {
    if (!currentMood || !targetMood) return null;
    const target = getMoodById(targetMood.id) || targetMood;
    return (
      <View style={styles.journeyHeaderRow}>
        <View style={styles.journeyHeaderMood}>
          <View style={[styles.journeyHeaderCircle, { backgroundColor: `${currentMood.color}20` }]}>
            <Feather name={currentMood.icon as any} size={20} color={currentMood.color} />
          </View>
          <ThemedText type="caption" style={{ color: currentMood.color, fontWeight: "600", marginTop: 4 }}>
            {currentMood.label}
          </ThemedText>
        </View>

        <View style={styles.journeyDottedLine}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: ACCENT_GOLD }]} />
          ))}
        </View>

        <View style={styles.journeyHeaderMood}>
          <View style={[styles.journeyHeaderCircle, { backgroundColor: `${target.color}20` }]}>
            <Feather name={target.icon as any} size={20} color={target.color} />
          </View>
          <ThemedText type="caption" style={{ color: target.color, fontWeight: "600", marginTop: 4 }}>
            {target.label}
          </ThemedText>
        </View>
      </View>
    );
  };

  const getStepTypeLabel = (type: string): string => {
    if (type === "breathe") return "Breathe";
    if (type === "meditate") return "Meditate";
    if (type === "listen") return "Listen";
    return type;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Pressable
          style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHandle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            style={styles.modalScroll}
          >
            {phase === "current" ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <ThemedText type="h3" style={styles.modalTitle}>
                  {checkinPrompt.title}
                </ThemedText>
                <ThemedText type="body" style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {checkinPrompt.subtitle}
                </ThemedText>

                <View style={styles.moodGrid}>
                  {MOOD_OPTIONS.map((mood) => (
                    <Pressable
                      key={mood.id}
                      onPress={() => handleCurrentMoodSelect(mood)}
                      style={[
                        styles.moodCard,
                        { backgroundColor: `${mood.color}10`, borderColor: `${mood.color}25` },
                      ]}
                      testID={`button-mood-current-${mood.id}`}
                    >
                      <View style={[styles.moodIconCircle, { backgroundColor: `${mood.color}20` }]}>
                        <Feather name={mood.icon as any} size={28} color={mood.color} />
                      </View>
                      <ThemedText type="caption" style={[styles.moodLabel, { color: mood.color }]}>
                        {mood.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            ) : phase === "target" ? (
              <Animated.View entering={FadeIn.duration(200)}>
                {renderMoodIndicator()}

                <ThemedText type="h3" style={styles.modalTitle}>
                  {targetPrompt?.title || "Where would you like to be?"}
                </ThemedText>
                <ThemedText type="body" style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {targetPrompt?.subtitle || "Choose your destination"}
                </ThemedText>

                <View style={styles.moodGrid}>
                  {MOOD_OPTIONS.filter((mood) => {
                    const validTargets = currentMood ? (VALID_TARGET_MOODS[currentMood.id] || []) : [];
                    return validTargets.includes(mood.id);
                  }).map((mood) => (
                    <Pressable
                      key={mood.id}
                      onPress={() => handleTargetMoodSelect(mood)}
                      style={[
                        styles.moodCard,
                        { backgroundColor: `${mood.color}10`, borderColor: `${mood.color}25` },
                      ]}
                      testID={`button-mood-target-${mood.id}`}
                    >
                      <View
                        style={[
                          styles.moodIconCircle,
                          { backgroundColor: `${mood.color}20` },
                        ]}
                      >
                        <Feather
                          name={mood.icon as any}
                          size={28}
                          color={mood.color}
                        />
                      </View>
                      <ThemedText
                        type="caption"
                        style={[styles.moodLabel, { color: mood.color }]}
                      >
                        {mood.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                <Pressable onPress={handleBackToPhase1} style={styles.backButton}>
                  <Feather name="arrow-left" size={14} color={theme.textSecondary} />
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                    {"Go back"}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            ) : isLoading ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={ACCENT_GOLD} />
                <ThemedText type="body" style={[styles.loadingText, { color: theme.textSecondary }]}>
                  {"Crafting your journey..."}
                </ThemedText>
              </Animated.View>
            ) : journeyResponse ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <ThemedText type="h3" style={styles.modalTitle}>
                  {journeyResponse.journeyTitle || "Your Journey"}
                </ThemedText>

                {renderJourneyHeader()}

                <View style={[styles.ackCard, { borderColor: `${ACCENT_GOLD}20` }]}>
                  <Feather name="message-circle" size={16} color={ACCENT_GOLD} style={styles.ackIcon} />
                  <ThemedText type="body" style={[styles.ackText, { color: theme.text }]}>
                    {journeyResponse.acknowledgment}
                  </ThemedText>
                </View>

                <ThemedText type="small" style={[styles.stepsHint, { color: theme.textSecondary }]}>
                  {"Tap any step to try it on its own"}
                </ThemedText>

                <View style={styles.stepsContainer}>
                  {journeyResponse.steps.map((step, index) => {
                    const stepColor = step.type === "breathe" ? "#50C9B0" : step.type === "meditate" ? "#7B68EE" : ACCENT_GOLD;
                    return (
                      <View key={index}>
                        {index > 0 ? (
                          <View style={styles.stepConnector}>
                            {[0, 1, 2].map((d) => (
                              <View key={d} style={[styles.connectorDot, { backgroundColor: `${theme.textSecondary}30` }]} />
                            ))}
                          </View>
                        ) : null}
                        <Pressable
                          onPress={() => handleSingleStep(step)}
                          style={({ pressed }) => [
                            styles.stepCard,
                            { backgroundColor: pressed ? `${stepColor}15` : `${stepColor}08`, borderColor: `${stepColor}20` },
                          ]}
                          testID={`button-step-${step.type}`}
                        >
                          <View style={styles.stepHeader}>
                            <View style={[styles.stepNumberCircle, { backgroundColor: `${stepColor}20` }]}>
                              <ThemedText type="caption" style={{ color: stepColor, fontWeight: "700", fontSize: 12 }}>
                                {String(index + 1)}
                              </ThemedText>
                            </View>
                            <View style={[styles.stepIconCircle, { backgroundColor: `${stepColor}15` }]}>
                              <StepIconComponent type={step.type} size={16} color={stepColor} />
                            </View>
                            <ThemedText type="body" style={[styles.stepTypeLabel, { color: stepColor }]}>
                              {getStepTypeLabel(step.type)}
                            </ThemedText>
                            <Feather name="chevron-right" size={16} color={`${stepColor}80`} style={styles.stepChevron} />
                          </View>
                          <ThemedText type="small" style={[styles.stepNote, { color: theme.textSecondary }]}>
                            {step.note}
                          </ThemedText>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                <Pressable
                  onPress={handleBeginJourney}
                  style={styles.beginButtonWrapper}
                  testID="button-begin-journey"
                >
                  <LinearGradient
                    colors={[ACCENT_GOLD, GOLD_LIGHT] as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.beginButton}
                  >
                    <ThemedText type="body" style={styles.beginButtonText}>
                      {"Begin Full Journey"}
                    </ThemedText>
                    <Feather name="arrow-right" size={18} color={NAVY} />
                  </LinearGradient>
                </Pressable>
                <ThemedText type="small" style={[styles.beginHint, { color: theme.textSecondary }]}>
                  {"Experience all steps together, one after another"}
                </ThemedText>

                <Pressable onPress={handleClose} style={styles.dismissButton}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {"Maybe later"}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 28, 63, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    paddingTop: Spacing.md,
    maxHeight: "90%",
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
    fontSize: 14,
  },
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  moodCard: {
    width: "30%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  moodIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  moodLabel: {
    fontWeight: "600",
    fontSize: 13,
  },
  journeyIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  indicatorMoodCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorArrow: {
    marginHorizontal: 2,
  },
  indicatorTargetCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  journeyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing.lg,
    gap: Spacing.md,
  },
  journeyHeaderMood: {
    alignItems: "center",
  },
  journeyHeaderCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyDottedLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  ackCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: `${ACCENT_GOLD}08`,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  ackIcon: {
    marginTop: 2,
  },
  ackText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    fontStyle: "italic",
    fontWeight: "500",
  },
  stepsContainer: {
    marginBottom: Spacing.lg,
  },
  stepConnector: {
    alignItems: "center",
    gap: 3,
    paddingVertical: 6,
  },
  connectorDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  stepCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 6,
  },
  stepNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTypeLabel: {
    fontWeight: "700",
    fontSize: 15,
    flex: 1,
  },
  stepChevron: {
    marginLeft: "auto",
  },
  stepNote: {
    fontSize: 13,
    lineHeight: 19,
    paddingLeft: 64,
  },
  stepsHint: {
    textAlign: "center",
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  beginHint: {
    textAlign: "center",
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  beginButtonWrapper: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  beginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  beginButtonText: {
    fontWeight: "700",
    fontSize: 17,
    color: NAVY,
  },
  dismissButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
});
