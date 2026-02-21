import React, { useEffect, useRef, useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export type RSVPFontSize = "S" | "M" | "L" | "XL" | "LANDSCAPE";

interface RSVPDisplayProps {
  wordTimings: WordTiming[];
  currentPositionMs: number;
  isPlaying: boolean;
  fontSize?: RSVPFontSize;
  showHighlight?: boolean;
  forceDarkMode?: boolean;
  ambient?: boolean;
}

const FONT_SIZES: Record<RSVPFontSize, number> = {
  S: 24,
  M: 32,
  L: 40,
  XL: 52,
  LANDSCAPE: 72,
};

function getORPIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return Math.floor(len / 2) - 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

function isStandalonePunctuation(word: string): boolean {
  return /^[,.!?;:'\-"—–…]+$/.test(word);
}

function stripPunctuation(word: string): string {
  return word.replace(/[^a-zA-Z0-9']/g, "");
}

function splitMergedWords(word: string): string {
  const match = word.match(/^([a-z]+)([A-Z])/);
  if (match) {
    return match[1];
  }
  return word;
}

function renderWordWithORP(
  word: string,
  fontSize: number,
  textColor: string,
  accentColor: string,
  showHighlight: boolean,
  ambient: boolean
) {
  if (!showHighlight || ambient) {
    return (
      <Text style={[
        ambient ? styles.wordAmbient : styles.word,
        { fontSize, color: textColor }
      ]}>
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
  ambient = false,
}: RSVPDisplayProps) {
  const { theme } = useTheme();
  
  const textColor = forceDarkMode ? "#F8FAFB" : theme.text;
  const accentColor = forceDarkMode ? "#E5C95C" : theme.accent;

  const wordOpacity = useSharedValue(0);
  const prevWordRef = useRef<string | null>(null);

  const currentWord = useMemo(() => {
    if (!wordTimings || wordTimings.length === 0) {
      return null;
    }

    for (let i = wordTimings.length - 1; i >= 0; i--) {
      if (currentPositionMs >= wordTimings[i].startMs) {
        if (!isStandalonePunctuation(wordTimings[i].word)) {
          return wordTimings[i];
        }
        for (let j = i - 1; j >= 0; j--) {
          if (!isStandalonePunctuation(wordTimings[j].word)) {
            return wordTimings[j];
          }
        }
        return null;
      }
    }

    return null;
  }, [wordTimings, currentPositionMs]);

  const displayWord = currentWord ? (splitMergedWords(stripPunctuation(currentWord.word)) || currentWord.word) : null;

  useEffect(() => {
    if (ambient) {
      if (displayWord && displayWord !== prevWordRef.current) {
        wordOpacity.value = 0;
        wordOpacity.value = withTiming(0.55, {
          duration: 400,
          easing: Easing.out(Easing.ease),
        });
      } else if (!displayWord && prevWordRef.current) {
        wordOpacity.value = withTiming(0, {
          duration: 500,
          easing: Easing.in(Easing.ease),
        });
      }
      prevWordRef.current = displayWord;
    }
  }, [displayWord, ambient]);


  const fontSizeValue = FONT_SIZES[fontSize];

  const animatedStyle = useAnimatedStyle(() => {
    if (ambient) {
      return {
        opacity: wordOpacity.value,
        transform: [{ scale: 1 }],
      };
    }
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
      <View style={styles.container}>
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>
          Preparing your affirmation...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <Animated.View style={[styles.wordContainer, animatedStyle]}>
        {displayWord ?
          renderWordWithORP(
            displayWord,
            fontSizeValue,
            textColor,
            accentColor,
            showHighlight,
            ambient
          ) : null}
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
  wordAmbient: {
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
    letterSpacing: 2,
  },
  placeholder: {
    fontSize: 16,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
  },
});
