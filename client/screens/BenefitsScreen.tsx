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
          <Feather name={icon as any} size={24} color={iconColor} />
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

  const sections: BenefitSectionProps[] = [
    {
      icon: "mic",
      iconColor: "#6366F1",
      iconBgColor: "#6366F120",
      title: "Your Voice, Your Power",
      subtitle: "personalized voice cloning",
      description: "When you hear affirmations in your own voice, your brain processes them differently. Research shows we're more receptive to messages that sound like our inner voice. Retune uses advanced AI to clone your voice, so every affirmation feels like it's coming from within—making positive self-talk feel natural and believable.",
    },
    {
      icon: "cpu",
      iconColor: "#C9A227",
      iconBgColor: "#C9A22720",
      title: "AI-Generated Affirmations",
      subtitle: "fresh perspectives for growth",
      description: "Our AI creates personalized affirmation scripts tailored to your specific goals. Whether you're working on confidence, abundance, health, or relationships, the AI crafts fresh perspectives and empowering statements you might not have thought of yourself—opening new pathways for manifesting your desires.",
    },
    {
      icon: "eye",
      iconColor: "#10B981",
      iconBgColor: "#10B98120",
      title: "RSVP: Deep Focus Mode",
      subtitle: "rapid serial visual presentation",
      description: "RSVP displays one word at a time, synchronized with audio playback. This powerful technique enhances your absorption of affirmations:",
      bullets: [
        "Eliminates distractions by removing peripheral text",
        "Enhances absorption by engaging both visual and auditory senses",
        "Improves focus by guiding attention to each word as it's spoken",
        "Deepens the experience by creating present-moment awareness",
      ],
    },
    {
      icon: "wind",
      iconColor: "#3B82F6",
      iconBgColor: "#3B82F620",
      title: "Guided Breathing",
      subtitle: "activate your calm",
      description: "Controlled breathing activates your parasympathetic nervous system, reducing stress and anxiety. Retune offers guided techniques like Box Breathing, 4-7-8, and Coherent Breathing—each designed to calm your mind and prepare you for deeper reflection.",
    },
    {
      icon: "repeat",
      iconColor: "#8B5CF6",
      iconBgColor: "#8B5CF620",
      title: "The Science of Repetition",
      subtitle: "neuroplasticity in action",
      description: "Neuroplasticity—your brain's ability to rewire itself—is activated through consistent repetition. By listening to affirmations regularly, you're literally building new neural pathways that support positive thinking and emotional resilience.",
    },
    {
      icon: "sun",
      iconColor: "#F59E0B",
      iconBgColor: "#F59E0B20",
      title: "Visual Design for Wellbeing",
      subtitle: "calming aesthetics",
      description: "Every visual element in Retune is crafted to support your mental wellbeing:",
      bullets: [
        "Soothing navy and gold palette reduces visual stress",
        "Gentle animations create a sense of calm flow",
        "Breathing visualizations guide natural rhythm",
        "Dark mode protects your eyes during evening sessions",
        "Minimal, clutter-free interfaces reduce cognitive load",
        "Ethereal gradients evoke serenity and possibility",
      ],
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
            <Feather name="heart" size={40} color={theme.primary} />
          </View>
          <ThemedText type="h4" style={styles.heroTitle}>Why Retune Works</ThemedText>
          <ThemedText type="small" style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Combining proven techniques from psychology, meditation, and neuroscience to help reshape your thinking patterns
          </ThemedText>
        </View>

        <View style={styles.sectionsContainer}>
          {sections.map((section, index) => (
            <BenefitSection key={index} {...section} />
          ))}
        </View>

        <View style={[styles.footerCard, { backgroundColor: theme.cardBackground }]}>
          <ThemedText type="body" style={[styles.footerTitle, { color: theme.text }]}>
            Your Journey to a Better You
          </ThemedText>
          <ThemedText type="small" style={[styles.footerText, { color: theme.textSecondary }]}>
            With consistent practice, you'll notice shifts in your thinking patterns, improved emotional resilience, and a stronger sense of self. Retune is your companion on this transformative journey.
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
    lineHeight: 20,
  },
  sectionsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
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
