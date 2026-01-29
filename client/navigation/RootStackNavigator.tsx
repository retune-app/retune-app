import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { createNativeStackNavigator, NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NavigationState, useNavigation } from "@react-navigation/native";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import VoiceSetupScreen from "@/screens/VoiceSetupScreen";
import CreateScreen from "@/screens/CreateScreen";
import PlayerScreen from "@/screens/PlayerScreen";
import { AuthScreen } from "@/screens/AuthScreen";
import { MiniPlayer } from "@/components/MiniPlayer";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  VoiceSetup: undefined;
  Create: undefined;
  Player: { affirmationId: number; isNew?: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function MiniPlayerWrapper({ currentRoute }: { currentRoute: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const handleNavigateToPlayer = useCallback((affirmationId: number) => {
    navigation.navigate('Player', { affirmationId, isNew: false });
  }, [navigation]);
  
  return (
    <MiniPlayer 
      currentRoute={currentRoute} 
      onNavigateToPlayer={handleNavigateToPlayer}
    />
  );
}

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

  const handleStateChange = useCallback((state: NavigationState | undefined) => {
    if (state) {
      const route = state.routes[state.index];
      setCurrentRoute(route?.name ?? 'Main');
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
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Stack.Navigator 
        screenOptions={screenOptions}
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
          }}
        />
        <Stack.Screen
          name="Create"
          component={CreateScreen}
          options={{
            headerTitle: "Create Affirmation",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{
            headerTitle: "",
            headerTransparent: true,
          }}
        />
      </Stack.Navigator>
      <VoiceSetupNavigator />
      <MiniPlayerWrapper currentRoute={currentRoute} />
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
