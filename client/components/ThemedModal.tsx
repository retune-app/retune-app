import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

type ModalType = 'success' | 'warning' | 'delete' | 'info';

interface ModalButton {
  text: string;
  onPress: () => void;
  style?: 'primary' | 'secondary' | 'destructive';
}

interface ThemedModalProps {
  visible: boolean;
  onClose: () => void;
  type?: ModalType;
  title: string;
  message?: string;
  highlightText?: string;
  buttons?: ModalButton[];
  autoDismiss?: number;
}

const ICON_CONFIG: Record<ModalType, { name: keyof typeof Feather.glyphMap; color: string }> = {
  success: { name: 'check-circle', color: '#50C9B0' },
  warning: { name: 'alert-circle', color: '#FFB347' },
  delete: { name: 'trash-2', color: '#FF6B6B' },
  info: { name: 'info', color: '#8A9AAE' },
};

export function ThemedModal({
  visible,
  onClose,
  type = 'info',
  title,
  message,
  highlightText,
  buttons = [{ text: 'OK', onPress: onClose, style: 'primary' }],
  autoDismiss,
}: ThemedModalProps) {
  const { theme, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 18,
          mass: 0.8,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (autoDismiss) {
        const timer = setTimeout(() => {
          handleClose();
        }, autoDismiss);
        return () => clearTimeout(timer);
      }
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible, autoDismiss]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const getButtonStyle = (style?: 'primary' | 'secondary' | 'destructive') => {
    switch (style) {
      case 'primary':
        return {
          backgroundColor: theme.primary,
          borderWidth: 0,
        };
      case 'destructive':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: '#FF6B6B',
        };
      case 'secondary':
      default:
        return {
          backgroundColor: theme.backgroundSecondary,
          borderWidth: 0,
        };
    }
  };

  const getButtonTextColor = (style?: 'primary' | 'secondary' | 'destructive') => {
    switch (style) {
      case 'primary':
        return '#0F1C3F';
      case 'destructive':
        return '#FF6B6B';
      case 'secondary':
      default:
        return theme.text;
    }
  };

  const iconConfig = ICON_CONFIG[type];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={isDark ? 40 : 20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDark ? '#1A2D4F' : '#FFFFFF',
              borderColor: isDark ? '#2A3D5F' : '#E0E4EB',
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: iconConfig.color + '20' }]}>
            <Feather name={iconConfig.name} size={28} color={iconConfig.color} />
          </View>

          <ThemedText type="h3" style={styles.title}>
            {title}
          </ThemedText>

          {highlightText ? (
            <View style={[styles.highlightContainer, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
              <ThemedText type="body" style={[styles.highlightText, { color: theme.primary }]} numberOfLines={2}>
                {highlightText}
              </ThemedText>
            </View>
          ) : null}

          {message ? (
            <ThemedText type="body" style={[styles.message, { color: theme.textSecondary }]}>
              {message}
            </ThemedText>
          ) : null}

          <View style={[styles.buttonContainer, buttons.length === 1 && styles.singleButton]}>
            {buttons.map((button, index) => (
              <Pressable
                key={index}
                onPress={() => {
                  button.onPress();
                }}
                style={({ pressed }) => [
                  styles.button,
                  getButtonStyle(button.style),
                  buttons.length > 1 && styles.halfButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <ThemedText
                  type="body"
                  style={[
                    styles.buttonText,
                    { color: getButtonTextColor(button.style) },
                  ]}
                >
                  {button.text}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 28, 63, 0.6)',
  },
  modalContainer: {
    width: width - 48,
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  highlightContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginVertical: Spacing.sm,
    maxWidth: '100%',
  },
  highlightText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  message: {
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    width: '100%',
  },
  singleButton: {
    justifyContent: 'center',
  },
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  halfButton: {
    flex: 1,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
