import React from "react";
import { View, StyleSheet, Image, ImageSourcePropType } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface EmptyStateProps {
  image?: ImageSourcePropType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  image,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(600)} style={styles.container}>
      {image ? (
        <Animated.View entering={FadeInUp.delay(200).duration(700).springify()}>
          <Image source={image} style={styles.image} resizeMode="contain" />
        </Animated.View>
      ) : null}
      <Animated.View entering={FadeInUp.delay(400).duration(500)}>
        <ThemedText type="h3" style={styles.title}>
          {title}
        </ThemedText>
      </Animated.View>
      {description ? (
        <Animated.View entering={FadeInUp.delay(550).duration(500)}>
          <ThemedText
            type="body"
            style={[styles.description, { color: theme.textSecondary }]}
          >
            {description}
          </ThemedText>
        </Animated.View>
      ) : null}
      {actionLabel && onAction ? (
        <Animated.View entering={FadeInUp.delay(700).duration(500)}>
          <Button variant="gradient" onPress={onAction} style={styles.button}>
            {actionLabel}
          </Button>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing["4xl"],
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: Spacing["2xl"],
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    maxWidth: 280,
  },
  button: {
    minWidth: 180,
  },
});
