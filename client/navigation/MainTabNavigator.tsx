import React, { useRef } from "react";
import { View, Pressable, StyleSheet, Animated } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import BreathingStackNavigator from "@/navigation/BreathingStackNavigator";
import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { useAudio } from "@/contexts/AudioContext";
import { ThemedText } from "@/components/ThemedText";

export type MainTabParamList = {
  BreatheTab: { screen?: string; params?: { autoStart?: boolean } } | undefined;
  CreateTab: undefined;
  AffirmTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const GOLD = "#C9A227";
const GOLD_LIGHT = "#E5C95C";
const NAVY = "#0F1C3F";

function CreateTabButton({ onPress }: { onPress?: (e?: any) => void }) {
  const { theme, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 12,
      bounciness: 8,
    }).start();
  };

  const handlePress = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.createButtonContainer}
      testID="button-create-affirmation"
    >
      <View style={[styles.createButtonGlow, { backgroundColor: GOLD + "15" }]} />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={[GOLD_LIGHT, GOLD] as [string, string]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.createButton, styles.createButtonShadow]}
        >
          <Feather name="plus" size={26} color={NAVY} />
        </LinearGradient>
      </Animated.View>
      <ThemedText
        type="caption"
        style={[styles.createLabel, { color: isDark ? GOLD_LIGHT : GOLD }]}
      >
        Create
      </ThemedText>
    </Pressable>
  );
}

function EmptyComponent() {
  return null;
}

function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  return (
    <View style={styles.tabIconWrapper}>
      <Feather name={name as any} size={22} color={color} />
      {focused ? (
        <View style={[styles.activeIndicator, { backgroundColor: GOLD }]} />
      ) : null}
    </View>
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const audioContext = useAudio();

  return (
    <Tab.Navigator
      initialRouteName="BreatheTab"
      screenOptions={{
        tabBarActiveTintColor: isDark ? GOLD_LIGHT : GOLD,
        tabBarInactiveTintColor: isDark ? "rgba(255,255,255,0.4)" : "rgba(15,28,63,0.35)",
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
            default: theme.backgroundRoot,
          }),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          elevation: 0,
          height: Platform.select({ ios: 96, android: 76, default: 76 }),
          paddingBottom: Platform.select({ ios: 28, android: 10, default: 10 }),
          paddingTop: Platform.select({ ios: 6, android: 4, default: 4 }),
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
          fontFamily: "Nunito_600SemiBold",
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      <Tab.Screen
        name="BreatheTab"
        component={BreathingStackNavigator}
        options={{
          title: "Breathe",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="wind" color={color} focused={focused} />
          ),
        }}
        listeners={() => ({
          tabPress: () => {
            const { currentAffirmation, isPlaying: isAffirmationPlaying, stop } = audioContext;
            if (currentAffirmation && isAffirmationPlaying) {
              stop();
            }
          },
        })}
      />
      <Tab.Screen
        name="CreateTab"
        component={EmptyComponent}
        options={{
          tabBarButton: (props) => (
            <CreateTabButton onPress={props.onPress} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation as any).navigate("Create");
          },
        })}
      />
      <Tab.Screen
        name="AffirmTab"
        component={HomeStackNavigator}
        options={{
          title: "Believe",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="headphones" color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={ProfileStackNavigator}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: "none" },
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  createButtonContainer: {
    position: "relative",
    top: -20,
    alignItems: "center",
    justifyContent: "center",
    width: 80,
  },
  createButtonGlow: {
    position: "absolute",
    top: -4,
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  createButtonShadow: {
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  createLabel: {
    fontSize: 10,
    fontFamily: "Nunito_600SemiBold",
    marginTop: 4,
    letterSpacing: 0.3,
  },
  tabIconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    height: 30,
  },
  activeIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
});
