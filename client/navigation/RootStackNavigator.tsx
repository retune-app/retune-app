import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { createNativeStackNavigator, NativeStackNavigationProp, NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { NavigationState, useNavigation } from "@react-navigation/native";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import VoiceSetupScreen from "@/screens/VoiceSetupScreen";
import VoiceSettingsScreen from "@/screens/VoiceSettingsScreen";
import SoundLibraryScreen from "@/screens/SoundLibraryScreen";
import CreateScreen from "@/screens/CreateScreen";
import PlayerScreen from "@/screens/PlayerScreen";
import AnalyticsScreen from "@/screens/AnalyticsScreen";
import { AuthScreen } from "@/screens/AuthScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  VoiceSetup: undefined;
  VoiceSettings: undefined;
  SoundLibrary: undefined;
  Create: undefined;
  Player: { affirmationId: number; isNew?: boolean };
  Analytics: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();


function VoiceSetupNavigator() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { needsVoiceSetup, clearNeedsVoiceSetup } = useAuth();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (needsVoiceSetup && !hasNavigated.current) {
      hasNavigated.current = true;
      clearNeedsVoiceSetup();
      navigation.navigate('VoiceSetup');
    }
  }, [needsVoiceSetup, clearNeedsVoiceSetup, navigation]);

  return null;
}

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>('Main');

  const fadeScreenOptions: NativeStackNavigationOptions = {
    ...screenOptions,
    animation: Platform.select({
      ios: 'fade',
      android: 'fade_from_bottom',
      default: 'fade',
    }),
    animationDuration: 300,
  };

  const handleStateChange = useCallback((state: NavigationState | undefined) => {
    if (state) {
      const route = state.routes[state.index];
      // Check if we're in Main (tabs) and get the active tab name
      if (route?.name === 'Main' && route.state) {
        const tabState = route.state as NavigationState;
        const activeTab = tabState.routes[tabState.index]?.name;
        setCurrentRoute(activeTab ?? 'Main');
      } else {
        setCurrentRoute(route?.name ?? 'Main');
      }
    }
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="Auth" component={AuthScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Stack.Navigator 
        screenOptions={fadeScreenOptions}
        screenListeners={{
          state: (e) => handleStateChange(e.data.state),
        }}
      >
        <Stack.Screen
          name="Main"
          component={MainTabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VoiceSetup"
          component={VoiceSetupScreen}
          options={{
            presentation: "fullScreenModal",
            headerShown: false,
            animation: "fade",
          }}
        />
        <Stack.Screen
          name="Create"
          component={CreateScreen}
          options={{
            headerTitle: "Create Affirmation",
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{
            headerTitle: "",
            headerTransparent: true,
            animation: "fade",
            animationDuration: 250,
          }}
        />
        <Stack.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{
            headerTitle: "Analytics",
            headerBackTitle: "Settings",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="VoiceSettings"
          component={VoiceSettingsScreen}
          options={{
            headerTitle: "Voice Settings",
            headerBackTitle: "Settings",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="SoundLibrary"
          component={SoundLibraryScreen}
          options={{
            headerTitle: "Sound Library",
            headerBackTitle: "Settings",
            animation: "slide_from_right",
          }}
        />
      </Stack.Navigator>
      <VoiceSetupNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
