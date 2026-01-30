import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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

interface CustomCategory {
  id: number;
  userId: string;
  name: string;
  createdAt: string;
}

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
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: customCategories = [] } = useQuery<CustomCategory[]>({
    queryKey: ["/api/custom-categories"],
  });

  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/custom-categories", { name });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-categories"] });
      setNewCategoryName("");
      setShowAddCategoryModal(false);
      setSelectedCategory(data.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to add category");
    },
  });

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      Alert.alert("Enter Name", "Please enter a category name.");
      return;
    }
    addCategoryMutation.mutate(newCategoryName.trim());
  };

  const allCategories = [...CATEGORIES, ...customCategories.map(c => c.name)];

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
          {allCategories.map((cat) => (
            <CategoryChip
              key={cat}
              label={cat}
              isSelected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat === selectedCategory ? "" : cat)}
              testID={`chip-${cat.toLowerCase()}`}
            />
          ))}
          {customCategories.length < 5 ? (
            <Pressable
              style={[styles.addCategoryButton, { borderColor: theme.primary }]}
              onPress={() => setShowAddCategoryModal(true)}
              testID="button-add-category"
            >
              <Feather name="plus" size={18} color={theme.primary} />
            </Pressable>
          ) : null}
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

      <Modal
        visible={showAddCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCategoryModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddCategoryModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.cardBackground }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText type="title" style={styles.modalTitle}>
              Add Category
            </ThemedText>
            <ThemedText type="caption" style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {5 - customCategories.length} of 5 custom categories remaining
            </ThemedText>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.inputBackground, borderColor: theme.primary, color: theme.text }]}
              placeholder="Enter category name..."
              placeholderTextColor={theme.placeholder}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              maxLength={30}
              autoFocus
              testID="input-new-category"
            />
            <View style={styles.modalButtons}>
              <Button
                variant="ghost"
                onPress={() => {
                  setNewCategoryName("");
                  setShowAddCategoryModal(false);
                }}
                style={styles.modalButton}
                testID="button-cancel-category"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={handleAddCategory}
                loading={addCategoryMutation.isPending}
                style={styles.modalButton}
                testID="button-save-category"
              >
                Add
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  addCategoryButton: {
    width: 40,
    height: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 28, 63, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.medium,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  modalInput: {
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
