import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, ImageBackground, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
} from "react-native-reanimated";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import Slider from "@react-native-community/slider";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useBackgroundMusic, getSoundsByCategory, BackgroundMusicOption, BackgroundMusicType, getAudioFile } from "@/contexts/BackgroundMusicContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

const profileBackgroundDark = require("../../assets/images/library-background.png");
const profileBackgroundLight = require("../../assets/images/library-background-light.png");

const ACCENT_GOLD = "#C9A227";

const CATEGORY_INFO = {
  rain: {
    title: "Rain",
    subtitle: "Soothing rainfall sounds",
    emoji: "cloud-rain",
    color: "#4FC3F7",
  },
  ocean: {
    title: "Ocean",
    subtitle: "Calming waves & coastal sounds",
    emoji: "droplet",
    color: "#29B6F6",
  },
  forest: {
    title: "Forest & Birds",
    subtitle: "Peaceful natural environments",
    emoji: "feather",
    color: "#66BB6A",
  },
  meditation: {
    title: "Meditation",
    subtitle: "Ambient music for inner peace",
    emoji: "heart",
    color: "#E040FB",
  },
  solfeggio: {
    title: "Solfeggio Frequencies",
    subtitle: "Ancient healing tones",
    emoji: "star",
    color: ACCENT_GOLD,
  },
  binaural: {
    title: "Binaural Beats",
    subtitle: "Brainwave entrainment",
    emoji: "activity",
    color: "#9C27B0",
  },
  noise: {
    title: "Noise",
    subtitle: "Ambient noise for focus & sleep",
    emoji: "radio",
    color: "#78909C",
  },
};

function getCategoryColor(soundId: string): string {
  if (soundId.startsWith("rain-")) return CATEGORY_INFO.rain.color;
  if (soundId.startsWith("ocean-")) return CATEGORY_INFO.ocean.color;
  if (soundId.startsWith("forest-")) return CATEGORY_INFO.forest.color;
  if (soundId.startsWith("meditation-")) return CATEGORY_INFO.meditation.color;
  if (soundId.startsWith("solfeggio-")) return CATEGORY_INFO.solfeggio.color;
  if (soundId.startsWith("binaural-")) return CATEGORY_INFO.binaural.color;
  if (soundId.startsWith("noise-")) return CATEGORY_INFO.noise.color;
  return CATEGORY_INFO.rain.color;
}

