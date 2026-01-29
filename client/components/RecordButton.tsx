import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { Shadows } from "@/constants/theme";

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  size?: number;
  testID?: string;
}

export function RecordButton({
  isRecording,
  onPress,
  size = 80,
  testID,
}: RecordButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withTiming(1.4, { duration: 1000, easing: Easing.out(Easing.ease) }),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1000, easing: Easing.out(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1);
      pulseOpacity.value = withTiming(0.4);
    }
  }, [isRecording]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    Haptics.impactAsync(
      isRecording
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium
    );
    onPress();
  };

  return (
    <View style={[styles.container, { width: size + 40, height: size + 40 }]}>
      {isRecording ? (
        <Animated.View
          style={[
            styles.pulse,
            {
              width: size + 40,
              height: size + 40,
              borderRadius: (size + 40) / 2,
              backgroundColor: theme.accent,
            },
            pulseAnimatedStyle,
          ]}
        />
      ) : null}
      <Animated.View style={buttonAnimatedStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          testID={testID}
        >
          <LinearGradient
            colors={
              isRecording
                ? [theme.accent, theme.primary]
                : (theme.gradient.primary as [string, string])
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.button,
              Shadows.large,
              { width: size, height: size, borderRadius: size / 2 },
            ]}
          >
            <Feather
              name={isRecording ? "square" : "mic"}
              size={size * 0.4}
              color="#FFFFFF"
            />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
});
