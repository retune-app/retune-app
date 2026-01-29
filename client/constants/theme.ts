import { Platform } from "react-native";

// ReWired Design System
// Ultra-minimalist spiritual growth aesthetic
// Gold/charcoal palette with high negative space

// Primary brand colors from design guidelines
const charcoalGrey = "#333333";
const mutedGold = "#BFAF83";
const glowingGold = "#E6B800";
const offWhite = "#F5F5F5";
const pureWhite = "#FFFFFF";
const lightGrey = "#E0E0E0";
const warmGrey = "#666666";
const blueGrey = "#7A8A99";
const successGreenGold = "#A8B07D";
const errorBrownGrey = "#8B7D6B";

// Dark mode equivalents
const darkBackground = "#121212";
const darkSurface = "#1E1E1E";
const darkTextPrimary = "#F5F5F5";
const darkTextSecondary = "#9BA1A6";

export const Colors = {
  light: {
    text: charcoalGrey,
    textSecondary: warmGrey,
    buttonText: pureWhite,
    tabIconDefault: lightGrey,
    tabIconSelected: mutedGold,
    link: mutedGold,
    primary: mutedGold,
    accent: glowingGold,
    success: successGreenGold,
    error: errorBrownGrey,
    warning: "#C9A227",
    backgroundRoot: offWhite,
    backgroundDefault: pureWhite,
    backgroundSecondary: offWhite,
    backgroundTertiary: lightGrey,
    border: lightGrey,
    cardBackground: pureWhite,
    inputBackground: pureWhite,
    inputBorder: lightGrey,
    placeholder: warmGrey,
    overlay: "rgba(51, 51, 51, 0.5)",
    gradient: {
      primary: [charcoalGrey, mutedGold],
      card: [offWhite, pureWhite],
      hero: [charcoalGrey, mutedGold],
    },
  },
  dark: {
    text: darkTextPrimary,
    textSecondary: darkTextSecondary,
    buttonText: "#1E1E1E",
    tabIconDefault: "#4A4A4A",
    tabIconSelected: mutedGold,
    link: mutedGold,
    primary: mutedGold,
    accent: glowingGold,
    success: successGreenGold,
    error: "#A67C6D",
    warning: "#D4AF37",
    backgroundRoot: darkBackground,
    backgroundDefault: darkSurface,
    backgroundSecondary: "#252525",
    backgroundTertiary: "#2F2F2F",
    border: "#3A3A3A",
    cardBackground: darkSurface,
    inputBackground: "#252525",
    inputBorder: "#3A3A3A",
    placeholder: darkTextSecondary,
    overlay: "rgba(0, 0, 0, 0.6)",
    gradient: {
      primary: ["#4A4A4A", mutedGold],
      card: [darkSurface, "#252525"],
      hero: ["#4A4A4A", mutedGold],
    },
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
  inputHeight: 52,
  buttonHeight: 56,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

// Typography based on design guidelines
// Using Inter font family for clean, modern look
export const Typography = {
  hero: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },
  h4: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
    fontFamily: "Inter_400Regular",
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
    fontFamily: "Inter_400Regular",
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
    fontFamily: "Inter_400Regular",
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
    fontFamily: "Inter_500Medium",
  },
};

export const Shadows = {
  small: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  floating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Animation constants
export const Animation = {
  spring: {
    damping: 15,
    mass: 0.3,
    stiffness: 150,
    overshootClamping: true,
  },
  timing: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  pressScale: 0.96,
};
