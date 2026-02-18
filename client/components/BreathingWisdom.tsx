import React, { useEffect, useRef, useState, useCallback } from "react";
import { Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { getApiUrl } from "@/lib/query-client";

interface BreathingWisdomProps {
  techniqueId: string;
  isPlaying: boolean;
  cyclesCompleted: number;
  isLandscape?: boolean;
}

const MIN_DELAY_MS = 10000;
const MIN_BETWEEN_TIPS_MS = 25000;
const DISPLAY_DURATION_MS = 6000;
const FADE_DURATION_MS = 1200;

export default function BreathingWisdom({
  techniqueId,
  isPlaying,
  cyclesCompleted,
  isLandscape = false,
}: BreathingWisdomProps) {
  const [wisdom, setWisdom] = useState<string[]>([]);
  const [currentTip, setCurrentTip] = useState<string | null>(null);
  const wisdomIndex = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const lastTipTimeRef = useRef<number>(0);
  const lastShownCycle = useRef(-1);
  const hasShownFirst = useRef(false);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const fetchWisdom = async () => {
      try {
        const url = new URL(`/api/breathing-wisdom?techniqueId=${techniqueId}`, getApiUrl());
        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          setWisdom(data.wisdom || []);
        }
      } catch {}
    };
    fetchWisdom();
  }, [techniqueId]);

  useEffect(() => {
    if (isPlaying && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      hasShownFirst.current = false;
      lastShownCycle.current = -1;
      wisdomIndex.current = 0;
    }
    if (!isPlaying) {
      startTimeRef.current = null;
      hasShownFirst.current = false;
      lastShownCycle.current = -1;
      opacity.value = withTiming(0, { duration: 400 });
      setCurrentTip(null);
    }
  }, [isPlaying]);

  const showNextTip = useCallback(() => {
    if (wisdom.length === 0) return;
    const tip = wisdom[wisdomIndex.current % wisdom.length];
    wisdomIndex.current += 1;
    lastTipTimeRef.current = Date.now();
    setCurrentTip(tip);

    opacity.value = 0;
    opacity.value = withSequence(
      withTiming(1, { duration: FADE_DURATION_MS, easing: Easing.out(Easing.ease) }),
      withDelay(
        DISPLAY_DURATION_MS,
        withTiming(0, { duration: FADE_DURATION_MS, easing: Easing.in(Easing.ease) })
      )
    );
  }, [wisdom]);

  useEffect(() => {
    if (!isPlaying || wisdom.length === 0) return;

    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;

    if (!hasShownFirst.current) {
      if (elapsed >= MIN_DELAY_MS && cyclesCompleted >= 1) {
        hasShownFirst.current = true;
        lastShownCycle.current = cyclesCompleted;
        showNextTip();
      }
      return;
    }

    const cyclesSinceLast = cyclesCompleted - lastShownCycle.current;
    const timeSinceLastTip = Date.now() - lastTipTimeRef.current;
    if (cyclesSinceLast >= 2 && timeSinceLastTip >= MIN_BETWEEN_TIPS_MS) {
      lastShownCycle.current = cyclesCompleted;
      showNextTip();
    }
  }, [cyclesCompleted, isPlaying, wisdom, showNextTip]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!currentTip) return null;

  if (isLandscape) {
    return (
      <Animated.View style={[styles.landscapeContainer, animatedStyle]}>
        <Text style={styles.wisdomText} numberOfLines={3}>{currentTip}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.portraitContainer, animatedStyle]}>
      <Text style={styles.wisdomText} numberOfLines={3}>{currentTip}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  portraitContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
    maxWidth: 320,
    alignSelf: "center",
    zIndex: 5,
  },
  landscapeContainer: {
    maxWidth: 160,
    paddingHorizontal: 8,
    marginTop: 12,
  },
  wisdomText: {
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    lineHeight: 20,
    letterSpacing: 0.3,
    fontStyle: "italic",
  },
});
