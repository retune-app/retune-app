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
import { getVoiceDisplayName } from "@shared/voiceMapping";
import { getPillarColor } from "@shared/pillars";

interface AffirmationCardProps {
  id: number;
  title: string;
  pillar?: string | null;
  category?: string;
  duration?: number;
  isFavorite?: boolean;
  createdAt?: Date | string;
  voiceType?: string;
  voiceGender?: string;
  aiVoiceId?: string;
  onPress?: () => void;
  onPlayPress?: () => void;
  onLongPress?: () => void;
  onFavoriteToggle?: () => void;
  isActive?: boolean;
  isBreathingAffirmation?: boolean;
  testID?: string;
  hapticEnabled?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AffirmationCard({
  id,
  title,
  pillar,
  category,
  duration,
  isFavorite = false,
  createdAt,
  voiceType = "ai",
  voiceGender = "female",
  aiVoiceId,
  onPress,
  onPlayPress,
  onLongPress,
  onFavoriteToggle,
  isActive = false,
  isBreathingAffirmation = false,
  testID,
  hapticEnabled = true,
}: AffirmationCardProps) {
  const { theme, isDark } = useTheme();
  const pillarColor = getPillarColor(pillar);
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

  const getLengthLabel = (seconds?: number): { label: string; color: string } => {
    if (!seconds || seconds <= 0) return { label: "", color: theme.textSecondary };
    if (seconds < 30) return { label: "Short", color: "#4CAF50" }; // Green
    if (seconds <= 60) return { label: "Med", color: theme.gold }; // Gold
    return { label: "Long", color: "#9C27B0" }; // Purple
  };

  const lengthInfo = getLengthLabel(duration);

  const getVoiceLabel = () => {
    if (voiceType === "personal") {
      return { label: "My Voice", icon: "mic" as const };
    }
    const voiceName = getVoiceDisplayName(voiceType, voiceGender, aiVoiceId);
    return { label: `AI Voice (${voiceName})`, icon: "cpu" as const };
  };

  const voiceInfo = getVoiceLabel();

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
      <View style={styles.cardWrapper}>
        {pillar ? (
          <View style={[styles.pillarAccent, { backgroundColor: pillarColor }]} />
        ) : isBreathingAffirmation ? (
          <View style={[styles.pillarAccent, { backgroundColor: theme.gold }]} />
        ) : null}
        <View style={[
          styles.card,
          Shadows.small,
          { 
            backgroundColor: theme.cardBackground,
            borderColor: isDark ? 'transparent' : theme.border,
            borderWidth: isDark ? 0 : 1,
          },
          isActive && { backgroundColor: theme.backgroundSecondary, borderColor: theme.primary, borderWidth: 2 },
          (pillar || isBreathingAffirmation) && { borderLeftWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
        ]}>
        <View style={[styles.cardHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : theme.border }]}>
          <View style={styles.ownershipBadge}>
            <Feather name={voiceInfo.icon} size={10} color={theme.gold} />
            <ThemedText style={[styles.ownershipText, { color: theme.gold }]}>
              {voiceInfo.label}
            </ThemedText>
          </View>
          <View style={styles.headerRight}>
            {lengthInfo.label ? (
              <View style={[styles.lengthBadge, { borderColor: lengthInfo.color }]}>
                <ThemedText style={[styles.lengthText, { color: lengthInfo.color }]}>
                  {lengthInfo.label}
                </ThemedText>
              </View>
            ) : null}
            <Pressable 
              onPress={(e) => {
                e.stopPropagation?.();
                if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onFavoriteToggle?.();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.favoriteButton}
            >
              <Feather 
                name={isFavorite ? "heart" : "heart"} 
                size={14} 
                color={isFavorite ? "#E91E63" : theme.textSecondary} 
                style={isFavorite ? { opacity: 1 } : { opacity: 0.5 }}
              />
            </Pressable>
            {formatCreatedDate(createdAt) ? (
              <ThemedText style={[styles.dateText, { color: theme.textSecondary }]}>
                {formatCreatedDate(createdAt)}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <ThemedText type="h4" numberOfLines={2} style={styles.title}>
              {title}
            </ThemedText>
            <View style={styles.meta}>
              {category ? (
                <View style={styles.categoriesContainer}>
                  {category.split(",").slice(0, 3).map((cat, index) => (
                    <View 
                      key={cat.trim()} 
                      style={[styles.categoryBadge, { backgroundColor: theme.backgroundSecondary, borderColor: theme.gold, borderWidth: 1 }]}
                    >
                      <ThemedText type="caption" style={{ color: theme.gold, fontSize: 10 }}>
                        {cat.trim()}
                      </ThemedText>
                    </View>
                  ))}
                  {category.split(",").length > 3 ? (
                    <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 10 }}>
                      +{category.split(",").length - 3}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}
              {isBreathingAffirmation ? (
                <View style={[styles.breathingBadge, { backgroundColor: '#2E7D6E' }]}>
                  <Feather name="wind" size={10} color="#fff" style={{ marginRight: 3 }} />
                  <ThemedText type="caption" style={{ color: '#fff', fontWeight: '600' }}>
                    Breathing
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
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  pillarAccent: {
    width: 4,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  card: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  ownershipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ownershipText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dateText: {
    fontSize: 11,
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
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  categoriesContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  breathingBadge: {
    flexDirection: "row",
    alignItems: "center",
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
  favoriteButton: {
    marginRight: Spacing.xs,
    padding: 2,
  },
  lengthBadge: {
    paddingHorizontal: 5,
    paddingVertical: 0,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  lengthText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
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
