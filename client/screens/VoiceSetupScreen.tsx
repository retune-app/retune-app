import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Image, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { RecordButton } from "@/components/RecordButton";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Shadows } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) throw new Error("Recording file not found");
        
        formData.append("audio", {
          uri,
          type: "audio/m4a",
          name: "voice-sample.m4a",
        } as any);
      }

      const response = await fetch(`${getApiUrl()}/api/voice-samples`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("Main");
    },
    onError: (error) => {
      Alert.alert("Upload Failed", "Could not upload your voice sample. Please try again.");
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
      <View style={[styles.content, { paddingTop: insets.top + Spacing["3xl"], paddingBottom: insets.bottom + Spacing["2xl"] }]}>
        <Image
          source={require("../../assets/images/voice-setup-hero.png")}
          style={styles.heroImage}
          resizeMode="contain"
        />

        <ThemedText type="h1" style={styles.title}>
          Record Your Voice
        </ThemedText>

        <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
          Record a 30-60 second sample of your voice. Speak naturally about anything - this helps create personalized affirmations in your own voice.
        </ThemedText>

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
              ? `Keep speaking... ${30 - recordingDuration}s more needed`
              : "Great! You can stop or keep going up to 60s"
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
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  heroImage: {
    width: 200,
    height: 150,
    marginBottom: Spacing["2xl"],
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing["3xl"],
    maxWidth: 320,
    lineHeight: 24,
  },
  waveform: {
    width: "100%",
    height: 80,
    marginBottom: Spacing.lg,
  },
  timer: {
    marginBottom: Spacing.sm,
  },
  hint: {
    textAlign: "center",
    marginBottom: Spacing["3xl"],
    height: 40,
  },
  buttonsContainer: {
    width: "100%",
    marginTop: Spacing["3xl"],
    gap: Spacing.md,
  },
  continueButton: {
    width: "100%",
  },
  skipButton: {
    width: "100%",
  },
});
