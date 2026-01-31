import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Shadows } from "@/constants/theme";

const ACCENT_GOLD = "#C9A227";

interface BreathingProgress {
  totalMinutes: number;
  totalSeconds: number;
  sessionCount: number;
  dateKey: string;
  goalMinutes: number;
}

interface DailyGoalProgressProps {
  compact?: boolean;
  onPress?: () => void;
}

export function DailyGoalProgress({ compact = false, onPress }: DailyGoalProgressProps) {
  const { theme } = useTheme();

  const { data: progress } = useQuery<BreathingProgress>({
    queryKey: ["/api/breathing-sessions/today"],
    refetchInterval: 30000,
  });

  const { data: streakData } = useQuery<{ streak: number; lastActiveDate: string | null }>({
    queryKey: ["/api/breathing-sessions/streak"],
    refetchInterval: 60000,
  });

  const totalMinutes = progress?.totalMinutes ?? 0;
  const goalMinutes = progress?.goalMinutes ?? 5;
  const percentage = Math.min((totalMinutes / goalMinutes) * 100, 100);
  const streak = streakData?.streak ?? 0;

  const size = compact ? 60 : 100;
  const strokeWidth = compact ? 4 : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  if (compact) {
    return (
      <Pressable 
        onPress={onPress}
        style={[styles.compactContainer, { backgroundColor: theme.cardBackground }, Shadows.small]}
      >
        <View style={styles.compactRingContainer}>
          <Svg width={size} height={size} style={styles.svg}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.backgroundSecondary}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={ACCENT_GOLD}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={styles.compactRingCenter}>
            <ThemedText type="small" style={styles.compactMinutes}>
              {totalMinutes}
            </ThemedText>
          </View>
        </View>
        {streak > 0 ? (
          <View style={styles.compactStreak}>
            <Feather name="zap" size={12} color={ACCENT_GOLD} />
            <ThemedText type="caption" style={{ color: ACCENT_GOLD }}>
              {streak}
            </ThemedText>
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground }, Shadows.medium]}>
      <View style={styles.content}>
        <View style={styles.ringContainer}>
          <Svg width={size} height={size} style={styles.svg}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.backgroundSecondary}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={ACCENT_GOLD}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <ThemedText type="h3" style={styles.minutes}>
              {totalMinutes}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              / {goalMinutes} min
            </ThemedText>
          </View>
        </View>

        <View style={styles.details}>
          <ThemedText type="body" style={{ fontWeight: "600" }}>
            Daily Goal
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {percentage >= 100 ? "Goal achieved!" : `${Math.round(percentage)}% complete`}
          </ThemedText>
          
          {streak > 0 ? (
            <View style={styles.streakBadge}>
              <Feather name="zap" size={14} color={ACCENT_GOLD} />
              <ThemedText type="small" style={{ color: ACCENT_GOLD, fontWeight: "600" }}>
                {streak} day streak
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  ringContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  svg: {
    transform: [{ rotateZ: "0deg" }],
  },
  ringCenter: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  minutes: {
    fontSize: 24,
    fontWeight: "700",
    color: ACCENT_GOLD,
    lineHeight: 28,
  },
  details: {
    flex: 1,
    gap: Spacing.xs,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  compactContainer: {
    borderRadius: 12,
    padding: Spacing.sm,
    alignItems: "center",
    minWidth: 80,
  },
  compactRingContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  compactRingCenter: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  compactMinutes: {
    fontSize: 16,
    fontWeight: "700",
    color: ACCENT_GOLD,
  },
  compactStreak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: Spacing.xs,
  },
});
