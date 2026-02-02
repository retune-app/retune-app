import { Platform } from "react-native";

// Retune Design System
// Gold/Navy aesthetic with mental growth theme

// Primary brand colors - Gold, White, Navy palette (NO PURPLE)
const primaryGold = "#C9A227";
const goldLight = "#E5C95C";
const navyDark = "#0F1C3F";
const navyMid = "#1A2D4F";
const successTeal = "#50C9B0";
const backgroundLight = "#F5F7FA";
const surfaceWhite = "#FFFFFF";
const textNavy = "#0F1C3F";
const textSecondaryLight = "#5A6A7E";
const borderLight = "#E0E4EB";

// Dark mode colors - Navy tones, NO BLACK
const darkBackground = "#0F1C3F";
const darkSurface = "#1A2D4F";
const darkTextPrimary = "#F5F7FA";
const darkTextSecondary = "#8A9AAE";
const darkBorder = "#2A3D5F";

export const Colors = {
  light: {
    text: textNavy,
    textSecondary: textSecondaryLight,
    buttonText: navyDark,
    tabIconDefault: textSecondaryLight,
    tabIconSelected: primaryGold,
    link: primaryGold,
    primary: primaryGold,
    accent: primaryGold,
    success: successTeal,
    error: "#E74C3C",
    warning: "#F39C12",
    backgroundRoot: backgroundLight,
    backgroundDefault: surfaceWhite,
    backgroundSecondary: "#EEF1F5",
    backgroundTertiary: "#E0E4EB",
    border: borderLight,
    cardBackground: "rgba(255, 255, 255, 0.95)",
    inputBackground: surfaceWhite,
    inputBorder: borderLight,
    placeholder: textSecondaryLight,
    overlay: "rgba(15, 28, 63, 0.5)",
    gold: primaryGold,
    goldLight: goldLight,
    navy: navyDark,
    navyMid: navyMid,
    gradient: {
      primary: [goldLight, primaryGold],
      card: [backgroundLight, surfaceWhite],
      hero: [primaryGold, navyMid],
    },
  },
  dark: {
    text: darkTextPrimary,
    textSecondary: darkTextSecondary,
    buttonText: navyDark,
    tabIconDefault: darkTextSecondary,
    tabIconSelected: goldLight,
    link: goldLight,
    primary: goldLight,
    accent: goldLight,
    success: "#6BE9D2",
    error: "#FF6B6B",
    warning: "#FFB347",
    backgroundRoot: darkBackground,
    backgroundDefault: darkSurface,
    backgroundSecondary: "#243656",
    backgroundTertiary: "#2E4166",
    border: darkBorder,
    cardBackground: darkSurface,
    inputBackground: "#243656",
    inputBorder: darkBorder,
    placeholder: darkTextSecondary,
    overlay: "rgba(15, 28, 63, 0.8)",
    gold: goldLight,
    goldLight: "#F0D878",
    navy: navyDark,
    navyMid: navyMid,
    gradient: {
      primary: [goldLight, primaryGold],
      card: [darkSurface, "#243656"],
      hero: [goldLight, navyMid],
    },
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
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
// Hero: Nunito Bold 34px, Title: Nunito Bold 24px, etc.
export const Typography = {
  hero: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "700" as const,
    fontFamily: "Nunito_700Bold",
  },
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
    fontFamily: "Nunito_700Bold",
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700" as const,
    fontFamily: "Nunito_700Bold",
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
    fontFamily: "Nunito_600SemiBold",
  },
  h4: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600" as const,
    fontFamily: "Nunito_600SemiBold",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
};

export const Shadows = {
  small: {
    shadowColor: navyDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: navyDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: navyDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  floating: {
    shadowColor: navyDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 3,
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
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
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