function RainAccent() {
  const drop1Y = useSharedValue(0);
  const drop2Y = useSharedValue(0);
  const drop3Y = useSharedValue(0);
  const drop1Opacity = useSharedValue(0.4);
  const drop2Opacity = useSharedValue(0.3);
  const drop3Opacity = useSharedValue(0.35);

  useEffect(() => {
    drop1Y.value = withRepeat(withTiming(8, { duration: 1200 }), -1, true);
    drop1Opacity.value = withRepeat(withSequence(withTiming(0.5, { duration: 600 }), withTiming(0.15, { duration: 600 })), -1, true);
    drop2Y.value = withDelay(400, withRepeat(withTiming(8, { duration: 1400 }), -1, true));
    drop2Opacity.value = withDelay(400, withRepeat(withSequence(withTiming(0.45, { duration: 700 }), withTiming(0.1, { duration: 700 })), -1, true));
    drop3Y.value = withDelay(800, withRepeat(withTiming(8, { duration: 1000 }), -1, true));
    drop3Opacity.value = withDelay(800, withRepeat(withSequence(withTiming(0.5, { duration: 500 }), withTiming(0.15, { duration: 500 })), -1, true));
  }, []);

  const style1 = useAnimatedStyle(() => ({ transform: [{ translateY: drop1Y.value }], opacity: drop1Opacity.value }));
  const style2 = useAnimatedStyle(() => ({ transform: [{ translateY: drop2Y.value }], opacity: drop2Opacity.value }));
  const style3 = useAnimatedStyle(() => ({ transform: [{ translateY: drop3Y.value }], opacity: drop3Opacity.value }));

  const dotStyle = { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#64B5F6", position: "absolute" as const };

  return (
    <>
      <Animated.View style={[dotStyle, { top: 6, left: 10 }, style1]} />
      <Animated.View style={[dotStyle, { top: 4, right: 12 }, style2]} />
      <Animated.View style={[dotStyle, { top: 10, left: 22 }, style3]} />
    </>
  );
}

function OceanAccent() {
  const wave1X = useSharedValue(0);
  const wave2X = useSharedValue(0);

  useEffect(() => {
    wave1X.value = withRepeat(withTiming(3, { duration: 2000 }), -1, true);
    wave2X.value = withDelay(500, withRepeat(withTiming(-3, { duration: 2200 }), -1, true));
  }, []);

  const style1 = useAnimatedStyle(() => ({ transform: [{ translateX: wave1X.value }], opacity: 0.35 }));
  const style2 = useAnimatedStyle(() => ({ transform: [{ translateX: wave2X.value }], opacity: 0.25 }));

  return (
    <>
      <Animated.View style={[{ position: "absolute", bottom: 4, left: 4, right: 4, height: 2, borderRadius: 1, backgroundColor: "#4FC3F7" }, style1]} />
      <Animated.View style={[{ position: "absolute", bottom: 8, left: 6, right: 6, height: 1.5, borderRadius: 1, backgroundColor: "#29B6F6" }, style2]} />
    </>
  );
}

function ForestAccent() {
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.2);

  useEffect(() => {
    glowScale.value = withRepeat(withTiming(1.15, { duration: 2000 }), -1, true);
    glowOpacity.value = withRepeat(withSequence(withTiming(0.4, { duration: 1000 }), withTiming(0.15, { duration: 1000 })), -1, true);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View style={[{
      position: "absolute", top: -3, left: -3, right: -3, bottom: -3,
      borderRadius: 27, borderWidth: 2, borderColor: "#66BB6A",
    }, style]} />
  );
}

function WindAccent() {
  const line1X = useSharedValue(-4);
  const line2X = useSharedValue(-2);
  const line3X = useSharedValue(-3);

  useEffect(() => {
    line1X.value = withRepeat(withTiming(4, { duration: 1500 }), -1, true);
    line2X.value = withDelay(300, withRepeat(withTiming(3, { duration: 1800 }), -1, true));
    line3X.value = withDelay(600, withRepeat(withTiming(4, { duration: 1300 }), -1, true));
  }, []);

  const style1 = useAnimatedStyle(() => ({ transform: [{ translateX: line1X.value }], opacity: 0.35 }));
  const style2 = useAnimatedStyle(() => ({ transform: [{ translateX: line2X.value }], opacity: 0.25 }));
  const style3 = useAnimatedStyle(() => ({ transform: [{ translateX: line3X.value }], opacity: 0.3 }));

  const lineBase = { position: "absolute" as const, height: 1.5, borderRadius: 1, backgroundColor: "#90CAF9" };

  return (
    <>
      <Animated.View style={[lineBase, { top: 12, left: 6, width: 14 }, style1]} />
      <Animated.View style={[lineBase, { top: 20, left: 10, width: 12 }, style2]} />
      <Animated.View style={[lineBase, { top: 28, left: 4, width: 16 }, style3]} />
    </>
  );
}

function SolfeggioAccent({ color }: { color: string }) {
  const ring1Scale = useSharedValue(1);
  const ring2Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.3);
  const ring2Opacity = useSharedValue(0.2);

  useEffect(() => {
    ring1Scale.value = withRepeat(withTiming(1.2, { duration: 1800 }), -1, true);
    ring1Opacity.value = withRepeat(withSequence(withTiming(0.4, { duration: 900 }), withTiming(0.1, { duration: 900 })), -1, true);
    ring2Scale.value = withDelay(400, withRepeat(withTiming(1.3, { duration: 2200 }), -1, true));
    ring2Opacity.value = withDelay(400, withRepeat(withSequence(withTiming(0.3, { duration: 1100 }), withTiming(0.05, { duration: 1100 })), -1, true));
  }, []);

  const style1 = useAnimatedStyle(() => ({ transform: [{ scale: ring1Scale.value }], opacity: ring1Opacity.value }));
  const style2 = useAnimatedStyle(() => ({ transform: [{ scale: ring2Scale.value }], opacity: ring2Opacity.value }));

  const ringBase = {
    position: "absolute" as const, borderRadius: 24, borderWidth: 1.5, borderColor: color,
    justifyContent: "center" as const, alignItems: "center" as const,
  };

  return (
    <>
      <Animated.View style={[ringBase, { top: -2, left: -2, right: -2, bottom: -2 }, style1]} />
      <Animated.View style={[ringBase, { top: -5, left: -5, right: -5, bottom: -5 }, style2]} />
    </>
  );
}

