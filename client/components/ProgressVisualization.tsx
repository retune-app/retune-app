import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Path, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface ProgressVisualizationProps {
  totalListens: number;
  streak: number;
  weeklyActivity: number[];
  minutesListened: number;
}

export function ProgressVisualization({
  totalListens = 0,
  streak = 0,
  weeklyActivity = [0, 0, 0, 0, 0, 0, 0],
  minutesListened = 0,
}: ProgressVisualizationProps) {
  const { theme, isDark } = useTheme();
  const progressAnim = useSharedValue(0);
  const streakAnim = useSharedValue(0);
  const previousListensRef = useRef<number | null>(null);

  const getMilestoneLevel = (listens: number): string => {
    if (listens < 10) return "Seedling";
    if (listens < 25) return "Sprout";
    if (listens < 50) return "Sapling";
    if (listens < 100) return "Tree";
    if (listens < 250) return "Forest";
    return "Enlightened";
  };

  useEffect(() => {
    progressAnim.value = withDelay(
      300,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
    streakAnim.value = withDelay(
      500,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
    );

    if (previousListensRef.current !== null) {
      const prevLevel = getMilestoneLevel(previousListensRef.current);
      const newLevel = getMilestoneLevel(totalListens);
      if (prevLevel !== newLevel) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    previousListensRef.current = totalListens;
  }, [totalListens, streak]);

  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const maxActivity = Math.max(...weeklyActivity, 1);

  const getMilestone = (listens: number): { level: string; next: number; progress: number } => {
    if (listens < 10) return { level: "Seedling", next: 10, progress: listens / 10 };
    if (listens < 25) return { level: "Sprout", next: 25, progress: (listens - 10) / 15 };
    if (listens < 50) return { level: "Sapling", next: 50, progress: (listens - 25) / 25 };
    if (listens < 100) return { level: "Tree", next: 100, progress: (listens - 50) / 50 };
    if (listens < 250) return { level: "Forest", next: 250, progress: (listens - 100) / 150 };
    return { level: "Enlightened", next: 0, progress: 1 };
  };

  const milestone = getMilestone(totalListens);

  const circleProgress = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progressAnim.value, [0, 1], [0.8, 1]) }],
    opacity: progressAnim.value,
  }));

  const streakStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(streakAnim.value, [0, 1], [0, 1]) }],
    opacity: streakAnim.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.mainStats}>
        <Animated.View style={[styles.progressCircle, circleProgress]}>
          <Svg width={120} height={120} viewBox="0 0 120 120">
            <Defs>
              <SvgGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={theme.goldLight} />
                <Stop offset="100%" stopColor={theme.gold} />
              </SvgGradient>
            </Defs>
            <Circle
              cx="60"
              cy="60"
              r="52"
              stroke={theme.backgroundTertiary}
              strokeWidth="8"
              fill="transparent"
            />
            <Circle
              cx="60"
              cy="60"
              r="52"
              stroke="url(#goldGradient)"
              strokeWidth="8"
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={`${milestone.progress * 327} 327`}
              transform="rotate(-90 60 60)"
            />
          </Svg>
          <View style={styles.circleContent}>
            <ThemedText type="h2" style={styles.circleNumber}>
              {totalListens}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              listens
            </ThemedText>
          </View>
        </Animated.View>

        <View style={styles.statsColumn}>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.statHeader}>
              <Feather name="zap" size={16} color={theme.gold} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                Level
              </ThemedText>
            </View>
            <ThemedText type="h4" style={{ color: theme.gold }}>
              {milestone.level}
            </ThemedText>
            {milestone.next > 0 ? (
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {milestone.next - totalListens} to next
              </ThemedText>
            ) : null}
          </View>

          <Animated.View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }, streakStyle]}>
            <View style={styles.statHeader}>
              <Feather name="trending-up" size={16} color="#FF6B4A" />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                Streak
              </ThemedText>
            </View>
            <ThemedText type="h4" style={{ color: "#FF6B4A" }}>
              {streak} {streak === 1 ? "day" : "days"}
            </ThemedText>
          </Animated.View>
        </View>
      </View>

      <View style={[styles.weeklyCard, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText type="small" style={[styles.weeklyTitle, { color: theme.textSecondary }]}>
          This Week
        </ThemedText>
        <View style={styles.weeklyChart}>
          {weeklyActivity.map((activity, index) => {
            const height = maxActivity > 0 ? (activity / maxActivity) * 40 : 0;
            const isToday = index === new Date().getDay();
            
            return (
              <View key={index} style={styles.dayColumn}>
                <View style={styles.barContainer}>
                  <LinearGradient
                    colors={
                      isToday
                        ? [theme.goldLight, theme.gold]
                        : activity > 0
                        ? [theme.gold + "60", theme.gold + "30"]
                        : [theme.backgroundTertiary, theme.backgroundTertiary]
                    }
                    style={[
                      styles.bar,
                      {
                        height: Math.max(height, 4),
                        borderRadius: 3,
                      },
                    ]}
                  />
                </View>
                <ThemedText
                  type="caption"
                  style={{
                    color: isToday ? theme.gold : theme.textSecondary,
                    fontWeight: isToday ? "700" : "400",
                  }}
                >
                  {days[index]}
                </ThemedText>
              </View>
            );
          })}
        </View>
        <View style={styles.weeklyFooter}>
          <Feather name="clock" size={12} color={theme.textSecondary} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
            {minutesListened} min total this week
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.lg,
  },
  mainStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  progressCircle: {
    width: 120,
    height: 120,
    position: "relative",
  },
  circleContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  circleNumber: {
    marginBottom: -4,
  },
  statsColumn: {
    flex: 1,
    marginLeft: Spacing.lg,
    gap: Spacing.sm,
  },
  statCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  weeklyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  weeklyTitle: {
    marginBottom: Spacing.md,
    fontWeight: "600",
  },
  weeklyChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 60,
  },
  dayColumn: {
    alignItems: "center",
    flex: 1,
  },
  barContainer: {
    height: 44,
    justifyContent: "flex-end",
    marginBottom: Spacing.xs,
  },
  bar: {
    width: 24,
  },
  weeklyFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    justifyContent: "center",
  },
});
