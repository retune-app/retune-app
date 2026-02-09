import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/hooks/useSubscription";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

const GOLD = "#C9A227";
const GOLD_LIGHT = "#E5C95C";
const NAVY = "#0F1C3F";

const FREE_ICONS: Record<string, string> = {
  "Basic breathing exercises (4 techniques)": "wind",
  "RSVP Focus Mode": "type",
  "Up to 10 AI affirmations per month": "mic",
  "Stock AI voices (Lotus & Sage)": "volume-2",
  "Ambient sound library": "headphones",
  "Daily reminders (up to 5)": "bell",
  "Basic listening analytics": "bar-chart-2",
};

const PREMIUM_ICONS: Record<string, string> = {
  "AI Mindful Moment - personalized wellness": "smile",
  "Micro-Meditations - AI meditation audio": "sun",
  "Inner Voice - personal voice cloning": "user",
  "Exclusive ambient tracks": "music",
  "Unlimited AI affirmations": "infinity",
  "Advanced analytics & insights": "trending-up",
  "Priority support": "shield",
  "Bedtime Stories — coming soon": "moon",
};

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { tier, isPremium, betaMode, freeFeatures, premiumFeatures } = useSubscription();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]} testID="screen-plans">
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.lg,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {betaMode ? (
          <View style={[styles.betaBadge, { backgroundColor: theme.success + "18", borderColor: theme.success + "40" }]}>
            <Feather name="zap" size={14} color={theme.success} />
            <ThemedText type="small" style={{ color: theme.success, marginLeft: Spacing.sm, fontFamily: "Nunito_600SemiBold" }}>
              Beta Access — All features unlocked
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.tierCard}>
          <View style={[
            styles.tierHeader,
            { backgroundColor: isDark ? theme.backgroundSecondary : theme.backgroundDefault }
          ]}>
            <View style={styles.tierTitleRow}>
              <View style={[styles.tierDot, { backgroundColor: theme.textSecondary }]} />
              <ThemedText type="h3" style={{ color: theme.text }}>
                Free
              </ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
              Get started on your journey
            </ThemedText>
          </View>
          <View style={[
            styles.tierBody,
            {
              backgroundColor: isDark ? theme.cardBackground : theme.backgroundDefault,
              borderColor: theme.border,
            }
          ]}>
            {freeFeatures.map((feature, index) => (
              <View
                key={index}
                style={[
                  styles.featureRow,
                  index < freeFeatures.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border } : null,
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: theme.success + "15" }]}>
                  <Feather
                    name={(FREE_ICONS[feature] || "check") as any}
                    size={14}
                    color={theme.success}
                  />
                </View>
                <ThemedText type="body" style={[styles.featureText, { color: theme.text }]}>
                  {feature}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.tierCard, styles.premiumTierCard]}>
          <LinearGradient
            colors={isDark ? [GOLD + "25", GOLD + "10"] : [GOLD + "18", GOLD + "08"]}
            style={[styles.premiumGlow]}
          />
          <View style={styles.tierHeader}>
            <LinearGradient
              colors={[GOLD, GOLD_LIGHT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.premiumHeaderGradient}
            >
              <View style={styles.tierTitleRow}>
                <Feather name="award" size={18} color="#FFFFFF" />
                <ThemedText type="h3" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                  Premium
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
                Unlock your full potential
              </ThemedText>
            </LinearGradient>
          </View>
          <View style={[
            styles.tierBody,
            styles.premiumTierBody,
            {
              backgroundColor: isDark ? theme.cardBackground : theme.backgroundDefault,
              borderColor: GOLD + "30",
            }
          ]}>
            {premiumFeatures.map((feature, index) => (
              <View
                key={index}
                style={[
                  styles.featureRow,
                  index < premiumFeatures.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? theme.border : GOLD + "15" } : null,
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: GOLD + "18" }]}>
                  <Feather
                    name={(PREMIUM_ICONS[feature] || "check") as any}
                    size={14}
                    color={GOLD}
                  />
                </View>
                <ThemedText type="body" style={[styles.featureText, { color: theme.text, flex: 1 }]}>
                  {feature}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={[
          styles.footerSection,
          { borderTopColor: theme.border }
        ]}>
          <ThemedText type="caption" style={[styles.footerNote, { color: theme.textSecondary }]}>
            All premium features are currently available during beta
          </ThemedText>
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <LinearGradient
              colors={[GOLD_LIGHT, GOLD]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Feather name="clock" size={16} color={NAVY} />
              <ThemedText type="body" style={styles.ctaText}>
                Pricing Coming Soon
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>

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
  betaBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.xl,
    alignSelf: "center",
  },
  tierCard: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  premiumTierCard: {
    position: "relative",
  },
  premiumGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BorderRadius.lg,
  },
  tierHeader: {
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
  },
  premiumHeaderGradient: {
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    marginVertical: -(Spacing.md + 2),
    marginHorizontal: -Spacing.lg,
  },
  tierTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  tierBody: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  premiumTierBody: {
    borderTopWidth: 0,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.xs,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm + 2,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
  },
  footerSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaButton: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    ...Shadows.small,
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    gap: Spacing.sm,
  },
  ctaText: {
    color: NAVY,
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
  },
  footerNote: {
    textAlign: "center",
  },
});
