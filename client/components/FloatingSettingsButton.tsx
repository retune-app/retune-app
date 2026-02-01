import React from "react";
import { StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  useSharedValue,
  withTiming
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Shadows } from "@/constants/theme";
import { useAudio } from "@/contexts/AudioContext";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FloatingSettingsButtonProps {
  bottomOffset?: number;
  topOffset?: number;
  hideOnMiniPlayer?: boolean;
}

export function FloatingSettingsButton({ bottomOffset, topOffset, hideOnMiniPlayer = true }: FloatingSettingsButtonProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { currentAffirmation } = useAudio();
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const isMiniPlayerVisible = !!currentAffirmation;
  
  // Early return AFTER all hooks are called
  if (hideOnMiniPlayer && isMiniPlayerVisible) {
    return null;
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.9, { damping: 15 }, () => {
      scale.value = withSpring(1, { damping: 15 });
    });
    navigation.navigate("Main", { screen: "SettingsTab" } as any);
  };

  const positionStyle = topOffset !== undefined 
    ? { top: topOffset, right: 16 }
    : { bottom: bottomOffset ?? 100, right: 16 };

  const buttonStyle = [
    styles.button,
    animatedStyle,
    positionStyle,
    {
      backgroundColor: Platform.OS === "ios" ? "transparent" : theme.backgroundSecondary,
    },
    Platform.OS !== "ios" && Shadows.small,
  ];

  return (
    <AnimatedPressable
      style={buttonStyle}
      onPress={handlePress}
      testID="floating-settings-button"
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={80}
          tint={isDark ? "dark" : "light"}
          style={styles.blurContent}
        >
          <Feather name="settings" size={20} color={theme.text} />
        </BlurView>
      ) : (
        <Feather name="settings" size={20} color={theme.text} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    overflow: "hidden",
  },
  blurContent: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    overflow: "hidden",
  },
});
