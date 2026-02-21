import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  ScrollView,
  PanResponder,
} from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { resolveVibeFromMoodPair, getVibeConfig } from "@shared/vibes";
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

const STARTING_MOODS: MoodOption[] = [
  { id: "stressed", label: "Stressed", icon: "zap", color: "#FF7043" },
  { id: "anxious", label: "Worried", icon: "alert-circle", color: "#FFA726" },
  { id: "tired", label: "Tired", icon: "moon", color: "#78909C" },
  { id: "overwhelmed", label: "Overwhelmed", icon: "layers", color: "#AB47BC" },
  { id: "frustrated", label: "Frustrated", icon: "x-circle", color: "#EF5350" },
  { id: "sad", label: "Down", icon: "cloud-rain", color: "#7986CB" },
  { id: "wired", label: "Wired", icon: "activity", color: "#E040FB" },
  { id: "scattered", label: "Scattered", icon: "shuffle", color: "#9575CD" },
  { id: "good", label: "Good", icon: "sun", color: "#81C784" },
];

const TARGET_MOODS: MoodOption[] = [
  { id: "calm", label: "Calm", icon: "sunset", color: "#66BB6A" },
  { id: "energized", label: "Energized", icon: "battery-charging", color: "#FFCA28" },
  { id: "confident", label: "Confident", icon: "shield", color: "#42A5F5" },
  { id: "focused", label: "Focused", icon: "crosshair", color: "#26C6DA" },
  { id: "locked_in", label: "Locked In", icon: "target", color: "#1E88E5" },
  { id: "grateful", label: "Grateful", icon: "heart", color: "#EC407A" },
  { id: "joyful", label: "Joyful", icon: "star", color: "#FFD54F" },
  { id: "grounded", label: "Grounded", icon: "anchor", color: "#A1887F" },
  { id: "lit_up", label: "Lit Up", icon: "sunrise", color: "#FF6D00" },
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
  originTab?: string;
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
  vibeId?: string;
  vibeLabel?: string;
  vibeAccentColor?: string;
  vibeIcon?: string;
  currentMood: string;
  targetMood: string;
  steps: JourneyStep[];
}

type Phase = "mood" | "target" | "journey";

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

