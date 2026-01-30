import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAudio } from '@/contexts/AudioContext';
import { useTheme } from '@/hooks/useTheme';

interface MiniPlayerProps {
  currentRoute?: string;
  onNavigateToPlayer?: (affirmationId: number) => void;
}

export function MiniPlayer({ currentRoute, onNavigateToPlayer }: MiniPlayerProps) {
  const { currentAffirmation, isPlaying, isLoading, togglePlayPause, position, duration } = useAudio();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Don't show mini player if no affirmation or if on Player screen
  if (!currentAffirmation || currentRoute === 'Player') {
    return null;
  }

  const progress = duration > 0 ? position / duration : 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigateToPlayer?.(currentAffirmation.id);
  };

  const handlePlayPause = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await togglePlayPause();
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutDown.duration(300)}
      style={[styles.container, { bottom: 80 + insets.bottom }]}
    >
      <Pressable onPress={handlePress} style={styles.pressable}>
        <LinearGradient
          colors={[theme.primary, theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Feather name="headphones" size={20} color="#fff" />
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={1}>
                {currentAffirmation.title || 'Now Playing'}
              </Text>
              <Text style={styles.category} numberOfLines={1}>
                {currentAffirmation.category}
              </Text>
            </View>

            <Pressable
              onPress={handlePlayPause}
              style={styles.playButton}
              testID="mini-player-toggle"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color="#fff"
                />
              )}
            </Pressable>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    shadowColor: '#0F1C3F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pressable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: 16,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontFamily: 'Nunito_700Bold',
    color: '#0F1C3F',
  },
  category: {
    fontSize: 13,
    fontFamily: 'Nunito_500Medium',
    color: 'rgba(15, 28, 63, 0.7)',
    marginTop: 2,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
