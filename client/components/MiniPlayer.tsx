import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAudio } from '@/contexts/AudioContext';
import { useTheme } from '@/hooks/useTheme';
import { BorderRadius, Shadows } from '@/constants/theme';

const MINI_PLAYER_GOLD = "#C9A227";

interface MiniPlayerProps {
  currentRoute?: string;
}

export function MiniPlayer({ currentRoute }: MiniPlayerProps) {
  const { currentAffirmation, isPlaying, isLoading, togglePlayPause, position, duration } = useAudio();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const hideOnRoutes = ['Player', 'BreatheTab', 'Settings', 'SettingsTab', 'VoiceSettings', 'VoiceRecording', 'NotificationSettings'];
  if (!currentAffirmation || hideOnRoutes.includes(currentRoute || '')) {
    return null;
  }

  const progress = duration > 0 ? position / duration : 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Player', { affirmationId: currentAffirmation.id });
  };

  const handlePlayPause = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await togglePlayPause();
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(250).springify()}
      exiting={FadeOutDown.duration(200)}
      style={[styles.container, { bottom: 94 + insets.bottom }]}
    >
      <Pressable onPress={handlePress} style={styles.pressable}>
        <BlurView
          intensity={isDark ? 60 : 80}
          tint={isDark ? "dark" : "light"}
          style={styles.blurContainer}
        >
          <View style={[styles.innerContainer, { backgroundColor: isDark ? 'rgba(15, 28, 63, 0.7)' : 'rgba(255, 255, 255, 0.8)' }]}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: MINI_PLAYER_GOLD }]} />
            </View>

            <View style={styles.content}>
              <View style={[styles.waveformIndicator, { backgroundColor: `${MINI_PLAYER_GOLD}30` }]}>
                {isPlaying ? (
                  <View style={styles.waveformBars}>
                    <Animated.View style={[styles.waveBar, styles.waveBar1, { backgroundColor: MINI_PLAYER_GOLD }]} />
                    <Animated.View style={[styles.waveBar, styles.waveBar2, { backgroundColor: MINI_PLAYER_GOLD }]} />
                    <Animated.View style={[styles.waveBar, styles.waveBar3, { backgroundColor: MINI_PLAYER_GOLD }]} />
                  </View>
                ) : (
                  <Feather name="headphones" size={16} color={MINI_PLAYER_GOLD} />
                )}
              </View>

              <View style={styles.textContainer}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                  {currentAffirmation.title || 'Now Playing'}
                </Text>
                <Text style={[styles.category, { color: theme.textSecondary }]} numberOfLines={1}>
                  {currentAffirmation.categoryName || 'Affirmation'}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("Main", { screen: "SettingsTab" } as any);
                }}
                style={[styles.settingsButton, { backgroundColor: `${MINI_PLAYER_GOLD}20` }]}
                testID="mini-player-settings"
              >
                <Feather name="settings" size={16} color={MINI_PLAYER_GOLD} />
              </Pressable>

              <Pressable
                onPress={handlePlayPause}
                style={[styles.playButton, { backgroundColor: MINI_PLAYER_GOLD }]}
                testID="mini-player-toggle"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather
                    name={isPlaying ? 'pause' : 'play'}
                    size={18}
                    color="#fff"
                    style={isPlaying ? {} : { marginLeft: 2 }}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    ...Shadows.medium,
  },
  pressable: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  blurContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  innerContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.4)',
  },
  progressBar: {
    height: 2,
    backgroundColor: 'rgba(201, 162, 39, 0.2)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  waveformIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
  },
  waveBar1: {
    height: 8,
  },
  waveBar2: {
    height: 14,
  },
  waveBar3: {
    height: 10,
  },
  textContainer: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    lineHeight: 18,
  },
  category: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    marginTop: 1,
  },
  settingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
