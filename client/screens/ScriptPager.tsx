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
  short: 200,
  medium: 320,
  long: 460,
};

export default function ScriptPager({ 
  scripts, 
  currentIndex,
  scriptLength = "medium",
}: ScriptPagerProps) {
  const key = scriptLength.toLowerCase();
  const boxHeight = HEIGHT_MAP[key] || HEIGHT_MAP.medium;

  return (
    <View style={[styles.pagerView, { height: boxHeight }]}>
      <ScrollView 
        style={styles.scriptScrollView}
        contentContainerStyle={styles.scriptContentContainer}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
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
    marginTop: Spacing.sm,
  },
  scriptScrollView: {
    flex: 1,
  },
  scriptContentContainer: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
  },
  scriptText: {
    lineHeight: 28,
    fontSize: 16,
  },
});
