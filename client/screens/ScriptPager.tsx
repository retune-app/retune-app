import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

interface ScriptPagerProps {
  pagerRef: React.RefObject<any>;
  scripts: string[];
  currentIndex: number;
  onPageSelected: (index: number) => void;
  scriptLength?: string;
}

const HEIGHT_MAP: Record<string, number> = {
  short: 180,
  medium: 300,
  long: 420,
};

export default function ScriptPager({ 
  scripts, 
  currentIndex,
  scriptLength = "medium",
}: ScriptPagerProps) {
  const height = HEIGHT_MAP[scriptLength.toLowerCase()] || HEIGHT_MAP.medium;

  return (
    <View style={[styles.pagerView, { height }]}>
      <ScrollView 
        style={styles.scriptScrollView}
        contentContainerStyle={styles.scriptContentContainer}
        showsVerticalScrollIndicator={true}
      >
        <ThemedText type="body" style={styles.scriptText}>
          {scripts[currentIndex] || ""}
        </ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pagerView: {
    marginTop: Spacing.xs,
  },
  scriptScrollView: {
    flex: 1,
  },
  scriptContentContainer: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
  scriptText: {
    lineHeight: 26,
    fontSize: 16,
  },
});