function BinauralAccent({ color }: { color: string }) {
  const bar1H = useSharedValue(6);
  const bar2H = useSharedValue(10);
  const bar3H = useSharedValue(4);
  const bar4H = useSharedValue(8);

  useEffect(() => {
    bar1H.value = withRepeat(withSequence(withTiming(12, { duration: 500 }), withTiming(4, { duration: 500 })), -1, true);
    bar2H.value = withDelay(150, withRepeat(withSequence(withTiming(14, { duration: 600 }), withTiming(3, { duration: 600 })), -1, true));
    bar3H.value = withDelay(300, withRepeat(withSequence(withTiming(10, { duration: 450 }), withTiming(5, { duration: 450 })), -1, true));
    bar4H.value = withDelay(100, withRepeat(withSequence(withTiming(13, { duration: 550 }), withTiming(4, { duration: 550 })), -1, true));
  }, []);

  const s1 = useAnimatedStyle(() => ({ height: bar1H.value }));
  const s2 = useAnimatedStyle(() => ({ height: bar2H.value }));
  const s3 = useAnimatedStyle(() => ({ height: bar3H.value }));
  const s4 = useAnimatedStyle(() => ({ height: bar4H.value }));

  const barBase = { width: 2, borderRadius: 1, backgroundColor: color, opacity: 0.4 };

  return (
    <View style={{ position: "absolute", bottom: 6, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 2 }}>
      <Animated.View style={[barBase, s1]} />
      <Animated.View style={[barBase, s2]} />
      <Animated.View style={[barBase, s3]} />
      <Animated.View style={[barBase, s4]} />
    </View>
  );
}

function AnimatedSoundAccent({ soundId }: { soundId: string }) {
  if (soundId.startsWith("rain-")) return <RainAccent />;
  if (soundId.startsWith("ocean-")) return <OceanAccent />;
  if (soundId.startsWith("forest-")) return <ForestAccent />;
  if (soundId.startsWith("meditation-")) return <SolfeggioAccent color={CATEGORY_INFO.meditation.color} />;
  if (soundId.startsWith("solfeggio-")) return <SolfeggioAccent color={ACCENT_GOLD} />;
  if (soundId.startsWith("binaural-")) {
    const binauralColors: Record<string, string> = {
      "binaural-theta": "#CE93D8",
      "binaural-alpha": "#FFB74D",
      "binaural-delta": "#90CAF9",
      "binaural-beta": "#FFD54F",
    };
    return <BinauralAccent color={binauralColors[soundId] || CATEGORY_INFO.binaural.color} />;
  }
  if (soundId.startsWith("noise-")) return <WindAccent />;
  return null;
}

function SelectedLeftBar({ color }: { color: string }) {
  const barOpacity = useSharedValue(0.6);

  useEffect(() => {
    barOpacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 1200 }), withTiming(0.5, { duration: 1200 })),
      -1, true
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: barOpacity.value }));

  return (
    <Animated.View style={[{
      position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
      backgroundColor: color, borderTopLeftRadius: 3, borderBottomLeftRadius: 3,
    }, style]} />
  );
}

