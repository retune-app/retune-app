import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

interface BenefitSectionProps {
  icon: string;
  iconColor: string;
  iconBgColor: string;
  title: string;
  subtitle: string;
  description: string;
  bullets?: string[];
}

function BenefitSection({ icon, iconColor, iconBgColor, title, subtitle, description, bullets }: BenefitSectionProps) {
  const { theme, isDark } = useTheme();
  
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, borderColor: isDark ? "#C9A22770" : "#C9A22740" }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: iconBgColor }]}>
          <Feather name={icon as any} size={22} color={iconColor} />
        </View>
        <View style={styles.sectionTitleContainer}>
          <ThemedText type="body" style={styles.sectionTitle}>{title}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>{subtitle}</ThemedText>
        </View>
      </View>
      <View style={styles.sectionBody}>
        <ThemedText type="small" style={[styles.descriptionText, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
        {bullets && bullets.length > 0 ? (
          <View style={styles.bulletList}>
            {bullets.map((bullet, index) => (
              <View key={index} style={styles.bulletItem}>
                <View style={[styles.bulletDot, { backgroundColor: iconColor }]} />
                <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                  {bullet}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function BenefitsScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handleOpenScience = async () => {
    const baseUrl = getApiUrl();
    const scienceUrl = `${baseUrl}/science`;
    try {
      if (Platform.OS === "web") {
        Linking.openURL(scienceUrl);
      } else {
        await WebBrowser.openBrowserAsync(scienceUrl);
      }
    } catch {
      Linking.openURL(scienceUrl);
    }
  };

  const sections: BenefitSectionProps[] = [
    {
      icon: "mic",
      iconColor: "#6366F1",
      iconBgColor: "#6366F120",
      title: "Your Voice, Your Power",
      subtitle: "personalized voice cloning",
      description: "Your brain trusts your own voice more than anyone else's. Retuned clones your voice with AI so every affirmation sounds like your inner dialogue — making new beliefs feel natural, not forced.",
    },
    {
      icon: "cpu",
      iconColor: "#C9A227",
      iconBgColor: "#C9A22720",
      title: "AI-Crafted Affirmations",
      subtitle: "tailored to your goals",
      description: "Tell us what you're working on — confidence, abundance, health, relationships — and our AI writes affirmations using subconscious language patterns designed to bypass your inner critic and land deeper.",
    },
    {
      icon: "wind",
      iconColor: "#2EC4B6",
      iconBgColor: "#2EC4B620",
      title: "Breathing That Rewires",
      subtitle: "5 science-backed techniques",
      description: "Deep breathing isn't just calming — it physically shifts your nervous system from fight-or-flight to rest-and-receive. This primes your brain to absorb affirmations more effectively.",
      bullets: [
        "Activates the vagus nerve within 60 seconds",
        "Box Breathing, 4-7-8, Coherent, and more",
        "Ambient soundscapes for deeper immersion",
      ],
    },
    {
      icon: "sunrise",
      iconColor: "#7C3AED",
      iconBgColor: "#7C3AED20",
      title: "Guided Micro-Meditations",
      subtitle: "AI-generated, mood-aware",
      description: "Short guided meditations crafted by AI based on how you're feeling right now. After affirmations, meditation consolidates new thought patterns — turning fresh ideas into lasting neural pathways.",
      bullets: [
        "Tailored to your current mood and energy",
        "1, 2, or 3 minute sessions",
        "Locks in affirmations through focused reflection",
      ],
    },
    {
      icon: "eye",
      iconColor: "#10B981",
      iconBgColor: "#10B98120",
      title: "Focus Reading Mode",
      subtitle: "visual reinforcement",
      description: "Words appear one at a time, perfectly synced with the audio. This dual-channel approach — hearing and seeing simultaneously — doubles your brain's engagement and helps affirmations stick.",
    },
    {
      icon: "compass",
      iconColor: "#F59E0B",
      iconBgColor: "#F59E0B20",
      title: "Mood Journeys",
      subtitle: "personalized wellness paths",
      description: "Tell us how you're feeling and Retuned creates a custom wellness path — combining breathing, affirmations, and meditation in the right sequence for your emotional state. Each journey adapts to you.",
    },
    {
      icon: "repeat",
      iconColor: "#8B5CF6",
      iconBgColor: "#8B5CF620",
      title: "The Power of Repetition",
      subtitle: "neuroplasticity in action",
      description: "Your brain rewires through repetition. Consistent daily listening builds stronger neural pathways for positive thinking — like a mental workout that compounds over time.",
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
        <ThemedText type="h3" style={styles.headerTitle}>Benefits for Wellbeing</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 180 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroSection, { backgroundColor: theme.primary + "15" }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.primary + "30" }]}>
            <Feather name="heart" size={36} color={theme.primary} />
          </View>
          <ThemedText type="h4" style={styles.heroTitle}>Why Retuned Works</ThemedText>
          <ThemedText type="small" style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Breathe, believe, become. Science-backed tools that work together to reshape how you think and feel.
          </ThemedText>
        </View>

        <View style={styles.sectionsContainer}>
          {sections.map((section, index) => (
            <BenefitSection key={index} {...section} />
          ))}
        </View>

        <Pressable
          onPress={handleOpenScience}
          style={[styles.scienceLink, { backgroundColor: theme.cardBackground, borderColor: isDark ? "#C9A22770" : "#C9A22740" }]}
          testID="button-read-science"
        >
          <View style={[styles.scienceLinkIcon, { backgroundColor: "#3B82F620" }]}>
            <Feather name="book-open" size={20} color="#3B82F6" />
          </View>
          <View style={styles.scienceLinkText}>
            <ThemedText type="body" style={styles.sectionTitle}>Read the Full Science</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Deep dive into the research behind every feature
            </ThemedText>
          </View>
          <Feather name="external-link" size={18} color={theme.textSecondary} />
        </Pressable>

        <View style={[styles.footerCard, { backgroundColor: theme.cardBackground }]}>
          <ThemedText type="body" style={[styles.footerTitle, { color: theme.text }]}>
            Your Journey, Your Pace
          </ThemedText>
          <ThemedText type="small" style={[styles.footerText, { color: theme.textSecondary }]}>
            Each session strengthens the last. Breathing calms your mind, affirmations plant new patterns, and meditation locks them in. The more you practice, the deeper the change.
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
    width: 72,
    height: 72,
    borderRadius: 36,
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
    lineHeight: 20,
  },
  sectionsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: "#C9A22740",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    paddingLeft: 44 + Spacing.md,
  },
  descriptionText: {
    lineHeight: 20,
  },
  bulletList: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  scienceLink: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  scienceLinkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scienceLinkText: {
    flex: 1,
  },
  footerCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
  },
  footerTitle: {
    fontFamily: "Nunito_700Bold",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  footerText: {
    textAlign: "center",
    lineHeight: 20,
  },
});
