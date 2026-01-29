import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/contexts/ThemeContext";

export function useTheme() {
  const { effectiveTheme, themeMode, setThemeMode } = useThemeContext();
  const isDark = effectiveTheme === "dark";
  const theme = Colors[effectiveTheme];

  return {
    theme,
    isDark,
    colorScheme: effectiveTheme,
    themeMode,
    setThemeMode,
  };
}
