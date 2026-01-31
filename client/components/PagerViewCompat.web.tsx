import React, { forwardRef, useImperativeHandle, useState } from "react";
import { View, StyleSheet, ViewStyle, NativeSyntheticEvent } from "react-native";

interface PageSelectedEventData {
  position: number;
}

interface PagerViewProps {
  style?: ViewStyle;
  initialPage?: number;
  onPageSelected?: (e: NativeSyntheticEvent<PageSelectedEventData>) => void;
  children: React.ReactNode;
}

export interface PagerViewRef {
  setPage: (page: number) => void;
}

const PagerViewCompat = forwardRef<PagerViewRef, PagerViewProps>(
  ({ style, initialPage = 0, onPageSelected, children }, ref) => {
    const [currentPage, setCurrentPage] = useState(initialPage);
    const childrenArray = React.Children.toArray(children);

    useImperativeHandle(ref, () => ({
      setPage: (page: number) => {
        setCurrentPage(page);
        if (onPageSelected) {
          onPageSelected({ nativeEvent: { position: page } } as NativeSyntheticEvent<PageSelectedEventData>);
        }
      },
    }));

    return (
      <View style={[styles.container, style]}>
        {childrenArray[currentPage]}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default PagerViewCompat;
