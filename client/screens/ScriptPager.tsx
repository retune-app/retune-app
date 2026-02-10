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

export default function ScriptPager({ 
  scripts, 
  currentIndex,
  scriptLength = "medium",
}: ScriptPagerProps) {
  const key = scriptLength.toLowerCase();

  return (
    <View style={[
      styles.pagerView,
      key === "short" && styles.pagerShort,
      key === "medium" && styles.pagerMedium,
      key === "long" && styles.pagerLong,
    ]}>
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
  pagerShort: {
    minHeight: 180,
    maxHeight: 220,
  },
  pagerMedium: {
    minHeight: 280,
    maxHeight: 360,
  },
  pagerLong: {
    minHeight: 380,
    maxHeight: 500,
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
