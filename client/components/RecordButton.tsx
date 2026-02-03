import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
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
  const readyGlowScale = useSharedValue(1);
  const readyGlowOpacity = useSharedValue(0);

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
      readyGlowOpacity.value = withTiming(0, { duration: 200 });
    } else {
      pulseScale.value = withTiming(1);
      pulseOpacity.value = withTiming(0.4);
      readyGlowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      readyGlowScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }
  }, [isRecording]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const readyGlowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: readyGlowScale.value }],
    opacity: readyGlowOpacity.value,
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
      {!isRecording ? (
        <Animated.View
          style={[
            styles.readyGlow,
            {
              width: size + 30,
              height: size + 30,
              borderRadius: (size + 30) / 2,
              borderColor: theme.primary,
            },
            readyGlowAnimatedStyle,
          ]}
        />
      ) : null}
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
  readyGlow: {
    position: "absolute",
    borderWidth: 2,
  },
  pulse: {
    position: "absolute",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
});
