import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

interface ScriptPagerProps {
  pagerRef: React.RefObject<any>;
  scripts: string[];
  currentIndex: number;
  onPageSelected: (index: number) => void;
  scriptLength?: string;
}

export default function ScriptPager({ 
  scripts, 
  currentIndex,
}: ScriptPagerProps) {
  return (
    <View style={styles.pagerView}>
      <ThemedText type="body" style={styles.scriptText}>
        {scripts[currentIndex] || ""}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pagerView: {
    marginTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  scriptText: {
    lineHeight: 28,
    fontSize: 16,
  },
});
