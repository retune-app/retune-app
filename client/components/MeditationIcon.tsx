import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";

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
        <Circle cx="12" cy="4.5" r="2.5" stroke={color} strokeWidth="1.8" fill="none" />
        <Path d="M12 7 L12 14" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M7.5 12 Q9 10.5 12 11 Q15 10.5 16.5 12" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <Path d="M7 19 Q9.5 15 12 16 Q14.5 15 17 19" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <Path d="M8.5 17.5 Q12 14.5 15.5 17.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
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
