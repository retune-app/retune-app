import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export type RSVPFontSize = "S" | "M" | "L" | "XL";

interface RSVPDisplayProps {
  wordTimings: WordTiming[];
  currentPositionMs: number;
  isPlaying: boolean;
  fontSize?: RSVPFontSize;
  showHighlight?: boolean;
}

const FONT_SIZES: Record<RSVPFontSize, number> = {
  S: 28,
  M: 36,
  L: 48,
  XL: 64,
};

function getORPIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return Math.floor(len / 2) - 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

function renderWordWithORP(
  word: string,
  fontSize: number,
  textColor: string,
  accentColor: string,
  showHighlight: boolean
) {
  if (!showHighlight) {
    return (
      <Text style={[styles.word, { fontSize, color: textColor }]}>
        {word}
      </Text>
    );
  }

  const orpIndex = getORPIndex(word);
  const before = word.slice(0, orpIndex);
  const orpChar = word[orpIndex] || "";
  const after = word.slice(orpIndex + 1);

  return (
    <Text style={[styles.word, { fontSize }]}>
      <Text style={{ color: textColor }}>{before}</Text>
      <Text style={{ color: accentColor }}>{orpChar}</Text>
      <Text style={{ color: textColor }}>{after}</Text>
    </Text>
  );
}

export function RSVPDisplay({
  wordTimings,
  currentPositionMs,
  isPlaying,
  fontSize = "M",
  showHighlight = true,
}: RSVPDisplayProps) {
  const { theme } = useTheme();

  const currentWord = useMemo(() => {
    if (!wordTimings || wordTimings.length === 0) {
      return null;
    }

    for (let i = wordTimings.length - 1; i >= 0; i--) {
      if (currentPositionMs >= wordTimings[i].startMs) {
        return wordTimings[i];
      }
    }

    return wordTimings[0];
  }, [wordTimings, currentPositionMs]);

  const wordIndex = useMemo(() => {
    if (!currentWord || !wordTimings) return 0;
    return wordTimings.findIndex(
      (w) => w.startMs === currentWord.startMs && w.word === currentWord.word
    );
  }, [currentWord, wordTimings]);

  const progress = useMemo(() => {
    if (!wordTimings || wordTimings.length === 0) return 0;
    return Math.round((wordIndex / wordTimings.length) * 100);
  }, [wordIndex, wordTimings]);

  const fontSizeValue = FONT_SIZES[fontSize];

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isPlaying ? 1 : 0.7, {
        duration: 150,
        easing: Easing.ease,
      }),
      transform: [
        {
          scale: withTiming(isPlaying ? 1 : 0.95, {
            duration: 150,
            easing: Easing.ease,
          }),
        },
      ],
    };
  });

  if (!wordTimings || wordTimings.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>
          No word timing data available
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={styles.progressInfo}>
        <Text style={[styles.progressText, { color: theme.textSecondary }]}>
          {wordIndex + 1} of {wordTimings.length} words
        </Text>
        <Text style={[styles.progressText, { color: theme.textSecondary }]}>
          {progress}%
        </Text>
      </View>

      <Animated.View style={[styles.wordContainer, animatedStyle]}>
        {showHighlight && (
          <View style={[styles.fixationLine, { backgroundColor: theme.accent }]} />
        )}
        {currentWord &&
          renderWordWithORP(
            currentWord.word,
            fontSizeValue,
            theme.text,
            theme.accent,
            showHighlight
          )}
      </Animated.View>

      <View style={[styles.progressBar, { backgroundColor: theme.backgroundTertiary }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.primary,
              width: `${progress}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: Spacing.lg,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Nunito_400Regular",
  },
  wordContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
    position: "relative",
  },
  fixationLine: {
    position: "absolute",
    width: 2,
    height: 20,
    top: -10,
    opacity: 0.6,
  },
  word: {
    fontFamily: "Nunito_700Bold",
    textAlign: "center",
    letterSpacing: 1,
  },
  placeholder: {
    fontSize: 16,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
  },
  progressBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.lg,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});
