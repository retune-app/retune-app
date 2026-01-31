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
  breathingSessions: number;
  breathingStreak: number;
  weeklyBreathingMinutes: number[];
  totalBreathingMinutes: number;
  affirmationsCreated?: number;
  totalListens?: number;
}

export function ProgressVisualization({
  breathingSessions = 0,
  breathingStreak = 0,
  weeklyBreathingMinutes = [0, 0, 0, 0, 0, 0, 0],
  totalBreathingMinutes = 0,
  affirmationsCreated = 0,
  totalListens = 0,
}: ProgressVisualizationProps) {
  const { theme, isDark } = useTheme();
  const progressAnim = useSharedValue(0);
  const streakAnim = useSharedValue(0);
  const previousSessionsRef = useRef<number | null>(null);

  const getMilestoneLevel = (sessions: number): string => {
    if (sessions < 7) return "Beginner";
    if (sessions < 21) return "Explorer";
    if (sessions < 50) return "Practitioner";
    if (sessions < 100) return "Devotee";
    if (sessions < 250) return "Master";
    return "Zen";
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

    if (previousSessionsRef.current !== null) {
      const prevLevel = getMilestoneLevel(previousSessionsRef.current);
      const newLevel = getMilestoneLevel(breathingSessions);
      if (prevLevel !== newLevel) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
    previousSessionsRef.current = breathingSessions;
  }, [breathingSessions, breathingStreak]);

  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const maxActivity = Math.max(...weeklyBreathingMinutes, 1);

  const getMilestone = (sessions: number): { level: string; next: number; progress: number } => {
    if (sessions < 7) return { level: "Beginner", next: 7, progress: sessions / 7 };
    if (sessions < 21) return { level: "Explorer", next: 21, progress: (sessions - 7) / 14 };
    if (sessions < 50) return { level: "Practitioner", next: 50, progress: (sessions - 21) / 29 };
    if (sessions < 100) return { level: "Devotee", next: 100, progress: (sessions - 50) / 50 };
    if (sessions < 250) return { level: "Master", next: 250, progress: (sessions - 100) / 150 };
    return { level: "Zen", next: 0, progress: 1 };
  };

  const milestone = getMilestone(breathingSessions);

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
              {breathingSessions}
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="wind" size={10} color={theme.textSecondary} style={{ marginRight: 3 }} />
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                breath sessions
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        <View style={styles.statsColumn}>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.statHeader}>
              <Feather name="wind" size={16} color={theme.gold} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                Breathing Level
              </ThemedText>
            </View>
            <ThemedText type="h4" style={{ color: theme.gold }}>
              {milestone.level}
            </ThemedText>
            {milestone.next > 0 ? (
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {milestone.next - breathingSessions} to next
              </ThemedText>
            ) : null}
          </View>

          <Animated.View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }, streakStyle]}>
            <View style={styles.statHeader}>
              <Feather name="wind" size={16} color="#FF6B4A" />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                Breathing Streak
              </ThemedText>
            </View>
            <ThemedText type="h4" style={{ color: "#FF6B4A" }}>
              {breathingStreak} {breathingStreak === 1 ? "day" : "days"}
            </ThemedText>
          </Animated.View>
        </View>
      </View>

      <View style={[styles.weeklyCard, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md }}>
          <Feather name="wind" size={14} color={theme.textSecondary} style={{ marginRight: 6, marginTop: 1 }} />
          <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
            Breathing This Week
          </ThemedText>
        </View>
        <View style={styles.weeklyChart}>
          {weeklyBreathingMinutes.map((minutes, index) => {
            const height = maxActivity > 0 ? (minutes / maxActivity) * 40 : 0;
            const isToday = index === new Date().getDay();
            
            return (
              <View key={index} style={styles.dayColumn}>
                <View style={styles.barContainer}>
                  <LinearGradient
                    colors={
                      isToday
                        ? [theme.goldLight, theme.gold]
                        : minutes > 0
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
          <Feather name="wind" size={12} color={theme.gold} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
            {totalBreathingMinutes} min
          </ThemedText>
          <View style={styles.footerDot} />
          <Feather name="headphones" size={12} color="#9C27B0" />
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
            {totalListens} listens
          </ThemedText>
          <View style={styles.footerDot} />
          <Feather name="file-plus" size={12} color={theme.textSecondary} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
            {affirmationsCreated} created
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
    flexWrap: "wrap",
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#999",
    marginHorizontal: Spacing.sm,
  },
});
