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
  FadeOut,
  SlideInUp,
  SlideInDown,
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

interface BreatheRec {
  techniqueId: string;
  techniqueName: string;
  note: string;
}

interface MeditateRec {
  note: string;
}

interface ListenRec {
  hasAffirmation: boolean;
  affirmationId: number | null;
  affirmationTitle: string | null;
  isInnerVoice: boolean;
  hasClonedVoice: boolean;
  hasAnyAffirmations: boolean;
  note: string;
}

interface MoodResponse {
  acknowledgment: string;
  breathe: BreatheRec;
  meditate: MeditateRec;
  listen: ListenRec;
}

export function MoodCheckin({ onStartBreathing, onStartAffirmations, visible, onClose }: MoodCheckinProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<MoodResponse | null>(null);


  const handleMoodSelect = useCallback(async (mood: MoodOption) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    setSelectedMood(mood.id);
    setIsLoading(true);

    try {
      const url = new URL("/api/mood-checkin", getApiUrl()).toString();
      const result = await apiRequest("POST", url, {
        mood: mood.id,
        timeOfDay: getTimeOfDay(),
      });
      const data = await result.json();
      setResponse(data);
    } catch (error) {
      setResponse({
        acknowledgment: "This moment is yours.",
        breathe: {
          techniqueId: "box",
          techniqueName: "Box Breathing",
          note: "Rhythmic breathing activates your vagus nerve, calming the body.",
        },
        meditate: {
          note: "A guided meditation to settle into this moment.",
        },
        listen: {
          hasAffirmation: false,
          affirmationId: null,
          affirmationTitle: null,
          isInnerVoice: false,
          hasClonedVoice: false,
          hasAnyAffirmations: false,
          note: "Create a personal affirmation that speaks to how you feel.",
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleBreathe = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    if (response?.breathe?.techniqueId) {
      onStartBreathing?.(response.breathe.techniqueId);
    }
    handleClose();
  }, [response, onStartBreathing]);

  const handleMeditate = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    handleClose();
    navigation.navigate("GuidedMoment", {
      mood: selectedMood!,
      timeOfDay: getTimeOfDay(),
    });
  }, [selectedMood, navigation]);

  const handleListen = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    handleClose();
    if (response?.listen?.hasAffirmation && response.listen.affirmationId) {
      navigation.navigate("Player", { affirmationId: response.listen.affirmationId });
    } else if (response?.listen?.hasAnyAffirmations) {
      onStartAffirmations?.();
    } else {
      navigation.navigate("Create");
    }
  }, [response, navigation, onStartAffirmations]);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setSelectedMood(null);
      setResponse(null);
    }, 300);
  }, [onClose]);

  const getListenLabel = () => {
    if (!response?.listen) return "Listen";
    if (response.listen.hasAffirmation) return "Listen";
    if (response.listen.hasAnyAffirmations) return "Listen";
    return "Create";
  };

  const getListenSublabel = () => {
    if (!response?.listen) return "Personal affirmation";
    if (response.listen.hasAffirmation && response.listen.isInnerVoice) return "In your Inner Voice";
    if (response.listen.hasAffirmation) return "Your affirmation";
    if (!response.listen.hasAnyAffirmations && !response.listen.hasClonedVoice) return "With your Inner Voice";
    return "Personal affirmation";
  };

  const getListenIcon = (): string => {
    if (!response?.listen) return "headphones";
    if (response.listen.hasAffirmation) return "headphones";
    return "plus-circle";
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="fade"
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

            {!selectedMood ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <ThemedText type="h3" style={styles.modalTitle}>
                  How are you feeling right now?
                </ThemedText>
                <ThemedText type="body" style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  Tap to get your personalized recommendation
                </ThemedText>

                <View style={styles.moodGrid}>
                  {MOOD_OPTIONS.map((mood) => (
                    <Pressable
                      key={mood.id}
                      onPress={() => handleMoodSelect(mood)}
                      style={[
                        styles.moodOption,
                        { backgroundColor: `${mood.color}12`, borderColor: `${mood.color}30` },
                      ]}
                      testID={`button-mood-${mood.id}`}
                    >
                      <View style={[styles.moodIconWrap, { backgroundColor: `${mood.color}20` }]}>
                        <Feather name={mood.icon as any} size={28} color={mood.color} />
                      </View>
                      <ThemedText type="caption" style={[styles.moodLabel, { color: mood.color }]}>
                        {mood.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            ) : isLoading ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={ACCENT_GOLD} />
                <ThemedText type="body" style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Tuning in to you...
                </ThemedText>
              </Animated.View>
            ) : response ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <View style={[styles.ackCard, { borderColor: `${ACCENT_GOLD}20` }]}>
                  <Feather name="message-circle" size={16} color={ACCENT_GOLD} style={styles.ackIcon} />
                  <ThemedText type="body" style={[styles.ackText, { color: theme.text }]}>
                    {response.acknowledgment}
                  </ThemedText>
                </View>

                <ThemedText type="caption" style={[styles.pathwayLabel, { color: theme.textSecondary }]}>
                  {"Choose your path"}
                </ThemedText>

                <View style={styles.pathwayCards}>
                  <Pressable
                    onPress={handleBreathe}
                    style={styles.pathwayCardWrapper}
                    testID="button-pathway-breathe"
                  >
                    <LinearGradient
                      colors={[ACCENT_GOLD, GOLD_LIGHT] as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.pathwayCard}
                    >
                      <View style={styles.pathwayCardHeader}>
                        <View style={[styles.pathwayIconCircle, { backgroundColor: `${NAVY}20` }]}>
                          <Feather name="wind" size={18} color={NAVY} />
                        </View>
                        <ThemedText type="body" style={styles.pathwayCardTitle}>
                          {"Breathe"}
                        </ThemedText>
                      </View>
                      <ThemedText type="caption" style={styles.pathwayCardNote}>
                        {response.breathe.note}
                      </ThemedText>
                      <ThemedText type="caption" style={styles.pathwayCardTechnique}>
                        {response.breathe.techniqueName}
                      </ThemedText>
                    </LinearGradient>
                  </Pressable>

                  <Pressable
                    onPress={handleMeditate}
                    style={styles.pathwayCardWrapper}
                    testID="button-pathway-meditate"
                  >
                    <LinearGradient
                      colors={["#50C9B0", "#3BA89A"] as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.pathwayCard}
                    >
                      <View style={styles.pathwayCardHeader}>
                        <View style={[styles.pathwayIconCircle, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                          <MeditationIcon size={18} color="#FFFFFF" />
                        </View>
                        <ThemedText type="body" style={styles.pathwayCardTitleLight}>
                          {"Meditate"}
                        </ThemedText>
                      </View>
                      <ThemedText type="caption" style={styles.pathwayCardNoteLight}>
                        {response.meditate.note}
                      </ThemedText>
                      <ThemedText type="caption" style={styles.pathwayCardTechniqueLight}>
                        {"AI Guided Moment"}
                      </ThemedText>
                    </LinearGradient>
                  </Pressable>

                  <Pressable
                    onPress={handleListen}
                    style={styles.pathwayCardWrapper}
                    testID="button-pathway-listen"
                  >
                    <View style={[styles.pathwayCard, styles.listenCard, { borderColor: `${ACCENT_GOLD}25` }]}>
                      <View style={styles.pathwayCardHeader}>
                        <View style={[styles.pathwayIconCircle, { backgroundColor: `${ACCENT_GOLD}15` }]}>
                          <Feather name={getListenIcon() as any} size={18} color={ACCENT_GOLD} />
                        </View>
                        <ThemedText type="body" style={[styles.pathwayCardTitle, { color: theme.text }]}>
                          {getListenLabel()}
                        </ThemedText>
                      </View>
                      <ThemedText type="caption" style={[styles.pathwayCardNote, { color: theme.textSecondary }]}>
                        {response.listen.note}
                      </ThemedText>
                      {response.listen.hasAffirmation && response.listen.affirmationTitle ? (
                        <View style={styles.affirmationTag}>
                          <Feather name="music" size={10} color={ACCENT_GOLD} />
                          <ThemedText type="caption" style={styles.affirmationTagText} numberOfLines={1}>
                            {response.listen.affirmationTitle}
                          </ThemedText>
                        </View>
                      ) : (
                        <ThemedText type="caption" style={[styles.pathwayCardTechnique, { color: `${ACCENT_GOLD}90` }]}>
                          {getListenSublabel()}
                        </ThemedText>
                      )}
                    </View>
                  </Pressable>
                </View>

                <Pressable onPress={handleClose} style={styles.dismissButton}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Maybe later
                  </ThemedText>
                </Pressable>
              </Animated.View>
            ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  moodOption: {
    width: "30%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  moodIconWrap: {
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
  pathwayLabel: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  pathwayCards: {
    gap: Spacing.sm,
  },
  pathwayCardWrapper: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  pathwayCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 6,
  },
  listenCard: {
    backgroundColor: `${ACCENT_GOLD}06`,
    borderWidth: 1,
  },
  pathwayCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  pathwayIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pathwayCardTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: NAVY,
  },
  pathwayCardTitleLight: {
    fontWeight: "700",
    fontSize: 16,
    color: "#FFFFFF",
  },
  pathwayCardNote: {
    fontSize: 13,
    lineHeight: 18,
    color: `${NAVY}B0`,
    paddingLeft: 44,
  },
  pathwayCardNoteLight: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.85)",
    paddingLeft: 44,
  },
  pathwayCardTechnique: {
    fontSize: 11,
    fontWeight: "600",
    color: `${NAVY}70`,
    paddingLeft: 44,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pathwayCardTechniqueLight: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    paddingLeft: 44,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  affirmationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 44,
    marginTop: 2,
  },
  affirmationTagText: {
    color: ACCENT_GOLD,
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  dismissButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
});
