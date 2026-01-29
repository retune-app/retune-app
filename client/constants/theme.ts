import { Platform } from "react-native";

// Rewired Design System
// Based on design_guidelines.md - Serene Empowerment aesthetic

// Primary brand colors from design guidelines
const primaryBlue = "#4A90E2";
const accentPurple = "#7B61FF";
const successTeal = "#50E3C2";
const backgroundSoft = "#F8FAFB";
const surfaceWhite = "#FFFFFF";
const textPrimary = "#2C3E50";
const textSecondary = "#7F8C8D";
const borderLight = "#E8ECF0";

// Dark mode equivalents
const darkBackground = "#1A1A2E";
const darkSurface = "#252542";
const darkTextPrimary = "#F8FAFB";
const darkTextSecondary = "#9BA1A6";

export const Colors = {
  light: {
    text: textPrimary,
    textSecondary: textSecondary,
    buttonText: "#FFFFFF",
    tabIconDefault: textSecondary,
    tabIconSelected: primaryBlue,
    link: primaryBlue,
    primary: primaryBlue,
    accent: accentPurple,
    success: successTeal,
    error: "#E74C3C",
    warning: "#F39C12",
    backgroundRoot: backgroundSoft,
    backgroundDefault: surfaceWhite,
    backgroundSecondary: "#F0F4F8",
    backgroundTertiary: "#E8ECF0",
    border: borderLight,
    cardBackground: surfaceWhite,
    inputBackground: surfaceWhite,
    inputBorder: borderLight,
    placeholder: textSecondary,
    overlay: "rgba(44, 62, 80, 0.5)",
    gradient: {
      primary: [primaryBlue, accentPurple],
      card: [backgroundSoft, surfaceWhite],
      hero: ["#4A90E2", "#7B61FF"],
    },
  },
  dark: {
    text: darkTextPrimary,
    textSecondary: darkTextSecondary,
    buttonText: "#FFFFFF",
    tabIconDefault: darkTextSecondary,
    tabIconSelected: primaryBlue,
    link: "#5BA3F5",
    primary: "#5BA3F5",
    accent: "#9B7FFF",
    success: "#6BE9D2",
    error: "#FF6B6B",
    warning: "#FFB347",
    backgroundRoot: darkBackground,
    backgroundDefault: darkSurface,
    backgroundSecondary: "#2F2F4A",
    backgroundTertiary: "#3A3A5A",
    border: "#3A3A5A",
    cardBackground: darkSurface,
    inputBackground: "#2F2F4A",
    inputBorder: "#3A3A5A",
    placeholder: darkTextSecondary,
    overlay: "rgba(0, 0, 0, 0.6)",
    gradient: {
      primary: ["#5BA3F5", "#9B7FFF"],
      card: [darkSurface, "#2F2F4A"],
      hero: ["#5BA3F5", "#9B7FFF"],
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  floating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
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
