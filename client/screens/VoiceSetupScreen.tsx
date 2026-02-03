import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Image, Alert, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { RecordButton } from "@/components/RecordButton";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getAuthToken } from "@/contexts/AuthContext";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const READING_PROMPTS = `Today is a beautiful day, and I am grateful for every opportunity that comes my way.

The sun rises, and with it, so does my potential. I believe in myself and my ability to achieve great things.

Every step I take moves me closer to my dreams. I am patient with myself and trust the journey I am on.

When challenges arise, I face them with courage and grace. I learn from every experience and grow stronger each day.

I am surrounded by love and support. My relationships are meaningful and bring joy to my life.

My creativity flows freely, and I express myself authentically. I embrace who I am becoming.

Success is not just a destination but a way of living. I celebrate small victories and keep moving forward.`;

export default function VoiceSetupScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const [showPrivacyNotice, setShowPrivacyNotice] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (uri: string) => {
      const apiUrl = getApiUrl();
      const authToken = getAuthToken();
      
      const formData = new FormData();
      
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append("audio", blob, "voice-sample.webm");
      } else {
        formData.append("audio", {
          uri,
          type: "audio/m4a",
          name: "voice-sample.m4a",
        } as any);
      }

      // Use AbortController for 3 minute timeout (voice cloning takes time)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      try {
        const headers: Record<string, string> = {};
        if (authToken) {
          headers["X-Auth-Token"] = authToken;
        }
        
        const response = await fetch(`${apiUrl}/api/voice-samples`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
          credentials: "include",
          headers,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Upload response error:", errorText);
          throw new Error(errorText || "Upload failed");
        }
        return response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          throw new Error("Upload timed out. Please try again.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-samples/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-preferences"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    },
    onError: (error: any) => {
      const message = error?.message || "Could not upload your voice sample. Please try again.";
      Alert.alert("Upload Failed", message);
      console.error("Upload error:", error);
    },
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  // Mutation to save voice consent to database
  const consentMutation = useMutation({
    mutationFn: async () => {
      const apiUrl = getApiUrl();
      const authToken = getAuthToken();
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["X-Auth-Token"] = authToken;
      }

      const response = await fetch(`${apiUrl}/api/user/voice-consent`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ consent: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to save consent");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/limits"] });
    },
  });

  const handlePrivacyAcknowledge = async () => {
    try {
      // Save consent to database before proceeding
      await consentMutation.mutateAsync();
      setShowPrivacyNotice(false);
      await requestPermissions();
    } catch (error) {
      console.error("Failed to save consent:", error);
      // Still proceed even if consent save fails (will be checked again on server)
      setShowPrivacyNotice(false);
      await requestPermissions();
    }
  };

  const requestPermissions = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      setPermissionGranted(granted);
      if (!granted) {
        Alert.alert(
          "Microphone Permission Required",
          "Please enable microphone access in your device settings to record your voice."
        );
      }
    } catch (error) {
      console.error("Permission error:", error);
    }
  };

  const startRecording = async () => {
    if (!permissionGranted) {
      requestPermissions();
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      setHasRecording(false);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Recording Error", "Could not start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      setIsRecording(false);
      setRecordingUri(uri);
      setHasRecording(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const handleRecordPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleContinue = () => {
    if (recordingUri) {
      uploadMutation.mutate(recordingUri);
    }
  };

  const skipMutation = useMutation({
    mutationFn: async () => {
      const apiUrl = getApiUrl();
      const authToken = getAuthToken();
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (authToken) {
        headers["X-Auth-Token"] = authToken;
      }
      
      const response = await fetch(`${apiUrl}/api/affirmations/samples`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      
      if (!response.ok) {
        throw new Error("Failed to create sample affirmations");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      navigation.goBack();
    },
    onError: (error: any) => {
      console.error("Skip error:", error);
      navigation.goBack();
    },
  });

  const handleSkip = () => {
    skipMutation.mutate();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isValidDuration = recordingDuration >= 20;

  if (showPrivacyNotice) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            styles.privacyContent,
            { paddingTop: insets.top + Spacing["2xl"], paddingBottom: insets.bottom + Spacing["2xl"] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.privacyIconContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="shield" size={48} color={theme.primary} />
          </View>

          <ThemedText type="h1" style={styles.title}>
            Your Voice is Protected
          </ThemedText>

          <ThemedText type="body" style={[styles.privacyDescription, { color: theme.textSecondary }]}>
            We take your privacy seriously. Here's how we protect your voice recording:
          </ThemedText>

          <View style={[styles.privacyCard, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.privacyItem}>
              <View style={[styles.privacyBullet, { backgroundColor: theme.primary }]}>
                <Feather name="trash-2" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.privacyItemText}>
                <ThemedText type="body" style={styles.privacyItemTitle}>
                  Immediately Deleted
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Your voice recording is deleted from our servers immediately after creating your voice clone
                </ThemedText>
              </View>
            </View>

            <View style={styles.privacyItem}>
              <View style={[styles.privacyBullet, { backgroundColor: theme.primary }]}>
                <Feather name="user" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.privacyItemText}>
                <ThemedText type="body" style={styles.privacyItemTitle}>
                  Only You Have Access
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Your voice clone is private and only used for your affirmations
                </ThemedText>
              </View>
            </View>

            <View style={styles.privacyItem}>
              <View style={[styles.privacyBullet, { backgroundColor: theme.primary }]}>
                <Feather name="headphones" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.privacyItemText}>
                <ThemedText type="body" style={styles.privacyItemTitle}>
                  Personal Use Only
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Used solely to create your personalized affirmations
                </ThemedText>
              </View>
            </View>

            <View style={styles.privacyItem}>
              <View style={[styles.privacyBullet, { backgroundColor: theme.primary }]}>
                <Feather name="shield" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.privacyItemText}>
                <ThemedText type="body" style={styles.privacyItemTitle}>
                  Delete All Data Anytime
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  You can permanently delete all your data from Settings at any time
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <Button
              variant="gradient"
              onPress={handlePrivacyAcknowledge}
              loading={consentMutation.isPending}
              style={styles.continueButton}
              testID="button-privacy-continue"
            >
              I Consent to Voice Cloning
            </Button>

            <Button
              variant="ghost"
              onPress={handleSkip}
              loading={skipMutation.isPending}
              style={styles.skipButton}
              testID="button-privacy-skip"
            >
              Skip for now
            </Button>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  const handleClose = () => {
    navigation.goBack();
  };

  const handleReRecord = () => {
    setHasRecording(false);
    setRecordingUri(null);
    setRecordingDuration(0);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Close button */}
      <View style={[styles.closeButtonContainer, { top: insets.top + Spacing.md }]}>
        <Button
          variant="ghost"
          onPress={handleClose}
          style={styles.closeButton}
          testID="button-close"
        >
          <Feather name="x" size={24} color={theme.text} />
        </Button>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing["2xl"] + 40, paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!isRecording && !hasRecording ? (
          <Image
            source={require("../../assets/images/voice-setup-hero.png")}
            style={styles.heroImage}
            resizeMode="contain"
          />
        ) : null}

        <ThemedText type="h1" style={styles.title}>
          {isRecording ? "Read This Aloud" : "Record Your Voice"}
        </ThemedText>

        {!isRecording && !hasRecording ? (
          <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
            Record a 20-60 second sample of your voice. Longer recordings create better voice quality! When you start recording, we'll show you some text to read aloud.
          </ThemedText>
        ) : null}

        {isRecording ? (
          <View style={[styles.promptCard, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="caption" style={[styles.promptLabel, { color: theme.primary }]}>
              READ NATURALLY AT YOUR OWN PACE
            </ThemedText>
            <ThemedText type="body" style={styles.promptText}>
              {READING_PROMPTS}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.recordingSection}>
          <WaveformVisualizer
            isActive={isRecording}
            barCount={32}
            style={styles.waveform}
            color={theme.primary}
          />

          <ThemedText type="h2" style={[styles.timer, { color: isRecording ? theme.primary : theme.text }]}>
            {formatDuration(recordingDuration)}
          </ThemedText>

          <ThemedText
            type="caption"
            style={[styles.hint, { color: theme.textSecondary }]}
          >
            {isRecording
              ? recordingDuration < 20
                ? `Keep reading... ${20 - recordingDuration}s minimum`
                : recordingDuration < 40
                ? "Good! Keep going for better quality..."
                : "Excellent! You can stop anytime now"
              : hasRecording
              ? isValidDuration
                ? "Recording complete! You can re-record or continue."
                : `Recording too short (${recordingDuration}s). Need at least 20 seconds.`
              : "Tap the microphone to start recording"}
          </ThemedText>

          <RecordButton
            isRecording={isRecording}
            onPress={handleRecordPress}
            size={80}
            testID="button-record"
          />
        </View>

        <View style={styles.buttonsContainer}>
          {hasRecording && isValidDuration ? (
            <>
              <Button
                variant="gradient"
                onPress={handleContinue}
                loading={uploadMutation.isPending}
                style={styles.continueButton}
                testID="button-continue"
              >
                Save Voice
              </Button>
              <Button
                variant="secondary"
                onPress={handleReRecord}
                disabled={uploadMutation.isPending}
                style={styles.continueButton}
                testID="button-rerecord"
              >
                Re-record
              </Button>
            </>
          ) : null}

          {hasRecording && !isValidDuration ? (
            <Button
              variant="secondary"
              onPress={handleReRecord}
              style={styles.continueButton}
              testID="button-rerecord-short"
            >
              Try Again
            </Button>
          ) : null}

          <Button
            variant="ghost"
            onPress={handleSkip}
            loading={skipMutation.isPending}
            disabled={uploadMutation.isPending}
            style={styles.skipButton}
            testID="button-skip"
          >
            Skip for now
          </Button>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButtonContainer: {
    position: "absolute",
    right: Spacing.md,
    zIndex: 10,
  },
  closeButton: {
    padding: Spacing.sm,
    minWidth: 44,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  heroImage: {
    width: 180,
    height: 130,
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    maxWidth: 320,
    lineHeight: 24,
  },
  promptCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  promptLabel: {
    marginBottom: Spacing.md,
    letterSpacing: 1,
    fontWeight: "600",
    textAlign: "center",
  },
  promptText: {
    lineHeight: 28,
    fontSize: 17,
  },
  recordingSection: {
    width: "100%",
    alignItems: "center",
  },
  waveform: {
    width: "100%",
    height: 60,
    marginBottom: Spacing.md,
  },
  timer: {
    marginBottom: Spacing.xs,
  },
  hint: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    height: 40,
  },
  buttonsContainer: {
    width: "100%",
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  continueButton: {
    width: "100%",
  },
  skipButton: {
    width: "100%",
  },
  privacyContent: {
    justifyContent: "center",
    minHeight: "100%",
  },
  privacyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  privacyDescription: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    maxWidth: 320,
    lineHeight: 24,
  },
  privacyCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  privacyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  privacyBullet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  privacyItemText: {
    flex: 1,
    gap: 4,
  },
  privacyItemTitle: {
    fontWeight: "600",
  },
});
