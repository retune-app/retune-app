import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  FlatList,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  FadeIn,
  SlideInUp,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const NAVY_DARK = "#0F1C3F";
const NAVY_MID = "#1A2D4F";
const GOLD = "#C9A227";
const GOLD_LIGHT = "#E5C95C";
const TEXT_PRIMARY = "#F5F7FA";
const TEXT_SECONDARY = "#8A9AAE";

interface SlideData {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
}

const slides: SlideData[] = [
  {
    key: "breathe",
    title: "Breathe",
    subtitle:
      "Find your calm. Begin each session with guided breathing that quiets the noise.",
    icon: "wind",
  },
  {
    key: "believe",
    title: "Believe",
    subtitle:
      "Hear personalized affirmations crafted for your goals \u2014 in your own voice.",
    icon: "heart",
  },
  {
    key: "become",
    title: "Become",
    subtitle:
      "Transform daily practice into lasting change. Your journey starts now.",
    icon: "sunrise",
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

function PulsingIcon({ icon, isActive }: { icon: keyof typeof Feather.glyphMap; isActive: boolean }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulse.value = withTiming(0, { duration: 300 });
    }
  }, [isActive, pulse]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [1, 1.08]);
    const opacity = interpolate(pulse.value, [0, 1], [0.85, 1]);
    return { transform: [{ scale }], opacity };
  });

  return (
    <Animated.View style={[styles.iconContainer, animatedStyle]}>
      <LinearGradient
        colors={[NAVY_MID, "#243656"]}
        style={styles.iconGradient}
      >
        <Feather name={icon} size={56} color={GOLD_LIGHT} />
      </LinearGradient>
    </Animated.View>
  );
}

function DotIndicator({ total, activeIndex }: { total: number; activeIndex: number }) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <DotItem key={i} isActive={i === activeIndex} />
      ))}
    </View>
  );
}

function DotItem({ isActive }: { isActive: boolean }) {
  const width = useSharedValue(isActive ? 24 : 8);
  const dotOpacity = useSharedValue(isActive ? 1 : 0.4);

  useEffect(() => {
    width.value = withSpring(isActive ? 24 : 8, { damping: 15, stiffness: 150 });
    dotOpacity.value = withTiming(isActive ? 1 : 0.4, { duration: 300 });
  }, [isActive, width, dotOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: width.value,
    opacity: dotOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        animatedStyle,
      ]}
    />
  );
}

function GetStartedButton({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const scale = useSharedValue(0.8);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      buttonOpacity.value = withTiming(1, { duration: 400 });
      scale.value = withSpring(1, { damping: 12, stiffness: 120 });
    } else {
      buttonOpacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.8, { duration: 200 });
    }
  }, [visible, scale, buttonOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: buttonOpacity.value,
  }));

  return visible ? (
    <Animated.View style={[styles.getStartedWrapper, animatedStyle]}>
      <Pressable
        onPress={onPress}
        testID="button-get-started"
        style={({ pressed }) => [
          styles.getStartedPressable,
          pressed ? { opacity: 0.9 } : null,
        ]}
      >
        <LinearGradient
          colors={[GOLD_LIGHT, GOLD]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.getStartedGradient}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
          <Feather name="arrow-right" size={20} color={NAVY_DARK} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  ) : null;
}

function SlideItem({ item, index, activeIndex }: { item: SlideData; index: number; activeIndex: number }) {
  const isActive = index === activeIndex;

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <PulsingIcon icon={item.icon} isActive={isActive} />

      {isActive ? (
        <Animated.View
          entering={SlideInUp.duration(500).delay(100)}
          style={styles.textContainer}
        >
          <Text style={styles.title}>{item.title}</Text>
        </Animated.View>
      ) : (
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
        </View>
      )}

      {isActive ? (
        <Animated.View
          entering={FadeIn.duration(600).delay(250)}
        >
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </Animated.View>
      ) : (
        <View>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
      )}
    </View>
  );
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLastSlide = currentIndex === slides.length - 1;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleGetStarted = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const renderItem = useCallback(
    ({ item, index }: { item: SlideData; index: number }) => (
      <SlideItem item={item} index={index} activeIndex={currentIndex} />
    ),
    [currentIndex]
  );

  return (
    <LinearGradient
      colors={[NAVY_DARK, NAVY_MID, NAVY_DARK]}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + Spacing.md },
        ]}
      >
        {!isLastSlide ? (
          <Pressable
            onPress={handleSkip}
            testID="button-skip"
            hitSlop={16}
            style={({ pressed }) => [
              styles.skipButton,
              pressed ? { opacity: 0.6 } : null,
            ]}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.skipButton} />
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        style={styles.flatList}
      />

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <DotIndicator total={slides.length} activeIndex={currentIndex} />

        <GetStartedButton visible={isLastSlide} onPress={handleGetStarted} />

        {!isLastSlide ? (
          <Pressable
            onPress={() => {
              const nextIndex = currentIndex + 1;
              if (nextIndex < slides.length) {
                flatListRef.current?.scrollToIndex({
                  index: nextIndex,
                  animated: true,
                });
              }
            }}
            testID="button-next"
            style={({ pressed }) => [
              styles.nextButton,
              pressed ? { opacity: 0.8 } : null,
            ]}
          >
            <View style={styles.nextButtonInner}>
              <Text style={styles.nextButtonText}>Next</Text>
              <Feather name="chevron-right" size={18} color={GOLD_LIGHT} />
            </View>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.xl,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minWidth: 60,
  },
  skipText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 16,
    color: TEXT_SECONDARY,
    textAlign: "right",
  },
  flatList: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  iconContainer: {
    marginBottom: Spacing["4xl"],
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(229, 201, 92, 0.3)",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: "Nunito_700Bold",
    fontSize: 36,
    color: TEXT_PRIMARY,
    textAlign: "center",
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: "Nunito_400Regular",
    fontSize: 17,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 26,
    paddingHorizontal: Spacing.lg,
    maxWidth: 320,
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    minHeight: 160,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: GOLD_LIGHT,
  },
  getStartedWrapper: {
    width: "100%",
    maxWidth: 300,
    marginBottom: Spacing.md,
  },
  getStartedPressable: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  getStartedGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  getStartedText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 18,
    color: NAVY_DARK,
    letterSpacing: 0.5,
  },
  nextButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    marginTop: Spacing.sm,
  },
  nextButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  nextButtonText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 16,
    color: GOLD_LIGHT,
  },
});
