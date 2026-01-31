import React, { forwardRef } from "react";
import { ViewStyle, NativeSyntheticEvent } from "react-native";
import PagerView from "react-native-pager-view";

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
    return (
      <PagerView
        ref={ref as any}
        style={style}
        initialPage={initialPage}
        onPageSelected={onPageSelected}
      >
        {children}
      </PagerView>
    );
  }
);

export default PagerViewCompat;
