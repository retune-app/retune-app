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
        <Path d="M12 3.5 A2 2 0 1 1 12 7.5 A2 2 0 1 1 12 3.5" stroke={color} strokeWidth="1.6" fill="none" />
        <Path d="M12 8 L12 14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <Path d="M8 11.5 Q10 13 12 12 Q14 13 16 11.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <Path d="M7 18 Q9 15 12 16 Q15 15 17 18" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <Path d="M7 18 Q7.5 20 12 20 Q16.5 20 17 18" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
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
