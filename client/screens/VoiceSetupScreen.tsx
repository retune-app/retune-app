import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Image, Alert, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { RecordButton } from "@/components/RecordButton";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const READING_PROMPTS = `I am absolutely crushing it today. My morning coffee tastes like liquid success, and my bed makes itself out of respect for my energy.

I radiate confidence like a disco ball at a dance party. People see me walking down the street and think, "Wow, that person definitely has their life together."

My plants thrive because they can sense my positive vibes. Even my houseplants have started growing towards me instead of the window.

I am patient, I am kind, and I am ridiculously good at parallel parking. Some people have talents, but I have the whole package.

I am becoming the best version of myself, which is really saying something because the current version is already pretty fantastic.`;

export default function VoiceSetupScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (uri: string) => {
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

      const apiUrl = getApiUrl();
      console.log("Uploading to:", `${apiUrl}/api/voice-samples`);

      // Use AbortController for 2 minute timeout (voice cloning takes time)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        const response = await fetch(`${apiUrl}/api/voice-samples`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("Main");
    },
    onError: (error: any) => {
      const message = error?.message || "Could not upload your voice sample. Please try again.";
      Alert.alert("Upload Failed", message);
      console.error("Upload error:", error);
    },
  });

  useEffect(() => {
    requestPermissions();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

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

  const handleSkip = () => {
    navigation.navigate("Main");
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isValidDuration = recordingDuration >= 30;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing["2xl"], paddingBottom: insets.bottom + Spacing["2xl"] },
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
            Record a 30-60 second sample of your voice. When you start recording, we'll show you some fun text to read aloud!
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
              ? recordingDuration < 30
                ? `Keep reading... ${30 - recordingDuration}s more needed`
                : "Perfect! You can stop or keep going up to 60s"
              : hasRecording
              ? "Recording complete! You can re-record or continue."
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
            <Button
              variant="gradient"
              onPress={handleContinue}
              loading={uploadMutation.isPending}
              style={styles.continueButton}
              testID="button-continue"
            >
              Continue
            </Button>
          ) : null}

          <Button
            variant="ghost"
            onPress={handleSkip}
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
});
