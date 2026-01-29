import React from "react";
import { View, StyleSheet, Image, ImageSourcePropType } from "react-native";
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
    <View style={styles.container}>
      {image ? (
        <Image source={image} style={styles.image} resizeMode="contain" />
      ) : null}
      <ThemedText type="h3" style={styles.title}>
        {title}
      </ThemedText>
      {description ? (
        <ThemedText
          type="body"
          style={[styles.description, { color: theme.textSecondary }]}
        >
          {description}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="gradient" onPress={onAction} style={styles.button}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
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
