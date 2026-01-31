import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Text, ActivityIndicator, ScrollView, Alert } from "react-native";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { getAuthToken } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const ACCENT_GOLD = "#C9A227";

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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function VoiceSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPersonalPreviewPlaying, setIsPersonalPreviewPlaying] = useState(false);
  const [isPersonalPreviewLoading, setIsPersonalPreviewLoading] = useState(false);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  const { data: voicePreferences, isLoading: isLoadingVoicePrefs } = useQuery<VoicePreferences>({
    queryKey: ["/api/voice-preferences"],
  });

  const { data: voiceOptions } = useQuery<VoiceOptions>({
    queryKey: ["/api/voices"],
  });

  const updateVoicePreferences = useMutation({
    mutationFn: async (updates: { 
      preferredVoiceType?: VoiceType; 
      preferredAiGender?: VoiceGender;
      preferredMaleVoiceId?: string;
      preferredFemaleVoiceId?: string;
    }) => {
      await apiRequest("PUT", "/api/voice-preferences", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-preferences"] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    },
  });

  const handleVoiceTypeChange = (type: VoiceType) => {
    updateVoicePreferences.mutate({ preferredVoiceType: type });
    
    if (type === "personal" && !voicePreferences?.hasPersonalVoice) {
      navigation.navigate("VoiceSetup");
    }
  };

  const handleVoiceGenderChange = (gender: VoiceGender) => {
    updateVoicePreferences.mutate({ preferredAiGender: gender });
  };

  const handleVoicePreview = async (voiceId: string) => {
    try {
      if (previewingVoiceId === voiceId) {
        if (previewSoundRef.current) {
          await previewSoundRef.current.stopAsync();
          await previewSoundRef.current.unloadAsync();
          previewSoundRef.current = null;
        }
        setPreviewingVoiceId(null);
        return;
      }

      if (previewSoundRef.current) {
        await previewSoundRef.current.stopAsync();
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
      }

      setIsPreviewLoading(true);
      setPreviewingVoiceId(voiceId);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}

      const token = await getAuthToken();
      const response = await fetch(
        new URL("/api/voices/preview", getApiUrl()).toString(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "X-Auth-Token": token } : {}),
          },
          body: JSON.stringify({ voiceId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate preview");
      }

      const data = await response.json();
      const audioUri = `data:audio/mpeg;base64,${data.audio}`;
      
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );
      
      previewSoundRef.current = sound;
      setIsPreviewLoading(false);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPreviewingVoiceId(null);
          sound.unloadAsync();
          previewSoundRef.current = null;
        }
      });
    } catch (error) {
      console.error("Voice preview error:", error);
      setIsPreviewLoading(false);
      setPreviewingVoiceId(null);
      Alert.alert("Preview Error", "Could not play voice preview. Please try again.");
    }
  };

  const handlePersonalVoicePreview = async () => {
    try {
      if (isPersonalPreviewPlaying) {
        if (previewSoundRef.current) {
          await previewSoundRef.current.stopAsync();
          await previewSoundRef.current.unloadAsync();
          previewSoundRef.current = null;
        }
        setIsPersonalPreviewPlaying(false);
        return;
      }

      if (previewSoundRef.current) {
        await previewSoundRef.current.stopAsync();
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
      }
      setPreviewingVoiceId(null);

      setIsPersonalPreviewLoading(true);
      setIsPersonalPreviewPlaying(true);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}

      const token = await getAuthToken();
      const response = await fetch(
        new URL("/api/voices/preview-personal", getApiUrl()).toString(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "X-Auth-Token": token } : {}),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate preview");
      }

      const data = await response.json();
      const audioUri = `data:audio/mpeg;base64,${data.audio}`;
      
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );
      
      previewSoundRef.current = sound;
      setIsPersonalPreviewLoading(false);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPersonalPreviewPlaying(false);
          sound.unloadAsync();
          previewSoundRef.current = null;
        }
      });
    } catch (error) {
      console.error("Personal voice preview error:", error);
      setIsPersonalPreviewLoading(false);
      setIsPersonalPreviewPlaying(false);
      Alert.alert("Preview Error", "Could not play your voice preview. Please try again.");
    }
  };

  useEffect(() => {
    return () => {
      if (previewSoundRef.current) {
        previewSoundRef.current.unloadAsync();
      }
    };
  }, []);

  const currentGender = voicePreferences?.preferredAiGender || "female";
  const voices = currentGender === "male" ? voiceOptions?.male : voiceOptions?.female;
  const selectedVoiceId = currentGender === "male" 
    ? voicePreferences?.preferredMaleVoiceId 
    : voicePreferences?.preferredFemaleVoiceId;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.section}>
        <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          DEFAULT VOICE
        </ThemedText>
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <View style={styles.toggleContainer}>
            <Pressable
              onPress={() => handleVoiceTypeChange("personal")}
              style={[
                styles.toggleButton,
                { 
                  backgroundColor: voicePreferences?.preferredVoiceType === "personal" 
                    ? ACCENT_GOLD 
                    : theme.backgroundSecondary,
                  borderColor: voicePreferences?.hasPersonalVoice ? ACCENT_GOLD : theme.border,
                },
              ]}
              testID="button-voice-personal"
            >
              <Feather 
                name="user" 
                size={18} 
                color={voicePreferences?.preferredVoiceType === "personal" ? "#FFFFFF" : theme.text} 
              />
              <View style={styles.toggleTextContainer}>
                <Text style={[
                  styles.toggleText,
                  { color: voicePreferences?.preferredVoiceType === "personal" ? "#FFFFFF" : theme.text }
                ]}>
                  My Voice
                </Text>
                {!voicePreferences?.hasPersonalVoice ? (
                  <Text style={[
                    styles.notSetupText,
                    { color: voicePreferences?.preferredVoiceType === "personal" ? "rgba(255,255,255,0.7)" : theme.textSecondary }
                  ]}>
                    (not set up)
                  </Text>
                ) : null}
              </View>
            </Pressable>
            <Pressable
              onPress={() => handleVoiceTypeChange("ai")}
              style={[
                styles.toggleButton,
                { 
                  backgroundColor: voicePreferences?.preferredVoiceType === "ai" || !voicePreferences?.preferredVoiceType 
                    ? ACCENT_GOLD 
                    : theme.backgroundSecondary,
                  borderColor: ACCENT_GOLD,
                },
              ]}
              testID="button-voice-ai"
            >
              <Feather 
                name="cpu" 
                size={18} 
                color={voicePreferences?.preferredVoiceType === "ai" || !voicePreferences?.preferredVoiceType 
                  ? "#FFFFFF" 
                  : theme.text} 
              />
              <Text style={[
                styles.toggleText,
                { color: voicePreferences?.preferredVoiceType === "ai" || !voicePreferences?.preferredVoiceType 
                  ? "#FFFFFF" 
                  : theme.text }
              ]}>AI Voice</Text>
            </Pressable>
          </View>

          {voicePreferences?.hasPersonalVoice ? (
            <View style={[styles.personalPreviewSection, { borderTopColor: theme.border }]}>
              <View style={styles.personalPreviewInfo}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Your voice is ready! Tap to preview how you sound:
                </ThemedText>
              </View>
              <Pressable
                onPress={handlePersonalVoicePreview}
                style={[
                  styles.personalPreviewButton,
                  { 
                    backgroundColor: isPersonalPreviewPlaying ? ACCENT_GOLD + "20" : theme.backgroundSecondary,
                    borderColor: ACCENT_GOLD,
                  },
                ]}
                testID="button-preview-personal-voice"
              >
                {isPersonalPreviewLoading ? (
                  <ActivityIndicator size="small" color={ACCENT_GOLD} />
                ) : (
                  <Feather 
                    name={isPersonalPreviewPlaying ? "pause" : "play"} 
                    size={18} 
                    color={ACCENT_GOLD} 
                  />
                )}
                <Text style={[styles.personalPreviewButtonText, { color: ACCENT_GOLD }]}>
                  {isPersonalPreviewPlaying ? "Stop Preview" : "Preview My Voice"}
                </Text>
                {isPersonalPreviewPlaying && !isPersonalPreviewLoading ? (
                  <Feather name="volume-2" size={16} color={ACCENT_GOLD} style={{ marginLeft: Spacing.xs }} />
                ) : null}
              </Pressable>
              <ThemedText type="caption" style={[styles.previewPhraseText, { color: theme.textSecondary }]}>
                "I am strong, capable, and worthy of success."
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      {(voicePreferences?.preferredVoiceType === "ai" || !voicePreferences?.preferredVoiceType) ? (
        <>
          <View style={styles.section}>
            <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              VOICE GENDER
            </ThemedText>
            <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
              <View style={styles.toggleContainer}>
                <Pressable
                  onPress={() => handleVoiceGenderChange("female")}
                  style={[
                    styles.genderButton,
                    { 
                      backgroundColor: currentGender === "female"
                        ? ACCENT_GOLD 
                        : theme.backgroundSecondary,
                      borderColor: ACCENT_GOLD,
                    },
                  ]}
                  testID="button-gender-female"
                >
                  <Text style={[
                    styles.toggleText,
                    { color: currentGender === "female" ? "#FFFFFF" : theme.text }
                  ]}>Female</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleVoiceGenderChange("male")}
                  style={[
                    styles.genderButton,
                    { 
                      backgroundColor: currentGender === "male" 
                        ? ACCENT_GOLD 
                        : theme.backgroundSecondary,
                      borderColor: ACCENT_GOLD,
                    },
                  ]}
                  testID="button-gender-male"
                >
                  <Text style={[
                    styles.toggleText,
                    { color: currentGender === "male" ? "#FFFFFF" : theme.text }
                  ]}>Male</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              SELECT VOICE
            </ThemedText>
            <ThemedText type="small" style={[styles.hintText, { color: theme.textSecondary }]}>
              Tap a voice to select and preview it
            </ThemedText>
            <View style={styles.voiceCardsContainer}>
              {voices?.map((voice) => {
                const isSelected = selectedVoiceId === voice.id;
                const isPlaying = previewingVoiceId === voice.id;
                const isLoading = isPreviewLoading && previewingVoiceId === voice.id;
                
                return (
                  <Pressable
                    key={voice.id}
                    onPress={() => {
                      if (!isSelected) {
                        if (currentGender === "male") {
                          updateVoicePreferences.mutate({ preferredMaleVoiceId: voice.id });
                        } else {
                          updateVoicePreferences.mutate({ preferredFemaleVoiceId: voice.id });
                        }
                      }
                      handleVoicePreview(voice.id);
                    }}
                    style={[
                      styles.voiceCard,
                      { 
                        backgroundColor: isSelected ? ACCENT_GOLD + "20" : theme.cardBackground,
                        borderColor: isSelected ? ACCENT_GOLD : theme.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    testID={`voice-card-${voice.id}`}
                  >
                    <View style={styles.voiceCardContent}>
                      <View style={styles.voiceCardNameRow}>
                        <ThemedText type="body" style={[{ fontWeight: "600" }, isSelected ? { color: ACCENT_GOLD } : undefined]}>
                          {voice.name}
                        </ThemedText>
                        {isLoading ? (
                          <ActivityIndicator size="small" color={ACCENT_GOLD} style={{ marginLeft: Spacing.sm }} />
                        ) : isPlaying ? (
                          <Feather name="volume-2" size={16} color={ACCENT_GOLD} style={{ marginLeft: Spacing.sm }} />
                        ) : null}
                      </View>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {voice.description}
                      </ThemedText>
                    </View>
                    {isSelected ? (
                      <View style={[styles.voiceCardCheck, { backgroundColor: ACCENT_GOLD }]}>
                        <Feather name="check" size={14} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.section}>
        <Pressable
          onPress={() => navigation.navigate("VoiceSetup")}
          style={[styles.recordButton, { backgroundColor: theme.cardBackground, borderColor: ACCENT_GOLD }]}
          testID="button-record-voice"
        >
          <Feather name="mic" size={20} color={ACCENT_GOLD} />
          <View style={styles.recordButtonText}>
            <ThemedText type="body" style={{ color: ACCENT_GOLD, fontWeight: "600" }}>
              {voicePreferences?.hasPersonalVoice ? "Re-record My Voice" : "Record My Voice"}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {voicePreferences?.hasPersonalVoice ? "Update your personal voice clone" : "Create a personalized voice clone"}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  toggleContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  toggleTextContainer: {
    alignItems: "flex-start",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  notSetupText: {
    fontSize: 10,
  },
  genderButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  hintText: {
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  voiceCardsContainer: {
    gap: Spacing.sm,
  },
  voiceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  voiceCardContent: {
    flex: 1,
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
    marginLeft: Spacing.md,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  recordButtonText: {
    flex: 1,
  },
  personalPreviewSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  personalPreviewInfo: {
    marginBottom: Spacing.sm,
  },
  personalPreviewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  personalPreviewButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  previewPhraseText: {
    marginTop: Spacing.sm,
    fontStyle: "italic",
    textAlign: "center",
  },
});
