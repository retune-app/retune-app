import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { createNativeStackNavigator, NativeStackNavigationProp } from "@react-navigation/native-stack";
import { NavigationState, useNavigation } from "@react-navigation/native";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import VoiceSetupScreen from "@/screens/VoiceSetupScreen";
import CreateScreen from "@/screens/CreateScreen";
import PlayerScreen from "@/screens/PlayerScreen";
import { MiniPlayer } from "@/components/MiniPlayer";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RootStackParamList = {
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

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const [currentRoute, setCurrentRoute] = useState<string>('Main');

  const handleStateChange = useCallback((state: NavigationState | undefined) => {
    if (state) {
      const route = state.routes[state.index];
      setCurrentRoute(route?.name ?? 'Main');
    }
  }, []);

  return (
    <View style={styles.container}>
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
      <MiniPlayerWrapper currentRoute={currentRoute} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
