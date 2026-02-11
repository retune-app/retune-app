import React, { useMemo, useState, useCallback } from "react";
import { View, StyleSheet, Pressable, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Affirmation } from "@shared/schema";

interface WelcomeSectionProps {
  userName?: string;
  lastPlayedAffirmation?: Affirmation | null;
  suggestedAffirmation?: Affirmation | null;
  onQuickPlay?: () => void;
  onSuggestionPress?: () => void;
  onSettingsPress?: () => void;
  onMoodPress?: () => void;
  onNudgeAction?: (actionType: string) => void;
  isPlaying?: boolean;
}

function getTimeGreeting(): { greeting: string; suggestion: string; icon: string } {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return {
      greeting: "Good morning",
      suggestion: "Start your day with positive energy",
      icon: "sunrise",
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: "Good afternoon",
      suggestion: "Recharge your mindset for the rest of the day",
      icon: "sun",
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: "Good evening",
      suggestion: "Wind down with calming affirmations",
      icon: "sunset",
    };
  } else {
    return {
      greeting: "Good night",
      suggestion: "Prepare your mind for restful sleep",
      icon: "moon",
    };
  }
}

interface GreetingResponse {
  message: string;
  actionText?: string;
  actionType?: string;
  cached: boolean;
}

export function WelcomeSection({
  userName,
  lastPlayedAffirmation,
  suggestedAffirmation,
  onQuickPlay,
  onSuggestionPress,
  onSettingsPress,
  onMoodPress,
  onNudgeAction,
  isPlaying = false,
}: WelcomeSectionProps) {
  const { theme, isDark, setThemeMode } = useTheme();
  const pulseValue = useSharedValue(0);
  const moodPulse = useSharedValue(0);
  const moodGlow = useSharedValue(0);
  const [moodTapped, setMoodTapped] = useState(false);

  const handleToggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setThemeMode(isDark ? "light" : "dark");
  };

  React.useEffect(() => {
    pulseValue.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);

  React.useEffect(() => {
    if (!moodTapped) {
      moodPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
      moodGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    }
  }, [moodTapped]);

  const settleMoodAnimation = useCallback(() => {
    setMoodTapped(true);
    cancelAnimation(moodPulse);
    cancelAnimation(moodGlow);
    moodPulse.value = withSpring(0, { damping: 15, stiffness: 150 });
    moodGlow.value = withTiming(0, { duration: 300 });
  }, []);

  const moodButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(moodPulse.value, [0, 1], [1, 1.05]) }],
  }));

  const moodGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(moodGlow.value, [0, 1], [0, 0.25]),
    transform: [{ scale: interpolate(moodGlow.value, [0, 1], [0.9, 1.3]) }],
  }));

  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(pulseValue.value, [0, 1], [0.6, 1]),
      transform: [{ scale: interpolate(pulseValue.value, [0, 1], [1, 1.02]) }],
    };
  });

  const { greeting, suggestion, icon } = useMemo(() => getTimeGreeting(), []);

  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  }, []);

  const { data: aiGreeting } = useQuery<GreetingResponse>({
    queryKey: [`/api/daily-greeting?timeOfDay=${timeOfDay}`],
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  const displayMessage = aiGreeting?.message || suggestion;
  const actionText = aiGreeting?.actionText;
  const actionType = aiGreeting?.actionType;

  const displayName = userName?.split(" ")[0] || "there";

  const handleQuickPlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onQuickPlay?.();
  };

  const handleSettingsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSettingsPress?.();
  };

  const handleNudgePress = () => {
    if (actionType && onNudgeAction) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onNudgeAction(actionType);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleToggleTheme}
        style={[
          styles.greetingRow,
          isDark ? styles.greetingRowDark : styles.greetingRowLight,
        ]}
        testID="button-toggle-theme-banner"
      >
        <View style={styles.greetingContent}>
          <View style={styles.greetingHeader}>
            <Feather name={icon as any} size={16} color={theme.gold} />
            <ThemedText type="body" style={[styles.greeting, { color: theme.text, fontSize: 16, fontWeight: "700" }]}>
              {greeting}, {displayName}
            </ThemedText>
          </View>
          <View style={styles.suggestionRow}>
            {actionText && actionType ? (
              <Text style={[styles.suggestion, { color: isDark ? theme.textSecondary : "#3A4A5E", fontSize: 13 }]}>
                {displayMessage}{" "}
                <Text
                  style={[styles.actionLink, { color: theme.gold }]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleNudgePress();
                  }}
                  testID="link-greeting-nudge"
                >
                  {actionText}
                </Text>
              </Text>
            ) : (
              <ThemedText type="small" style={[styles.suggestion, { color: isDark ? theme.textSecondary : "#3A4A5E", fontSize: 13 }]}>
                {displayMessage}
              </ThemedText>
            )}
          </View>
        </View>
        <View style={styles.headerActions}>
          {onMoodPress ? (
            <Animated.View style={[styles.moodButtonWrapper, moodButtonStyle]}>
              <Animated.View style={[styles.moodGlowRing, moodGlowStyle]} />
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  settleMoodAnimation();
                  onMoodPress();
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 6 }}
                style={[styles.moodButton, { backgroundColor: isDark ? 'rgba(80,201,176,0.15)' : 'rgba(80,201,176,0.12)' }]}
                testID="button-mood-checkin"
              >
                <Feather name="smile" size={20} color="#50C9B0" />
              </Pressable>
            </Animated.View>
          ) : null}
          {onSettingsPress ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleSettingsPress();
              }}
              hitSlop={{ top: 12, bottom: 12, left: 6, right: 12 }}
              style={[styles.headerActionButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              testID="button-welcome-settings"
            >
              <Feather name="settings" size={20} color={theme.gold} />
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xs,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
    paddingRight: Spacing.sm,
  },
  greetingRowLight: {
    backgroundColor: "rgba(201, 162, 39, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(201, 162, 39, 0.25)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginHorizontal: -Spacing.lg,
    marginTop: 0,
    borderRadius: BorderRadius.md,
  },
  greetingRowDark: {
    backgroundColor: "rgba(201, 162, 39, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(201, 162, 39, 0.3)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginHorizontal: -Spacing.lg,
    marginTop: 0,
    borderRadius: BorderRadius.md,
  },
  greetingContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  moodButtonWrapper: {
    position: "relative",
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  moodGlowRing: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(80,201,176,0.18)",
  },
  moodButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  greetingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  greeting: {
    letterSpacing: -0.5,
  },
  suggestionRow: {
    marginLeft: 28,
    minHeight: 34,
  },
  suggestion: {
    lineHeight: 18,
  },
  actionLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
    fontSize: 13,
    lineHeight: 18,
  },
});
