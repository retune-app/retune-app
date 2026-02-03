import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Switch, Text, Modal, ActivityIndicator, ImageBackground, TextInput, Alert, Platform, ScrollView } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

const profileBackgroundDark = require("../../assets/images/library-background.png");
const profileBackgroundLight = require("../../assets/images/library-background-light.png");
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTO_REPLAY_KEY = "@settings/autoReplay";
const BACKGROUND_WALLPAPER_KEY = "@settings/backgroundWallpaper";
const PROGRESS_INDICATOR_KEY = "@settings/progressIndicator";

// Voice preference types
type VoiceType = "personal" | "ai";
type VoiceGender = "male" | "female";

interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

interface VoiceOptions {
  female: VoiceOption[];
  male: VoiceOption[];
}

interface VoicePreferences {
  preferredVoiceType: VoiceType;
  preferredAiGender: VoiceGender;
  preferredMaleVoiceId: string;
  preferredFemaleVoiceId: string;
  hasPersonalVoice: boolean;
}

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import ReminderSettings from "@/components/ReminderSettings";
import { ProgressVisualization } from "@/components/ProgressVisualization";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, getAuthToken } from "@/contexts/AuthContext";
import { useBackgroundMusic, BACKGROUND_MUSIC_OPTIONS, BackgroundMusicType } from "@/contexts/BackgroundMusicContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

// Use consistent gold for accent buttons regardless of theme
const ACCENT_GOLD = "#C9A227";


type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
  testID?: string;
}

