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
  forceDarkMode?: boolean;
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

  const charWidth = fontSize * 0.6;
  const beforeWidth = before.length * charWidth;
  const orpHalfWidth = charWidth / 2;
  const baseOffset = -(beforeWidth + orpHalfWidth - (word.length * charWidth) / 2);
  const leftAdjustment = -fontSize * 0.8;
  const offsetX = baseOffset + leftAdjustment;

  return (
    <View style={{ transform: [{ translateX: offsetX }] }}>
      <Text style={[styles.word, { fontSize }]}>
        <Text style={{ color: textColor }}>{before}</Text>
        <Text style={{ color: accentColor, fontWeight: '900' }}>{orpChar}</Text>
        <Text style={{ color: textColor }}>{after}</Text>
      </Text>
    </View>
  );
}

export function RSVPDisplay({
  wordTimings,
  currentPositionMs,
  isPlaying,
  fontSize = "M",
  showHighlight = true,
  forceDarkMode = false,
}: RSVPDisplayProps) {
  const { theme } = useTheme();
  
  // Use light colors for dark background in fullscreen mode
  const textColor = forceDarkMode ? "#F8FAFB" : theme.text;
  const accentColor = forceDarkMode ? "#9B7FFF" : theme.accent;

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
    <View style={styles.container}>

      <Animated.View style={[styles.wordContainer, animatedStyle]}>
        {currentWord &&
          renderWordWithORP(
            currentWord.word,
            fontSizeValue,
            textColor,
            accentColor,
            showHighlight
          )}
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  wordContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
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
});
