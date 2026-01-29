import React from "react";
import { StyleSheet, Pressable, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Animation, Shadows } from "@/constants/theme";

interface CardProps {
  elevation?: number;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
}

const springConfig: WithSpringConfig = {
  damping: Animation.spring.damping,
  mass: Animation.spring.mass,
  stiffness: Animation.spring.stiffness,
  overshootClamping: Animation.spring.overshootClamping,
};

const getBackgroundColorForElevation = (
  elevation: number,
  theme: any,
): string => {
  switch (elevation) {
    case 1:
      return theme.cardBackground;
    case 2:
      return theme.backgroundSecondary;
    case 3:
      return theme.backgroundTertiary;
    default:
      return theme.backgroundDefault;
  }
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  elevation = 1,
  title,
  description,
  children,
  onPress,
  style,
  testID,
}: CardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const cardBackgroundColor = getBackgroundColorForElevation(elevation, theme);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(Animation.pressScale, springConfig);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, springConfig);
    }
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      testID={testID}
      style={[
        styles.card,
        Shadows.small,
        {
          backgroundColor: cardBackgroundColor,
        },
        animatedStyle,
        style,
      ]}
    >
      {title ? (
        <ThemedText type="h4" style={styles.cardTitle}>
          {title}
        </ThemedText>
      ) : null}
      {description ? (
        <ThemedText type="small" style={[styles.cardDescription, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
      ) : null}
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  cardTitle: {
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    opacity: 0.8,
  },
});
