import React, { useMemo, useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  useSharedValue,
  Easing,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
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
  const accentColor = forceDarkMode ? "#E5C95C" : theme.accent;

  const currentWord = useMemo(() => {
    if (!wordTimings || wordTimings.length === 0) {
      return null;
    }

    for (let i = wordTimings.length - 1; i >= 0; i--) {
      if (currentPositionMs >= wordTimings[i].startMs) {
        if (currentPositionMs <= wordTimings[i].endMs + 200) {
          return wordTimings[i];
        }
        if (i < wordTimings.length - 1) {
          const gapToNext = wordTimings[i + 1].startMs - wordTimings[i].endMs;
          if (gapToNext > 500) {
            return null;
          }
        }
        return wordTimings[i];
      }
    }

    return null;
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

  const pulseOpacity = useSharedValue(0.4);
  const pulseScale = useSharedValue(0.95);
  const dotOpacity1 = useSharedValue(0.3);
  const dotOpacity2 = useSharedValue(0.3);
  const dotOpacity3 = useSharedValue(0.3);

  useEffect(() => {
    if (!wordTimings || wordTimings.length === 0) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.95, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      dotOpacity1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      dotOpacity2.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 200 }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      dotOpacity3.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 400 }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }
  }, [wordTimings]);

  const pulseAnimStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));
  const dot1Style = useAnimatedStyle(() => ({ opacity: dotOpacity1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dotOpacity2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: dotOpacity3.value }));

  if (!wordTimings || wordTimings.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Animated.View style={[styles.emptyIconWrap, pulseAnimStyle]}>
          <Feather name="type" size={40} color="#E5C95C" />
        </Animated.View>
        <Text style={styles.emptyTitle}>Preparing your words</Text>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, dot1Style]} />
          <Animated.View style={[styles.dot, dot2Style]} />
          <Animated.View style={[styles.dot, dot3Style]} />
        </View>
        <Text style={styles.emptySubtitle}>
          Your affirmation text will appear here, synced word-by-word with the audio
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
  emptyContainer: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    gap: 16,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(229, 201, 92, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(229, 201, 92, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Nunito_700Bold',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.5,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5C95C',
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 260,
  },
});
