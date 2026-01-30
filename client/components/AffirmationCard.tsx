import React, { useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
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
  description?: string | null;
  category?: string;
  duration?: number;
  isFavorite?: boolean;
  createdAt?: Date | string;
  onPress?: () => void;
  onPlayPress?: () => void;
  onLongPress?: () => void;
  isActive?: boolean;
  testID?: string;
  hapticEnabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AffirmationCard({
  id,
  title,
  description,
  category,
  duration,
  isFavorite = false,
  createdAt,
  onPress,
  onPlayPress,
  onLongPress,
  isActive = false,
  testID,
  hapticEnabled = true,
}: AffirmationCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);
  const breathProgress = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  const formatCreatedDate = (date?: Date | string) => {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    if (isActive) {
      breathProgress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      breathProgress.value = withTiming(0, { duration: 300 });
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const playButtonAnimatedStyle = useAnimatedStyle(() => {
    const buttonScale = interpolate(breathProgress.value, [0, 1], [1, 1.1]);
    return {
      transform: [{ scale: buttonScale }],
      shadowOpacity: glowOpacity.value * 0.6,
      shadowRadius: interpolate(breathProgress.value, [0, 1], [4, 12]),
    };
  });

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
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const handlePlayPress = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
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
      onLongPress={onLongPress}
      delayLongPress={200}
      style={[animatedStyle]}
      testID={testID}
    >
      <View style={[
        styles.card,
        Shadows.small,
        { 
          backgroundColor: theme.cardBackground,
          borderColor: isDark ? 'transparent' : theme.border,
          borderWidth: isDark ? 0 : 1,
        },
        isActive && { backgroundColor: theme.backgroundSecondary, borderColor: theme.primary, borderWidth: 2 },
      ]}>
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <ThemedText type="h4" numberOfLines={2} style={styles.title}>
                {title}
              </ThemedText>
              {isFavorite ? (
                <Feather name="heart" size={14} color={theme.accent} style={styles.favoriteIcon} />
              ) : null}
            </View>
            {description ? (
              <ThemedText type="body" numberOfLines={1} style={[styles.description, { color: theme.textSecondary }]}>
                {description}
              </ThemedText>
            ) : null}
            <View style={styles.meta}>
              {category ? (
                <View style={[styles.categoryBadge, { backgroundColor: theme.backgroundSecondary, borderColor: theme.gold, borderWidth: 1 }]}>
                  <ThemedText type="caption" style={{ color: theme.gold }}>
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
            <Animated.View
              style={[
                styles.playButtonWrapper,
                { shadowColor: theme.gold },
                playButtonAnimatedStyle,
              ]}
            >
              <Pressable
                onPress={handlePlayPress}
                style={({ pressed }) => [
                  styles.playButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                testID={`button-play-${id}`}
              >
                <LinearGradient
                  colors={theme.gradient.primary as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playGradient}
                >
                  <Feather name={isActive ? "pause" : "play"} size={16} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </Animated.View>
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: 13,
    marginBottom: Spacing.sm,
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
    marginLeft: Spacing.xs,
  },
  playButtonWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
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
