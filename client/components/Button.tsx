import React, { ReactNode } from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp, ActivityIndicator } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Animation, Shadows } from "@/constants/theme";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "gradient";
  size?: "small" | "medium" | "large";
  testID?: string;
}

const springConfig: WithSpringConfig = {
  damping: Animation.spring.damping,
  mass: Animation.spring.mass,
  stiffness: Animation.spring.stiffness,
  overshootClamping: Animation.spring.overshootClamping,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  onPress,
  children,
  style,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "medium",
  testID,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(Animation.pressScale, springConfig);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(1, springConfig);
    }
  };

  const getBackgroundColor = () => {
    if (variant === "secondary") return theme.backgroundSecondary;
    if (variant === "ghost") return "transparent";
    return theme.primary;
  };

  const getTextColor = () => {
    if (variant === "secondary") return theme.text;
    if (variant === "ghost") return theme.primary;
    return theme.buttonText;
  };

  const getHeight = () => {
    if (size === "small") return 40;
    if (size === "large") return 60;
    return Spacing.buttonHeight;
  };

  const getPadding = () => {
    if (size === "small") return Spacing.md;
    if (size === "large") return Spacing["2xl"];
    return Spacing.lg;
  };

  const buttonContent = (
    <>
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <ThemedText
          type={size === "small" ? "small" : "body"}
          style={[styles.buttonText, { color: getTextColor() }]}
        >
          {children}
        </ThemedText>
      )}
    </>
  );

  if (variant === "gradient" && !disabled) {
    return (
      <AnimatedPressable
        onPress={disabled || loading ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[animatedStyle, style]}
        testID={testID}
      >
        <LinearGradient
          colors={theme.gradient.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.button,
            Shadows.floating,
            {
              height: getHeight(),
              paddingHorizontal: getPadding(),
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={theme.buttonText} size="small" />
          ) : (
            <ThemedText
              type={size === "small" ? "small" : "body"}
              style={[styles.buttonText, { color: theme.buttonText }]}
            >
              {children}
            </ThemedText>
          )}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={disabled || loading ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.button,
        variant !== "ghost" && Shadows.floating,
        {
          backgroundColor: getBackgroundColor(),
          height: getHeight(),
          paddingHorizontal: getPadding(),
          opacity: disabled ? 0.5 : 1,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: theme.border,
        },
        style,
        animatedStyle,
      ]}
      testID={testID}
    >
      {buttonContent}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  buttonText: {
    fontWeight: "600",
  },
});
