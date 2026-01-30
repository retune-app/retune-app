import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Switch, Text, Modal, ActivityIndicator, ImageBackground, TextInput } from "react-native";

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

// Voice preference types
type VoiceType = "personal" | "ai";
type VoiceGender = "male" | "female";

interface VoicePreferences {
  preferredVoiceType: VoiceType;
  preferredAiGender: VoiceGender;
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
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuth();
  const { selectedMusic, setSelectedMusic, volume, setVolume } = useBackgroundMusic();

  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("8:00 AM");
  const [autoReplayEnabled, setAutoReplayEnabled] = useState(true);
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

  // Voice preferences mutation
  const updateVoicePreferences = useMutation({
    mutationFn: async (updates: { preferredVoiceType?: VoiceType; preferredAiGender?: VoiceGender }) => {
      await apiRequest("PUT", "/api/voice-preferences", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-preferences"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleVoiceTypeChange = (type: VoiceType) => {
    // Always update the preference - user can express intent even if voice not set up yet
    updateVoicePreferences.mutate({ preferredVoiceType: type });
    
    // If selecting personal voice but none is recorded, prompt to set up
    if (type === "personal" && !voicePreferences?.hasPersonalVoice) {
      navigation.navigate("VoiceSetup");
    }
  };

  const handleVoiceGenderChange = (gender: VoiceGender) => {
    updateVoicePreferences.mutate({ preferredAiGender: gender });
  };

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/custom-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-categories"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("PUT", "/api/user/name", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditingName(false);
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
    // Time picker coming soon
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  return (
    <ImageBackground
      source={isDark ? profileBackgroundDark : profileBackgroundLight}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
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
                  onBlur={handleCancelEditName}
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
              <Pressable onPress={handleEditName} testID="button-edit-name">
                <Feather name="edit-2" size={18} color={theme.primary} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <ProgressVisualization
        totalListens={(stats as any)?.totalListens || 0}
        streak={(stats as any)?.streak || 0}
        weeklyActivity={[0, 2, 1, 3, 2, 0, 1]}
        minutesListened={Math.round(((stats as any)?.totalListens || 0) * 2.5)}
      />

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          VOICE PREFERENCES
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          {/* Voice Type Selection */}
          <View style={styles.voicePreferenceSection}>
            <ThemedText type="body" style={styles.voicePreferenceLabel}>
              Default Voice
            </ThemedText>
            <View style={styles.voiceToggleContainer}>
              {/* My Voice - Left */}
              <Pressable
                onPress={() => handleVoiceTypeChange("personal")}
                style={[
                  styles.voiceToggleButton,
                  { 
                    backgroundColor: voicePreferences?.preferredVoiceType === "personal" 
                      ? theme.primary 
                      : theme.backgroundSecondary,
                    borderColor: voicePreferences?.hasPersonalVoice ? theme.primary : theme.border,
                  },
                ]}
                testID="button-voice-personal"
              >
                <Feather 
                  name="user" 
                  size={16} 
                  color={voicePreferences?.preferredVoiceType === "personal" ? "#FFFFFF" : theme.text} 
                />
                <View style={styles.voiceButtonTextContainer}>
                  <Text style={[
                    styles.voiceToggleText,
                    { color: voicePreferences?.preferredVoiceType === "personal" ? "#FFFFFF" : theme.text }
                  ]}>
                    My Voice
                  </Text>
                  {!voicePreferences?.hasPersonalVoice ? (
                    <Text style={[
                      styles.voiceNotSetupText,
                      { color: voicePreferences?.preferredVoiceType === "personal" ? "rgba(255,255,255,0.7)" : theme.textSecondary }
                    ]}>
                      (not set up)
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              {/* AI Voice - Right */}
              <Pressable
                onPress={() => handleVoiceTypeChange("ai")}
                style={[
                  styles.voiceToggleButton,
                  { 
                    backgroundColor: voicePreferences?.preferredVoiceType === "ai" || !voicePreferences?.preferredVoiceType 
                      ? theme.primary 
                      : theme.backgroundSecondary,
                    borderColor: theme.primary,
                  },
                ]}
                testID="button-voice-ai"
              >
                <Feather 
                  name="cpu" 
                  size={16} 
                  color={voicePreferences?.preferredVoiceType === "ai" || !voicePreferences?.preferredVoiceType 
                    ? "#FFFFFF" 
                    : theme.text} 
                />
                <Text style={[
                  styles.voiceToggleText,
                  { color: voicePreferences?.preferredVoiceType === "ai" || !voicePreferences?.preferredVoiceType 
                    ? "#FFFFFF" 
                    : theme.text }
                ]}>AI Voice</Text>
              </Pressable>
            </View>
          </View>

          {/* AI Gender Selection - only show when AI voice is selected */}
          {(voicePreferences?.preferredVoiceType === "ai" || !voicePreferences?.preferredVoiceType) ? (
            <View style={[styles.voicePreferenceSection, { borderTopWidth: 1, borderTopColor: theme.border }]}>
              <ThemedText type="body" style={styles.voicePreferenceLabel}>
                AI Voice Gender
              </ThemedText>
              <View style={styles.voiceToggleContainer}>
                <Pressable
                  onPress={() => handleVoiceGenderChange("female")}
                  style={[
                    styles.voiceGenderButton,
                    { 
                      backgroundColor: voicePreferences?.preferredAiGender === "female" || !voicePreferences?.preferredAiGender
                        ? theme.primary 
                        : theme.backgroundSecondary,
                      borderColor: theme.primary,
                    },
                  ]}
                  testID="button-gender-female"
                >
                  <Text style={[
                    styles.voiceToggleText,
                    { color: voicePreferences?.preferredAiGender === "female" || !voicePreferences?.preferredAiGender
                      ? "#FFFFFF" 
                      : theme.text }
                  ]}>Female</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleVoiceGenderChange("male")}
                  style={[
                    styles.voiceGenderButton,
                    { 
                      backgroundColor: voicePreferences?.preferredAiGender === "male" 
                        ? theme.primary 
                        : theme.backgroundSecondary,
                      borderColor: theme.primary,
                    },
                  ]}
                  testID="button-gender-male"
                >
                  <Text style={[
                    styles.voiceToggleText,
                    { color: voicePreferences?.preferredAiGender === "male" ? "#FFFFFF" : theme.text }
                  ]}>Male</Text>
                </Pressable>
              </View>
              <ThemedText type="caption" style={[styles.voiceGenderHint, { color: theme.textSecondary }]}>
                {voicePreferences?.preferredAiGender === "male" 
                  ? "Adam - calm, deep voice" 
                  : "Rachel - soft, warm voice"}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {/* Voice Sample Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground, marginTop: Spacing.md }, Shadows.small]}>
          <SettingItem
            icon="mic"
            label="Voice Sample"
            value={voicePreferences?.hasPersonalVoice ? "Re-record your voice" : "Record your voice for personalized affirmations"}
            onPress={handleVoiceSetup}
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
          BACKGROUND MUSIC
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          {BACKGROUND_MUSIC_OPTIONS.map((option, index) => (
            <Pressable
              key={option.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedMusic(option.id);
              }}
              style={({ pressed }) => [
                styles.settingItem,
                { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
                index < BACKGROUND_MUSIC_OPTIONS.length - 1 && styles.settingItemBorder,
                index < BACKGROUND_MUSIC_OPTIONS.length - 1 && { borderBottomColor: theme.border },
              ]}
              testID={`button-music-${option.id}`}
            >
              <View style={[styles.settingIcon, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather 
                  name={option.id === 'none' ? 'volume-x' : 'music'} 
                  size={20} 
                  color={theme.primary} 
                />
              </View>
              <View style={styles.settingContent}>
                <ThemedText type="body">{option.name}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {option.description}
                </ThemedText>
              </View>
              <View style={[
                styles.radioButton,
                { borderColor: selectedMusic === option.id ? theme.primary : theme.border },
              ]}>
                {selectedMusic === option.id ? (
                  <View style={[styles.radioButtonInner, { backgroundColor: theme.primary }]} />
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
        {selectedMusic !== 'none' ? (
          <View style={[styles.volumeContainer, { backgroundColor: theme.cardBackground }, Shadows.small]}>
            <View style={styles.volumeRow}>
              <Feather name="volume-1" size={18} color={theme.textSecondary} />
              <View style={styles.volumeSliderContainer}>
                <View 
                  style={[
                    styles.volumeTrack, 
                    { backgroundColor: theme.border }
                  ]}
                >
                  <View 
                    style={[
                      styles.volumeFill, 
                      { backgroundColor: theme.primary, width: `${volume * 100}%` }
                    ]} 
                  />
                </View>
                <Pressable
                  style={[
                    styles.volumeThumb,
                    { 
                      backgroundColor: theme.primary,
                      left: `${volume * 100}%`,
                      transform: [{ translateX: -10 }],
                    },
                  ]}
                  onPress={() => {}}
                />
              </View>
              <Feather name="volume-2" size={18} color={theme.textSecondary} />
            </View>
            <View style={styles.volumeLabels}>
              <Pressable 
                onPress={() => setVolume(Math.max(0.1, volume - 0.1))}
                style={styles.volumeButton}
              >
                <Feather name="minus" size={16} color={theme.primary} />
              </Pressable>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Volume: {Math.round(volume * 100)}%
              </ThemedText>
              <Pressable 
                onPress={() => setVolume(Math.min(1, volume + 0.1))}
                style={styles.volumeButton}
              >
                <Feather name="plus" size={16} color={theme.primary} />
              </Pressable>
            </View>
          </View>
        ) : null}
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
            label="About ReWired"
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
          DATA MANAGEMENT
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
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

      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          ACCOUNT
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
            <View style={[styles.settingIcon, { backgroundColor: "#E74C3C20" }]}>
              <Feather name="log-out" size={20} color="#E74C3C" />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.logoutText, { color: "#E74C3C" }]}>Sign Out</Text>
            </View>
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
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
            <View style={styles.securityHeader}>
              <View style={[styles.modalIconContainer, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="shield" size={32} color={theme.primary} />
              </View>
              <ThemedText type="h4" style={styles.modalTitle}>Security & Privacy</ThemedText>
            </View>
            
            <View style={styles.securitySection}>
              <ThemedText type="body" style={styles.securitySectionTitle}>Data Protection</ThemedText>
              <ThemedText type="small" style={[styles.securityText, { color: theme.textSecondary }]}>
                Your passwords are encrypted using bcrypt with secure salt rounds. All sessions use HTTP-only cookies to prevent unauthorized access.
              </ThemedText>
            </View>

            <View style={styles.securitySection}>
              <ThemedText type="body" style={styles.securitySectionTitle}>Voice Data Security</ThemedText>
              <ThemedText type="small" style={[styles.securityText, { color: theme.textSecondary }]}>
                Your voice samples and cloned voice IDs are stored securely and are never shared with third parties. Only you can access your voice data.
              </ThemedText>
            </View>

            <View style={styles.securitySection}>
              <ThemedText type="body" style={styles.securitySectionTitle}>Data Isolation</ThemedText>
              <ThemedText type="small" style={[styles.securityText, { color: theme.textSecondary }]}>
                All affirmations and personal data are private and accessible only to you. Each user's data is completely isolated from others.
              </ThemedText>
            </View>

            <View style={styles.securitySection}>
              <ThemedText type="body" style={styles.securitySectionTitle}>Encryption</ThemedText>
              <ThemedText type="small" style={[styles.securityText, { color: theme.textSecondary }]}>
                All data in transit is encrypted using TLS/HTTPS. Sensitive data at rest is encrypted for additional security.
              </ThemedText>
            </View>

            <View style={styles.securitySection}>
              <ThemedText type="body" style={styles.securitySectionTitle}>Your Control</ThemedText>
              <ThemedText type="small" style={[styles.securityText, { color: theme.textSecondary }]}>
                You can reset your data or delete your account at any time from the Data Management section. We respect your right to control your personal information.
              </ThemedText>
            </View>

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
    </ImageBackground>
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
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  securityHeader: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  securitySection: {
    marginBottom: Spacing.md,
  },
  securitySectionTitle: {
    fontFamily: "Nunito_600SemiBold",
    marginBottom: Spacing.xs,
  },
  securityText: {
    lineHeight: 20,
  },
  securityCloseButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
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
});
