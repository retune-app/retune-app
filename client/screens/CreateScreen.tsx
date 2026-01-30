import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CategoryChip } from "@/components/CategoryChip";
import { IconButton } from "@/components/IconButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const CATEGORIES = ["Career", "Health", "Confidence", "Wealth", "Relationships", "Sleep"];
const LENGTHS = ["Short", "Medium", "Long"] as const;
type LengthOption = typeof LENGTHS[number];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [goal, setGoal] = useState("");
  const [generatedScript, setGeneratedScript] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLength, setSelectedLength] = useState<LengthOption>("Medium");
  const [regenerateCount, setRegenerateCount] = useState(0);

  const generateMutation = useMutation({
    mutationFn: async ({ goalText, category, length }: { goalText: string; category: string; length: string }) => {
      const res = await apiRequest("POST", "/api/affirmations/generate-script", {
        goal: goalText,
        category,
        length,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedScript(data.script);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Alert.alert("Error", "Failed to generate script. Please try again.");
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/affirmations/create-with-voice", {
        title: goal.substring(0, 50) || "My Affirmation",
        script: generatedScript,
        category: selectedCategory,
        isManual: mode === "manual",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("Player", { affirmationId: data.id, isNew: true });
    },
    onError: () => {
      Alert.alert("Error", "Failed to create affirmation. Please try again.");
    },
  });

  const handleGenerate = () => {
    if (!goal.trim()) {
      Alert.alert("Enter a Goal", "Please describe what you want to achieve.");
      return;
    }
    generateMutation.mutate({
      goalText: goal,
      category: selectedCategory,
      length: selectedLength.toLowerCase(),
    });
  };

  const handleRegenerate = () => {
    if (regenerateCount >= 3) {
      Alert.alert("Limit Reached", "You've reached the maximum number of regenerations.");
      return;
    }
    setRegenerateCount((prev) => prev + 1);
    generateMutation.mutate({
      goalText: goal,
      category: selectedCategory,
      length: selectedLength.toLowerCase(),
    });
  };

  const handleCreate = () => {
    if (!generatedScript.trim()) {
      Alert.alert("Generate Script First", "Please generate or write a script first.");
      return;
    }
    createMutation.mutate();
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing["4xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.modeToggle}>
          <Button
            variant={mode === "ai" ? "primary" : "ghost"}
            size="small"
            onPress={() => setMode("ai")}
            style={styles.modeButton}
            testID="button-mode-ai"
          >
            Auto
          </Button>
          <Button
            variant={mode === "manual" ? "primary" : "ghost"}
            size="small"
            onPress={() => setMode("manual")}
            style={styles.modeButton}
            testID="button-mode-manual"
          >
            Manual
          </Button>
        </View>

        <ThemedText type="h3" style={styles.sectionTitle}>
          {mode === "ai" ? "What do you want to achieve?" : "Write your affirmation"}
        </ThemedText>

        <View
          style={[
            styles.inputContainer,
            { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
          ]}
        >
          <TextInput
            style={[styles.goalInput, { color: theme.text }]}
            placeholder={
              mode === "ai"
                ? "e.g., Build confidence in public speaking, achieve financial independence..."
                : "Write or paste your affirmation script here..."
            }
            placeholderTextColor={theme.placeholder}
            value={mode === "ai" ? goal : generatedScript}
            onChangeText={mode === "ai" ? setGoal : setGeneratedScript}
            multiline
            textAlignVertical="top"
            testID="input-goal"
          />
          <ThemedText type="caption" style={[styles.charCount, { color: theme.textSecondary }]}>
            {(mode === "ai" ? goal : generatedScript).length} characters
          </ThemedText>
        </View>

        <ThemedText type="h4" style={styles.sectionTitle}>
          Category
        </ThemedText>
        <View style={styles.categoriesGrid}>
          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              isSelected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat === selectedCategory ? "" : cat)}
              testID={`chip-${cat.toLowerCase()}`}
            />
          ))}
        </View>

        {mode === "ai" ? (
          <>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Length
            </ThemedText>
            <View style={styles.lengthSelector}>
              {LENGTHS.map((len) => (
                <Button
                  key={len}
                  variant={selectedLength === len ? "primary" : "ghost"}
                  size="small"
                  onPress={() => setSelectedLength(len)}
                  style={styles.lengthButton}
                  testID={`button-length-${len.toLowerCase()}`}
                >
                  {len}
                </Button>
              ))}
            </View>
          </>
        ) : null}

        {mode === "ai" && (
          <Button
            variant="gradient"
            onPress={handleGenerate}
            loading={generateMutation.isPending}
            style={styles.generateButton}
            testID="button-generate"
          >
            Generate Script
          </Button>
        )}

        {generatedScript && mode === "ai" ? (
          <Card style={styles.scriptCard}>
            <View style={styles.scriptHeader}>
              <ThemedText type="h4">Generated Script</ThemedText>
              <IconButton
                icon="refresh-cw"
                size={18}
                onPress={handleRegenerate}
                testID="button-regenerate"
              />
            </View>
            <ThemedText type="body" style={styles.scriptText}>
              {generatedScript}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Regenerations: {regenerateCount}/3
            </ThemedText>
          </Card>
        ) : null}

        {(generatedScript || mode === "manual") && (mode === "manual" ? generatedScript : true) ? (
          <Button
            variant="gradient"
            onPress={handleCreate}
            loading={createMutation.isPending}
            style={styles.createButton}
            testID="button-create"
          >
            Create with My Voice
          </Button>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  modeToggle: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  modeButton: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
    minHeight: 150,
  },
  goalInput: {
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
    minHeight: 100,
  },
  charCount: {
    textAlign: "right",
    marginTop: Spacing.sm,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  lengthSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  lengthButton: {
    flex: 1,
  },
  generateButton: {
    marginBottom: Spacing["2xl"],
  },
  scriptCard: {
    marginBottom: Spacing["2xl"],
  },
  scriptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  scriptText: {
    marginBottom: Spacing.md,
    lineHeight: 26,
  },
  createButton: {
    marginTop: Spacing.lg,
  },
});
