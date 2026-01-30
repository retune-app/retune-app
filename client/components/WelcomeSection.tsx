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
  isPlaying = false,
}: WelcomeSectionProps) {
  const { theme, isDark } = useTheme();
  const pulseValue = useSharedValue(0);

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

  return (
    <View style={styles.container}>
      <View style={styles.greetingRow}>
        <View style={styles.greetingContent}>
          <View style={styles.greetingHeader}>
            <Feather name={icon as any} size={20} color={theme.gold} />
            <ThemedText type="h2" style={styles.greeting}>
              {greeting}, {displayName}
            </ThemedText>
          </View>
          <ThemedText type="body" style={[styles.suggestion, { color: theme.textSecondary }]}>
            {suggestion}
          </ThemedText>
        </View>
      </View>

      {hasQuickAction ? (
        <Animated.View style={[pulseStyle]}>
          <Pressable
            onPress={handleQuickPlay}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <LinearGradient
              colors={isDark ? [theme.navyMid, "#243656"] : [theme.gold + "15", theme.gold + "08"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.quickPlayCard,
                Shadows.small,
                { borderColor: theme.gold + "40" },
              ]}
            >
              <View style={styles.quickPlayContent}>
                <View style={styles.quickPlayText}>
                  <ThemedText type="caption" style={{ color: theme.gold }}>
                    {lastPlayedAffirmation ? "CONTINUE WHERE YOU LEFT OFF" : "SUGGESTED FOR YOU"}
                  </ThemedText>
                  <ThemedText type="h4" numberOfLines={1} style={styles.quickPlayTitle}>
                    {lastPlayedAffirmation?.title || suggestedAffirmation?.title || "Daily Affirmation"}
                  </ThemedText>
                  <View style={styles.categoryBadge}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {lastPlayedAffirmation?.categoryName || suggestedAffirmation?.categoryName || suggestedCategory}
                    </ThemedText>
                  </View>
                </View>
                <LinearGradient
                  colors={theme.gradient.primary as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playButton}
                >
                  <Feather name={isPlaying ? "pause" : "play"} size={24} color="#FFFFFF" />
                </LinearGradient>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  greetingContent: {
    flex: 1,
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
    padding: Spacing.lg,
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
