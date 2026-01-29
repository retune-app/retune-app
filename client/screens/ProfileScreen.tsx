import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Switch, Alert, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTO_REPLAY_KEY = "@settings/autoReplay";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Shadows, FontFamily, FontSizes } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
}

function SettingItem({ icon, label, value, onPress, showArrow = true, rightElement }: SettingItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingItem,
        { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
      ]}
    >
      <View style={[styles.settingIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name={icon} size={20} color={theme.primary} />
      </View>
      <View style={styles.settingContent}>
        <ThemedText type="body">{label}</ThemedText>
        {value ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      {rightElement || (showArrow ? (
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      ) : null)}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("8:00 AM");
  const [autoReplayEnabled, setAutoReplayEnabled] = useState(true);

  const { data: stats } = useQuery({
    queryKey: ["/api/user/stats"],
  });

  useEffect(() => {
    AsyncStorage.getItem(AUTO_REPLAY_KEY).then((value) => {
      if (value !== null) {
        setAutoReplayEnabled(value === "true");
      }
    });
  }, []);

  const handleVoiceSetup = () => {
    navigation.navigate("VoiceSetup");
  };

  const handleToggleNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotificationsEnabled(!notificationsEnabled);
  };

  const handleToggleAutoReplay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newValue = !autoReplayEnabled;
    setAutoReplayEnabled(newValue);
    await AsyncStorage.setItem(AUTO_REPLAY_KEY, String(newValue));
  };

  const handleReminderTime = () => {
    Alert.alert("Reminder Time", "Time picker coming soon!");
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.profileHeader}>
        <LinearGradient
          colors={theme.gradient.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarGradient}
        >
          <Feather name="user" size={40} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="h2" style={styles.displayName}>
          {user?.name || "Welcome"}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {user?.email || "Rewiring your subconscious"}
        </ThemedText>
      </View>

      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText type="h2" style={{ color: theme.primary }}>
              {(stats as any)?.totalListens || 0}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Total Listens
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <ThemedText type="h2" style={{ color: theme.accent }}>
              {(stats as any)?.streak || 0}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Day Streak
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <ThemedText type="h2" style={{ color: theme.success }}>
              {(stats as any)?.affirmationsCount || 0}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Affirmations
            </ThemedText>
          </View>
        </View>
      </Card>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          VOICE
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <SettingItem
            icon="mic"
            label="Voice Sample"
            value="Re-record your voice"
            onPress={handleVoiceSetup}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          PLAYBACK
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <SettingItem
            icon="repeat"
            label="Auto-Replay"
            value={autoReplayEnabled ? "Affirmations loop automatically" : "Play once then stop"}
            showArrow={false}
            rightElement={
              <Switch
                value={autoReplayEnabled}
                onValueChange={handleToggleAutoReplay}
                trackColor={{ false: theme.border, true: theme.primary + "80" }}
                thumbColor={autoReplayEnabled ? theme.primary : theme.textSecondary}
              />
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          NOTIFICATIONS
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <SettingItem
            icon="bell"
            label="Daily Reminders"
            showArrow={false}
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: theme.border, true: theme.primary + "80" }}
                thumbColor={notificationsEnabled ? theme.primary : theme.textSecondary}
              />
            }
          />
          {notificationsEnabled ? (
            <SettingItem
              icon="clock"
              label="Reminder Time"
              value={reminderTime}
              onPress={handleReminderTime}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          ABOUT
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <SettingItem
            icon="info"
            label="About Rewired"
            onPress={() => Alert.alert(
              "About Rewired",
              "Version 1.0.0\n\nRewire your subconscious mind with personalized AI-powered audio affirmations in your own voice."
            )}
          />
          <SettingItem
            icon="shield"
            label="Security & Privacy"
            onPress={() => Alert.alert(
              "Security Measures",
              "Your data is protected by:\n\n" +
              "\u2022 Password Hashing: Passwords are encrypted using bcrypt with secure salt rounds\n\n" +
              "\u2022 Secure Sessions: Session-based authentication with HTTP-only cookies\n\n" +
              "\u2022 Data Isolation: All your affirmations and voice data are private and accessible only to you\n\n" +
              "\u2022 Voice Protection: Your cloned voice ID is stored securely and never shared\n\n" +
              "\u2022 Encrypted Storage: All sensitive data is encrypted at rest\n\n" +
              "\u2022 HTTPS: All data in transit is encrypted using TLS"
            )}
          />
          <SettingItem
            icon="help-circle"
            label="Help & Support"
            onPress={() => Alert.alert("Help", "Support documentation coming soon!")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          ACCOUNT
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <Pressable
            onPress={() => {
              Alert.alert(
                "Sign Out",
                "Are you sure you want to sign out?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      logout();
                    },
                  },
                ]
              );
            }}
            style={({ pressed }) => [
              styles.settingItem,
              { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
            ]}
            testID="button-logout"
          >
            <View style={[styles.settingIcon, { backgroundColor: "#E74C3C20" }]}>
              <Feather name="log-out" size={20} color="#E74C3C" />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.logoutText, { color: "#E74C3C" }]}>Sign Out</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  displayName: {
    marginBottom: Spacing.xs,
  },
  statsCard: {
    marginBottom: Spacing["2xl"],
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
    letterSpacing: 1,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  logoutText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSizes.md,
  },
});
