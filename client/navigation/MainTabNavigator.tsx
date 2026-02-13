import React, { useState, useEffect } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BreathingStackNavigator from "@/navigation/BreathingStackNavigator";
import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { Shadows } from "@/constants/theme";
import { useAudio } from "@/contexts/AudioContext";

const FIRST_TAB_VISIT_KEY = "@navigation/firstTabVisit";

export type MainTabParamList = {
  BreatheTab: undefined;
  CreateTab: undefined;
  AffirmTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function CreateTabButton({ onPress }: { onPress?: (e?: any) => void }) {
  const { theme } = useTheme();

  const handlePress = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    onPress?.();
  };

  return (
    <Pressable onPress={handlePress} style={styles.createButtonContainer} testID="button-create-affirmation">
      <LinearGradient
        colors={["#C9A227", "#E5C95C"] as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.createButton, styles.createButtonShadow]}
      >
        <Feather name="plus" size={28} color="#0F1C3F" />
      </LinearGradient>
    </Pressable>
  );
}

function EmptyComponent() {
  return null;
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const audioContext = useAudio();
  const [initialRoute, setInitialRoute] = useState<"BreatheTab" | "AffirmTab">("BreatheTab");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FIRST_TAB_VISIT_KEY).then((value) => {
      if (value !== "done") {
        AsyncStorage.setItem(FIRST_TAB_VISIT_KEY, "done").catch(() => {});
      }
      setReady(true);
    }).catch(() => {
      setReady(true);
    });
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <Tab.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.select({ ios: 100, android: 80 }),
          paddingBottom: Platform.select({ ios: 30, android: 14 }),
          paddingTop: Platform.select({ ios: 8, android: 6 }),
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          letterSpacing: 0.5,
          fontFamily: "Poppins_600SemiBold",
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
      }}
    >
      <Tab.Screen
        name="BreatheTab"
        component={BreathingStackNavigator}
        options={{
          title: "Breathe",
          tabBarIcon: ({ color, size }) => (
            <Feather name="wind" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
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
          tabBarIcon: ({ color, size }) => (
            <Feather name="headphones" size={size} color={color} />
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
    top: -18,
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  createButtonShadow: {
    shadowColor: "#C9A227",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
});
