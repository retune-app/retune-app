import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BreathingScreen from "@/screens/BreathingScreen";
import { useTheme } from "@/hooks/useTheme";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type BreathingStackParamList = {
  Breathing: undefined;
};

const Stack = createNativeStackNavigator<BreathingStackParamList>();

export default function BreathingStackNavigator() {
  const { theme } = useTheme();
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Breathing"
        component={BreathingScreen}
        options={{
          headerTitle: "Breathe",
        }}
      />
    </Stack.Navigator>
  );
}
