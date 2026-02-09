import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

interface MeditationIconProps {
  size?: number;
  color?: string;
  glow?: boolean;
  glowColor?: string;
}

export function MeditationIcon({ size = 24, color = "#50C9B0", glow = false, glowColor }: MeditationIconProps) {
  const effectiveGlowColor = glowColor || color;
  
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {glow ? (
        <View style={[styles.glowEffect, { 
          width: size * 1.6, 
          height: size * 1.6,
          borderRadius: size * 0.8,
          backgroundColor: `${effectiveGlowColor}15`,
          shadowColor: effectiveGlowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: size * 0.4,
        }]} />
      ) : null}
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2 C9 2 7 5 7 8 C7 10 8 11.5 9.5 12.5 L9.5 14 C9.5 14 9 15 9 16 L9 21" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <Path d="M12 2 C15 2 17 5 17 8 C17 10 16 11.5 14.5 12.5 L14.5 14 C14.5 14 15 15 15 16 L15 21" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <Path d="M9.5 14 L14.5 14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M9.5 12.5 L14.5 12.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  glowEffect: {
    position: "absolute",
  },
});
