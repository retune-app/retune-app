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
  isActive?: boolean;
  testID?: string;
}

export function SwipeableAffirmationCard({
  affirmation,
  onPress,
  onPlayPress,
  onLongPress,
  isActive,
  testID,
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to delete affirmation");
    },
  });

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      renderRightActions={renderRightActions}
      rightThreshold={40}
      friction={2}
      overshootRight={false}
      enabled={!isActive}
    >
      <AffirmationCard
        id={affirmation.id}
        title={affirmation.title}
        duration={affirmation.duration ?? undefined}
        isFavorite={affirmation.isFavorite ?? false}
        onPress={onPress}
        onPlayPress={onPlayPress}
        onLongPress={onLongPress}
        isActive={isActive}
        testID={testID}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  deleteButton: {
    width: 80,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    marginLeft: Spacing.sm,
  },
});
