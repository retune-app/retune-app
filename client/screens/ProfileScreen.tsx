import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Switch, Text, Modal, ActivityIndicator, ImageBackground, TextInput, Alert, Platform } from "react-native";

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

interface CustomCategory {
  id: number;
  userId: string;
  name: string;
  createdAt: string;
}

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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const nameInputRef = useRef<TextInput>(null);
  const { data: stats } = useQuery({
    queryKey: ["/api/user/stats"],
  });

  const { data: customCategories = [] } = useQuery<CustomCategory[]>({
    queryKey: ["/api/custom-categories"],
  });

  // Voice preferences query
  const { data: voicePreferences, isLoading: isLoadingVoicePrefs } = useQuery<VoicePreferences>({
    queryKey: ["/api/voice-preferences"],
  });

  // Available voices query
  const { data: voiceOptions } = useQuery<VoiceOptions>({
    queryKey: ["/api/voices"],
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/custom-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-categories"] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    },
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

  const handleDeleteCategory = (category: CustomCategory) => {
    deleteCategoryMutation.mutate(category.id);
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

  const handleResetData = async () => {
    setIsResetting(true);
    try {
      const url = new URL("/api/user/reset", getApiUrl()).toString();
      console.log("Resetting data at:", url);
      
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
      
      console.log("Reset response status:", response.status);
      
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

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const url = new URL("/api/user/account/delete", getApiUrl()).toString();
      console.log("Deleting account at:", url);
      
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
      
      console.log("Delete response status:", response.status);
      
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
          CUSTOM CATEGORIES
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          {customCategories.length > 0 ? (
            customCategories.map((category, index) => (
              <View
                key={category.id}
                style={[
                  styles.customCategoryItem,
                  index < customCategories.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                ]}
              >
                <View style={[styles.settingIcon, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="tag" size={20} color={theme.primary} />
                </View>
                <View style={styles.settingContent}>
                  <ThemedText type="body">{category.name}</ThemedText>
                </View>
                <Pressable
                  onPress={() => handleDeleteCategory(category)}
                  style={styles.deleteButton}
                  testID={`button-delete-category-${category.id}`}
                >
                  <Feather name="x" size={18} color={theme.error} />
                </Pressable>
              </View>
            ))
          ) : (
            <View style={styles.emptyCategories}>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
                No custom categories yet.{"\n"}Add them when creating affirmations.
              </ThemedText>
            </View>
          )}
        </View>
        <ThemedText type="caption" style={[styles.categoryCount, { color: theme.textSecondary }]}>
          {customCategories.length} of 5 custom categories used
        </ThemedText>
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
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          SUPPORT & INFO
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <SettingItem
            icon="info"
            label="About Rewired"
            value="Version 1.0.0"
          />
          <SettingItem
            icon="shield"
            label="Security & Privacy"
            onPress={() => setShowSecurityModal(true)}
          />
          <SettingItem
            icon="help-circle"
            label="Help & Support"
            value="Get assistance"
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
                Clear affirmations and voice samples
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

      <Modal
        visible={showSecurityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSecurityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.securityModalContent, { backgroundColor: theme.cardBackground }]}>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.securityScrollView}>
              <View style={styles.securityHeader}>
                <View style={[styles.modalIconContainer, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="shield" size={32} color={theme.primary} />
                </View>
                <ThemedText type="h4" style={styles.modalTitle}>Security & Privacy</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
                  Your data protection is our priority
                </ThemedText>
              </View>
              
              {/* Security Sections with Icons */}
              <View style={styles.securitySection}>
                <View style={styles.securitySectionHeader}>
                  <Text style={styles.sectionEmoji}>🔐</Text>
                  <ThemedText type="body" style={styles.securitySectionTitle}>Data Protection</ThemedText>
                </View>
                <ThemedText type="small" style={[styles.securityText, { color: theme.textSecondary }]}>
                  Your passwords are encrypted using bcrypt with secure salt rounds. All sessions use HTTP-only cookies to prevent unauthorized access.
                </ThemedText>
              </View>

              <View style={styles.securitySection}>
                <View style={styles.securitySectionHeader}>
                  <Text style={styles.sectionEmoji}>🎙️</Text>
                  <ThemedText type="body" style={styles.securitySectionTitle}>Voice Data Security</ThemedText>
                </View>
                <ThemedText type="small" style={[styles.securityText, { color: theme.textSecondary }]}>
                  Your voice samples are processed by ElevenLabs for voice cloning. Only you can access and manage your cloned voices.
                </ThemedText>
              </View>

              <View style={styles.securitySection}>
                <View style={styles.securitySectionHeader}>
                  <Text style={styles.sectionEmoji}>🔒</Text>
                  <ThemedText type="body" style={styles.securitySectionTitle}>Data Isolation</ThemedText>
                </View>
                <ThemedText type="small" style={[styles.securityText, { color: theme.textSecondary }]}>
                  All affirmations and personal data are private and accessible only to you. Each user's data is completely isolated from others.
                </ThemedText>
              </View>

              <View style={styles.securitySection}>
                <View style={styles.securitySectionHeader}>
                  <Text style={styles.sectionEmoji}>🛡️</Text>
                  <ThemedText type="body" style={styles.securitySectionTitle}>Encryption</ThemedText>
                </View>
                <ThemedText type="small" style={[styles.securityText, { color: theme.textSecondary }]}>
                  All data in transit is encrypted using TLS/HTTPS. Sensitive data at rest is encrypted for additional security.
                </ThemedText>
              </View>

              <View style={styles.securitySection}>
                <View style={styles.securitySectionHeader}>
                  <Text style={styles.sectionEmoji}>⚙️</Text>
                  <ThemedText type="body" style={styles.securitySectionTitle}>Your Control</ThemedText>
                </View>
                <ThemedText type="small" style={[styles.securityText, { color: theme.textSecondary }]}>
                  You can reset your data or delete your account at any time from the Data Management section.
                </ThemedText>
              </View>

              {/* Where Your Data Lives Table */}
              <View style={[styles.dataTableContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <View style={styles.dataTableHeader}>
                  <Text style={styles.sectionEmoji}>📍</Text>
                  <ThemedText type="body" style={styles.securitySectionTitle}>Where Your Data Lives</ThemedText>
                </View>
                
                <View style={[styles.dataTableRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.dataTableCell}>
                    <Text style={styles.tableEmoji}>🔑</Text>
                    <ThemedText type="small" style={styles.tableCellTitle}>Passwords & Sessions</ThemedText>
                  </View>
                  <ThemedText type="small" style={[styles.tableCellValue, { color: theme.textSecondary }]}>
                    Rewired Database (encrypted)
                  </ThemedText>
                </View>

                <View style={[styles.dataTableRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.dataTableCell}>
                    <Text style={styles.tableEmoji}>🎤</Text>
                    <ThemedText type="small" style={styles.tableCellTitle}>Voice Clones</ThemedText>
                  </View>
                  <ThemedText type="small" style={[styles.tableCellValue, { color: theme.textSecondary }]}>
                    ElevenLabs Cloud
                  </ThemedText>
                </View>

                <View style={[styles.dataTableRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.dataTableCell}>
                    <Text style={styles.tableEmoji}>✨</Text>
                    <ThemedText type="small" style={styles.tableCellTitle}>Affirmations & Goals</ThemedText>
                  </View>
                  <ThemedText type="small" style={[styles.tableCellValue, { color: theme.textSecondary }]}>
                    Rewired Database
                  </ThemedText>
                </View>

                <View style={[styles.dataTableRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.dataTableCell}>
                    <Text style={styles.tableEmoji}>🔄</Text>
                    <ThemedText type="small" style={styles.tableCellTitle}>Data in Transit</ThemedText>
                  </View>
                  <ThemedText type="small" style={[styles.tableCellValue, { color: theme.textSecondary }]}>
                    TLS/HTTPS Encrypted
                  </ThemedText>
                </View>

                <View style={styles.dataTableRow}>
                  <View style={styles.dataTableCell}>
                    <Text style={styles.tableEmoji}>🤖</Text>
                    <ThemedText type="small" style={styles.tableCellTitle}>AI Text Generation</ThemedText>
                  </View>
                  <ThemedText type="small" style={[styles.tableCellValue, { color: theme.textSecondary }]}>
                    OpenAI (not stored)
                  </ThemedText>
                </View>
              </View>

              {/* Summary Section */}
              <View style={[styles.summaryContainer, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}>
                <View style={styles.dataTableHeader}>
                  <Text style={styles.sectionEmoji}>📋</Text>
                  <ThemedText type="body" style={styles.securitySectionTitle}>Summary</ThemedText>
                </View>
                
                <View style={styles.summaryItem}>
                  <Text style={styles.bulletEmoji}>✅</Text>
                  <ThemedText type="small" style={[styles.summaryText, { color: theme.textSecondary }]}>
                    <ThemedText type="small" style={{ fontFamily: "Nunito_700Bold" }}>You control:</ThemedText> Account, passwords, affirmations, preferences, and all personal data
                  </ThemedText>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.bulletEmoji}>🎙️</Text>
                  <ThemedText type="small" style={[styles.summaryText, { color: theme.textSecondary }]}>
                    <ThemedText type="small" style={{ fontFamily: "Nunito_700Bold" }}>ElevenLabs stores:</ThemedText> Voice samples and cloned voice models (deletable anytime)
                  </ThemedText>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.bulletEmoji}>💭</Text>
                  <ThemedText type="small" style={[styles.summaryText, { color: theme.textSecondary }]}>
                    <ThemedText type="small" style={{ fontFamily: "Nunito_700Bold" }}>OpenAI processes:</ThemedText> Affirmation text generation (not stored long-term)
                  </ThemedText>
                </View>
              </View>

              {/* Additional Assurance */}
              <View style={styles.assuranceSection}>
                <ThemedText type="small" style={[styles.assuranceText, { color: theme.textSecondary }]}>
                  🌟 We never sell your data to third parties{"\n"}
                  🌟 You can delete all your data at any time{"\n"}
                  🌟 Voice data can be removed from ElevenLabs{"\n"}
                  🌟 Industry-standard security practices
                </ThemedText>
              </View>
            </ScrollView>

            <Pressable
              onPress={() => setShowSecurityModal(false)}
              style={[styles.securityCloseButton, { backgroundColor: theme.primary }]}
              testID="button-close-security"
            >
              <Text style={styles.confirmLogoutText}>Got It</Text>
            </Pressable>
          </View>
        </View>
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
  customCategoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  deleteButton: {
    padding: Spacing.sm,
  },
  emptyCategories: {
    padding: Spacing.xl,
  },
  categoryCount: {
    textAlign: "center",
    marginTop: Spacing.sm,
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
  securityModalContent: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "85%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  securityScrollView: {
    flexGrow: 0,
  },
  securityHeader: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  securitySection: {
    marginBottom: Spacing.md,
  },
  securitySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  sectionEmoji: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  securitySectionTitle: {
    fontFamily: "Nunito_600SemiBold",
  },
  securityText: {
    lineHeight: 20,
    marginLeft: 26,
  },
  dataTableContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  dataTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  dataTableRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  dataTableCell: {
    flexDirection: "row",
    alignItems: "center",
  },
  tableEmoji: {
    fontSize: 14,
    marginRight: Spacing.sm,
  },
  tableCellTitle: {
    fontFamily: "Nunito_600SemiBold",
  },
  tableCellValue: {
    marginLeft: 22,
    marginTop: 2,
  },
  summaryContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  bulletEmoji: {
    fontSize: 14,
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  summaryText: {
    flex: 1,
    lineHeight: 20,
  },
  assuranceSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  assuranceText: {
    lineHeight: 22,
    textAlign: "center",
  },
  securityCloseButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
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
