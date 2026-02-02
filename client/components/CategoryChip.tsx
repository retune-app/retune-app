import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Animation } from "@/constants/theme";

// Default gold color for selected state
const DEFAULT_COLOR = "#C9A227";

interface CategoryChipProps {
  label: string;
  isSelected?: boolean;
  onPress?: () => void;
  color?: string;
  testID?: string;
  icon?: string;
  iconOnly?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CategoryChip({
  label,
  isSelected = false,
  onPress,
  color,
  testID,
  icon,
  iconOnly = false,
}: CategoryChipProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const activeColor = color || DEFAULT_COLOR;

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

  const iconColor = isSelected ? theme.buttonText : theme.text;

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={testID}
      style={[
        styles.chip,
        {
          backgroundColor: isSelected ? activeColor : theme.backgroundSecondary,
          borderColor: isSelected ? activeColor : theme.border,
        },
        iconOnly && styles.iconOnlyChip,
        animatedStyle,
      ]}
    >
      <View style={styles.chipContent}>
        {icon ? (
          <Feather 
            name={icon as any} 
            size={iconOnly ? 18 : 14} 
            color={iconColor} 
            style={!iconOnly && styles.iconWithLabel}
          />
        ) : null}
        {!iconOnly ? (
          <ThemedText
            type="small"
            style={{
              color: isSelected ? theme.buttonText : theme.text,
              fontWeight: isSelected ? "600" : "400",
            }}
          >
            {label}
          </ThemedText>
        ) : null}
      </View>
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
  iconOnlyChip: {
    paddingHorizontal: Spacing.md,
  },
  chipContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWithLabel: {
    marginRight: Spacing.xs,
  },
});