export function MoodCheckin({ visible, onClose, originTab }: MoodCheckinProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [phase, setPhase] = useState<Phase>("mood");
  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<MoodOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [journeyResponse, setJourneyResponse] = useState<JourneyResponse | null>(null);

  const connDot0 = useSharedValue(0.3);
  const connDot1 = useSharedValue(0.3);
  const connDot2 = useSharedValue(0.3);

  React.useEffect(() => {
    const dur = 500;
    const ease = Easing.inOut(Easing.sin);
    const totalCycle = 1800;
    const makePulse = (delay: number) =>
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: delay }),
          withTiming(1, { duration: dur, easing: ease }),
          withTiming(0.3, { duration: dur, easing: ease }),
          withTiming(0.3, { duration: Math.max(0, totalCycle - delay - dur * 2) })
        ),
        -1
      );
    connDot0.value = makePulse(0);
    connDot1.value = makePulse(350);
    connDot2.value = makePulse(700);
  }, []);

  const connDotStyle0 = useAnimatedStyle(() => ({ opacity: connDot0.value }));
  const connDotStyle1 = useAnimatedStyle(() => ({ opacity: connDot1.value }));
  const connDotStyle2 = useAnimatedStyle(() => ({ opacity: connDot2.value }));
  const connDotStyles = [connDotStyle0, connDotStyle1, connDotStyle2];

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setPhase("mood");
      setSelectedMood(null);
      setSelectedTarget(null);
      setIsLoading(false);
      setJourneyResponse(null);
    }, 300);
  }, [onClose]);

  const handleMoodSelect = useCallback((mood: MoodOption) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setSelectedMood(mood);
    setPhase("target");
  }, []);

  const handleTargetSelect = useCallback(async (target: MoodOption) => {
    if (!selectedMood) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setSelectedTarget(target);
    setPhase("journey");
    setIsLoading(true);

    try {
      const url = new URL("/api/mood-checkin", getApiUrl()).toString();
      const result = await apiRequest("POST", url, {
        mood: selectedMood.id,
        targetMood: target.id,
        timeOfDay: getTimeOfDay(),
      });
      const data = await result.json();
      setJourneyResponse(data);
    } catch (error) {
      const vibeId = resolveVibeFromMoodPair(selectedMood.id, target.id);
      const vibe = getVibeConfig(vibeId);
      setJourneyResponse({
        acknowledgment: "This moment is yours. Let's guide you gently.",
        vibeId: vibeId,
        vibeLabel: vibe?.label,
        vibeAccentColor: vibe?.ui.accentColor,
        vibeIcon: vibe?.ui.icon,
        currentMood: selectedMood.id,
        targetMood: target.id,
        steps: [
          {
            type: "breathe",
            techniqueId: vibe?.breathing.primaryTechniqueId || "box",
            techniqueName: vibe?.breathing.primaryTechniqueName || "Box Breathing",
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
  }, [selectedMood]);

  const handleBeginJourney = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}
    if (journeyResponse) {
      handleClose();
      (navigation as any).navigate("MoodJourney", { journey: journeyResponse, originTab });
    }
  }, [journeyResponse, navigation, handleClose, originTab]);

  const handleSingleStep = useCallback((step: JourneyStep) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
    handleClose();
    if (step.type === "breathe") {
      const singleJourney = {
        acknowledgment: journeyResponse?.acknowledgment || "",
        currentMood: journeyResponse?.currentMood || selectedMood?.id || "calm",
        targetMood: journeyResponse?.targetMood || selectedTarget?.id || "calm",
        vibeId: journeyResponse?.vibeId,
        steps: [step],
      };
      (navigation as any).navigate("MoodJourney", { journey: singleJourney, originTab });
    } else if (step.type === "meditate") {
      navigation.navigate("GuidedMoment", {
        mood: journeyResponse?.targetMood || selectedTarget?.id || "calm",
        timeOfDay: getTimeOfDay(),
      });
    } else if (step.type === "listen") {
      if (step.affirmationId) {
        navigation.navigate("Player", { affirmationId: step.affirmationId, autoPlay: true });
      } else {
        navigation.navigate("Create");
      }
    }
  }, [journeyResponse, selectedMood, selectedTarget, navigation, handleClose]);

  const getStepTypeLabel = (type: string): string => {
    if (type === "breathe") return "Breathe";
    if (type === "meditate") return "Meditate";
    if (type === "listen") return "Listen";
    return type;
  };

  const translateY = useSharedValue(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 8,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.value = gestureState.dy;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          translateY.value = withTiming(600, { duration: 250 });
          runOnJS(handleClose)();
        } else {
          translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        }
      },
    })
  ).current;

  const modalSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (visible) {
      translateY.value = 0;
    }
  }, [visible]);

  const journeyAccent = selectedTarget?.color || journeyResponse?.vibeAccentColor || ACCENT_GOLD;
  const journeyGradient: [string, string] = selectedTarget?.color
    ? [selectedTarget.color, `${selectedTarget.color}CC`]
    : journeyResponse?.vibeAccentColor
      ? [journeyResponse.vibeAccentColor, `${journeyResponse.vibeAccentColor}CC`]
      : [ACCENT_GOLD, GOLD_LIGHT];

  const handleBackToMood = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setPhase("mood");
    setSelectedMood(null);
    setSelectedTarget(null);
  }, []);

  const renderMoodGrid = (moods: MoodOption[], onSelect: (m: MoodOption) => void, title: string, subtitle: string) => (
    <Animated.View entering={FadeIn.duration(200)}>
      <ThemedText type="h3" style={styles.modalTitle}>
        {title}
      </ThemedText>
      <ThemedText type="body" style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
        {subtitle}
      </ThemedText>

      <View style={styles.moodGrid}>
        {moods.map((mood) => (
          <Pressable
            key={mood.id}
            onPress={() => onSelect(mood)}
            style={({ pressed }) => [
              styles.moodChip,
              { backgroundColor: pressed ? `${mood.color}20` : `${mood.color}10`, borderColor: `${mood.color}25` },
            ]}
            testID={`button-mood-${mood.id}`}
          >
            <View style={[styles.moodIconCircle, { backgroundColor: `${mood.color}20` }]}>
              <Feather name={mood.icon as any} size={24} color={mood.color} />
            </View>
            <ThemedText type="caption" style={[styles.moodLabel, { color: mood.color }]}>
              {mood.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Animated.View
          style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }, modalSlideStyle]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => {}}
        >
          <View {...panResponder.panHandlers} style={styles.handleZone}>
            <View style={styles.modalHandle} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={true}
            keyboardShouldPersistTaps="handled"
            style={styles.modalScroll}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {phase === "mood" ? (
              renderMoodGrid(STARTING_MOODS, handleMoodSelect, "How are you feeling?", "Be honest — no wrong answers")
            ) : phase === "target" ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <View style={styles.selectedMoodBadge}>
                  {selectedMood ? (
                    <Pressable onPress={handleBackToMood} style={[styles.selectedMoodPill, { backgroundColor: `${selectedMood.color}15`, borderColor: `${selectedMood.color}30` }]}>
                      <Feather name={selectedMood.icon as any} size={14} color={selectedMood.color} />
                      <ThemedText type="caption" style={{ color: selectedMood.color, fontWeight: "600", fontSize: 12 }}>
                        {selectedMood.label}
                      </ThemedText>
                      <Feather name="x" size={12} color={selectedMood.color} />
                    </Pressable>
                  ) : null}
                </View>
                {renderMoodGrid(TARGET_MOODS, handleTargetSelect, "I want to feel...", "Where would you like to go?")}
              </Animated.View>
            ) : isLoading ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={journeyAccent} />
                <ThemedText type="body" style={[styles.loadingText, { color: theme.textSecondary }]}>
                  {"Crafting your journey..."}
                </ThemedText>
              </Animated.View>
            ) : journeyResponse ? (
              <Animated.View entering={FadeIn.duration(300)}>
                {selectedMood && selectedTarget ? (
                  <View style={styles.moodPairHeader}>
                    <View style={[styles.moodPairPill, { backgroundColor: `${selectedMood.color}15` }]}>
                      <Feather name={selectedMood.icon as any} size={14} color={selectedMood.color} />
                      <ThemedText type="caption" style={{ color: selectedMood.color, fontWeight: "600", fontSize: 12 }}>{selectedMood.label}</ThemedText>
                    </View>
                    <Feather name="arrow-right" size={16} color={theme.textSecondary} />
                    <View style={[styles.moodPairPill, { backgroundColor: `${selectedTarget.color}15` }]}>
                      <Feather name={selectedTarget.icon as any} size={14} color={selectedTarget.color} />
                      <ThemedText type="caption" style={{ color: selectedTarget.color, fontWeight: "600", fontSize: 12 }}>{selectedTarget.label}</ThemedText>
                    </View>
                  </View>
                ) : null}

                <ThemedText type="h3" style={styles.modalTitle}>
                  {journeyResponse.journeyTitle || "Your Journey"}
                </ThemedText>

                <View style={[styles.ackCard, { borderColor: `${journeyAccent}20`, backgroundColor: `${journeyAccent}08` }]}>
                  <Feather name="message-circle" size={16} color={journeyAccent} style={styles.ackIcon} />
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
                            {[0, 1].map((d) => (
                              <Animated.View key={d} style={[styles.connectorDot, connDotStyles[d]]} />
                            ))}
                          </View>
                        ) : null}
                        <Pressable
                          onPress={() => handleSingleStep(step)}
                          style={({ pressed }) => [
                            styles.stepCard,
                            { backgroundColor: pressed ? `${stepColor}15` : `${stepColor}08`, borderColor: `${stepColor}40` },
                          ]}
                          testID={`button-step-${step.type}`}
                        >
                          <View style={styles.stepCardRow}>
                            <View style={styles.stepLeftColumn}>
                              <View style={[styles.stepNumberCircle, { backgroundColor: `${stepColor}20` }]}>
                                <ThemedText type="caption" style={{ color: stepColor, fontWeight: "700", fontSize: 12 }}>
                                  {String(index + 1)}
                                </ThemedText>
                              </View>
                              <View style={[styles.stepIconCircle, { backgroundColor: `${stepColor}15` }]}>
                                <StepIconComponent type={step.type} size={16} color={stepColor} />
                              </View>
                            </View>
                            <View style={styles.stepRightContent}>
                              <ThemedText type="body" style={[styles.stepTypeLabel, { color: stepColor }]}>
                                {getStepTypeLabel(step.type)}
                              </ThemedText>
                            </View>
                            <Feather name="chevron-right" size={16} color={`${stepColor}80`} style={styles.stepChevron} />
                          </View>
                          <ThemedText type="small" style={[styles.stepNote, { color: theme.text, opacity: 0.85 }]}>
                            {step.note}
                          </ThemedText>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            ) : null}
          </ScrollView>

          {journeyResponse && phase === "journey" ? (
            <View style={[styles.stickyFooter, { backgroundColor: theme.backgroundRoot }]}>
              <Pressable
                onPress={handleBeginJourney}
                style={styles.beginButtonWrapper}
                testID="button-begin-journey"
              >
                <LinearGradient
                  colors={journeyGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.beginButton}
                >
                  <ThemedText type="body" style={styles.beginButtonText}>
                    {"Begin Full Journey"}
                  </ThemedText>
                  <Feather name="arrow-right" size={20} color={NAVY} />
                </LinearGradient>
              </Pressable>
              <Pressable onPress={handleClose} style={styles.dismissButton}>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {"Maybe later"}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
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
    paddingBottom: 48,
    paddingTop: Spacing.md,
    maxHeight: "95%",
  },
  modalScroll: {
    flexGrow: 0,
  },
  handleZone: {
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: "center",
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
  moodChip: {
    width: "31%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    minHeight: 90,
  },
  moodIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  moodLabel: {
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  selectedMoodBadge: {
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  selectedMoodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  moodPairHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  moodPairPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  ackCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  ackIcon: {
    marginTop: 2,
  },
  ackText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    fontWeight: "500",
  },
  stepsContainer: {
    marginBottom: Spacing.sm,
  },
  stepConnector: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  connectorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT_GOLD,
    shadowColor: "#E5C95C",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 3,
    elevation: 4,
  },
  stepCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    padding: Spacing.sm,
  },
  stepCardRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  stepLeftColumn: {
    alignItems: "center",
    gap: 4,
    paddingTop: 2,
  },
  stepRightContent: {
    flex: 1,
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
    lineHeight: 18,
    marginTop: -28,
    paddingLeft: 36,
  },
  stepsHint: {
    textAlign: "center",
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  stickyFooter: {
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  beginButtonWrapper: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.xs,
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
    paddingVertical: Spacing.sm,
  },
});
