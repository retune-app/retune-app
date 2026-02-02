import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";

interface ScriptPagerProps {
  pagerRef: React.RefObject<any>;
  scripts: string[];
  currentIndex: number;
  onPageSelected: (index: number) => void;
}

export default function ScriptPager({ 
  scripts, 
  currentIndex,
}: ScriptPagerProps) {
  return (
    <View style={styles.pagerView}>
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
  pagerView: {
    height: 180,
  },
  scriptScrollView: {
    flex: 1,
  },
  scriptText: {
    lineHeight: 24,
  },
});
