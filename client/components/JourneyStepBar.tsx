import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing } from "@/constants/theme";

const ACCENT_GOLD = "#C9A227";

interface JourneyStepBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  onPrevious?: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
  showPrevious?: boolean;
}

function getStepIcon(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("breath")) return "wind";
  if (lower.includes("meditat")) return "headphones";
  if (lower.includes("listen") || lower.includes("affirm")) return "volume-2";
  return "circle";
}

export default function JourneyStepBar({
  currentStep,
  totalSteps,
  stepLabels,
  onPrevious,
  onSkip,
  showSkip = true,
  showPrevious = true,
}: JourneyStepBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <LinearGradient
        colors={["rgba(0,0,0,0.75)", "rgba(0,0,0,0.5)", "transparent"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <View style={styles.leftSection}>
          {showPrevious && onPrevious ? (
            <Pressable onPress={onPrevious} style={styles.navButton} hitSlop={8}>
              <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.navButtonText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.navButtonPlaceholder} />
          )}
        </View>

        <View style={styles.centerSection}>
          <View style={styles.stepsRow}>
            {stepLabels.map((label, i) => {
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              return (
                <React.Fragment key={i}>
                  {i > 0 ? (
                    <View style={[styles.connector, isDone ? styles.connectorDone : undefined]} />
                  ) : null}
                  <View style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        isActive ? styles.stepDotActive : undefined,
                        isDone ? styles.stepDotDone : undefined,
                      ]}
                    >
                      {isDone ? (
                        <Feather name="check" size={10} color="#FFFFFF" />
                      ) : (
                        <Feather
                          name={getStepIcon(label) as any}
                          size={10}
                          color={isActive ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        isActive ? styles.stepLabelActive : undefined,
                        isDone ? styles.stepLabelDone : undefined,
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        <View style={styles.rightSection}>
          {showSkip && onSkip ? (
            <Pressable onPress={onSkip} style={styles.navButton} hitSlop={8}>
              <Text style={styles.navButtonText}>Skip</Text>
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.9)" />
            </Pressable>
          ) : (
            <View style={styles.navButtonPlaceholder} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingBottom: Spacing.lg,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
  },
  leftSection: {
    width: 70,
    alignItems: "flex-start",
  },
  rightSection: {
    width: 70,
    alignItems: "flex-end",
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepItem: {
    alignItems: "center",
    gap: 3,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
  },
  stepDotActive: {
    backgroundColor: ACCENT_GOLD,
    borderColor: ACCENT_GOLD,
  },
  stepDotDone: {
    backgroundColor: "rgba(80,201,176,0.8)",
    borderColor: "rgba(80,201,176,0.9)",
  },
  stepLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  stepLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  stepLabelDone: {
    color: "rgba(255,255,255,0.6)",
  },
  connector: {
    width: 20,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 4,
    marginBottom: 14,
  },
  connectorDone: {
    backgroundColor: "rgba(80,201,176,0.6)",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  navButtonText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
  navButtonPlaceholder: {
    width: 60,
  },
});
