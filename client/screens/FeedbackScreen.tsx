import React, { useState } from "react";
import { View, StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView, Platform } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getAuthToken } from "@/lib/auth-token";

const GOLD = "#C9A227";

type FeedbackType = "feedback" | "feature" | "bug";

const FEEDBACK_TYPES: { id: FeedbackType; label: string; icon: keyof typeof Feather.glyphMap; description: string; accent: string }[] = [
  { id: "feedback", label: "Feedback", icon: "message-circle", description: "Your experience", accent: "#C9A227" },
  { id: "feature", label: "Feature Idea", icon: "zap", description: "Suggest new ideas", accent: "#7C3AED" },
  { id: "bug", label: "Report Issue", icon: "alert-circle", description: "Report a problem", accent: "#EF4444" },
];

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
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
            Your {selectedType === "feature" ? "feature idea" : selectedType === "bug" ? "issue report" : "feedback"} has been sent to team@retuned.app. We appreciate you helping make Retuned better.
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

  const selectedAccent = FEEDBACK_TYPES.find(t => t.id === selectedType)?.accent || GOLD;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]} testID="screen-feedback">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="small" style={[styles.intro, { color: theme.textSecondary }]}>
          Questions, ideas, or issues — we read every message at team@retuned.app
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
                    backgroundColor: isSelected
                      ? type.accent + (isDark ? "25" : "12")
                      : theme.cardBackground,
                    borderColor: isSelected ? type.accent : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                testID={`button-type-${type.id}`}
              >
                <View style={[
                  styles.typeIcon,
                  {
                    backgroundColor: isSelected
                      ? type.accent + (isDark ? "35" : "20")
                      : isDark ? theme.backgroundSecondary : type.accent + "10",
                  },
                ]}>
                  <Feather
                    name={type.icon}
                    size={20}
                    color={isSelected ? type.accent : isDark ? theme.textSecondary : type.accent + "BB"}
                  />
                </View>
                <ThemedText
                  type="small"
                  style={[
                    styles.typeLabel,
                    { color: isSelected ? type.accent : theme.text },
                  ]}
                >
                  {type.label}
                </ThemedText>
                <ThemedText
                  type="caption"
                  style={[
                    styles.typeDescription,
                    { color: isSelected ? type.accent + "CC" : theme.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {type.description}
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
            placeholder={selectedType === "feature" ? "Describe the feature you'd like to see..." : selectedType === "bug" ? "What happened? What did you expect?..." : "Tell us more about your experience..."}
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
              backgroundColor: canSubmit ? selectedAccent : theme.border,
              opacity: isSubmitting ? 0.7 : 1,
            },
          ]}
          testID="button-submit-feedback"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="send" size={16} color={canSubmit ? "#FFFFFF" : theme.textSecondary} />
              <ThemedText
                type="body"
                style={[styles.submitText, { color: canSubmit ? "#FFFFFF" : theme.textSecondary }]}
              >
                Submit {selectedType === "feature" ? "Idea" : selectedType === "bug" ? "Report" : "Feedback"}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  intro: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  typeSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  typeCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  typeLabel: {
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    textAlign: "center",
  },
  typeDescription: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
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
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    marginBottom: Spacing.md,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    minHeight: 120,
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
