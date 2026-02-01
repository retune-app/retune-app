import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import type { Affirmation } from "@shared/schema";

interface WelcomeSectionProps {
  userName?: string;
  lastPlayedAffirmation?: Affirmation | null;
  suggestedAffirmation?: Affirmation | null;
  onQuickPlay?: () => void;
  onSuggestionPress?: () => void;
  onSettingsPress?: () => void;
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

function getSuggestedCategory(): string {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return "Confidence";
  } else if (hour >= 12 && hour < 17) {
    return "Career";
  } else if (hour >= 17 && hour < 21) {
    return "Health";
  } else {
    return "Sleep";
  }
}

export function WelcomeSection({
  userName,
  lastPlayedAffirmation,
  suggestedAffirmation,
  onQuickPlay,
  onSuggestionPress,
  onSettingsPress,
  isPlaying = false,
}: WelcomeSectionProps) {
  const { theme, isDark, setThemeMode } = useTheme();
  const pulseValue = useSharedValue(0);

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

  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(pulseValue.value, [0, 1], [0.6, 1]),
      transform: [{ scale: interpolate(pulseValue.value, [0, 1], [1, 1.02]) }],
    };
  });

  const { greeting, suggestion, icon } = useMemo(() => getTimeGreeting(), []);
  const suggestedCategory = useMemo(() => getSuggestedCategory(), []);

  const displayName = userName?.split(" ")[0] || "there";
  const hasQuickAction = lastPlayedAffirmation || suggestedAffirmation;

  const handleQuickPlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onQuickPlay?.();
  };

  const handleSettingsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSettingsPress?.();
  };

  return (
    <View style={styles.container}>
      <View style={[
        styles.greetingRow,
        isDark ? styles.greetingRowDark : styles.greetingRowLight,
      ]}>
        <View style={styles.greetingContent}>
          <View style={styles.greetingHeader}>
            <Pressable onPress={handleToggleTheme} testID="button-toggle-theme-icon">
              <Feather name={icon as any} size={20} color={theme.gold} />
            </Pressable>
            <ThemedText type="h2" style={[styles.greeting, { color: theme.text }]}>
              {greeting}, {displayName}
            </ThemedText>
          </View>
          <ThemedText type="body" style={[styles.suggestion, { color: isDark ? theme.textSecondary : "#3A4A5E" }]}>
            {suggestion}
          </ThemedText>
        </View>
        <View style={styles.headerButtons}>
          <Pressable
            onPress={handleToggleTheme}
            style={[styles.themeButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
            testID="button-toggle-theme"
          >
            <Feather name={isDark ? "sun" : "moon"} size={18} color={theme.gold} />
          </Pressable>
          {onSettingsPress ? (
            <Pressable
              onPress={handleSettingsPress}
              style={[styles.settingsButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              testID="button-welcome-settings"
            >
              <Feather name="settings" size={22} color={theme.gold} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  greetingRowLight: {
    backgroundColor: "rgba(201, 162, 39, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(201, 162, 39, 0.25)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: -Spacing.lg,
    marginTop: 0,
    borderRadius: BorderRadius.md,
  },
  greetingRowDark: {
    backgroundColor: "rgba(201, 162, 39, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(201, 162, 39, 0.3)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: -Spacing.lg,
    marginTop: 0,
    borderRadius: BorderRadius.md,
  },
  greetingContent: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  themeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  greetingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  greeting: {
    letterSpacing: -0.5,
  },
  suggestion: {
    marginLeft: 28,
  },
  quickPlayCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  quickPlayContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  quickPlayText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  quickPlayTitle: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  categoryBadge: {
    flexDirection: "row",
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