function SettingItem({ icon, label, value, onPress, showArrow = true, rightElement, testID }: SettingItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingItem,
        { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
      ]}
      testID={testID}
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
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, updateUserName } = useAuth();
  const { selectedMusic, setSelectedMusic, volume, setVolume } = useBackgroundMusic();

  const queryClient = useQueryClient();
  const [autoReplayEnabled, setAutoReplayEnabled] = useState(true);
  const [backgroundWallpaperEnabled, setBackgroundWallpaperEnabled] = useState(false);
  const [progressIndicatorEnabled, setProgressIndicatorEnabled] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showClearAffirmationsModal, setShowClearAffirmationsModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [isClearingAffirmations, setIsClearingAffirmations] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const nameInputRef = useRef<TextInput>(null);
  const { data: stats } = useQuery({
    queryKey: ["/api/user/stats"],
  });

  // Usage limits query
  interface UsageLimits {
    voiceClones: { used: number; limit: number; remaining: number };
    aiAffirmations: { used: number; limit: number; remaining: number };
    hasConsentedToVoiceCloning: boolean;
  }
  const { data: usageLimits } = useQuery<UsageLimits>({
    queryKey: ["/api/user/limits"],
  });

  // Voice preferences query
  const { data: voicePreferences, isLoading: isLoadingVoicePrefs } = useQuery<VoicePreferences>({
    queryKey: ["/api/voice-preferences"],
  });

  // Available voices query
  const { data: voiceOptions } = useQuery<VoiceOptions>({
    queryKey: ["/api/voices"],
  });

  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("PUT", "/api/user/name", { name });
      return response.json();
    },
    onSuccess: (_, newName) => {
      // Update name directly in state for instant UI update
      updateUserName(newName);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      setIsEditingName(false);
      setEditedName("");
    },
    onError: (error) => {
      console.error("Failed to update name:", error);
      Alert.alert("Error", "Failed to update name. Please try again.");
    },
  });

  const handleEditName = () => {
    setEditedName(user?.name || "");
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const handleSaveName = () => {
    if (editedName.trim()) {
      updateNameMutation.mutate(editedName.trim());
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName("");
  };

  useEffect(() => {
    AsyncStorage.getItem(AUTO_REPLAY_KEY).then((value) => {
      if (value !== null) {
        setAutoReplayEnabled(value === "true");
      }
    });
    AsyncStorage.getItem(BACKGROUND_WALLPAPER_KEY).then((value) => {
      if (value !== null) {
        setBackgroundWallpaperEnabled(value === "true");
      }
    });
    AsyncStorage.getItem(PROGRESS_INDICATOR_KEY).then((value) => {
      if (value !== null) {
        setProgressIndicatorEnabled(value === "true");
      }
    });
  }, []);

  const handleVoiceSetup = () => {
    navigation.navigate("VoiceSetup");
  };

  const handleToggleAutoReplay = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Haptics not supported
    }
    const newValue = !autoReplayEnabled;
    setAutoReplayEnabled(newValue);
    await AsyncStorage.setItem(AUTO_REPLAY_KEY, String(newValue));
  };

  const handleToggleBackgroundWallpaper = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Haptics not supported
    }
    const newValue = !backgroundWallpaperEnabled;
    setBackgroundWallpaperEnabled(newValue);
    await AsyncStorage.setItem(BACKGROUND_WALLPAPER_KEY, String(newValue));
  };

  const handleToggleProgressIndicator = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Haptics not supported
    }
    const newValue = !progressIndicatorEnabled;
    setProgressIndicatorEnabled(newValue);
    await AsyncStorage.setItem(PROGRESS_INDICATOR_KEY, String(newValue));
  };

  const handleResetData = async () => {
    setIsResetting(true);
    try {
      const url = new URL("/api/user/reset", getApiUrl()).toString();
      
      const authToken = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["X-Auth-Token"] = authToken;
      }
      
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
      });
      
      if (response.ok) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
        // Invalidate queries to refresh the UI
        queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/voice-samples"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
        setShowResetModal(false);
      } else {
        const data = await response.json();
        console.error("Reset data failed:", data);
        setShowResetModal(false);
      }
    } catch (error) {
      console.error("Reset data error:", error);
      setShowResetModal(false);
    } finally {
      setIsResetting(false);
    }
  };

  const handleClearAffirmations = async () => {
    setIsClearingAffirmations(true);
    try {
      const url = new URL("/api/affirmations/clear-all", getApiUrl()).toString();
      
      const authToken = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["X-Auth-Token"] = authToken;
      }
      
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
      });
      
      if (response.ok) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
        queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
        setShowClearAffirmationsModal(false);
      } else {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (e) {}
        setShowClearAffirmationsModal(false);
      }
    } catch (error) {
      console.error("Clear affirmations error:", error);
      setShowClearAffirmationsModal(false);
    } finally {
      setIsClearingAffirmations(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const url = new URL("/api/user/account/delete", getApiUrl()).toString();
      
      const authToken = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["X-Auth-Token"] = authToken;
      }
      
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
      });
      
      if (response.ok) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
        setShowDeleteAccountModal(false);
        // Short delay to ensure modal closes before navigation
        setTimeout(() => {
          logout();
        }, 100);
      } else {
        const data = await response.json();
        console.error("Delete account failed:", data);
        setShowDeleteAccountModal(false);
      }
    } catch (error) {
      console.error("Delete account error:", error);
      setShowDeleteAccountModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenSupportModal = () => {
    setSupportEmail(user?.email || "");
    setSupportSubject("");
    setSupportMessage("");
    setSupportSuccess(false);
    setShowSupportModal(true);
  };

  const handleSubmitSupport = async () => {
    if (!supportEmail || !supportSubject || !supportMessage) {
      return;
    }
    
    setIsSubmittingSupport(true);
    try {
      const url = new URL("/api/support", getApiUrl()).toString();
      const authToken = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["X-Auth-Token"] = authToken;
      }
      
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          email: supportEmail,
          subject: supportSubject,
          message: supportMessage,
        }),
      });
      
      if (response.ok) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
        setSupportSuccess(true);
      } else {
        console.error("Support request failed");
      }
    } catch (error) {
      console.error("Support request error:", error);
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  const getCurrentVoiceLabel = () => {
    if (voicePreferences?.preferredVoiceType === "personal" && voicePreferences?.hasPersonalVoice) {
      return "Using your personal voice";
    }
    
    const gender = voicePreferences?.preferredAiGender || "female";
    const voices = gender === "male" ? voiceOptions?.male : voiceOptions?.female;
    const selectedId = gender === "male" 
      ? voicePreferences?.preferredMaleVoiceId 
      : voicePreferences?.preferredFemaleVoiceId;
    
    const selectedVoice = voices?.find(v => v.id === selectedId);
    if (selectedVoice) {
      return `${selectedVoice.name} (${gender === "male" ? "Male" : "Female"})`;
    }
    
    return "AI Voice";
  };

  const containerContent = (
    <>
      <KeyboardAwareScrollViewCompat
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + 80 + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          PROFILE
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="user" size={20} color={theme.primary} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Preferred Name
              </ThemedText>
              {isEditingName ? (
                <TextInput
                  ref={nameInputRef}
                  value={editedName}
                  onChangeText={setEditedName}
                  onSubmitEditing={handleSaveName}
                  style={[styles.nameInput, { color: theme.text, borderColor: theme.primary }]}
                  placeholder="Enter your name"
                  placeholderTextColor={theme.textSecondary}
                  autoFocus
                  testID="input-preferred-name"
                />
              ) : (
                <ThemedText type="body">{user?.name || "Not set"}</ThemedText>
              )}
            </View>
            {isEditingName ? (
              <View style={styles.nameEditButtons}>
                <Pressable onPress={handleSaveName} style={styles.nameEditButton} testID="button-save-name">
                  <Feather name="check" size={20} color={theme.primary} />
                </Pressable>
                <Pressable onPress={handleCancelEditName} style={styles.nameEditButton} testID="button-cancel-name">
                  <Feather name="x" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <Pressable 
                onPress={handleEditName} 
                testID="button-edit-name"
                style={styles.editNameButton}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Feather name="edit-2" size={18} color={theme.primary} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <ProgressVisualization
        breathingSessions={(stats as any)?.meditation?.totalSessions || 0}
        breathingStreak={(stats as any)?.meditation?.streak || 0}
        weeklyBreathingMinutes={
          (stats as any)?.meditation?.weeklyData 
            ? (stats as any).meditation.weeklyData.map((d: { minutes: number }) => d.minutes)
            : [0, 0, 0, 0, 0, 0, 0]
        }
        totalBreathingMinutes={(stats as any)?.meditation?.minutesThisWeek || 0}
        affirmationsCreated={(stats as any)?.affirmationsCount || 0}
        totalListens={(stats as any)?.totalListens || 0}
      />

      <Pressable
        onPress={() => navigation.navigate("Analytics")}
        style={[styles.analyticsButton, { borderColor: theme.gold, backgroundColor: isDark ? theme.cardBackground : "rgba(255, 255, 255, 0.95)" }]}
      >
        <Feather name="bar-chart-2" size={18} color={theme.gold} />
        <ThemedText type="body" style={[styles.analyticsButtonText, { color: theme.gold }]}>
          View Detailed Analytics
        </ThemedText>
        <Feather name="chevron-right" size={18} color={theme.gold} />
      </Pressable>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          AUDIO & VOICE
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <SettingItem
            icon="mic"
            label="Voice Settings"
            value={getCurrentVoiceLabel()}
            onPress={() => navigation.navigate("VoiceSettings")}
            testID="button-voice-settings"
          />
          <SettingItem
            icon="headphones"
            label="Sound Library"
            value={BACKGROUND_MUSIC_OPTIONS.find(o => o.id === selectedMusic)?.name || 'Rain'}
            onPress={() => navigation.navigate("SoundLibrary")}
            testID="button-sound-library"
          />
          <SettingItem
            icon="repeat"
            label="Auto-Replay"
            value={autoReplayEnabled ? "Loop continuously" : "Play once"}
            showArrow={false}
            rightElement={
              <Switch
                value={autoReplayEnabled}
                onValueChange={handleToggleAutoReplay}
                trackColor={{ false: theme.border, true: ACCENT_GOLD + "80" }}
                thumbColor={autoReplayEnabled ? ACCENT_GOLD : theme.textSecondary}
              />
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          DAILY REMINDERS
        </ThemedText>
        <ReminderSettings />
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          APPEARANCE
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <Pressable
            onPress={() => setThemeMode("light")}
            style={({ pressed }) => [
              styles.settingItem,
              { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
            ]}
            testID="button-theme-light"
          >
            <View style={[styles.settingIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="sun" size={20} color={theme.primary} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body">Light Mode</ThemedText>
            </View>
            {themeMode === "light" ? (
              <Feather name="check" size={20} color={theme.primary} />
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setThemeMode("dark")}
            style={({ pressed }) => [
              styles.settingItem,
              { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
            ]}
            testID="button-theme-dark"
          >
            <View style={[styles.settingIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="moon" size={20} color={theme.primary} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body">Dark Mode</ThemedText>
            </View>
            {themeMode === "dark" ? (
              <Feather name="check" size={20} color={theme.primary} />
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setThemeMode("system")}
            style={({ pressed }) => [
              styles.settingItem,
              { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
            ]}
            testID="button-theme-system"
          >
            <View style={[styles.settingIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="smartphone" size={20} color={theme.primary} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body">System Default</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Match device settings
              </ThemedText>
            </View>
            {themeMode === "system" ? (
              <Feather name="check" size={20} color={theme.primary} />
            ) : null}
          </Pressable>
          <SettingItem
            icon="image"
            label="Background Wallpaper"
            value={backgroundWallpaperEnabled ? "Meditation theme enabled" : "Off"}
            showArrow={false}
            rightElement={
              <Switch
                value={backgroundWallpaperEnabled}
                onValueChange={handleToggleBackgroundWallpaper}
                trackColor={{ false: theme.border, true: ACCENT_GOLD + "80" }}
                thumbColor={backgroundWallpaperEnabled ? ACCENT_GOLD : theme.textSecondary}
              />
            }
          />
          <SettingItem
            icon="activity"
            label="Progress Indicator"
            value={progressIndicatorEnabled ? "Show ring during breathing" : "Off"}
            showArrow={false}
            rightElement={
              <Switch
                value={progressIndicatorEnabled}
                onValueChange={handleToggleProgressIndicator}
                trackColor={{ false: theme.border, true: ACCENT_GOLD + "80" }}
                thumbColor={progressIndicatorEnabled ? ACCENT_GOLD : theme.textSecondary}
              />
            }
          />
        </View>
      </View>

      {/* Usage Limits Section */}
      {usageLimits ? (
        <View style={styles.section}>
          <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            USAGE LIMITS
          </ThemedText>
          <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
            <View style={styles.usageLimitItem}>
              <View style={[styles.usageLimitIcon, { backgroundColor: "#6366F120" }]}>
                <Feather name="mic" size={20} color="#6366F1" />
              </View>
              <View style={styles.usageLimitContent}>
                <ThemedText type="body">Voice Clones</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {usageLimits.voiceClones.used} of {usageLimits.voiceClones.limit} used (lifetime)
                </ThemedText>
              </View>
              <View style={[styles.usageLimitBadge, { 
                backgroundColor: usageLimits.voiceClones.remaining > 0 ? "#10B98120" : "#EF444420" 
              }]}>
                <ThemedText type="small" style={{ 
                  color: usageLimits.voiceClones.remaining > 0 ? "#10B981" : "#EF4444",
                  fontWeight: "600"
                }}>
                  {usageLimits.voiceClones.remaining} left
                </ThemedText>
              </View>
            </View>
            <View style={styles.usageLimitItem}>
              <View style={[styles.usageLimitIcon, { backgroundColor: "#C9A22720" }]}>
                <Feather name="zap" size={20} color="#C9A227" />
              </View>
              <View style={styles.usageLimitContent}>
                <ThemedText type="body">AI Affirmations</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {usageLimits.aiAffirmations.used} of {usageLimits.aiAffirmations.limit} used this month
                </ThemedText>
              </View>
              <View style={[styles.usageLimitBadge, { 
                backgroundColor: usageLimits.aiAffirmations.remaining > 0 ? "#10B98120" : "#EF444420" 
              }]}>
                <ThemedText type="small" style={{ 
                  color: usageLimits.aiAffirmations.remaining > 0 ? "#10B981" : "#EF4444",
                  fontWeight: "600"
                }}>
                  {usageLimits.aiAffirmations.remaining} left
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          SUPPORT & INFO
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <SettingItem
            icon="heart"
            label="Benefits for Wellbeing"
            onPress={() => navigation.navigate("Benefits" as never)}
          />
          <SettingItem
            icon="shield"
            label="Security & Privacy"
            onPress={() => navigation.navigate("SecurityPrivacy" as never)}
          />
          <SettingItem
            icon="help-circle"
            label="Help & Support"
            value="Get assistance"
            onPress={handleOpenSupportModal}
          />
          <SettingItem
            icon="info"
            label="About Retune"
            value="Version 1.0.0"
            showArrow={false}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          ACCOUNT ACTIONS
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <Pressable
            onPress={() => setShowLogoutModal(true)}
            style={({ pressed }) => [
              styles.settingItem,
              { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
            ]}
            testID="button-logout"
          >
            <View style={[styles.settingIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="log-out" size={20} color={theme.primary} />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body">Sign Out</ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => setShowClearAffirmationsModal(true)}
            style={({ pressed }) => [
              styles.settingItem,
              { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
            ]}
            testID="button-clear-affirmations"
          >
            <View style={[styles.settingIcon, { backgroundColor: "#9C27B020" }]}>
              <Feather name="file-minus" size={20} color="#9C27B0" />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body">Clear All Affirmations</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Remove all affirmations, keep voice
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => setShowResetModal(true)}
            style={({ pressed }) => [
              styles.settingItem,
              { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
            ]}
            testID="button-reset-data"
          >
            <View style={[styles.settingIcon, { backgroundColor: "#F5A62320" }]}>
              <Feather name="refresh-cw" size={20} color="#F5A623" />
            </View>
            <View style={styles.settingContent}>
              <ThemedText type="body">Reset All Data</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Remove all affirmations and voice samples
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => setShowDeleteAccountModal(true)}
            style={({ pressed }) => [
              styles.settingItem,
              { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
            ]}
            testID="button-delete-account"
          >
            <View style={[styles.settingIcon, { backgroundColor: "#E74C3C20" }]}>
              <Feather name="trash-2" size={20} color="#E74C3C" />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.dangerText, { color: "#E74C3C" }]}>Delete Account</Text>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Permanently remove your account
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <ThemedText type="h4" style={styles.modalTitle}>Sign Out</ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: theme.textSecondary }]}>
              Are you sure you want to sign out?
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowLogoutModal(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
                testID="button-cancel-logout"
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowLogoutModal(false);
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
                  logout();
                }}
                style={[styles.modalButton, { backgroundColor: "#E74C3C" }]}
                testID="button-confirm-logout"
              >
                <Text style={styles.confirmLogoutText}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showClearAffirmationsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearAffirmationsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: "#9C27B020" }]}>
              <Feather name="file-minus" size={32} color="#9C27B0" />
            </View>
            <ThemedText type="h4" style={styles.modalTitle}>Clear All Affirmations</ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: theme.textSecondary }]}>
              This will permanently delete all your affirmations. Your voice samples and account settings will be kept.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowClearAffirmationsModal(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
                testID="button-cancel-clear-affirmations"
                disabled={isClearingAffirmations}
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleClearAffirmations}
                style={[styles.modalButton, { backgroundColor: "#9C27B0" }]}
                testID="button-confirm-clear-affirmations"
                disabled={isClearingAffirmations}
              >
                {isClearingAffirmations ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmLogoutText}>Clear All</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: "#F5A62320" }]}>
              <Feather name="refresh-cw" size={32} color="#F5A623" />
            </View>
            <ThemedText type="h4" style={styles.modalTitle}>Reset All Data</ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: theme.textSecondary }]}>
              This will permanently delete all your affirmations and voice samples. Your account and preferences will be kept.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowResetModal(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
                testID="button-cancel-reset"
                disabled={isResetting}
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleResetData}
                style={[styles.modalButton, { backgroundColor: "#F5A623" }]}
                testID="button-confirm-reset"
                disabled={isResetting}
              >
                {isResetting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmLogoutText}>Reset Data</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteAccountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: "#E74C3C20" }]}>
              <Feather name="alert-triangle" size={32} color="#E74C3C" />
            </View>
            <ThemedText type="h4" style={styles.modalTitle}>Delete Account</ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: theme.textSecondary }]}>
              This action cannot be undone. All your data including affirmations, voice samples, and account information will be permanently deleted.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setShowDeleteAccountModal(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
                testID="button-cancel-delete"
                disabled={isDeleting}
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleDeleteAccount}
                style={[styles.modalButton, { backgroundColor: "#E74C3C" }]}
                testID="button-confirm-delete"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmLogoutText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Help & Support Modal */}
      <Modal
        visible={showSupportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSupportModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={() => setShowSupportModal(false)} 
          />
          <View style={[styles.supportModalContent, { backgroundColor: theme.cardBackground }]}>
            {supportSuccess ? (
              <>
                <View style={styles.supportHeader}>
                  <View style={[styles.modalIconContainer, { backgroundColor: "#50C9B020" }]}>
                    <Text style={{ fontSize: 32 }}>✅</Text>
                  </View>
                  <ThemedText type="h4" style={styles.modalTitle}>Request Submitted!</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
                    Thank you for reaching out. We'll get back to you at {supportEmail} as soon as possible.
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => setShowSupportModal(false)}
                  style={[styles.supportSuccessButton, { backgroundColor: theme.primary }]}
                  testID="button-close-support-success"
                >
                  <Text style={styles.confirmLogoutText}>Done</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.supportHeader}>
                  <View style={[styles.modalIconContainer, { backgroundColor: theme.primary + "20" }]}>
                    <Feather name="help-circle" size={32} color={theme.primary} />
                  </View>
                  <ThemedText type="h4" style={styles.modalTitle}>Help & Support</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
                    Send us a message and we'll get back to you
                  </ThemedText>
                </View>

                <View style={styles.supportFormField}>
                  <ThemedText type="small" style={[styles.supportLabel, { color: theme.textSecondary }]}>
                    📧 Email Address
                  </ThemedText>
                  <TextInput
                    style={[styles.supportInput, { 
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    }]}
                    value={supportEmail}
                    onChangeText={setSupportEmail}
                    placeholder="your@email.com"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    testID="input-support-email"
                  />
                </View>

                <View style={styles.supportFormField}>
                  <ThemedText type="small" style={[styles.supportLabel, { color: theme.textSecondary }]}>
                    📝 Subject
                  </ThemedText>
                  <TextInput
                    style={[styles.supportInput, { 
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    }]}
                    value={supportSubject}
                    onChangeText={setSupportSubject}
                    placeholder="What can we help with?"
                    placeholderTextColor={theme.textSecondary}
                    testID="input-support-subject"
                  />
                </View>

                <View style={styles.supportFormField}>
                  <ThemedText type="small" style={[styles.supportLabel, { color: theme.textSecondary }]}>
                    💬 Message
                  </ThemedText>
                  <TextInput
                    style={[styles.supportInput, styles.supportTextArea, { 
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    }]}
                    value={supportMessage}
                    onChangeText={setSupportMessage}
                    placeholder="Describe your question or issue..."
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    testID="input-support-message"
                  />
                </View>

                <View style={styles.supportButtonRow}>
                  <Pressable
                    onPress={() => setShowSupportModal(false)}
                    style={[styles.supportCancelButton, { borderColor: theme.border }]}
                    testID="button-cancel-support"
                  >
                    <ThemedText type="body">Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={handleSubmitSupport}
                    disabled={isSubmittingSupport || !supportEmail || !supportSubject || !supportMessage}
                    style={[
                      styles.supportSubmitButton, 
                      { 
                        backgroundColor: theme.primary,
                        opacity: (!supportEmail || !supportSubject || !supportMessage) ? 0.5 : 1,
                      }
                    ]}
                    testID="button-submit-support"
                  >
                    {isSubmittingSupport ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.confirmLogoutText}>Send Message</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </KeyboardAwareScrollViewCompat>

      {/* Top edge fade gradient */}
      <LinearGradient
        colors={isDark 
          ? ["rgba(15, 28, 63, 0.95)", "rgba(15, 28, 63, 0)"] 
          : ["rgba(255, 255, 255, 0.95)", "rgba(255, 255, 255, 0)"]}
        style={[styles.edgeFade, styles.topFade, { height: headerHeight + 20 }]}
        pointerEvents="none"
      />

      {/* Bottom edge fade gradient */}
      <LinearGradient
        colors={isDark 
          ? ["rgba(15, 28, 63, 0)", "rgba(15, 28, 63, 0.95)"] 
          : ["rgba(255, 255, 255, 0)", "rgba(255, 255, 255, 0.95)"]}
        style={[styles.edgeFade, styles.bottomFade, { height: tabBarHeight + 40 }]}
        pointerEvents="none"
      />
    </>
  );

  if (backgroundWallpaperEnabled) {
    return (
      <ImageBackground
        source={isDark ? profileBackgroundDark : profileBackgroundLight}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {containerContent}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.backgroundImage, { backgroundColor: isDark ? '#0F1C3F' : '#F8FAFB' }]}>
      {containerContent}
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  edgeFade: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  topFade: {
    top: 0,
  },
  bottomFade: {
    bottom: 0,
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
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: Spacing.lg,
  },
  displayName: {
    marginBottom: Spacing.xs,
  },
  nameInput: {
    fontSize: 16,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    minWidth: 150,
  },
  nameEditButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  nameEditButton: {
    padding: Spacing.xs,
  },
  editNameButton: {
    padding: Spacing.sm,
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
  usageLimitItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  usageLimitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  usageLimitContent: {
    flex: 1,
  },
  usageLimitBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  deleteButton: {
    padding: Spacing.sm,
  },
  logoutText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 28, 63, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  modalMessage: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmLogoutText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  dangerText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  supportModalContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  supportHeader: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  supportFormField: {
    marginBottom: Spacing.md,
  },
  supportLabel: {
    marginBottom: Spacing.xs,
    fontFamily: "Nunito_600SemiBold",
  },
  supportInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: "Nunito_400Regular",
    fontSize: 16,
  },
  supportTextArea: {
    minHeight: 100,
    paddingTop: Spacing.sm,
  },
  supportButtonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  supportCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  supportSubmitButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  supportSuccessButton: {
    width: "100%",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  settingItemBorder: {
    borderBottomWidth: 1,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  volumeContainer: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  volumeSliderContainer: {
    flex: 1,
    height: 20,
    justifyContent: "center",
    position: "relative",
  },
  volumeTrack: {
    height: 4,
    borderRadius: 2,
    width: "100%",
  },
  volumeFill: {
    height: "100%",
    borderRadius: 2,
  },
  volumeThumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    top: 0,
  },
  volumeLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    gap: Spacing.lg,
  },
  volumeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  voicePreferenceSection: {
    padding: Spacing.md,
  },
  voicePreferenceLabel: {
    marginBottom: Spacing.sm,
  },
  voiceToggleContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  voiceToggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  voiceToggleText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
  },
  voiceButtonTextContainer: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  voiceNotSetupText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 10,
    marginTop: -2,
  },
  voiceGenderButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  voiceGenderHint: {
    marginTop: Spacing.sm,
    textAlign: "center",
    fontStyle: "italic",
  },
  voiceCardsContainer: {
    gap: Spacing.sm,
  },
  voiceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  voiceCardContent: {
    flex: 1,
    gap: 2,
  },
  voiceCardNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  voiceCardCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  voicePreviewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  analyticsButtonText: {
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
});
