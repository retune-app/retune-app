import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/hooks/useTheme';

interface FocusModeTipProps {
  visible: boolean;
  onDismiss: () => void;
}

export function FocusModeTip({ visible, onDismiss }: FocusModeTipProps) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withSpring(1);
      translateY.value = withSpring(0);
      rotation.value = withDelay(
        500,
        withRepeat(
          withSequence(
            withSpring(-15, { damping: 8 }),
            withSpring(15, { damping: 8 }),
            withSpring(0, { damping: 8 })
          ),
          3,
          false
        )
      );
    } else {
      opacity.value = withSpring(0);
      translateY.value = withSpring(10);
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const phoneIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={[styles.tooltip, { backgroundColor: theme.cardBackground }]}>
        <View style={styles.content}>
          <Animated.View style={[styles.iconContainer, phoneIconStyle]}>
            <Feather name="smartphone" size={20} color={theme.primary} />
            <View style={styles.rotateArrows}>
              <Feather name="rotate-cw" size={12} color={theme.primary} style={styles.rotateIcon} />
            </View>
          </Animated.View>
          <View style={styles.textContainer}>
            <ThemedText type="small" style={{ color: theme.text }}>
              Rotate your phone for
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: '600' }}>
              immersive Focus Mode
            </ThemedText>
          </View>
        </View>
        <Pressable onPress={onDismiss} style={styles.dismissButton} hitSlop={10}>
          <Feather name="x" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>
      <View style={[styles.arrow, { borderTopColor: theme.cardBackground }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 8,
  },
  tooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: 10,
    position: 'relative',
  },
  rotateArrows: {
    position: 'absolute',
    top: -4,
    right: -6,
  },
  rotateIcon: {
    opacity: 0.8,
  },
  textContainer: {
    flexDirection: 'column',
  },
  dismissButton: {
    padding: 6,
    marginLeft: 8,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});
