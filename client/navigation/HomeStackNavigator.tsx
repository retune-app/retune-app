import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type HomeStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

function BrandedTitle() {
  return (
    <View style={styles.brandContainer}>
      <Text style={styles.brandRe}>Re</Text>
      <Text style={styles.brandWired}>wired</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  brandRe: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 22,
    color: "#0F1C3F",
  },
  brandWired: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 22,
    color: "#C9A227",
  },
});

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <BrandedTitle />,
        }}
      />
    </Stack.Navigator>
  );
}
