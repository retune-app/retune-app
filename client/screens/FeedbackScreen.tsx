import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getAuthToken } from "@/lib/auth-token";

const GOLD = "#C9A227";

type FeedbackType = "feedback" | "feature" | "bug";

const FEEDBACK_TYPES: { id: FeedbackType; label: string; icon: keyof typeof Feather.glyphMap; description: string }[] = [
  { id: "feedback", label: "General Feedback", icon: "message-circle", description: "Share your experience" },
  { id: "feature", label: "Feature Request", icon: "zap", description: "Suggest something new" },
  { id: "bug", label: "Report an Issue", icon: "alert-circle", description: "Something not working?" },
];

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [selectedType, setSelectedType] = useState<FeedbackType>("feedback");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const canSubmit = title.trim().length > 0 && message.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}

    try {
      const url = new URL("/api/feedback", getApiUrl()).toString();
      const authToken = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["X-Auth-Token"] = authToken;

      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          type: selectedType,
          title: title.trim(),
          message: message.trim(),
          email: user?.email || "",
          appVersion: Constants.expoConfig?.version || "unknown",
        }),
      });

      if (response.ok) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
        setIsSubmitted(true);
      }
    } catch (error) {
      console.error("Feedback submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedType("feedback");
    setTitle("");
    setMessage("");
    setIsSubmitted(false);
  };

  if (isSubmitted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.successContainer, { paddingTop: headerHeight + Spacing.xl * 2 }]}>
          <View style={[styles.successIcon, { backgroundColor: theme.success + "18" }]}>
            <Feather name="check-circle" size={48} color={theme.success} />
          </View>
          <ThemedText type="h2" style={styles.successTitle}>
            Thank You!
          </ThemedText>
          <ThemedText type="body" style={[styles.successMessage, { color: theme.textSecondary }]}>
            Your {selectedType === "feature" ? "feature request" : selectedType === "bug" ? "bug report" : "feedback"} has been sent to team@retuned.app. We appreciate you helping make Retuned better.
          </ThemedText>
          <Pressable
            onPress={handleReset}
            style={[styles.submitAgainButton, { borderColor: theme.primary }]}
          >
            <Feather name="edit-3" size={16} color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.primary, marginLeft: Spacing.sm }}>
              Submit Another
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]} testID="screen-feedback">
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="body" style={[styles.intro, { color: theme.textSecondary }]}>
          Your voice shapes the future of Retuned. Share your thoughts with team@retuned.app -- we read every message.
        </ThemedText>

        <View style={styles.typeSelector}>
          {FEEDBACK_TYPES.map((type) => {
            const isSelected = selectedType === type.id;
            return (
              <Pressable
                key={type.id}
                onPress={() => {
                  setSelectedType(type.id);
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                }}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: isSelected ? GOLD + "15" : theme.cardBackground,
                    borderColor: isSelected ? GOLD : theme.border,
                  },
                  Shadows.small,
                ]}
                testID={`button-type-${type.id}`}
              >
                <View style={[styles.typeIcon, { backgroundColor: isSelected ? GOLD + "20" : theme.backgroundSecondary }]}>
                  <Feather name={type.icon} size={18} color={isSelected ? GOLD : theme.textSecondary} />
                </View>
                <ThemedText type="small" style={[styles.typeLabel, { color: isSelected ? GOLD : theme.text }]}>
                  {type.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.formSection}>
          <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Title
          </ThemedText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={selectedType === "feature" ? "e.g., Sleep playlist builder" : selectedType === "bug" ? "e.g., Audio stops when switching tabs" : "e.g., I love the breathing exercises"}
            placeholderTextColor={theme.textSecondary + "80"}
            style={[
              styles.input,
              {
                backgroundColor: theme.cardBackground,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            maxLength={100}
            testID="input-feedback-title"
          />

          <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Details
          </ThemedText>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={selectedType === "feature" ? "Describe the feature you'd like to see and how it would help your practice..." : selectedType === "bug" ? "What happened? What did you expect to happen?..." : "Tell us more about your experience..."}
            placeholderTextColor={theme.textSecondary + "80"}
            style={[
              styles.textArea,
              {
                backgroundColor: theme.cardBackground,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
            testID="input-feedback-message"
          />
          <ThemedText type="caption" style={[styles.charCount, { color: theme.textSecondary }]}>
            {message.length}/1000
          </ThemedText>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          style={[
            styles.submitButton,
            {
              backgroundColor: canSubmit ? GOLD : theme.border,
              opacity: isSubmitting ? 0.7 : 1,
            },
          ]}
          testID="button-submit-feedback"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#0F1C3F" />
          ) : (
            <>
              <Feather name="send" size={16} color={canSubmit ? "#0F1C3F" : theme.textSecondary} />
              <ThemedText
                type="body"
                style={[styles.submitText, { color: canSubmit ? "#0F1C3F" : theme.textSecondary }]}
              >
                Submit {selectedType === "feature" ? "Request" : selectedType === "bug" ? "Report" : "Feedback"}
              </ThemedText>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  intro: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  typeSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  typeCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  typeLabel: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 12,
    textAlign: "center",
  },
  formSection: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontFamily: "Nunito_600SemiBold",
    marginBottom: Spacing.xs,
    marginLeft: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    marginBottom: Spacing.lg,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    minHeight: 140,
  },
  charCount: {
    textAlign: "right",
    marginTop: Spacing.xs,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  submitText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  successTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  successMessage: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  submitAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
});
