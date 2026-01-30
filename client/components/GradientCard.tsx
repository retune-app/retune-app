import React from "react";
import { StyleSheet, Pressable, ViewStyle, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Animation, Shadows } from "@/constants/theme";

interface GradientCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  gradientColors?: [string, string];
  gradientDirection?: "horizontal" | "vertical" | "diagonal";
  variant?: "subtle" | "prominent" | "border";
  testID?: string;
}

const springConfig: WithSpringConfig = {
  damping: Animation.spring.damping,
  mass: Animation.spring.mass,
  stiffness: Animation.spring.stiffness,
  overshootClamping: Animation.spring.overshootClamping,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GradientCard({
  children,
  onPress,
  style,
  gradientColors,
  gradientDirection = "diagonal",
  variant = "subtle",
  testID,
}: GradientCardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const defaultColors: [string, string] = isDark
    ? [theme.navyMid, "#243656"]
    : [theme.cardBackground, theme.backgroundSecondary];

  const colors = gradientColors || defaultColors;

  const getGradientProps = () => {
    switch (gradientDirection) {
      case "horizontal":
        return { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };
      case "vertical":
        return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
      case "diagonal":
      default:
        return { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
    }
  };

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

  if (variant === "border") {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        testID={testID}
        style={[styles.borderCardOuter, animatedStyle, style]}
      >
        <LinearGradient
          colors={[theme.gold, theme.goldLight]}
          {...getGradientProps()}
          style={styles.borderGradient}
        >
          <View style={[styles.borderCardInner, { backgroundColor: theme.cardBackground }]}>
            {children}
          </View>
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  if (variant === "prominent") {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        testID={testID}
        style={[animatedStyle]}
      >
        <LinearGradient
          colors={[theme.gold, theme.navyMid]}
          {...getGradientProps()}
          style={[styles.prominentCard, Shadows.medium, style]}
        >
          {children}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
      testID={testID}
      style={[animatedStyle]}
    >
      <LinearGradient
        colors={colors}
        {...getGradientProps()}
        style={[styles.subtleCard, Shadows.small, style]}
      >
        {children}
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  subtleCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  prominentCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  borderCardOuter: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  borderGradient: {
    padding: 2,
    borderRadius: BorderRadius.lg,
  },
  borderCardInner: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg - 2,
  },
});