function CategoryDivider({ color }: { color: string }) {
  const lineOpacity = useSharedValue(0.3);
  const lineScaleX = useSharedValue(0.7);

  useEffect(() => {
    lineOpacity.value = withRepeat(
      withSequence(withTiming(0.6, { duration: 2000 }), withTiming(0.2, { duration: 2000 })),
      -1, true
    );
    lineScaleX.value = withRepeat(
      withSequence(withTiming(1, { duration: 2000 }), withTiming(0.7, { duration: 2000 })),
      -1, true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: lineOpacity.value,
    transform: [{ scaleX: lineScaleX.value }],
  }));

  return (
    <Animated.View style={[{
      height: 1.5, borderRadius: 1, backgroundColor: color, marginTop: Spacing.xs,
    }, style]} />
  );
}

interface SoundItemProps {
  option: BackgroundMusicOption;
  isSelected: boolean;
  isPreviewing: boolean;
  onSelect: () => void;
  onPreview: () => void;
}

function SoundItem({ option, isSelected, isPreviewing, onSelect, onPreview }: SoundItemProps) {
  const { theme } = useTheme();
  const categoryColor = getCategoryColor(option.id);

  const itemContent = (
    <>
      {isSelected ? <SelectedLeftBar color={categoryColor} /> : null}
      <View style={[
        styles.soundIconContainer, 
        { backgroundColor: isPreviewing ? `${categoryColor}30` : isSelected ? `${ACCENT_GOLD}30` : theme.backgroundSecondary }
      ]}>
        <AnimatedSoundAccent soundId={option.id} />
        <Feather 
          name={isPreviewing ? "volume-2" : option.icon as any} 
          size={22} 
          color={isPreviewing ? categoryColor : isSelected ? ACCENT_GOLD : theme.primary} 
        />
      </View>
      <View style={styles.soundContent}>
        <ThemedText type="body" style={[
          styles.soundName, 
          isSelected && { color: ACCENT_GOLD, fontWeight: "600" },
          isPreviewing && !isSelected && { color: categoryColor },
        ]}>
          {option.name}
        </ThemedText>
        <ThemedText type="small" style={{ color: isPreviewing ? categoryColor : theme.textSecondary }}>
          {isPreviewing ? "Playing preview..." : option.description}
        </ThemedText>
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}
          onSelect();
        }}
        style={[
          styles.radioButton,
          { borderColor: isSelected ? ACCENT_GOLD : theme.border },
        ]}
        testID={`button-select-${option.id}`}
      >
        {isSelected ? (
          <View style={[styles.radioButtonInner, { backgroundColor: ACCENT_GOLD }]} />
        ) : null}
      </Pressable>
    </>
  );

  if (isSelected) {
    return (
      <Pressable
        onPress={() => {
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
          onPreview();
        }}
        testID={`button-sound-${option.id}`}
      >
        <LinearGradient
          colors={[`${categoryColor}18`, `${ACCENT_GOLD}10`, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.soundItem,
            { borderColor: ACCENT_GOLD },
          ]}
        >
          {itemContent}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
        onPreview();
      }}
      style={[
        styles.soundItem,
        { 
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
      ]}
      testID={`button-sound-${option.id}`}
    >
      {itemContent}
    </Pressable>
  );
}

interface CategorySectionProps {
  category: keyof typeof CATEGORY_INFO;
  options: BackgroundMusicOption[];
  selectedMusic: BackgroundMusicType;
  previewingId: BackgroundMusicType | null;
  onSelectMusic: (id: BackgroundMusicType) => void;
  onPreviewMusic: (id: BackgroundMusicType) => void;
  index: number;
}

