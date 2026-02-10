import React from "react";
import { View, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

interface ScriptPagerProps {
  pagerRef: React.RefObject<any>;
  scripts: string[];
  currentIndex: number;
  onPageSelected: (index: number) => void;
  scriptLength?: string;
}

const MIN_HEIGHT_MAP: Record<string, number> = {
  short: 160,
  medium: 280,
  long: 380,
};

const MAX_HEIGHT_RATIO: Record<string, number> = {
  short: 0.3,
  medium: 0.45,
  long: 0.6,
};

export default function ScriptPager({ 
  scripts, 
  currentIndex,
  scriptLength = "medium",
}: ScriptPagerProps) {
  const { height: screenHeight } = useWindowDimensions();
  const key = scriptLength.toLowerCase();
  const minH = MIN_HEIGHT_MAP[key] || MIN_HEIGHT_MAP.medium;
  const maxH = Math.round(screenHeight * (MAX_HEIGHT_RATIO[key] || MAX_HEIGHT_RATIO.medium));
  const containerHeight = Math.max(minH, maxH);

  return (
    <View style={[styles.pagerView, { height: containerHeight }]}>
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
