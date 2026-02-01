import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

interface LibraryTipProps {
  visible: boolean;
  onDismiss: () => void;
}

export function LibraryTip({ visible, onDismiss }: LibraryTipProps) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-10);
  const swipeAnimation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withDelay(500, withSpring(1));
      translateY.value = withDelay(500, withSpring(0));
      swipeAnimation.value = withDelay(
        1000,
        withRepeat(
          withSequence(
            withSpring(-8, { damping: 10 }),
            withSpring(8, { damping: 10 }),
            withSpring(0, { damping: 10 })
          ),
          3,
          false
        )
      );
    } else {
      opacity.value = withSpring(0);
      translateY.value = withSpring(-10);
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const swipeIconStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeAnimation.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={[styles.tooltip, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.content}>
          <Animated.View style={[styles.iconContainer, swipeIconStyle]}>
            <Feather name="chevrons-left" size={16} color={theme.error || '#E74C3C'} />
            <Feather name="trash-2" size={18} color={theme.error || '#E74C3C'} style={styles.actionIcon} />
          </Animated.View>
          <View style={styles.divider} />
          <Animated.View style={[styles.iconContainer, swipeIconStyle]}>
            <Feather name="wind" size={18} color={'#2E7D6E'} style={styles.actionIcon} />
            <Feather name="edit-2" size={18} color={theme.primary} style={styles.actionIcon} />
            <Feather name="chevrons-right" size={16} color={theme.primary} />
          </Animated.View>
        </View>
        <View style={styles.textContainer}>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center' }}>
            Swipe left to <ThemedText type="small" style={{ color: theme.error || '#E74C3C', fontWeight: '600' }}>delete</ThemedText>, right for <ThemedText type="small" style={{ color: '#2E7D6E', fontWeight: '600' }}>breathing</ThemedText> or <ThemedText type="small" style={{ color: theme.primary, fontWeight: '600' }}>rename</ThemedText>
          </ThemedText>
        </View>
        <Pressable onPress={onDismiss} style={styles.dismissButton} hitSlop={10}>
          <Feather name="x" size={14} color={theme.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  tooltip: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    marginHorizontal: 2,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    marginHorizontal: Spacing.md,
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dismissButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 4,
  },
});
