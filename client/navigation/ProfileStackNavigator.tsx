import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import ProfileScreen from "@/screens/ProfileScreen";
import SecurityPrivacyScreen from "@/screens/SecurityPrivacyScreen";
import BenefitsScreen from "@/screens/BenefitsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";

export type ProfileStackParamList = {
  Settings: { origin?: 'BreatheTab' | 'AffirmTab' };
  SecurityPrivacy: undefined;
  Benefits: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

function SettingsCloseButton({ origin }: { origin?: 'BreatheTab' | 'AffirmTab' }) {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  
  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const targetTab = origin || 'BreatheTab';
    navigation.navigate('Main', { screen: targetTab });
  };
  
  return (
    <HeaderButton onPress={handleClose}>
      <Feather name="x" size={24} color={theme.text} />
    </HeaderButton>
  );
}

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Settings"
        component={ProfileScreen}
        options={({ route }) => ({
          title: "Settings",
          headerLeft: () => (
            <SettingsCloseButton origin={route.params?.origin} />
          ),
        })}
      />
      <Stack.Screen
        name="SecurityPrivacy"
        component={SecurityPrivacyScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Benefits"
        component={BenefitsScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
