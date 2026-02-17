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
import { useNavigation } from "@react-navigation/native";
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

interface CompareResponse {
  elevenlabs: ProviderResult;
  cartesia: ProviderResult;
}

const DEFAULT_TEXT =
  "I am confident, capable, and worthy of success. Every day I grow stronger and more resilient.";

export default function VoiceCompareScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();

  const [text, setText] = useState(DEFAULT_TEXT);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingProvider, setPlayingProvider] = useState<string | null>(null);

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

  const handleGenerate = async () => {
    if (!text.trim()) return;
    await stopAll();
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await apiRequest("POST", "/api/tts/compare", { text: text.trim() });
      const data: CompareResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate audio");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = async (provider: "elevenlabs" | "cartesia") => {
    if (!result) return;

    if (playingProvider === provider) {
      await stopAll();
      return;
    }

    await stopAll();

    const providerResult = result[provider];
    if (!providerResult.available || !providerResult.audio) return;

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

  const renderProviderCard = (
    provider: "elevenlabs" | "cartesia",
    label: string
  ) => {
    const providerResult = result ? result[provider] : null;
    const isPlaying = playingProvider === provider;
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
          <Feather
            name="mic"
            size={18}
            color={theme.gold}
            style={styles.providerIcon}
          />
          <Text
            style={[
              styles.providerLabel,
              { color: theme.text, fontFamily: "Nunito_700Bold" },
            ]}
          >
            {label}
          </Text>
          {providerResult ? (
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: providerResult.available
                    ? theme.success
                    : theme.error,
                },
              ]}
            />
          ) : null}
        </View>

        {hasError ? (
          <Text
            style={[styles.errorText, { color: theme.error }]}
            testID={`text-error-${provider}`}
          >
            {providerResult?.error || "Provider unavailable"}
          </Text>
        ) : null}

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
              size={20}
              color={isPlaying ? (isDark ? theme.navy : "#FFFFFF") : theme.text}
            />
            <Text
              style={[
                styles.playButtonText,
                {
                  color: isPlaying
                    ? isDark
                      ? theme.navy
                      : "#FFFFFF"
                    : theme.text,
                  fontFamily: "Nunito_600SemiBold",
                },
              ]}
            >
              {isPlaying ? "Stop" : "Play"}
            </Text>
          </Pressable>
        ) : null}

        {!providerResult && !isLoading ? (
          <Text style={[styles.pendingText, { color: theme.textSecondary }]}>
            Generate to compare
          </Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={theme.gold}
            style={styles.cardLoader}
          />
        ) : null}
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
        style={[
          styles.title,
          { color: theme.text, fontFamily: "Nunito_700Bold" },
        ]}
      >
        Voice Comparison
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: theme.textSecondary, fontFamily: "Nunito_400Regular" },
        ]}
      >
        Compare ElevenLabs and Cartesia TTS on the same text
      </Text>

      <Text
        style={[
          styles.inputLabel,
          { color: theme.text, fontFamily: "Nunito_600SemiBold" },
        ]}
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
        numberOfLines={4}
        placeholder="Enter affirmation text..."
        placeholderTextColor={theme.placeholder}
        textAlignVertical="top"
      />

      <Pressable
        testID="button-generate"
        onPress={handleGenerate}
        disabled={isLoading || !text.trim()}
        style={({ pressed }) => [
          styles.generateButton,
          { opacity: pressed ? 0.85 : isLoading || !text.trim() ? 0.5 : 1 },
        ]}
      >
        <LinearGradient
          colors={goldGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.generateGradient}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isDark ? "#0F1C3F" : "#FFFFFF"} />
          ) : (
            <Feather
              name="zap"
              size={20}
              color={isDark ? "#0F1C3F" : "#FFFFFF"}
            />
          )}
          <Text
            style={[
              styles.generateText,
              {
                color: isDark ? "#0F1C3F" : "#FFFFFF",
                fontFamily: "Nunito_700Bold",
              },
            ]}
          >
            {isLoading ? "Generating..." : "Generate Comparison"}
          </Text>
        </LinearGradient>
      </Pressable>

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

      {result || isLoading ? (
        <View style={styles.resultsSection}>
          <Text
            style={[
              styles.resultsTitle,
              { color: theme.text, fontFamily: "Nunito_700Bold" },
            ]}
          >
            Results
          </Text>
          <View style={styles.cardsContainer}>
            {renderProviderCard("elevenlabs", "ElevenLabs")}
            {renderProviderCard("cartesia", "Cartesia")}
          </View>
        </View>
      ) : null}
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
    marginBottom: Spacing.xxl,
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
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
    marginBottom: Spacing.xl,
  },
  generateButton: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginBottom: Spacing.xl,
  },
  generateGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    gap: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  generateText: {
    fontSize: 16,
    lineHeight: 24,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xl,
  },
  errorBannerText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  resultsSection: {
    marginTop: Spacing.sm,
  },
  resultsTitle: {
    fontSize: 20,
    lineHeight: 28,
    marginBottom: Spacing.lg,
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
  providerIcon: {
    marginRight: Spacing.sm,
  },
  providerLabel: {
    fontSize: 18,
    lineHeight: 26,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  playButtonText: {
    fontSize: 16,
    lineHeight: 24,
  },
  pendingText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  cardLoader: {
    marginTop: Spacing.sm,
  },
});
