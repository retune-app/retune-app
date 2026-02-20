import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { File } from "expo-file-system/next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getAuthToken } from "@/lib/auth-token";

const GOLD = "#C9A227";
const DEFAULT_TEXT = "I am calm, focused, and in control of my energy. Every breath I take brings me closer to the person I am becoming.";

type Phase = "record" | "generating" | "results";

interface ProviderResult {
  provider: string;
  audioBase64: string | null;
  durationMs: number;
  error: string | null;
}

interface ABResult {
  results: ProviderResult[];
  generationTimeMs: { elevenlabs: number; chatterbox: number };
}

export default function DevABTestScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();

  const [phase, setPhase] = useState<Phase>("record");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [text, setText] = useState(DEFAULT_TEXT);
  const [abResult, setAbResult] = useState<ABResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundARef = useRef<Audio.Sound | null>(null);
  const soundBRef = useRef<Audio.Sound | null>(null);
  const [playingA, setPlayingA] = useState(false);
  const [playingB, setPlayingB] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [labelOrder, setLabelOrder] = useState<[string, string]>(["elevenlabs", "chatterbox"]);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

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

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);

      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    } catch (err) {
      console.error("Recording start failed:", err);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (uri) setRecordingUri(uri);
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    } catch (err) {
      console.error("Recording stop failed:", err);
    }
  }, []);

  const runABTest = useCallback(async () => {
    if (!recordingUri || !text.trim()) return;

    setPhase("generating");
    setError(null);
    setAbResult(null);
    setRevealed(false);

    const shuffled: [string, string] = Math.random() > 0.5
      ? ["elevenlabs", "chatterbox"]
      : ["chatterbox", "elevenlabs"];
    setLabelOrder(shuffled);

    try {
      const formData = new FormData();
      formData.append("text", text.trim());

      if (Platform.OS === "web") {
        const response = await fetch(recordingUri);
        const blob = await response.blob();
        formData.append("voiceClip", blob, "voice.wav");
      } else {
        const file = new File(recordingUri);
        if (!file.exists) throw new Error("Recording file not found");
        formData.append("voiceClip", {
          uri: recordingUri,
          name: "voice.m4a",
          type: "audio/m4a",
        } as any);
      }

      const apiUrl = getApiUrl();
      const url = new URL("/api/dev/ab-test", apiUrl).toString();
      const authToken = getAuthToken();

      const headers: Record<string, string> = {};
      if (authToken) headers["X-Auth-Token"] = authToken;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      const data: ABResult = await res.json();
      setAbResult(data);
      setPhase("results");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setPhase("record");
    }
  }, [recordingUri, text]);

  const playAudio = useCallback(async (base64: string, label: "A" | "B") => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = `data:audio/mp3;base64,${base64}`;
      const { sound } = await Audio.Sound.createAsync({ uri });

      if (label === "A") {
        if (soundARef.current) await soundARef.current.unloadAsync();
        soundARef.current = sound;
        setPlayingA(true);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) setPlayingA(false);
        });
      } else {
        if (soundBRef.current) await soundBRef.current.unloadAsync();
        soundBRef.current = sound;
        setPlayingB(true);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) setPlayingB(false);
        });
      }

      await sound.playAsync();
    } catch (err) {
      console.error("Playback failed:", err);
    }
  }, []);

  const resetTest = useCallback(() => {
    setPhase("record");
    setRecordingUri(null);
    setRecordingDuration(0);
    setAbResult(null);
    setRevealed(false);
    setError(null);
  }, []);

  const cardBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const inputBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const getResultForLabel = (label: "A" | "B"): ProviderResult | undefined => {
    if (!abResult) return undefined;
    const provider = label === "A" ? labelOrder[0] : labelOrder[1];
    return abResult.results.find((r) => r.provider === provider);
  };

  const getTimeForLabel = (label: "A" | "B"): number => {
    if (!abResult) return 0;
    const provider = label === "A" ? labelOrder[0] : labelOrder[1];
    return abResult.generationTimeMs[provider as keyof typeof abResult.generationTimeMs] || 0;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }}
    >
      <View style={styles.content}>
        <ThemedText style={styles.title}>Voice Quality A/B Test</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Record your voice once, hear both providers side by side (blind)
        </ThemedText>

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: "rgba(239,68,68,0.1)" }]}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <ThemedText style={[styles.errorText, { color: "#EF4444" }]}>{error}</ThemedText>
          </View>
        ) : null}

        {phase === "record" || phase === "generating" ? (
          <>
            <View style={[styles.card, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.sectionLabel}>1. Record Your Voice (5-10 seconds)</ThemedText>
              <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
                Read anything naturally — this is your voice reference
              </ThemedText>

              <View style={styles.recorderRow}>
                {recordingUri ? (
                  <View style={styles.recordedRow}>
                    <Feather name="check-circle" size={20} color="#22C55E" />
                    <ThemedText style={{ color: "#22C55E", marginLeft: 8 }}>
                      Recorded ({recordingDuration}s)
                    </ThemedText>
                    <Pressable
                      onPress={resetTest}
                      style={[styles.smallBtn, { backgroundColor: inputBg, marginLeft: 12 }]}
                    >
                      <Feather name="refresh-cw" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.smallBtnText, { color: theme.textSecondary }]}>
                        Re-record
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={isRecording ? stopRecording : startRecording}
                    style={[
                      styles.recordBtn,
                      { backgroundColor: isRecording ? "#EF4444" : GOLD },
                    ]}
                  >
                    <Feather
                      name={isRecording ? "square" : "mic"}
                      size={20}
                      color="#FFFFFF"
                    />
                    <ThemedText style={styles.recordBtnText}>
                      {isRecording ? `Stop (${recordingDuration}s)` : "Start Recording"}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: cardBg }]}>
              <ThemedText style={styles.sectionLabel}>2. Affirmation Text</ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                  },
                ]}
                multiline
                numberOfLines={4}
                value={text}
                onChangeText={setText}
                placeholder="Enter the text to synthesize..."
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <Pressable
              onPress={runABTest}
              disabled={!recordingUri || !text.trim() || phase === "generating"}
              style={[
                styles.generateBtn,
                {
                  backgroundColor: recordingUri && text.trim() ? GOLD : inputBg,
                  opacity: recordingUri && text.trim() && phase !== "generating" ? 1 : 0.5,
                },
              ]}
            >
              {phase === "generating" ? (
                <View style={styles.generatingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <ThemedText style={styles.generateBtnText}>
                    Generating from both providers...
                  </ThemedText>
                </View>
              ) : (
                <>
                  <Feather name="zap" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.generateBtnText}>Generate A/B Test</ThemedText>
                </>
              )}
            </Pressable>

            {phase === "generating" ? (
              <ThemedText style={[styles.hint, { color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }]}>
                This may take 30-60 seconds (HuggingFace queue)
              </ThemedText>
            ) : null}
          </>
        ) : null}

        {phase === "results" && abResult ? (
          <>
            {(["A", "B"] as const).map((label) => {
              const result = getResultForLabel(label);
              const timeMs = getTimeForLabel(label);
              const isPlaying = label === "A" ? playingA : playingB;

              return (
                <View key={label} style={[styles.card, { backgroundColor: cardBg }]}>
                  <View style={styles.resultHeader}>
                    <View style={[styles.labelBadge, { backgroundColor: label === "A" ? "#3B82F6" : "#8B5CF6" }]}>
                      <ThemedText style={styles.labelText}>{label}</ThemedText>
                    </View>
                    {revealed ? (
                      <View style={[styles.providerBadge, { backgroundColor: inputBg }]}>
                        <ThemedText style={[styles.providerText, { color: theme.text }]}>
                          {label === "A" ? labelOrder[0] : labelOrder[1]}
                        </ThemedText>
                      </View>
                    ) : null}
                    <ThemedText style={[styles.timeText, { color: theme.textSecondary }]}>
                      {(timeMs / 1000).toFixed(1)}s
                    </ThemedText>
                  </View>

                  {result?.error ? (
                    <View style={[styles.errorCard, { backgroundColor: "rgba(239,68,68,0.1)" }]}>
                      <ThemedText style={{ color: "#EF4444", fontSize: 13 }}>
                        Failed: {result.error}
                      </ThemedText>
                    </View>
                  ) : result?.audioBase64 ? (
                    <Pressable
                      onPress={() => playAudio(result.audioBase64!, label)}
                      style={[
                        styles.playBtn,
                        {
                          backgroundColor: isPlaying
                            ? (label === "A" ? "rgba(59,130,246,0.15)" : "rgba(139,92,246,0.15)")
                            : inputBg,
                        },
                      ]}
                    >
                      <Feather
                        name={isPlaying ? "pause" : "play"}
                        size={22}
                        color={label === "A" ? "#3B82F6" : "#8B5CF6"}
                      />
                      <ThemedText style={{ color: theme.text, marginLeft: 10, fontSize: 15 }}>
                        {isPlaying ? "Playing..." : `Play ${label}`}
                      </ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}

            <Pressable
              onPress={() => setRevealed(true)}
              disabled={revealed}
              style={[
                styles.revealBtn,
                {
                  backgroundColor: revealed ? inputBg : GOLD,
                  opacity: revealed ? 0.5 : 1,
                },
              ]}
            >
              <Feather name="eye" size={18} color={revealed ? theme.textSecondary : "#FFFFFF"} />
              <ThemedText
                style={[
                  styles.generateBtnText,
                  { color: revealed ? theme.textSecondary : "#FFFFFF" },
                ]}
              >
                {revealed ? "Providers Revealed" : "Reveal Which is Which"}
              </ThemedText>
            </Pressable>

            {revealed && abResult ? (
              <View style={[styles.card, { backgroundColor: cardBg, marginTop: Spacing.md }]}>
                <ThemedText style={styles.sectionLabel}>Generation Speed</ThemedText>
                <View style={styles.speedRow}>
                  <ThemedText style={{ color: theme.text }}>ElevenLabs:</ThemedText>
                  <ThemedText style={{ color: GOLD, fontWeight: "600" }}>
                    {(abResult.generationTimeMs.elevenlabs / 1000).toFixed(1)}s
                  </ThemedText>
                </View>
                <View style={styles.speedRow}>
                  <ThemedText style={{ color: theme.text }}>Chatterbox:</ThemedText>
                  <ThemedText style={{ color: GOLD, fontWeight: "600" }}>
                    {(abResult.generationTimeMs.chatterbox / 1000).toFixed(1)}s
                  </ThemedText>
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={resetTest}
              style={[styles.resetBtn, { backgroundColor: inputBg }]}
            >
              <Feather name="refresh-cw" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.resetBtnText, { color: theme.textSecondary }]}>
                Start New Test
              </ThemedText>
            </Pressable>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: Spacing.lg },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionLabel: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  hint: { fontSize: 13, marginBottom: Spacing.sm },
  recorderRow: { marginTop: Spacing.sm },
  recordedRow: { flexDirection: "row", alignItems: "center" },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  recordBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  smallBtnText: { fontSize: 13 },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  generatingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  generateBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  errorText: { fontSize: 13, flex: 1 },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: 8,
  },
  labelBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  labelText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  providerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  providerText: { fontSize: 12, fontWeight: "500" },
  timeText: { fontSize: 12, marginLeft: "auto" },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  revealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    gap: 8,
    marginTop: Spacing.sm,
  },
  speedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    gap: 8,
    marginTop: Spacing.md,
  },
  resetBtnText: { fontWeight: "500", fontSize: 14 },
});
