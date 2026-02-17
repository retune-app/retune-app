import React, { useState, useCallback } from "react";
import { View, StyleSheet, Pressable, Modal, ScrollView, Dimensions, PanResponder } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useBackgroundMusic, BACKGROUND_MUSIC_OPTIONS, BackgroundMusicType } from "@/contexts/BackgroundMusicContext";
import { Spacing, BorderRadius } from "@/constants/theme";

interface AmbientSoundMixerProps {
  compact?: boolean;
}

const getIconForMusic = (id: BackgroundMusicType): string => {
  if (id === 'none') return 'volume-x';
  const option = BACKGROUND_MUSIC_OPTIONS.find(o => o.id === id);
  return option?.icon || 'music';
};

export function AmbientSoundMixer({ compact = false }: AmbientSoundMixerProps) {
  const { theme, isDark } = useTheme();
  const { selectedMusic, setSelectedMusic, volume, setVolume, isPlaying } = useBackgroundMusic();
  const [showModal, setShowModal] = useState(false);
  const pulseValue = useSharedValue(0);
  const translateY = useSharedValue(0);

  const closeModal = useCallback(() => {
    setShowModal(false);
    translateY.value = 0;
  }, []);

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) {
        translateY.value = gestureState.dy;
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 80 || gestureState.vy > 0.5) {
        translateY.value = withTiming(Dimensions.get("window").height, { duration: 200 }, () => {
          runOnJS(closeModal)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    },
  }), [closeModal]);

  const modalSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  React.useEffect(() => {
    if (isPlaying && selectedMusic !== "none") {
      pulseValue.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    } else {
      pulseValue.value = withTiming(0, { duration: 300 });
    }
  }, [isPlaying, selectedMusic]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseValue.value, [0, 1], [0.7, 1]),
    transform: [{ scale: interpolate(pulseValue.value, [0, 1], [1, 1.05]) }],
  }));

  const handleSelectMusic = async (type: BackgroundMusicType) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    await setSelectedMusic(type);
    if (compact) {
      closeModal();
    }
  };

  const handleVolumeChange = async (value: number) => {
    await setVolume(value);
  };

  const currentOption = BACKGROUND_MUSIC_OPTIONS.find(o => o.id === selectedMusic);

  if (compact) {
    return (
      <>
        <Pressable
          onPress={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
            setShowModal(true);
          }}
          style={({ pressed }) => [
            styles.compactButton,
            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Animated.View style={pulseStyle}>
            <Feather
              name="music"
              size={20}
              color={selectedMusic === "none" ? theme.textSecondary : theme.gold}
            />
          </Animated.View>
        </Pressable>

        <Modal
          visible={showModal}
          transparent
          animationType="slide"
          onRequestClose={closeModal}
          onShow={() => { translateY.value = 0; }}
        >
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Animated.View
              style={[styles.modalContent, { backgroundColor: theme.cardBackground }, modalSlideStyle]}
            >
              <View {...panResponder.panHandlers} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHandle} />
              <ThemedText type="h3" style={styles.modalTitle}>
                Background Sounds
              </ThemedText>
              <ThemedText type="body" style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                Layer relaxing sounds with your affirmations
              </ThemedText>

              <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
                {/* No Sound Option */}
                <Pressable
                  onPress={() => handleSelectMusic('none')}
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor: selectedMusic === 'none'
                        ? theme.gold + "20"
                        : theme.backgroundSecondary,
                      borderColor: selectedMusic === 'none' ? theme.gold : "transparent",
                      marginBottom: Spacing.md,
                    },
                  ]}
                >
                  <View style={[styles.optionIcon, { backgroundColor: theme.backgroundTertiary }]}>
                    <Feather
                      name="volume-x"
                      size={20}
                      color={selectedMusic === 'none' ? theme.gold : theme.textSecondary}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      No Sound
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      Play affirmation without background music
                    </ThemedText>
                  </View>
                  {selectedMusic === 'none' ? (
                    <Feather name="check-circle" size={20} color={theme.gold} />
                  ) : null}
                </Pressable>

                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Rain
                </ThemedText>
                {BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'rain').map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectMusic(option.id)}
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: selectedMusic === option.id
                          ? theme.gold + "20"
                          : theme.backgroundSecondary,
                        borderColor: selectedMusic === option.id ? theme.gold : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: theme.backgroundTertiary }]}>
                      <Feather
                        name={option.icon as any}
                        size={20}
                        color={selectedMusic === option.id ? theme.gold : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {option.name}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {option.description}
                      </ThemedText>
                    </View>
                    {selectedMusic === option.id ? (
                      <Feather name="check-circle" size={20} color={theme.gold} />
                    ) : null}
                  </Pressable>
                ))}

                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Ocean
                </ThemedText>
                {BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'ocean').map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectMusic(option.id)}
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: selectedMusic === option.id
                          ? theme.gold + "20"
                          : theme.backgroundSecondary,
                        borderColor: selectedMusic === option.id ? theme.gold : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: theme.backgroundTertiary }]}>
                      <Feather
                        name={option.icon as any}
                        size={20}
                        color={selectedMusic === option.id ? theme.gold : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {option.name}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {option.description}
                      </ThemedText>
                    </View>
                    {selectedMusic === option.id ? (
                      <Feather name="check-circle" size={20} color={theme.gold} />
                    ) : null}
                  </Pressable>
                ))}

                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Forest & Birds
                </ThemedText>
                {BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'forest').map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectMusic(option.id)}
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: selectedMusic === option.id
                          ? theme.gold + "20"
                          : theme.backgroundSecondary,
                        borderColor: selectedMusic === option.id ? theme.gold : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: theme.backgroundTertiary }]}>
                      <Feather
                        name={option.icon as any}
                        size={20}
                        color={selectedMusic === option.id ? theme.gold : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {option.name}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {option.description}
                      </ThemedText>
                    </View>
                    {selectedMusic === option.id ? (
                      <Feather name="check-circle" size={20} color={theme.gold} />
                    ) : null}
                  </Pressable>
                ))}

                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Meditation
                </ThemedText>
                {BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'meditation').map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectMusic(option.id)}
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: selectedMusic === option.id
                          ? theme.gold + "20"
                          : theme.backgroundSecondary,
                        borderColor: selectedMusic === option.id ? theme.gold : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: theme.backgroundTertiary }]}>
                      <Feather
                        name={option.icon as any}
                        size={20}
                        color={selectedMusic === option.id ? theme.gold : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {option.name}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {option.description}
                      </ThemedText>
                    </View>
                    {selectedMusic === option.id ? (
                      <Feather name="check-circle" size={20} color={theme.gold} />
                    ) : null}
                  </Pressable>
                ))}

                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Solfeggio Frequencies
                </ThemedText>
                {BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'solfeggio').map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectMusic(option.id)}
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: selectedMusic === option.id
                          ? theme.gold + "20"
                          : theme.backgroundSecondary,
                        borderColor: selectedMusic === option.id ? theme.gold : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: theme.backgroundTertiary }]}>
                      <Feather
                        name={option.icon as any}
                        size={20}
                        color={selectedMusic === option.id ? theme.gold : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {option.name}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {option.description}
                      </ThemedText>
                    </View>
                    {selectedMusic === option.id ? (
                      <Feather name="check-circle" size={20} color={theme.gold} />
                    ) : null}
                  </Pressable>
                ))}

                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Binaural Beats
                </ThemedText>
                {BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'binaural').map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectMusic(option.id)}
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: selectedMusic === option.id
                          ? theme.gold + "20"
                          : theme.backgroundSecondary,
                        borderColor: selectedMusic === option.id ? theme.gold : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: theme.backgroundTertiary }]}>
                      <Feather
                        name={option.icon as any}
                        size={20}
                        color={selectedMusic === option.id ? theme.gold : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {option.name}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {option.description}
                      </ThemedText>
                    </View>
                    {selectedMusic === option.id ? (
                      <Feather name="check-circle" size={20} color={theme.gold} />
                    ) : null}
                  </Pressable>
                ))}

                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  Noise
                </ThemedText>
                {BACKGROUND_MUSIC_OPTIONS.filter(o => o.category === 'noise').map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectMusic(option.id)}
                    style={[
                      styles.optionItem,
                      {
                        backgroundColor: selectedMusic === option.id
                          ? theme.gold + "20"
                          : theme.backgroundSecondary,
                        borderColor: selectedMusic === option.id ? theme.gold : "transparent",
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: theme.backgroundTertiary }]}>
                      <Feather
                        name={option.icon as any}
                        size={20}
                        color={selectedMusic === option.id ? theme.gold : theme.textSecondary}
                      />
                    </View>
                    <View style={styles.optionText}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {option.name}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {option.description}
                      </ThemedText>
                    </View>
                    {selectedMusic === option.id ? (
                      <Feather name="check-circle" size={20} color={theme.gold} />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>

              {selectedMusic !== "none" ? (
                <View style={styles.volumeSection}>
                  <View style={styles.volumeHeader}>
                    <Feather name="volume-1" size={16} color={theme.textSecondary} />
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                      Volume: {Math.round(volume * 100)}%
                    </ThemedText>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={1}
                    value={volume}
                    onValueChange={handleVolumeChange}
                    minimumTrackTintColor={theme.gold}
                    maximumTrackTintColor={theme.backgroundTertiary}
                    thumbTintColor={theme.gold}
                  />
                </View>
              ) : null}
              </View>
            </Animated.View>
          </Pressable>
        </Modal>
      </>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText type="h4" style={styles.title}>
        Background Sounds
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.optionsRow}
      >
        {/* No Sound Option */}
        <Pressable
          onPress={() => handleSelectMusic('none')}
          style={({ pressed }) => [
            styles.optionChip,
            {
              backgroundColor: selectedMusic === 'none'
                ? theme.gold + "25"
                : theme.backgroundSecondary,
              borderColor: selectedMusic === 'none' ? theme.gold : theme.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather
            name="volume-x"
            size={16}
            color={selectedMusic === 'none' ? theme.gold : theme.textSecondary}
          />
          <ThemedText
            type="small"
            style={{
              color: selectedMusic === 'none' ? theme.gold : theme.text,
              marginLeft: Spacing.xs,
            }}
          >
            Off
          </ThemedText>
        </Pressable>
        {BACKGROUND_MUSIC_OPTIONS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => handleSelectMusic(option.id)}
            style={({ pressed }) => [
              styles.optionChip,
              {
                backgroundColor: selectedMusic === option.id
                  ? theme.gold + "25"
                  : theme.backgroundSecondary,
                borderColor: selectedMusic === option.id ? theme.gold : theme.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name={option.icon as any}
              size={16}
              color={selectedMusic === option.id ? theme.gold : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{
                color: selectedMusic === option.id ? theme.gold : theme.text,
                marginLeft: Spacing.xs,
              }}
            >
              {option.name}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
      {selectedMusic !== "none" ? (
        <View style={styles.volumeRow}>
          <Feather name="volume-1" size={16} color={theme.textSecondary} />
          <Slider
            style={styles.inlineSlider}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={handleVolumeChange}
            minimumTrackTintColor={theme.gold}
            maximumTrackTintColor={theme.backgroundTertiary}
            thumbTintColor={theme.gold}
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary, width: 40 }}>
            {Math.round(volume * 100)}%
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.md,
  },
  optionsRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  inlineSlider: {
    flex: 1,
    height: 40,
  },
  compactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    maxHeight: "70%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  optionsList: {
    maxHeight: 400,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  optionText: {
    flex: 1,
  },
  volumeSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  volumeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  slider: {
    width: "100%",
    height: 40,
  },
});
