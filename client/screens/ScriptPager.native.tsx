import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import PagerView from "react-native-pager-view";
import { ThemedText } from "@/components/ThemedText";

interface ScriptPagerProps {
  pagerRef: React.RefObject<any>;
  scripts: string[];
  currentIndex: number;
  onPageSelected: (index: number) => void;
}

export default function ScriptPagerNative({ 
  pagerRef, 
  scripts, 
  onPageSelected,
}: ScriptPagerProps) {
  return (
    <PagerView
      ref={pagerRef}
      style={styles.pagerView}
      initialPage={0}
      onPageSelected={(e) => onPageSelected(e.nativeEvent.position)}
    >
      {scripts.map((script, index) => (
        <View key={index} style={styles.scriptPage}>
          <ScrollView 
            style={styles.scriptScrollView}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <ThemedText type="body" style={styles.scriptText}>
              {script}
            </ThemedText>
          </ScrollView>
        </View>
      ))}
    </PagerView>
  );
}

const styles = StyleSheet.create({
  pagerView: {
    height: 180,
  },
  scriptPage: {
    flex: 1,
  },
  scriptScrollView: {
    flex: 1,
  },
  scriptText: {
    lineHeight: 24,
  },
});
