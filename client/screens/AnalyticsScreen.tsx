import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Text,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface MeditationStats {
  streak: number;
  bestStreak: number;
  minutesToday: number;
  minutesThisWeek: number;
  lifetimeMinutes: number;
  totalSessions: number;
  daysActive: number;
  weeklyData: { day: string; minutes: number; date: string }[];
  techniqueBreakdown: { technique: string; sessions: number; minutes: number }[];
}

interface MindfulMinutes {
  today: number;
  thisWeek: number;
  lifetime: number;
}

interface StatsData {
  totalListens: number;
  streak: number;
  bestStreak: number;
  affirmationsCount: number;
  weeklyData: { day: string; minutes: number; date: string }[];
  totalMinutesThisWeek: number;
  minutesToday: number;
  lifetimeMinutes: number;
  categoryBreakdown: { category: string; listens: number; minutes: number }[];
  totalDaysActive: number;
  meditation?: MeditationStats;
  mindfulMinutes?: MindfulMinutes;
}

export default function AnalyticsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/user/stats"],
  });

  const progressAnim = useSharedValue(0);

  React.useEffect(() => {
    progressAnim.value = withDelay(
      200,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progressAnim.value,
    transform: [{ translateY: interpolate(progressAnim.value, [0, 1], [20, 0]) }],
  }));

  const formatMinutes = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
    const icons: Record<string, keyof typeof Feather.glyphMap> = {
      Career: "briefcase",
      Health: "heart",
      Confidence: "star",
      Wealth: "dollar-sign",
      Relationships: "users",
      Sleep: "moon",
    };
    return icons[category] || "tag";
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      Career: "#4A90E2",
      Health: "#50E3C2",
      Confidence: "#C9A227",
      Wealth: "#7B61FF",
      Relationships: "#FF6B6B",
      Sleep: "#6B5B95",
    };
    return colors[category] || theme.gold;
  };

  const maxCategoryListens = Math.max(
    ...(stats?.categoryBreakdown?.map((c) => c.listens) || [1]),
    1
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={animatedStyle}>
          {/* Breathing Section - Primary Analytics */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              BREATHING TODAY
            </Text>
            
            <LinearGradient
              colors={[theme.gold + "20", theme.gold + "05"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.todayCard, { borderColor: theme.gold + "40" }]}
            >
              <View style={styles.todayContent}>
                <Feather name="wind" size={32} color={theme.gold} />
                <View style={styles.todayText}>
                  <Text style={[styles.todayMinutes, { color: theme.gold }]}>
                    {formatMinutes(stats?.meditation?.todayMinutes || 0)}
                  </Text>
                  <Text style={[styles.todayLabel, { color: theme.textSecondary }]}>
                    mindful minutes today
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              BREATHING STREAKS
            </Text>
            <View style={styles.streakRow}>
              <View style={[styles.streakCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
                <View style={[styles.streakIconContainer, { backgroundColor: theme.gold + "20" }]}>
                  <Feather name="zap" size={24} color={theme.gold} />
                </View>
                <Text style={[styles.streakNumber, { color: theme.text }]}>
                  {stats?.meditation?.streak || 0}
                </Text>
                <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>
                  Current Streak
                </Text>
              </View>

              <View style={[styles.streakCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
                <View style={[styles.streakIconContainer, { backgroundColor: "#50E3C2" + "20" }]}>
                  <Feather name="award" size={24} color="#50E3C2" />
                </View>
                <Text style={[styles.streakNumber, { color: theme.text }]}>
                  {stats?.meditation?.bestStreak || 0}
                </Text>
                <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>
                  Best Streak
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              BREATHING STATS
            </Text>
            <View style={[styles.lifetimeCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
              <View style={styles.lifetimeRow}>
                <View style={styles.lifetimeStat}>
                  <Feather name="activity" size={20} color={theme.gold} style={styles.lifetimeIcon} />
                  <ThemedText type="h3" style={styles.lifetimeNumber}>
                    {stats?.meditation?.totalSessions || 0}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Sessions
                  </ThemedText>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.lifetimeStat}>
                  <Feather name="clock" size={20} color={theme.gold} style={styles.lifetimeIcon} />
                  <ThemedText type="h3" style={styles.lifetimeNumber}>
                    {formatMinutes(stats?.meditation?.lifetimeMinutes || 0)}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Total Time
                  </ThemedText>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.lifetimeStat}>
                  <Feather name="calendar" size={20} color={theme.gold} style={styles.lifetimeIcon} />
                  <ThemedText type="h3" style={styles.lifetimeNumber}>
                    {stats?.meditation?.daysActive || 0}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Days Active
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              THIS WEEK
            </Text>
            <View style={[styles.weeklyCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
              <View style={styles.weeklyHeader}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {formatMinutes(stats?.meditation?.minutesThisWeek || 0)}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  this week
                </ThemedText>
              </View>
              <View style={styles.weeklyChart}>
                {(stats?.meditation?.weeklyData || []).map((day, index) => {
                  const maxMinutes = Math.max(...(stats?.meditation?.weeklyData?.map((d) => d.minutes) || [1]), 1);
                  const height = day.minutes > 0 ? Math.max((day.minutes / maxMinutes) * 60, 8) : 4;
                  const isToday = index === 6;
                  return (
                    <View key={day.date} style={styles.dayColumn}>
                      <View
                        style={[
                          styles.dayBar,
                          {
                            height,
                            backgroundColor: isToday ? theme.gold : theme.gold + "60",
                          },
                        ]}
                      />
                      <ThemedText
                        type="caption"
                        style={[
                          styles.dayLabel,
                          { color: isToday ? theme.gold : theme.textSecondary },
                        ]}
                      >
                        {day.day}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              TECHNIQUE BREAKDOWN
            </Text>
            <View style={[styles.categoryCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
              {(stats?.meditation?.techniqueBreakdown?.length ?? 0) > 0 ? (
                stats?.meditation?.techniqueBreakdown?.map((tech, index) => {
                  const maxSessions = Math.max(...(stats?.meditation?.techniqueBreakdown?.map((t) => t.sessions) || [1]), 1);
                  const getTechniqueLabel = (id: string) => {
                    const labels: Record<string, string> = {
                      box: "Box Breathing",
                      "478": "4-7-8 Relaxing",
                      coherent: "Coherent Breathing",
                    };
                    return labels[id] || id;
                  };
                  const getTechniqueIcon = (id: string): keyof typeof Feather.glyphMap => {
                    const icons: Record<string, keyof typeof Feather.glyphMap> = {
                      box: "square",
                      "478": "moon",
                      coherent: "heart",
                    };
                    return icons[id] || "wind";
                  };
                  return (
                    <View
                      key={tech.technique}
                      style={[
                        styles.categoryRow,
                        index < (stats?.meditation?.techniqueBreakdown?.length ?? 0) - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: theme.border,
                        },
                      ]}
                    >
                      <View style={styles.categoryLeft}>
                        <View
                          style={[
                            styles.categoryIcon,
                            { backgroundColor: theme.gold + "20" },
                          ]}
                        >
                          <Feather
                            name={getTechniqueIcon(tech.technique)}
                            size={16}
                            color={theme.gold}
                          />
                        </View>
                        <View>
                          <ThemedText type="body">{getTechniqueLabel(tech.technique)}</ThemedText>
                          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                            {tech.sessions} sessions - {formatMinutes(tech.minutes)}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.categoryRight}>
                        <View style={styles.categoryBarContainer}>
                          <View
                            style={[
                              styles.categoryBar,
                              {
                                width: `${(tech.sessions / maxSessions) * 100}%`,
                                backgroundColor: theme.gold,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyCategory}>
                  <Feather name="wind" size={32} color={theme.textSecondary} />
                  <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                    No breathing data yet
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Complete some breathing sessions to see your breakdown
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          {/* Affirmation Listening Section - Secondary Analytics */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              AFFIRMATION LISTENING
            </Text>
            
            <LinearGradient
              colors={["#9C27B0" + "20", "#9C27B0" + "05"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.todayCard, { borderColor: "#9C27B0" + "40", marginBottom: Spacing.md }]}
            >
              <View style={styles.todayContent}>
                <Feather name="headphones" size={32} color="#9C27B0" />
                <View style={styles.todayText}>
                  <Text style={[styles.todayMinutes, { color: "#9C27B0" }]}>
                    {formatMinutes(stats?.minutesToday || 0)}
                  </Text>
                  <Text style={[styles.todayLabel, { color: theme.textSecondary }]}>
                    listened today
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Affirmation Stats */}
            <View style={[styles.lifetimeCard, { backgroundColor: theme.cardBackground }, Shadows.small, { marginBottom: Spacing.md }]}>
              <View style={styles.lifetimeRow}>
                <View style={styles.lifetimeStat}>
                  <Feather name="headphones" size={20} color="#9C27B0" style={styles.lifetimeIcon} />
                  <ThemedText type="h3" style={styles.lifetimeNumber}>
                    {stats?.totalListens || 0}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Total Listens
                  </ThemedText>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.lifetimeStat}>
                  <Feather name="clock" size={20} color="#9C27B0" style={styles.lifetimeIcon} />
                  <ThemedText type="h3" style={styles.lifetimeNumber}>
                    {formatMinutes(stats?.lifetimeMinutes || 0)}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Total Time
                  </ThemedText>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.lifetimeStat}>
                  <Feather name="file-plus" size={20} color="#9C27B0" style={styles.lifetimeIcon} />
                  <ThemedText type="h3" style={styles.lifetimeNumber}>
                    {stats?.affirmationsCount || 0}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Created
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Affirmation Category Breakdown */}
            <View style={[styles.categoryCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
              <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.md }}>
                Category Breakdown
              </ThemedText>
              {(stats?.categoryBreakdown?.length ?? 0) > 0 ? (
                stats?.categoryBreakdown?.map((cat, index) => (
                  <View
                    key={cat.category}
                    style={[
                      styles.categoryRow,
                      index < (stats?.categoryBreakdown?.length ?? 0) - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.categoryLeft}>
                      <View
                        style={[
                          styles.categoryIcon,
                          { backgroundColor: getCategoryColor(cat.category) + "20" },
                        ]}
                      >
                        <Feather
                          name={getCategoryIcon(cat.category)}
                          size={16}
                          color={getCategoryColor(cat.category)}
                        />
                      </View>
                      <View>
                        <ThemedText type="body">{cat.category}</ThemedText>
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                          {cat.listens} listens
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.categoryRight}>
                      <View style={styles.categoryBarContainer}>
                        <View
                          style={[
                            styles.categoryBar,
                            {
                              width: `${(cat.listens / maxCategoryListens) * 100}%`,
                              backgroundColor: getCategoryColor(cat.category),
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyCategory}>
                  <Feather name="bar-chart-2" size={32} color={theme.textSecondary} />
                  <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                    No listening data yet
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    Complete some affirmations to see your breakdown
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    letterSpacing: 1.5,
    fontSize: 13,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  todayCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  todayContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  todayText: {
    marginLeft: Spacing.md,
  },
  todayMinutes: {
    fontSize: 32,
    fontWeight: "700" as const,
    lineHeight: 44,
  },
  todayLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  streakRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  streakCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
  },
  streakIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  streakNumber: {
    fontSize: 36,
    fontWeight: "700" as const,
    lineHeight: 48,
    marginBottom: Spacing.xs,
    textAlign: "center" as const,
  },
  streakLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center" as const,
  },
  lifetimeCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  lifetimeRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  lifetimeStat: {
    alignItems: "center",
    flex: 1,
  },
  lifetimeIcon: {
    marginBottom: Spacing.xs,
  },
  lifetimeNumber: {
    fontSize: 20,
    fontWeight: "700",
  },
  divider: {
    width: 1,
    height: 50,
  },
  weeklyCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  weeklyHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  weeklyChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 80,
  },
  dayColumn: {
    alignItems: "center",
    flex: 1,
  },
  dayBar: {
    width: 24,
    borderRadius: 4,
    marginBottom: Spacing.xs,
  },
  dayLabel: {
    fontSize: 10,
  },
  categoryCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    padding: Spacing.md,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  categoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  categoryRight: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  categoryBarContainer: {
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
  },
  categoryBar: {
    height: "100%",
    borderRadius: 4,
  },
  emptyCategory: {
    padding: Spacing.xl,
    alignItems: "center",
  },
});
