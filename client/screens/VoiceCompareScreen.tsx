import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ProviderResult {
  available: boolean;
  audio?: string;
  error?: string;
}

const DEFAULT_TEXT = `I am confident, capable, and worthy of success. Every day I grow stronger and more resilient. My mind is clear, focused, and ready for whatever comes my way. I trust in my ability to handle any challenge with grace and determination.

I release all doubt and embrace the power within me. I am deserving of love, abundance, and joy. My thoughts create my reality, and I choose thoughts that uplift and empower me. I am grateful for this moment and all the possibilities it holds.

I speak my truth with confidence and compassion. My voice matters, and my words carry weight. I attract positive experiences and meaningful connections into my life. Each breath fills me with renewed energy and purpose.

I am at peace with who I am and where I am on my journey. I celebrate my progress and honor my growth. The universe supports me in all that I do. I am enough, exactly as I am, right here, right now.

I choose to see the beauty in every situation. My heart is open, my spirit is strong, and my path is illuminated with possibility. Today, I step forward with courage and embrace the extraordinary life I am creating.`;

type ProviderKey = "elevenlabs" | "cartesia";

export default function VoiceCompareScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();

  const [text, setText] = useState(DEFAULT_TEXT);
  const [loadingProvider, setLoadingProvider] = useState<ProviderKey | null>(null);
  const [results, setResults] = useState<Record<ProviderKey, ProviderResult | null>>({
    elevenlabs: null,
    cartesia: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [playingProvider, setPlayingProvider] = useState<ProviderKey | null>(null);

  const elevenlabsSoundRef = useRef<Audio.Sound | null>(null);
  const cartesiaSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      elevenlabsSoundRef.current?.unloadAsync();
      cartesiaSoundRef.current?.unloadAsync();
    };
  }, []);

  const stopAll = async () => {
    if (elevenlabsSoundRef.current) {
      await elevenlabsSoundRef.current.stopAsync().catch(() => {});
      await elevenlabsSoundRef.current.unloadAsync().catch(() => {});
      elevenlabsSoundRef.current = null;
    }
    if (cartesiaSoundRef.current) {
      await cartesiaSoundRef.current.stopAsync().catch(() => {});
      await cartesiaSoundRef.current.unloadAsync().catch(() => {});
      cartesiaSoundRef.current = null;
    }
    setPlayingProvider(null);
  };

  const handleGenerate = async (provider: ProviderKey) => {
    if (!text.trim()) return;
    await stopAll();
    setLoadingProvider(provider);
    setError(null);

    try {
      const res = await apiRequest("POST", "/api/tts/compare", {
        text: text.trim(),
        provider,
      });
      const data = await res.json();
      setResults((prev) => ({
        ...prev,
        [provider]: data[provider] || { available: false, error: "No response from provider" },
      }));
    } catch (err: any) {
      setError(err.message || "Failed to generate audio");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handlePlay = async (provider: ProviderKey) => {
    const providerResult = results[provider];
    if (!providerResult?.available || !providerResult?.audio) return;

    if (playingProvider === provider) {
      await stopAll();
      return;
    }

    await stopAll();

    const mimeType = provider === "elevenlabs" ? "audio/mp3" : "audio/wav";
    const uri = `data:${mimeType};base64,${providerResult.audio}`;

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      if (provider === "elevenlabs") {
        elevenlabsSoundRef.current = sound;
      } else {
        cartesiaSoundRef.current = sound;
      }

      setPlayingProvider(provider);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingProvider((current) => (current === provider ? null : current));
        }
      });
    } catch (err) {
      setPlayingProvider(null);
    }
  };

  const goldGradient: [string, string] = isDark
    ? ["#C9A227", "#8A6D1A"]
    : ["#E5C95C", "#C9A227"];

  const renderProviderCard = (provider: ProviderKey, label: string, iconColor: string) => {
    const providerResult = results[provider];
    const isPlaying = playingProvider === provider;
    const isLoading = loadingProvider === provider;
    const hasAudio = providerResult?.available && providerResult?.audio;
    const hasError = providerResult && (!providerResult.available || providerResult.error);

    return (
      <View
        style={[
          styles.providerCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: isPlaying ? theme.gold : theme.border,
            borderWidth: isPlaying ? 2 : 1,
          },
        ]}
      >
        <View style={styles.providerHeader}>
          <View style={[styles.providerIconCircle, { backgroundColor: iconColor + "20" }]}>
            <Feather name="mic" size={16} color={iconColor} />
          </View>
          <View style={styles.providerHeaderText}>
            <Text
              style={[styles.providerLabel, { color: theme.text, fontFamily: "Nunito_700Bold" }]}
            >
              {label}
            </Text>
            {providerResult ? (
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: providerResult.available ? theme.success : theme.error },
                  ]}
                />
                <Text style={[styles.statusText, { color: theme.textSecondary, fontFamily: "Nunito_400Regular" }]}>
                  {providerResult.available ? "Ready" : "Unavailable"}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {hasError ? (
          <View style={[styles.providerError, { backgroundColor: isDark ? "rgba(255,107,107,0.1)" : "rgba(231,76,60,0.08)" }]}>
            <Feather name="alert-circle" size={14} color={theme.error} />
            <Text
              style={[styles.errorText, { color: theme.error, fontFamily: "Nunito_400Regular" }]}
              testID={`text-error-${provider}`}
            >
              {providerResult?.error || "Provider unavailable"}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardActions}>
          <Pressable
            testID={`button-generate-${provider}`}
            onPress={() => handleGenerate(provider)}
            disabled={isLoading || !text.trim()}
            style={({ pressed }) => [
              styles.sampleButton,
              { opacity: pressed ? 0.85 : isLoading || !text.trim() ? 0.5 : 1 },
            ]}
          >
            <LinearGradient
              colors={goldGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sampleGradient}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={isDark ? "#0F1C3F" : "#FFFFFF"} />
              ) : (
                <Feather name="zap" size={16} color={isDark ? "#0F1C3F" : "#FFFFFF"} />
              )}
              <Text
                style={[
                  styles.sampleButtonText,
                  { color: isDark ? "#0F1C3F" : "#FFFFFF", fontFamily: "Nunito_700Bold" },
                ]}
              >
                {isLoading ? "Generating..." : `${label} Sample`}
              </Text>
            </LinearGradient>
          </Pressable>

          {hasAudio ? (
            <Pressable
              testID={`button-play-${provider}`}
              onPress={() => handlePlay(provider)}
              style={({ pressed }) => [
                styles.playButton,
                {
                  backgroundColor: isPlaying
                    ? theme.gold
                    : isDark
                    ? theme.backgroundSecondary
                    : theme.backgroundTertiary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name={isPlaying ? "square" : "play"}
                size={18}
                color={isPlaying ? (isDark ? theme.navy : "#FFFFFF") : theme.text}
              />
              <Text
                style={[
                  styles.playButtonText,
                  {
                    color: isPlaying ? (isDark ? theme.navy : "#FFFFFF") : theme.text,
                    fontFamily: "Nunito_600SemiBold",
                  },
                ]}
              >
                {isPlaying ? "Stop" : "Play"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
      testID="screen-voice-compare"
    >
      <Text
        style={[styles.title, { color: theme.text, fontFamily: "Nunito_700Bold" }]}
      >
        Voice Comparison
      </Text>
      <Text
        style={[styles.subtitle, { color: theme.textSecondary, fontFamily: "Nunito_400Regular" }]}
      >
        Generate samples individually to compare ElevenLabs and Cartesia side by side
      </Text>

      <Text
        style={[styles.inputLabel, { color: theme.text, fontFamily: "Nunito_600SemiBold" }]}
      >
        Affirmation Text
      </Text>
      <TextInput
        testID="input-affirmation-text"
        style={[
          styles.textInput,
          {
            backgroundColor: theme.inputBackground,
            borderColor: theme.inputBorder,
            color: theme.text,
            fontFamily: "Nunito_400Regular",
          },
        ]}
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={6}
        placeholder="Enter affirmation text..."
        placeholderTextColor={theme.placeholder}
        textAlignVertical="top"
      />

      {error ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: isDark ? "rgba(255,107,107,0.15)" : "rgba(231,76,60,0.1)" },
          ]}
        >
          <Feather name="alert-circle" size={16} color={theme.error} />
          <Text
            style={[styles.errorBannerText, { color: theme.error }]}
            testID="text-error-general"
          >
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardsContainer}>
        {renderProviderCard("elevenlabs", "ElevenLabs", "#6366F1")}
        {renderProviderCard("cartesia", "Cartesia", "#10B981")}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 160,
    marginBottom: Spacing.xl,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  errorBannerText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  cardsContainer: {
    gap: Spacing.lg,
  },
  providerCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadows.small,
  },
  providerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  providerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  providerHeaderText: {
    flex: 1,
  },
  providerLabel: {
    fontSize: 18,
    lineHeight: 24,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
  },
  providerError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  cardActions: {
    gap: Spacing.sm,
  },
  sampleButton: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  sampleGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    gap: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  sampleButtonText: {
    fontSize: 15,
    lineHeight: 22,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 44,
    borderRadius: BorderRadius.sm,
  },
  playButtonText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
