import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Alert, Platform, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  FadeInUp,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { GoldShimmer } from "@/components/GoldShimmer";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getAuthToken } from "@/lib/auth-token";
import { useAuth } from "@/contexts/AuthContext";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const READING_PROMPTS = `Today is a beautiful day, and I am grateful for every opportunity that comes my way.

The sun rises, and with it, so does my potential. I believe in myself and my ability to achieve great things.

Every step I take moves me closer to my dreams. I am patient with myself and trust the journey I am on.

When challenges arise, I face them with courage and grace. I learn from every experience and grow stronger each day.

I am surrounded by love and support. My relationships are meaningful and bring joy to my life.

My creativity flows freely, and I express myself authentically. I embrace who I am becoming.

Success is not just a destination but a way of living. I celebrate small victories and keep moving forward.`;

const MILESTONES = [
  { seconds: 20, label: "Min", icon: "check" as const },
  { seconds: 40, label: "Good", icon: "thumbs-up" as const },
  { seconds: 60, label: "Best", icon: "star" as const },
];

function UnifiedRecordButton({
  isRecording,
  hasRecording,
  duration,
  onPress,
  theme,
}: {
  isRecording: boolean;
  hasRecording: boolean;
  duration: number;
  onPress: () => void;
  theme: any;
}) {
  const SIZE = 200;
  const STROKE_WIDTH = 6;
  const radius = (SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = SIZE / 2;
  const buttonSize = 80;

  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const progressValue = useSharedValue(0);
  const idlePulseScale = useSharedValue(1);
  const idlePulseOpacity = useSharedValue(0);

  useEffect(() => {
    progressValue.value = withTiming(Math.min(duration / 60, 1), {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
  }, [duration]);

  useEffect(() => {
    const isIdle = !isRecording && !hasRecording;
    if (isIdle) {
      idlePulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      idlePulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.08, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      idlePulseScale.value = withTiming(1, { duration: 200 });
      idlePulseOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isRecording, hasRecording]);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      glowOpacity.value = withTiming(1, { duration: 400 });
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
      pulseOpacity.value = withTiming(0, { duration: 300 });
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isRecording]);

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progressValue.value),
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const idlePulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: idlePulseScale.value }],
    opacity: idlePulseOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1);
  };
  const handlePress = () => {
    try { Haptics.impactAsync(isRecording ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
    onPress();
  };

  const isIdle = !isRecording && !hasRecording;

  return (
    <View style={ubStyles.wrapper}>
      {isIdle ? (
        <Animated.View style={[ubStyles.pulseRing, {
          width: SIZE + 30,
          height: SIZE + 30,
          borderRadius: (SIZE + 30) / 2,
          backgroundColor: theme.primary,
        }, idlePulseStyle]} />
      ) : null}

      <Animated.View style={[ubStyles.pulseRing, {
        width: SIZE + 30,
        height: SIZE + 30,
        borderRadius: (SIZE + 30) / 2,
        backgroundColor: theme.primary,
      }, pulseStyle]} />

      <Animated.View style={[ubStyles.glowRing, {
        width: SIZE + 16,
        height: SIZE + 16,
        borderRadius: (SIZE + 16) / 2,
        borderColor: theme.primary,
      }, glowStyle]} />

      <Svg width={SIZE} height={SIZE} style={ubStyles.svg}>
        <Defs>
          <SvgLinearGradient id="recordProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.primary} />
            <Stop offset="100%" stopColor={theme.goldLight || theme.primary} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.backgroundSecondary}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          opacity={0.5}
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#recordProgressGradient)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={progressProps}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>

      <View style={ubStyles.centerContent}>
        <Animated.View style={buttonAnimStyle}>
          <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            testID="button-record"
          >
            <LinearGradient
              colors={
                isRecording
                  ? [theme.accent || theme.primary, theme.primary]
                  : hasRecording
                  ? ["#50C9B0", "#3DAF9A"]
                  : (theme.gradient?.primary as [string, string]) || [theme.primary, theme.primary]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[ubStyles.button, Shadows.large, {
                width: buttonSize,
                height: buttonSize,
                borderRadius: buttonSize / 2,
              }]}
            >
              <Feather
                name={hasRecording ? "refresh-cw" : isRecording ? "square" : "mic"}
                size={buttonSize * 0.38}
                color="#FFFFFF"
              />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      {isIdle ? (
        <Animated.View
          entering={FadeIn.duration(600).delay(300)}
          style={ubStyles.tapHintContainer}
        >
          <Feather name="chevrons-up" size={14} color={theme.primary} style={{ marginBottom: 2 }} />
          <ThemedText type="caption" style={[ubStyles.tapHintText, { color: theme.primary }]}>
            Tap to Start Recording
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const ubStyles = StyleSheet.create({
  wrapper: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
  },
  glowRing: {
    position: "absolute",
    borderWidth: 2,
  },
  svg: {
    position: "absolute",
  },
  centerContent: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  tapHintContainer: {
    position: "absolute",
    bottom: -30,
    alignItems: "center",
  },
  tapHintText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

function MilestoneBar({
  duration,
  isRecording,
  hasRecording,
  theme,
}: {
  duration: number;
  isRecording: boolean;
  hasRecording: boolean;
  theme: any;
}) {
  if (!isRecording && !hasRecording) return null;

  return (
    <Animated.View entering={FadeInUp.duration(300)} style={msStyles.container}>
      <View style={[msStyles.trackBackground, { backgroundColor: theme.backgroundSecondary }]}>
        <Animated.View
          style={[
            msStyles.trackFill,
            {
              backgroundColor: theme.primary,
              width: `${Math.min((duration / 60) * 100, 100)}%`,
            },
          ]}
        />
      </View>
      <View style={msStyles.milestonesRow}>
        {MILESTONES.map((m) => {
          const reached = duration >= m.seconds;
          return (
            <View key={m.seconds} style={msStyles.milestone}>
              <View style={[
                msStyles.milestoneIcon,
                {
                  backgroundColor: reached ? theme.primary : theme.backgroundSecondary,
                  borderColor: reached ? theme.primary : theme.border,
                },
              ]}>
                <Feather
                  name={reached ? m.icon : "circle"}
                  size={10}
                  color={reached ? "#FFFFFF" : theme.textSecondary}
                />
              </View>
              <ThemedText type="caption" style={[
                msStyles.milestoneLabel,
                { color: reached ? theme.primary : theme.textSecondary },
              ]}>
                {m.seconds}s {m.label}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const msStyles = StyleSheet.create({
  container: {
    width: "100%",
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  trackBackground: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  trackFill: {
    height: "100%",
    borderRadius: 3,
  },
  milestonesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  milestone: {
    alignItems: "center",
    gap: 4,
  },
  milestoneIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  milestoneLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
});

export default function VoiceSetupScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  const [showPrivacyNotice, setShowPrivacyNotice] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

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
          let cleanMessage = "Upload failed. Please try again.";
          try {
            const errorJson = JSON.parse(errorText);
            cleanMessage = errorJson?.error || cleanMessage;
          } catch (_) {
            cleanMessage = errorText || cleanMessage;
          }
          throw new Error(cleanMessage);
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/voice-samples/status"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/voice-preferences"] }),
        refreshUser(),
      ]);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
      setShowSuccess(true);
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
      await consentMutation.mutateAsync();
      setShowPrivacyNotice(false);
      await requestPermissions();
    } catch (error) {
      console.error("Failed to save consent:", error);
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

      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
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

      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const handleRecordPress = () => {
    if (hasRecording) {
      handleReRecord();
      return;
    }
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
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isValidDuration = recordingDuration >= 20;

  const handleClose = () => {
    navigation.goBack();
  };

  const handleReRecord = () => {
    setHasRecording(false);
    setRecordingUri(null);
    setRecordingDuration(0);
  };

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

  const getStatusText = () => {
    if (hasRecording && isValidDuration) return "Voice Sample Ready";
    if (hasRecording && !isValidDuration) return "Too Short";
    if (isRecording) return "Listening...";
    return "Record Your Voice";
  };

  const getSubText = () => {
    if (hasRecording && isValidDuration) return "Your voice sample is ready to create your Inner Voice clone.";
    if (hasRecording && !isValidDuration) return `Only ${recordingDuration}s recorded. You need at least 20 seconds for a good voice clone.`;
    if (isRecording) {
      if (recordingDuration < 20) return "Keep reading naturally...";
      if (recordingDuration < 40) return "Looking good! Keep going for better quality.";
      return "Excellent quality! You can stop whenever you're ready.";
    }
    return "Read the passage below out loud for 20-60 seconds. Longer recordings produce better voice quality.";
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.headerRow, { top: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={handleClose}
          style={styles.headerButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID="button-close"
        >
          <Feather name="x" size={22} color={theme.text} />
        </Pressable>
        <ThemedText type="caption" style={[styles.headerTitle, { color: theme.textSecondary }]}>
          VOICE CLONING
        </ThemedText>
        <View style={styles.headerButton} />
      </View>

      {showSuccess ? (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[
            styles.successContainer,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + Spacing["2xl"] },
          ]}
        >
          <Animated.View
            entering={FadeInUp.duration(500).delay(100).springify().damping(12)}
            style={styles.successContent}
          >
            <GoldShimmer
              style={styles.successCheckContainer}
              shimmerWidth={120}
              duration={2500}
            >
              <LinearGradient
                colors={[theme.primary, theme.goldLight || "#E5C95C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.successCheckCircle}
              >
                <Feather name="check" size={56} color="#FFFFFF" />
              </LinearGradient>
            </GoldShimmer>

            <Animated.View
              entering={FadeInUp.duration(400).delay(300)}
              style={styles.successTextContainer}
            >
              <ThemedText type="h1" style={styles.successTitle}>
                Voice Cloned!
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.successSubtitle, { color: theme.textSecondary }]}
              >
                Your affirmations will now play in your own voice
              </ThemedText>
            </Animated.View>

            <Animated.View
              entering={FadeInUp.duration(400).delay(500)}
              style={styles.successButtonContainer}
            >
              <Button
                variant="gradient"
                onPress={() => navigation.goBack()}
                style={styles.continueButton}
                testID="button-success-continue"
              >
                Continue
              </Button>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      ) : (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.recordContent,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <UnifiedRecordButton
            isRecording={isRecording}
            hasRecording={hasRecording}
            duration={recordingDuration}
            onPress={handleRecordPress}
            theme={theme}
          />

          {isRecording || hasRecording ? (
            <View style={styles.timerDisplay}>
              <ThemedText type="h1" style={[styles.timer, {
                color: isRecording ? theme.primary : hasRecording && isValidDuration ? theme.success : theme.text,
              }]}>
                {formatDuration(recordingDuration)}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {isRecording || hasRecording ? (
          <>
            <ThemedText type="h2" style={[styles.statusTitle, { textAlign: "center" }]}>
              {getStatusText()}
            </ThemedText>
            <ThemedText type="body" style={[styles.statusSub, { color: theme.textSecondary }]}>
              {getSubText()}
            </ThemedText>
          </>
        ) : null}

        <MilestoneBar
          duration={recordingDuration}
          isRecording={isRecording}
          hasRecording={hasRecording}
          theme={theme}
        />

        {!hasRecording ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.promptCard, { backgroundColor: theme.backgroundSecondary }]}
          >
            <View style={styles.promptHeader}>
              <Feather name={isRecording ? "book-open" : "eye"} size={14} color={theme.primary} />
              <ThemedText type="caption" style={[styles.promptLabel, { color: theme.primary }]}>
                {isRecording ? "READ THIS ALOUD" : "READING PREVIEW"}
              </ThemedText>
            </View>
            <ThemedText type="body" style={[styles.promptText, {
              color: isRecording ? theme.text : theme.textSecondary,
            }]}>
              {isRecording ? READING_PROMPTS : `${READING_PROMPTS.substring(0, 200)}...`}
            </ThemedText>
            {!isRecording ? (
              <View style={[styles.promptOverlay, { backgroundColor: theme.backgroundSecondary }]} />
            ) : null}
          </Animated.View>
        ) : null}

        <View style={styles.buttonsContainer}>
          {hasRecording && isValidDuration ? (
            <Animated.View entering={FadeInUp.duration(300)} style={styles.buttonWrapper}>
              <Button
                variant="gradient"
                onPress={handleContinue}
                loading={uploadMutation.isPending}
                style={styles.continueButton}
                testID="button-continue"
              >
                Clone Inner Voice
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
            </Animated.View>
          ) : null}

          {hasRecording && !isValidDuration ? (
            <Animated.View entering={FadeInUp.duration(300)} style={styles.buttonWrapper}>
              <Button
                variant="secondary"
                onPress={handleReRecord}
                style={styles.continueButton}
                testID="button-rerecord-short"
              >
                Try Again
              </Button>
            </Animated.View>
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
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    zIndex: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    letterSpacing: 2,
    fontWeight: "700",
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  recordContent: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  timerDisplay: {
    marginTop: Spacing.sm,
    alignItems: "center",
  },
  timer: {
    fontSize: 36,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    lineHeight: 42,
  },
  statusTitle: {
    marginBottom: Spacing.xs,
  },
  statusSub: {
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  promptCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing["3xl"],
    overflow: "hidden",
  },
  promptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  promptLabel: {
    letterSpacing: 1.5,
    fontWeight: "700",
    fontSize: 11,
  },
  promptText: {
    lineHeight: 26,
    fontSize: 16,
  },
  promptOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    opacity: 0.85,
  },
  buttonsContainer: {
    width: "100%",
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  buttonWrapper: {
    width: "100%",
    gap: Spacing.md,
  },
  continueButton: {
    width: "100%",
  },
  skipButton: {
    width: "100%",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
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
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  successContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing["2xl"],
  },
  successCheckContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
  },
  successCheckCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  successTextContainer: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  successTitle: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
  },
  successSubtitle: {
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 24,
    fontSize: 16,
  },
  successButtonContainer: {
    width: "100%",
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
});
