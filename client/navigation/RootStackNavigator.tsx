import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import VoiceSetupScreen from "@/screens/VoiceSetupScreen";
import CreateScreen from "@/screens/CreateScreen";
import PlayerScreen from "@/screens/PlayerScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RootStackParamList = {
  Main: undefined;
  VoiceSetup: undefined;
  Create: undefined;
  Player: { affirmationId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
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
  );
}
