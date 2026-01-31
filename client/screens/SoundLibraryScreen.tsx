import React from "react";
import { View, StyleSheet, Pressable, ImageBackground, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useBackgroundMusic, getSoundsByCategory, BackgroundMusicOption, BackgroundMusicType } from "@/contexts/BackgroundMusicContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

const profileBackgroundDark = require("../../assets/images/library-background.png");
const profileBackgroundLight = require("../../assets/images/library-background-light.png");

const ACCENT_GOLD = "#C9A227";

const CATEGORY_INFO = {
  nature: {
    title: "Nature Sounds",
    subtitle: "Immerse yourself in peaceful natural environments",
    emoji: "cloud-rain",
    color: "#4CAF50",
  },
  binaural: {
    title: "Binaural Beats",
    subtitle: "Brainwave entrainment for focus & relaxation",
    emoji: "activity",
    color: "#9C27B0",
  },
  solfeggio: {
    title: "Solfeggio Frequencies",
    subtitle: "Ancient healing tones for mind & body",
    emoji: "star",
    color: ACCENT_GOLD,
  },
};

interface SoundItemProps {
  option: BackgroundMusicOption;
  isSelected: boolean;
  onSelect: () => void;
}

function SoundItem({ option, isSelected, onSelect }: SoundItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={() => {
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
        onSelect();
      }}
      style={({ pressed }) => [
        styles.soundItem,
        { 
          backgroundColor: isSelected 
            ? `${ACCENT_GOLD}20` 
            : pressed 
              ? theme.backgroundSecondary 
              : theme.cardBackground,
          borderColor: isSelected ? ACCENT_GOLD : theme.border,
        },
      ]}
      testID={`button-sound-${option.id}`}
    >
      <View style={[
        styles.soundIconContainer, 
        { backgroundColor: isSelected ? `${ACCENT_GOLD}30` : theme.backgroundSecondary }
      ]}>
        <Feather 
          name={option.icon as any} 
          size={22} 
          color={isSelected ? ACCENT_GOLD : theme.primary} 
        />
      </View>
      <View style={styles.soundContent}>
        <ThemedText type="body" style={[
          styles.soundName, 
          isSelected && { color: ACCENT_GOLD, fontWeight: "600" }
        ]}>
          {option.name}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {option.description}
        </ThemedText>
      </View>
      <View style={[
        styles.radioButton,
        { borderColor: isSelected ? ACCENT_GOLD : theme.border },
      ]}>
        {isSelected ? (
          <View style={[styles.radioButtonInner, { backgroundColor: ACCENT_GOLD }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

interface CategorySectionProps {
  category: keyof typeof CATEGORY_INFO;
  options: BackgroundMusicOption[];
  selectedMusic: BackgroundMusicType;
  onSelectMusic: (id: BackgroundMusicType) => void;
  index: number;
}

function CategorySection({ category, options, selectedMusic, onSelectMusic, index }: CategorySectionProps) {
  const { theme } = useTheme();
  const info = CATEGORY_INFO[category];

  if (options.length === 0) return null;

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={styles.categorySection}
    >
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
      <View style={[styles.soundsGrid, { backgroundColor: theme.cardBackground }, Shadows.small]}>
        {options.map((option) => (
          <SoundItem
            key={option.id}
            option={option}
            isSelected={selectedMusic === option.id}
            onSelect={() => onSelectMusic(option.id)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export default function SoundLibraryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { selectedMusic, setSelectedMusic, volume, setVolume } = useBackgroundMusic();
  
  const { nature, binaural, solfeggio } = getSoundsByCategory();

  const handleSelectMusic = async (id: BackgroundMusicType) => {
    await setSelectedMusic(id);
  };

  const currentSelection = selectedMusic === 'none' 
    ? null 
    : [...nature, ...binaural, ...solfeggio].find(o => o.id === selectedMusic);

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
        {/* Current Selection Card */}
        <Animated.View entering={FadeIn.duration(400)}>
          <View style={[styles.currentCard, { backgroundColor: theme.cardBackground }, Shadows.medium]}>
            <View style={styles.currentHeader}>
              <Feather name="volume-2" size={20} color={ACCENT_GOLD} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                CURRENTLY PLAYING
              </ThemedText>
            </View>
            <View style={styles.currentContent}>
              {currentSelection ? (
                <>
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
                </>
              ) : (
                <>
                  <View style={[styles.currentIconContainer, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="volume-x" size={24} color={theme.textSecondary} />
                  </View>
                  <View style={styles.currentInfo}>
                    <ThemedText type="h4" style={{ color: theme.textSecondary }}>
                      No Sound Selected
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Choose a sound below to enhance your experience
                    </ThemedText>
                  </View>
                </>
              )}
            </View>

            {/* Volume Control */}
            {currentSelection ? (
              <View style={styles.volumeSection}>
                <View style={styles.volumeRow}>
                  <Feather name="volume-1" size={16} color={theme.textSecondary} />
                  <View style={styles.volumeSliderContainer}>
                    <View style={[styles.volumeTrack, { backgroundColor: theme.border }]}>
                      <View 
                        style={[
                          styles.volumeFill, 
                          { backgroundColor: ACCENT_GOLD, width: `${volume * 100}%` }
                        ]} 
                      />
                    </View>
                  </View>
                  <Feather name="volume-2" size={16} color={theme.textSecondary} />
                </View>
                <View style={styles.volumeControls}>
                  <Pressable 
                    onPress={() => setVolume(Math.max(0.1, volume - 0.1))}
                    style={[styles.volumeButton, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <Feather name="minus" size={14} color={theme.primary} />
                  </Pressable>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {Math.round(volume * 100)}%
                  </ThemedText>
                  <Pressable 
                    onPress={() => setVolume(Math.min(1, volume + 0.1))}
                    style={[styles.volumeButton, { backgroundColor: theme.backgroundSecondary }]}
                  >
                    <Feather name="plus" size={14} color={theme.primary} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {/* Turn Off Button */}
            {currentSelection ? (
              <Pressable
                onPress={() => handleSelectMusic('none')}
                style={[styles.turnOffButton, { borderColor: theme.border }]}
              >
                <Feather name="x-circle" size={16} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                  Turn Off Sound
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>

        {/* Category Sections */}
        <CategorySection
          category="nature"
          options={nature}
          selectedMusic={selectedMusic}
          onSelectMusic={handleSelectMusic}
          index={0}
        />
        <CategorySection
          category="solfeggio"
          options={solfeggio}
          selectedMusic={selectedMusic}
          onSelectMusic={handleSelectMusic}
          index={1}
        />
        <CategorySection
          category="binaural"
          options={binaural}
          selectedMusic={selectedMusic}
          onSelectMusic={handleSelectMusic}
          index={2}
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
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  volumeSliderContainer: {
    flex: 1,
    height: 6,
  },
  volumeTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  volumeFill: {
    height: "100%",
    borderRadius: 3,
  },
  volumeControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  volumeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  turnOffButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
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
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderWidth: 0,
  },
  soundIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  soundContent: {
    flex: 1,
  },
  soundName: {
    marginBottom: 2,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: Spacing.sm,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
