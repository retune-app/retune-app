import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";

interface ScriptPagerProps {
  pagerRef: React.RefObject<any>;
  scripts: string[];
  currentIndex: number;
  onPageSelected: (index: number) => void;
  scriptLength?: string;
}

const HEIGHT_MAP: Record<string, number> = {
  short: 100,
  medium: 180,
  long: 280,
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
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="body" style={styles.scriptText}>
          {scripts[currentIndex] || ""}
        </ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pagerView: {},
  scriptScrollView: {
    flex: 1,
  },
  scriptText: {
    lineHeight: 24,
  },
});
