import React, { useRef } from "react";
import { View, StyleSheet, Animated, Alert, Platform } from "react-native";
import { Swipeable, RectButton } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AffirmationCard } from "./AffirmationCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { Affirmation } from "@shared/schema";

interface SwipeableAffirmationCardProps {
  affirmation: Affirmation;
  onPress: () => void;
  onPlayPress: () => void;
  onLongPress?: () => void;
  onRename?: (affirmation: Affirmation) => void;
  isActive?: boolean;
  testID?: string;
  hapticEnabled?: boolean;
}

export function SwipeableAffirmationCard({
  affirmation,
  onPress,
  onPlayPress,
  onLongPress,
  onRename,
  isActive,
  testID,
  hapticEnabled = true,
}: SwipeableAffirmationCardProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const swipeableRef = useRef<Swipeable>(null);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/affirmations/${affirmation.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      if (hapticEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to delete affirmation");
    },
  });

  const handleDelete = () => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Delete Affirmation",
      `Are you sure you want to delete "${affirmation.title}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => swipeableRef.current?.close(),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const handleRename = () => {
    if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    swipeableRef.current?.close();
    if (onRename) {
      onRename(affirmation);
    }
  };

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });

    return (
      <RectButton
        style={[styles.renameButton, { backgroundColor: theme.primary }]}
        onPress={handleRename}
        testID={`button-rename-${affirmation.id}`}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Feather name="edit-2" size={24} color="#fff" />
        </Animated.View>
      </RectButton>
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });

    return (
      <RectButton
        style={[styles.deleteButton, { backgroundColor: theme.error }]}
        onPress={handleDelete}
        testID={`button-delete-${affirmation.id}`}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Feather name="trash-2" size={24} color="#fff" />
        </Animated.View>
      </RectButton>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      leftThreshold={40}
      rightThreshold={40}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      enabled={!isActive}
    >
      <AffirmationCard
        id={affirmation.id}
        title={affirmation.title}
        description={affirmation.description}
        category={affirmation.categoryName ?? undefined}
        duration={affirmation.duration ?? undefined}
        isFavorite={affirmation.isFavorite ?? false}
        createdAt={affirmation.createdAt}
        onPress={onPress}
        onPlayPress={onPlayPress}
        onLongPress={onLongPress}
        isActive={isActive}
        testID={testID}
        hapticEnabled={hapticEnabled}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  renameButton: {
    width: 80,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    marginRight: Spacing.sm,
  },
  deleteButton: {
    width: 80,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    marginLeft: Spacing.sm,
  },
});
