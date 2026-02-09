import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/hooks/useSubscription";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

const GOLD = "#C9A227";
const GOLD_LIGHT = "#E5C95C";
const NAVY = "#0F1C3F";

const FREE_ICONS: Record<string, string> = {
  "Breathing exercises (4 techniques)": "wind",
  "RSVP Focus Mode": "type",
  "Up to 20 AI affirmations per month": "mic",
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
  "Unlimited AI affirmations": "zap",
  "Advanced analytics & insights": "trending-up",
  "Priority support": "shield",
  "Bedtime Stories — coming soon": "moon",
  "Sleep Timer — coming soon": "clock",
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

        <View style={styles.whyPremiumSection}>
          <ThemedText type="h3" style={[styles.whyPremiumTitle, { color: theme.text }]}>
            Why Premium?
          </ThemedText>
          <ThemedText type="small" style={[styles.whyPremiumSubtitle, { color: theme.textSecondary }]}>
            Backed by neuroscience and behavioral psychology
          </ThemedText>

          <View style={styles.benefitCard}>
            <View style={[styles.benefitIcon, { backgroundColor: "#7C3AED" + "18" }]}>
              <Feather name="cpu" size={18} color="#7C3AED" />
            </View>
            <View style={styles.benefitContent}>
              <ThemedText type="body" style={[styles.benefitTitle, { color: theme.text }]}>
                Rewire Neural Pathways
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18 }}>
                Hearing affirmations in your own voice activates the brain's self-referential network, making new beliefs feel authentic and deeply personal.
              </ThemedText>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <View style={[styles.benefitIcon, { backgroundColor: "#0EA5E9" + "18" }]}>
              <Feather name="activity" size={18} color="#0EA5E9" />
            </View>
            <View style={styles.benefitContent}>
              <ThemedText type="body" style={[styles.benefitTitle, { color: theme.text }]}>
                Regulate Your Nervous System
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18 }}>
                AI-guided breathing and meditation activate your parasympathetic response, lowering cortisol and shifting you from fight-or-flight to calm focus.
              </ThemedText>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <View style={[styles.benefitIcon, { backgroundColor: GOLD + "18" }]}>
              <Feather name="target" size={18} color={GOLD} />
            </View>
            <View style={styles.benefitContent}>
              <ThemedText type="body" style={[styles.benefitTitle, { color: theme.text }]}>
                Build Lasting Habits
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18 }}>
                Personalized mood routing and smart reminders leverage the habit loop — cue, routine, reward — to make self-care feel effortless.
              </ThemedText>
            </View>
          </View>

          <View style={[styles.benefitCard, { marginBottom: 0 }]}>
            <View style={[styles.benefitIcon, { backgroundColor: "#10B981" + "18" }]}>
              <Feather name="headphones" size={18} color="#10B981" />
            </View>
            <View style={styles.benefitContent}>
              <ThemedText type="body" style={[styles.benefitTitle, { color: theme.text }]}>
                Deepen Subconscious Absorption
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18 }}>
                Ambient soundscapes and binaural beats entrain brainwaves toward alpha and theta states — where the subconscious is most receptive to change.
              </ThemedText>
            </View>
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
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
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
  whyPremiumSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  whyPremiumTitle: {
    textAlign: "center",
    marginBottom: 4,
  },
  whyPremiumSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  benefitCard: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    alignItems: "flex-start",
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm + 2,
    marginTop: 2,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 15,
    marginBottom: 2,
  },
  footerSection: {
    marginTop: Spacing.lg,
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