function CategorySection({ category, options, selectedMusic, previewingId, onSelectMusic, onPreviewMusic, index }: CategorySectionProps) {
  const { theme } = useTheme();
  const info = CATEGORY_INFO[category];

  if (options.length === 0) return null;

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={styles.categorySection}
    >
      <View>
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryIconContainer, { backgroundColor: `${info.color}20` }]}>
            <Feather name={info.emoji as any} size={20} color={info.color} />
          </View>
          <View style={styles.categoryTitleContainer}>
            <ThemedText type="h4" style={{ color: theme.text }}>
              {info.title}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {info.subtitle}
            </ThemedText>
          </View>
        </View>
        <CategoryDivider color={info.color} />
      </View>
      <View style={[styles.soundsGrid, { backgroundColor: theme.cardBackground }, Shadows.small]}>
        {options.map((option) => (
          <SoundItem
            key={option.id}
            option={option}
            isSelected={selectedMusic === option.id}
            isPreviewing={previewingId === option.id}
            onSelect={() => onSelectMusic(option.id)}
            onPreview={() => onPreviewMusic(option.id)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const PREVIEW_DURATION = 5000;

export default function SoundLibraryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { selectedMusic, setSelectedMusic, volume, setVolume } = useBackgroundMusic();
  
  const { rain, ocean, forest, meditation, solfeggio, binaural, noise } = getSoundsByCategory();
  
  const [previewingId, setPreviewingId] = useState<BackgroundMusicType | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (previewSoundRef.current) {
        previewSoundRef.current.unloadAsync();
      }
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, []);

  const handlePreviewMusic = async (id: BackgroundMusicType) => {
    if (previewingId === id) {
      if (previewSoundRef.current) {
        await previewSoundRef.current.stopAsync();
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
      }
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      setPreviewingId(null);
      return;
    }

    if (previewSoundRef.current) {
      await previewSoundRef.current.stopAsync();
      await previewSoundRef.current.unloadAsync();
      previewSoundRef.current = null;
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    try {
      const audioFile = getAudioFile(id as Exclude<BackgroundMusicType, 'none'>);
      const { sound } = await Audio.Sound.createAsync(
        audioFile,
        { volume: volume, shouldPlay: true }
      );
      previewSoundRef.current = sound;
      setPreviewingId(id);

      previewTimerRef.current = setTimeout(async () => {
        if (previewSoundRef.current) {
          await previewSoundRef.current.stopAsync();
          await previewSoundRef.current.unloadAsync();
          previewSoundRef.current = null;
        }
        setPreviewingId(null);
      }, PREVIEW_DURATION);
    } catch (error) {
      console.error('Error previewing sound:', error);
      setPreviewingId(null);
    }
  };

  const handleSelectMusic = async (id: BackgroundMusicType) => {
    if (previewSoundRef.current) {
      await previewSoundRef.current.stopAsync();
      await previewSoundRef.current.unloadAsync();
      previewSoundRef.current = null;
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setPreviewingId(null);
    
    await setSelectedMusic(id);
  };

  const currentSelection = [...rain, ...ocean, ...forest, ...meditation, ...solfeggio, ...binaural, ...noise].find(o => o.id === selectedMusic);

  return (
    <ImageBackground
      source={isDark ? profileBackgroundDark : profileBackgroundLight}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {currentSelection ? (
        <Animated.View entering={FadeIn.duration(400)}>
          <View style={[styles.currentCard, { backgroundColor: theme.cardBackground }, Shadows.medium]}>
            <View style={styles.currentHeader}>
              <Feather name="volume-2" size={20} color={ACCENT_GOLD} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                CURRENTLY SELECTED
              </ThemedText>
            </View>
            <View style={styles.currentContent}>
              <View style={[styles.currentIconContainer, { backgroundColor: `${ACCENT_GOLD}20` }]}>
                <Feather name={currentSelection.icon as any} size={24} color={ACCENT_GOLD} />
              </View>
              <View style={styles.currentInfo}>
                <ThemedText type="h4" style={{ color: ACCENT_GOLD }}>
                  {currentSelection.name}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {currentSelection.description}
                </ThemedText>
              </View>
            </View>

            <View style={styles.volumeSection}>
              <View style={styles.volumeRow}>
                <Pressable onPress={() => setVolume(Math.max(0.05, volume - 0.15))}>
                  <Feather name={volume > 0.05 ? "volume-1" : "volume-x"} size={18} color={theme.textSecondary} />
                </Pressable>
                <Slider
                  style={styles.volumeSlider}
                  minimumValue={0.05}
                  maximumValue={1}
                  value={volume}
                  onValueChange={(val: number) => setVolume(Math.round(val * 100) / 100)}
                  minimumTrackTintColor={ACCENT_GOLD}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={ACCENT_GOLD}
                  testID="slider-volume"
                />
                <Pressable onPress={() => setVolume(Math.min(1, volume + 0.15))}>
                  <Feather name="volume-2" size={18} color={theme.textSecondary} />
                </Pressable>
                <ThemedText type="small" style={{ color: theme.textSecondary, width: 36, textAlign: "center" }}>
                  {Math.round(volume * 100)}%
                </ThemedText>
              </View>
            </View>
          </View>
        </Animated.View>
        ) : null}

        <CategorySection
          category="rain"
          options={rain}
          selectedMusic={selectedMusic}
          previewingId={previewingId}
          onSelectMusic={handleSelectMusic}
          onPreviewMusic={handlePreviewMusic}
          index={0}
        />
        <CategorySection
          category="ocean"
          options={ocean}
          selectedMusic={selectedMusic}
          previewingId={previewingId}
          onSelectMusic={handleSelectMusic}
          onPreviewMusic={handlePreviewMusic}
          index={1}
        />
        <CategorySection
          category="forest"
          options={forest}
          selectedMusic={selectedMusic}
          previewingId={previewingId}
          onSelectMusic={handleSelectMusic}
          onPreviewMusic={handlePreviewMusic}
          index={2}
        />
        <CategorySection
          category="meditation"
          options={meditation}
          selectedMusic={selectedMusic}
          previewingId={previewingId}
          onSelectMusic={handleSelectMusic}
          onPreviewMusic={handlePreviewMusic}
          index={3}
        />
        <CategorySection
          category="solfeggio"
          options={solfeggio}
          selectedMusic={selectedMusic}
          previewingId={previewingId}
          onSelectMusic={handleSelectMusic}
          onPreviewMusic={handlePreviewMusic}
          index={4}
        />
        <CategorySection
          category="binaural"
          options={binaural}
          selectedMusic={selectedMusic}
          previewingId={previewingId}
          onSelectMusic={handleSelectMusic}
          onPreviewMusic={handlePreviewMusic}
          index={5}
        />
        
        <Animated.View 
          entering={FadeInDown.delay(600).duration(400)}
          style={[styles.headphonesNote, { backgroundColor: `${theme.primary}15` }]}
        >
          <Feather name="headphones" size={16} color={theme.primary} />
          <ThemedText type="caption" style={[styles.headphonesText, { color: theme.textSecondary }]}>
            Binaural beats require headphones to work properly. Each ear needs to hear a slightly different frequency for your brain to perceive the beat.
          </ThemedText>
        </Animated.View>

        <CategorySection
          category="noise"
          options={noise}
          selectedMusic={selectedMusic}
          previewingId={previewingId}
          onSelectMusic={handleSelectMusic}
          onPreviewMusic={handlePreviewMusic}
          index={7}
        />
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.lg,
  },
  currentCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  currentHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  currentContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  currentIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  currentInfo: {
    flex: 1,
    gap: 2,
  },
  volumeSection: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  volumeSlider: {
    flex: 1,
    height: 40,
  },
  categorySection: {
    gap: Spacing.sm,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryTitleContainer: {
    flex: 1,
  },
  soundsGrid: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  soundItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderWidth: 0,
    overflow: "hidden",
  },
  soundIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
    overflow: "hidden",
  },
  soundContent: {
    flex: 1,
  },
  soundName: {
    marginBottom: 2,
  },
  radioButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Spacing.sm,
  },
  radioButtonInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  headphonesNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  headphonesText: {
    flex: 1,
    lineHeight: 18,
  },
});
