import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Animation, Shadows } from "@/constants/theme";

interface AffirmationCardProps {
  id: number;
  title: string;
  category?: string;
  duration?: number;
  isFavorite?: boolean;
  onPress?: () => void;
  onPlayPress?: () => void;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AffirmationCard({
  id,
  title,
  category,
  duration,
  isFavorite = false,
  onPress,
  onPlayPress,
  testID,
}: AffirmationCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(Animation.pressScale, {
      damping: Animation.spring.damping,
      stiffness: Animation.spring.stiffness,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: Animation.spring.damping,
      stiffness: Animation.spring.stiffness,
    });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const handlePlayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPlayPress?.();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle]}
      testID={testID}
    >
      <View style={[styles.card, Shadows.small, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <ThemedText type="h4" numberOfLines={2} style={styles.title}>
              {title}
            </ThemedText>
            <View style={styles.meta}>
              {category ? (
                <View style={[styles.categoryBadge, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {category}
                  </ThemedText>
                </View>
              ) : null}
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatDuration(duration)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.actions}>
            {isFavorite ? (
              <Feather name="heart" size={18} color={theme.accent} style={styles.favoriteIcon} />
            ) : null}
            <Pressable
              onPress={handlePlayPress}
              style={({ pressed }) => [
                styles.playButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <LinearGradient
                colors={theme.gradient.primary as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.playGradient}
              >
                <Feather name="play" size={16} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  favoriteIcon: {
    marginRight: Spacing.xs,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  playGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
