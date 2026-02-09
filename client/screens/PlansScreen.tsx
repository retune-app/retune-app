import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription } from "@/hooks/useSubscription";
import { Spacing, BorderRadius } from "@/constants/theme";

const ACCENT_GOLD = "#C9A227";

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { tier, isPremium, betaMode, freeFeatures, premiumFeatures } = useSubscription();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]} testID="screen-plans">
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerArea}>
          <View style={[styles.crownCircle, { backgroundColor: ACCENT_GOLD + "1A" }]}>
            <Feather name="star" size={32} color={ACCENT_GOLD} />
          </View>
          <ThemedText type="h2" style={styles.headerTitle}>
            Your Plan
          </ThemedText>
        </View>

        <View style={[styles.planBadge, { backgroundColor: ACCENT_GOLD + "1A", borderColor: ACCENT_GOLD + "40" }]}>
          <ThemedText type="h3" style={{ color: ACCENT_GOLD }}>
            {tier === "premium" ? "Premium" : "Free"}
          </ThemedText>
          {betaMode ? (
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              (Beta - All features unlocked)
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            Free Features
          </ThemedText>
          <Card style={styles.featureCard}>
            {freeFeatures.map((feature, index) => (
              <View key={index} style={[styles.featureRow, index < freeFeatures.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border } : null]}>
                <Feather name="check" size={18} color={theme.primary} style={styles.featureIcon} />
                <ThemedText type="body" style={styles.featureText}>
                  {feature}
                </ThemedText>
              </View>
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
            Premium Features
          </ThemedText>
          <Card style={styles.featureCard}>
            {premiumFeatures.map((feature, index) => (
              <View key={index} style={[styles.featureRow, index < premiumFeatures.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border } : null]}>
                <Feather name="check" size={18} color={ACCENT_GOLD} style={styles.featureIcon} />
                <ThemedText type="body" style={[styles.featureText, { flex: 1 }]}>
                  {feature}
                </ThemedText>
                <Feather name="lock" size={14} color={ACCENT_GOLD} />
              </View>
            ))}
          </Card>
        </View>

        <View style={[styles.banner, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Feather name="clock" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
            Subscription pricing coming soon
          </ThemedText>
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
  headerArea: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  crownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    textAlign: "center",
  },
  planBadge: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  featureCard: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
  },
  featureIcon: {
    marginRight: Spacing.sm,
  },
  featureText: {
    flex: 1,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
});
