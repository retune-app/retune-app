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
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
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

interface MoodResponse {
  acknowledgment: string;
  recommendation: string;
  activityType: string;
  techniqueId: string;
  techniqueName: string;
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
        acknowledgment: "I hear you.",
        recommendation: "A moment of mindfulness can make a difference right now.",
        activityType: "breathe",
        techniqueId: "box",
        techniqueName: "Box Breathing",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStartActivity = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}

    if (response?.activityType === "believe") {
      onStartAffirmations?.();
    } else if (response?.techniqueId) {
      onStartBreathing?.(response.techniqueId);
    }
    handleClose();
  }, [response, onStartBreathing, onStartAffirmations]);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setSelectedMood(null);
      setResponse(null);
    }, 300);
  }, [onClose]);

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
                  Finding the perfect activity for you...
                </ThemedText>
              </Animated.View>
            ) : response ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <View style={[styles.responseCard, { backgroundColor: `${ACCENT_GOLD}08`, borderColor: `${ACCENT_GOLD}20` }]}>
                  <View style={styles.responseAckRow}>
                    <Feather name="message-circle" size={18} color={ACCENT_GOLD} />
                    <ThemedText type="body" style={[styles.responseAck, { color: theme.text }]}>
                      {response.acknowledgment}
                    </ThemedText>
                  </View>

                  <View style={[styles.divider, { backgroundColor: `${ACCENT_GOLD}15` }]} />

                  <View style={styles.recommendationRow}>
                    <View style={[styles.recommendIcon, { backgroundColor: `${ACCENT_GOLD}15` }]}>
                      <Feather
                        name={response.activityType === "breathe" ? "wind" : "heart"}
                        size={24}
                        color={ACCENT_GOLD}
                      />
                    </View>
                    <View style={styles.recommendText}>
                      <ThemedText type="body" style={{ fontWeight: "700", fontSize: 16 }}>
                        {response.techniqueName}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4, lineHeight: 18 }}>
                        {response.recommendation}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <ThemedText type="caption" style={[styles.chooseLabel, { color: theme.textSecondary }]}>
                  {"Choose your practice"}
                </ThemedText>

                <View style={styles.actionButtonsRow}>
                  <Pressable
                    onPress={handleStartActivity}
                    style={styles.actionButtonWrapper}
                    testID="button-start-recommended"
                  >
                    <LinearGradient
                      colors={[ACCENT_GOLD, GOLD_LIGHT] as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.actionButton}
                    >
                      <Feather name="wind" size={22} color={NAVY} />
                      <ThemedText type="body" style={styles.actionButtonTextDark}>
                        {"Breathe"}
                      </ThemedText>
                      <ThemedText type="caption" style={styles.actionButtonSubDark}>
                        {"Guided breathing"}
                      </ThemedText>
                    </LinearGradient>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                      handleClose();
                      navigation.navigate("GuidedMoment", {
                        mood: selectedMood!,
                        timeOfDay: getTimeOfDay(),
                      });
                    }}
                    style={styles.actionButtonWrapper}
                    testID="button-try-micro-meditation"
                  >
                    <LinearGradient
                      colors={["#50C9B0", "#3BA89A"] as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.actionButton}
                    >
                      <MeditationIcon size={24} color="#FFFFFF" />
                      <ThemedText type="body" style={styles.actionButtonTextLight}>
                        {"Meditate"}
                      </ThemedText>
                      <ThemedText type="caption" style={styles.actionButtonSubLight}>
                        {"AI micro-meditation"}
                      </ThemedText>
                    </LinearGradient>
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
  responseCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  responseAckRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  responseAck: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  recommendationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  recommendIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendText: {
    flex: 1,
  },
  chooseLabel: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButtonWrapper: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: 4,
  },
  actionButtonTextDark: {
    color: NAVY,
    fontWeight: "700",
    fontSize: 16,
    marginTop: 4,
  },
  actionButtonSubDark: {
    color: `${NAVY}90`,
    fontSize: 11,
  },
  actionButtonTextLight: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    marginTop: 4,
  },
  actionButtonSubLight: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
  },
  dismissButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
});
