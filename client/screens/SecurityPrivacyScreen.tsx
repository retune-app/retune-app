import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SecuritySectionProps {
  icon: string;
  iconColor: string;
  iconBgColor: string;
  title: string;
  subtitle: string;
  description: string;
  highlight: string;
}

function SecuritySection({ icon, iconColor, iconBgColor, title, subtitle, description, highlight }: SecuritySectionProps) {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: iconBgColor }]}>
          <Feather name={icon as any} size={24} color={iconColor} />
        </View>
        <View style={styles.sectionTitleContainer}>
          <ThemedText type="body" style={styles.sectionTitle}>{title}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{subtitle}</ThemedText>
        </View>
      </View>
      <View style={styles.sectionBody}>
        <ThemedText type="body" style={[styles.highlightText, { color: theme.primary }]}>
          {highlight}
        </ThemedText>
        <ThemedText type="small" style={[styles.descriptionText, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
      </View>
    </View>
  );
}

export default function SecurityPrivacyScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const sections: SecuritySectionProps[] = [
    {
      icon: "lock",
      iconColor: "#C9A227",
      iconBgColor: "#C9A22720",
      title: "Data Protection",
      subtitle: "passwords, sessions",
      highlight: "Your Replit PostgreSQL database",
      description: "Passwords are hashed with bcrypt before storage",
    },
    {
      icon: "mic",
      iconColor: "#6366F1",
      iconBgColor: "#6366F120",
      title: "Voice Data Security",
      subtitle: "voice samples, cloned voice IDs",
      highlight: "ElevenLabs cloud",
      description: "When users upload voice samples for cloning, ElevenLabs stores and processes them to create the cloned voice",
    },
    {
      icon: "database",
      iconColor: "#10B981",
      iconBgColor: "#10B98120",
      title: "Data Isolation",
      subtitle: "affirmations, personal data",
      highlight: "Your Replit PostgreSQL database",
      description: "All user content stays in your database",
    },
    {
      icon: "shield",
      iconColor: "#F59E0B",
      iconBgColor: "#F59E0B20",
      title: "Encryption",
      subtitle: "TLS/HTTPS",
      highlight: "Replit infrastructure",
      description: "Handles the HTTPS encryption in transit",
    },
    {
      icon: "trash-2",
      iconColor: "#EF4444",
      iconBgColor: "#EF444420",
      title: "Your Control",
      subtitle: "deletion rights",
      highlight: "Applies to both your database and ElevenLabs",
      description: "Your database (which you control) and ElevenLabs (cloned voices can be deleted via their API)",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      <LinearGradient
        colors={isDark 
          ? ["rgba(15, 28, 63, 1)", "rgba(26, 45, 79, 0.8)"] 
          : ["rgba(255, 255, 255, 1)", "rgba(248, 250, 251, 0.9)"]}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          testID="button-back"
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3" style={styles.headerTitle}>Security & Privacy</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroSection, { backgroundColor: theme.primary + "15" }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.primary + "30" }]}>
            <Feather name="shield" size={40} color={theme.primary} />
          </View>
          <ThemedText type="h4" style={styles.heroTitle}>Your data protection is our priority</ThemedText>
          <ThemedText type="small" style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Here's exactly where your data lives and how it's protected
          </ThemedText>
        </View>

        <View style={styles.sectionsContainer}>
          {sections.map((section, index) => (
            <SecuritySection key={index} {...section} />
          ))}
        </View>

        <View style={[styles.assuranceCard, { backgroundColor: theme.cardBackground }]}>
          <ThemedText type="body" style={[styles.assuranceTitle, { color: theme.text }]}>
            Our Commitment to You
          </ThemedText>
          <View style={styles.assuranceList}>
            <View style={styles.assuranceItem}>
              <ThemedText style={styles.assuranceEmoji}>🌟</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                We never sell your data to third parties
              </ThemedText>
            </View>
            <View style={styles.assuranceItem}>
              <ThemedText style={styles.assuranceEmoji}>🌟</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                You can delete all your data at any time
              </ThemedText>
            </View>
            <View style={styles.assuranceItem}>
              <ThemedText style={styles.assuranceEmoji}>🌟</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                Voice data can be removed from ElevenLabs
              </ThemedText>
            </View>
            <View style={styles.assuranceItem}>
              <ThemedText style={styles.assuranceEmoji}>🌟</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                Industry-standard security practices
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  heroSection: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  heroTitle: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    textAlign: "center",
  },
  sectionsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: "Nunito_700Bold",
  },
  sectionBody: {
    paddingLeft: 48 + Spacing.md,
  },
  highlightText: {
    fontFamily: "Nunito_700Bold",
    marginBottom: Spacing.xs,
  },
  descriptionText: {
    lineHeight: 20,
  },
  assuranceCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  assuranceTitle: {
    fontFamily: "Nunito_700Bold",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  assuranceList: {
    gap: Spacing.sm,
  },
  assuranceItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  assuranceEmoji: {
    fontSize: 16,
  },
});
