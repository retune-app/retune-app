import React from "react";
import { StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/hooks/useTheme";

interface GradientBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "primary" | "card" | "hero";
}

export function GradientBackground({
  children,
  style,
  variant = "primary",
}: GradientBackgroundProps) {
  const { theme } = useTheme();

  const getColors = (): [string, string] => {
    switch (variant) {
      case "card":
        return theme.gradient.card as [string, string];
      case "hero":
        return theme.gradient.hero as [string, string];
      default:
        return theme.gradient.primary as [string, string];
    }
  };

  return (
    <LinearGradient
      colors={getColors()}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradient, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
});
