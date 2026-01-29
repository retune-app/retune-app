import React from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Animation } from "@/constants/theme";

interface CategoryChipProps {
  label: string;
  isSelected?: boolean;
  onPress?: () => void;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CategoryChip({
  label,
  isSelected = false,
  onPress,
  testID,
}: CategoryChipProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, {
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={testID}
      style={[
        styles.chip,
        {
          backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
          borderColor: isSelected ? theme.primary : theme.border,
        },
        animatedStyle,
      ]}
    >
      <ThemedText
        type="small"
        style={{
          color: isSelected ? theme.buttonText : theme.text,
          fontWeight: isSelected ? "600" : "400",
        }}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
