import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  SharedValue,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import BreathingCircle from "@/components/BreathingCircle";
import { Spacing } from "@/constants/theme";
import type { BreathingTechnique } from "@shared/breathingTechniques";

interface StatItem {
  label: string;
  value: string;
  color?: string;
}

interface FullscreenBreathingLayoutProps {
  technique: BreathingTechnique;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
  onCycleComplete: () => void;
  controlsOpacity: SharedValue<number>;
  controlsVisible: boolean;
  onToggleControls: () => void;
  resetControlsTimer: () => void;
  insets: { top: number; bottom: number; left: number; right: number };
  stats: StatItem[];
  backgroundColor?: string;
  circleSize?: number;
  showContent?: boolean;
  renderCircleOverlay?: (size: number) => React.ReactNode;
  renderProgressRing?: (size: number) => React.ReactNode;
  renderTopRightExtra?: () => React.ReactNode;
  renderBottomExtra?: () => React.ReactNode;
  renderBelowCircle?: () => React.ReactNode;
  renderStopButton?: () => React.ReactNode;
  renderWisdom?: () => React.ReactNode;
  hapticsEnabled?: boolean;
  hideTopControls?: boolean;
  affirmationTitle?: string;
}

export default function FullscreenBreathingLayout({
  technique,
  isPlaying,
  onTogglePlay,
  onClose,
  onCycleComplete,
  controlsOpacity,
  controlsVisible,
  onToggleControls,
  resetControlsTimer,
  insets,
  stats,
  backgroundColor = "#0F1C3F",
  circleSize: circleSizeOverride,
  showContent = true,
  renderCircleOverlay,
  renderProgressRing,
  renderTopRightExtra,
  renderBottomExtra,
  renderBelowCircle,
  renderStopButton,
  renderWisdom,
  hapticsEnabled,
  hideTopControls = false,
  affirmationTitle,
}: FullscreenBreathingLayoutProps) {
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;
  const isLandscape = screenWidth > screenHeight;

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  if (isLandscape) {
    const circleSize = circleSizeOverride ?? Math.min(screenHeight - 80, 320);

    return (
      <Pressable style={[styles.landscapeContainer, { backgroundColor }]} onPress={onToggleControls}>
        <Animated.View style={[styles.landscapeCloseButton, { top: insets.top + 4 }, controlsAnimatedStyle]} pointerEvents={controlsVisible ? "auto" : "none"}>
          <Pressable onPress={() => { resetControlsTimer(); onClose(); }}>
            <BlurView intensity={40} tint="dark" style={styles.blurButton}>
              <Feather name="x" size={24} color="#FFFFFF" />
            </BlurView>
          </Pressable>
        </Animated.View>

        <View style={[styles.landscapeContent, { paddingLeft: Math.max(insets.left, 48), paddingRight: Math.max(insets.right, 48) }]}>
          <Animated.View style={[styles.landscapeSidePanel, controlsAnimatedStyle]} pointerEvents={controlsVisible ? "auto" : "none"} onStartShouldSetResponder={() => true}>
            <Text style={[styles.landscapeTechniqueName, { color: technique.color }]}>
              {technique.name}
            </Text>
            <Text style={styles.landscapePhaseLabel}>
              {technique.benefits}
            </Text>
            {affirmationTitle ? (
              <Text style={styles.landscapeAffirmationTitle} numberOfLines={2}>
                {affirmationTitle}
              </Text>
            ) : null}
            {renderWisdom ? renderWisdom() : null}
          </Animated.View>

          <View style={styles.landscapeCircleContainer}>
            {renderProgressRing ? renderProgressRing(circleSize) : null}
            <BreathingCircle
              technique={technique}
              isPlaying={isPlaying}
              onCycleComplete={onCycleComplete}
              hapticsEnabled={hapticsEnabled}
              size={circleSize}
              showContent={showContent}
            />
            {renderCircleOverlay ? renderCircleOverlay(circleSize) : null}
          </View>

          <Animated.View style={[styles.landscapeSidePanel, controlsAnimatedStyle]} pointerEvents={controlsVisible ? "auto" : "none"} onStartShouldSetResponder={() => true}>
            {stats.map((stat, i) => (
              <View key={i} style={styles.landscapeStats}>
                <Text style={styles.landscapeStatLabel}>{stat.label}</Text>
                <Text style={[styles.landscapeStatValue, stat.color ? { color: stat.color } : undefined]}>{stat.value}</Text>
              </View>
            ))}

            <View style={styles.landscapeControlsRow}>
              <Pressable onPress={() => { resetControlsTimer(); onTogglePlay(); }}>
                <LinearGradient
                  colors={[technique.color, `${technique.color}CC`]}
                  style={styles.landscapePlayButton}
                >
                  <Feather name={isPlaying ? "pause" : "play"} size={24} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
              {renderStopButton ? renderStopButton() : null}
            </View>

            {renderBottomExtra ? renderBottomExtra() : null}
          </Animated.View>
        </View>
      </Pressable>
    );
  }

  const portraitCircleSize = circleSizeOverride ?? Math.min((screenWidth - 48) / 1.15, screenHeight * 0.44);

  return (
    <Pressable style={[styles.landscapeContainer, { backgroundColor }]} onPress={onToggleControls}>
      {!hideTopControls ? (
        <Animated.View style={[styles.topGradientOverlay, { paddingTop: insets.top + Spacing.md }, controlsAnimatedStyle]} pointerEvents={controlsVisible ? "auto" : "none"} onStartShouldSetResponder={() => true}>
          <LinearGradient
            colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.45)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.fsTopControls}>
            <View style={styles.fsTopLeft}>
              <Text style={[styles.fsTechniqueBadge, { backgroundColor: "rgba(0,0,0,0.35)", color: technique.color }]}>
                {technique.name}
              </Text>
            </View>
            <View style={styles.fsTopRight}>
              {renderTopRightExtra ? renderTopRightExtra() : null}
              <Pressable onPress={() => { resetControlsTimer(); onClose(); }} style={styles.fsCloseBtn}>
                <Feather name="x" size={22} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
          {affirmationTitle ? (
            <Text style={styles.fsAffirmationTitle} numberOfLines={2}>
              {affirmationTitle}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}

      {renderWisdom ? (
        <View style={[styles.portraitWisdomContainer, { top: insets.top + Math.max((screenHeight / 2 - portraitCircleSize / 2 - insets.top) / 2 - 22, 8) }]} pointerEvents="none">
          {renderWisdom()}
        </View>
      ) : null}

      <View style={styles.portraitCenterSection}>
        {renderProgressRing ? renderProgressRing(portraitCircleSize) : null}
        <BreathingCircle
          technique={technique}
          isPlaying={isPlaying}
          onCycleComplete={onCycleComplete}
          hapticsEnabled={hapticsEnabled}
          size={portraitCircleSize}
          showContent={showContent}
        />
        {renderCircleOverlay ? renderCircleOverlay(48) : null}
      </View>

      {renderBelowCircle ? (
        <Animated.View style={[styles.belowCircleSection, controlsAnimatedStyle]} pointerEvents={controlsVisible ? "auto" : "none"} onStartShouldSetResponder={() => true}>
          {renderBelowCircle()}
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.bottomGradientOverlay, { paddingBottom: insets.bottom + Spacing.lg }, controlsAnimatedStyle]} pointerEvents={controlsVisible ? "auto" : "none"} onStartShouldSetResponder={() => true}>
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.75)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.fsCenterControls}>
          <Pressable onPress={() => { resetControlsTimer(); onTogglePlay(); }}>
            <LinearGradient
              colors={[technique.color, `${technique.color}CC`]}
              style={styles.portraitPlayButton}
            >
              <Feather name={isPlaying ? "pause" : "play"} size={28} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
          {renderStopButton ? <View style={styles.portraitStopButtonWrap}>{renderStopButton()}</View> : null}
        </View>

        <View style={styles.portraitStatsRow}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.portraitStatItem}>
              <Text style={styles.portraitStatLabel}>{stat.label}</Text>
              <Text style={[styles.portraitStatValue, stat.color ? { color: stat.color } : undefined]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {renderBottomExtra ? renderBottomExtra() : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  landscapeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  landscapeCloseButton: {
    position: "absolute",
    right: 24,
    zIndex: 10,
  },
  blurButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  landscapeContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  landscapeSidePanel: {
    width: 180,
    alignItems: "center",
  },
  landscapeTechniqueName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  landscapePhaseLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  landscapeCircleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  landscapeStats: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  landscapeStatLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  landscapeStatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  landscapeAffirmationTitle: {
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
    color: "rgba(255,255,255,0.75)",
    marginTop: 8,
  },
  landscapeControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  landscapePlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  topGradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  bottomGradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl * 2,
    gap: Spacing.lg,
  },
  portraitCenterSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  belowCircleSection: {
    zIndex: 11,
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  portraitWisdomContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 40,
    zIndex: 6,
  },
  fsTopControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    zIndex: 10,
  },
  fsTopLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  fsTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  fsTechniqueBadge: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: "hidden",
    letterSpacing: 0.5,
  },
  fsAffirmationTitle: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: "rgba(255,255,255,0.85)",
    marginTop: Spacing.md,
    textAlign: "center",
    alignSelf: "center",
  },
  fsCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  fsCenterControls: {
    alignItems: "center",
    justifyContent: "center",
  },
  portraitStopButtonWrap: {
    position: "absolute" as const,
    right: -60,
    top: "50%" as any,
    marginTop: -22,
  },
  portraitPlayButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  portraitStatsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl * 3,
  },
  portraitStatItem: {
    alignItems: "center",
  },
  portraitStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  portraitStatValue: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
