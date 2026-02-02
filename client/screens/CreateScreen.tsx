import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Alert,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CategoryChip } from "@/components/CategoryChip";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useAudio } from "@/contexts/AudioContext";
import { PILLARS, PILLAR_LIST, type PillarName } from "@shared/pillars";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

const MAX_SUBCATEGORIES = 5;
const MAX_CUSTOM_TAGS_PER_PILLAR = 3;
const CUSTOM_TAGS_STORAGE_KEY = "@create/customTags";
const LENGTHS = ["Short", "Medium", "Long"] as const;
type LengthOption = typeof LENGTHS[number];

type CustomTagsMap = Record<string, string[]>;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

import ScriptPager from './ScriptPager';

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { breathingAffirmation, setBreathingAffirmation } = useAudio();

  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [selectedPillar, setSelectedPillar] = useState<PillarName | null>(null);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [scriptHistory, setScriptHistory] = useState<string[]>([]);
  const [currentScriptIndex, setCurrentScriptIndex] = useState(0);
  const [manualScript, setManualScript] = useState("");
  const [selectedLength, setSelectedLength] = useState<LengthOption>("Medium");
  const pagerRef = useRef<any>(null);
  
  const [customTags, setCustomTags] = useState<CustomTagsMap>({});
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const newTagInputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_TAGS_STORAGE_KEY).then((value) => {
      if (value) {
        try {
          setCustomTags(JSON.parse(value));
        } catch (e) {}
      }
    });
  }, []);

  const saveCustomTags = async (tags: CustomTagsMap) => {
    setCustomTags(tags);
    await AsyncStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(tags));
  };

  const handleAddCustomTag = () => {
    if (!selectedPillar || !newTagName.trim()) return;
    
    const trimmedName = newTagName.trim();
    const pillarTags = customTags[selectedPillar] || [];
    const predefinedTags = PILLARS[selectedPillar].subcategories;
    
    if (pillarTags.length >= MAX_CUSTOM_TAGS_PER_PILLAR) {
      Alert.alert("Limit Reached", `You can only add ${MAX_CUSTOM_TAGS_PER_PILLAR} custom tags per pillar.`);
      return;
    }
    
    if (pillarTags.includes(trimmedName) || predefinedTags.includes(trimmedName)) {
      Alert.alert("Duplicate Tag", "This tag already exists.");
      return;
    }
    
    const newTags = { ...customTags, [selectedPillar]: [...pillarTags, trimmedName] };
    saveCustomTags(newTags);
    setNewTagName("");
    setIsAddingTag(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteCustomTag = (pillar: PillarName, tag: string) => {
    const pillarTags = customTags[pillar] || [];
    const newPillarTags = pillarTags.filter(t => t !== tag);
    const newTags = { ...customTags, [pillar]: newPillarTags };
    saveCustomTags(newTags);
    setSelectedSubcategories(prev => prev.filter(s => s !== tag));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleStartAddingTag = () => {
    setIsAddingTag(true);
    setTimeout(() => newTagInputRef.current?.focus(), 100);
  };

  const handleCancelAddingTag = () => {
    setIsAddingTag(false);
    setNewTagName("");
  };

  const handlePillarSelect = (pillar: PillarName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selectedPillar === pillar) {
      setSelectedPillar(null);
      setSelectedSubcategories([]);
    } else {
      setSelectedPillar(pillar);
      setSelectedSubcategories([]);
    }
  };

  const handleSubcategoryToggle = (subcategory: string) => {
    setSelectedSubcategories(prev => {
      if (prev.includes(subcategory)) {
        return prev.filter(c => c !== subcategory);
      }
      if (prev.length >= MAX_SUBCATEGORIES) {
        Alert.alert("Limit Reached", `You can select up to ${MAX_SUBCATEGORIES} tags.`);
        return prev;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return [...prev, subcategory];
    });
  };

  const generateMutation = useMutation({
    mutationFn: async ({ goalText, pillar, subcategories, length }: { goalText: string; pillar: string; subcategories: string[]; length: string }) => {
      const res = await apiRequest("POST", "/api/affirmations/generate-script", {
        goal: goalText,
        pillar,
        categories: subcategories,
        length,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setScriptHistory((prev) => {
        const newHistory = [...prev, data.script].slice(-3);
        const newIndex = newHistory.length - 1;
        setCurrentScriptIndex(newIndex);
        if (Platform.OS !== 'web') {
          setTimeout(() => {
            pagerRef.current?.setPage(newIndex);
          }, 100);
        }
        return newHistory;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Alert.alert("Error", "Failed to generate script. Please try again.");
    },
  });

  const currentScript = mode === "ai" ? scriptHistory[currentScriptIndex] || "" : manualScript;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/affirmations/create-with-voice", {
        title: goal.substring(0, 50) || "My Affirmation",
        script: currentScript,
        pillar: selectedPillar,
        categories: selectedSubcategories,
        isManual: mode === "manual",
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (!breathingAffirmation) {
        setBreathingAffirmation(data);
      }
      
      navigation.navigate("Player", { affirmationId: data.id, isNew: true });
    },
    onError: () => {
      Alert.alert("Error", "Failed to create affirmation. Please try again.");
    },
  });

  const handleGenerate = () => {
    if (!selectedPillar) {
      Alert.alert("Select a Pillar", "Please choose a pillar for your affirmation.");
      return;
    }
    if (!goal.trim()) {
      Alert.alert("Enter a Goal", "Please describe what you want to achieve.");
      return;
    }
    generateMutation.mutate({
      goalText: goal,
      pillar: selectedPillar,
      subcategories: selectedSubcategories,
      length: selectedLength.toLowerCase(),
    });
  };

  const handleRegenerate = () => {
    if (scriptHistory.length >= 3) {
      Alert.alert("Limit Reached", "You've generated all 3 script variations. Swipe to compare them.");
      return;
    }
    generateMutation.mutate({
      goalText: goal,
      pillar: selectedPillar || "",
      subcategories: selectedSubcategories,
      length: selectedLength.toLowerCase(),
    });
  };

  const handleCreate = () => {
    if (!selectedPillar) {
      Alert.alert("Select a Pillar", "Please choose a pillar for your affirmation.");
      return;
    }
    if (!currentScript.trim()) {
      Alert.alert("Generate Script First", "Please generate or write a script first.");
      return;
    }
    createMutation.mutate();
  };

  const selectedPillarData = selectedPillar ? PILLARS[selectedPillar] : null;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing["4xl"] },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        extraKeyboardSpace={120}
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
          Choose Your Pillar
        </ThemedText>
        <ThemedText type="caption" style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          Select the area of life you want to focus on
        </ThemedText>

        <View style={styles.pillarsGrid}>
          {PILLAR_LIST.map((pillarName) => {
            const pillar = PILLARS[pillarName];
            const isSelected = selectedPillar === pillarName;
            return (
              <Pressable
                key={pillarName}
                onPress={() => handlePillarSelect(pillarName)}
                style={[
                  styles.pillarCard,
                  {
                    backgroundColor: isSelected ? pillar.color : (isDark ? theme.cardBackground : theme.backgroundSecondary),
                    borderColor: isSelected ? pillar.color : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                testID={`pillar-${pillarName.toLowerCase()}`}
              >
                <View style={[
                  styles.pillarIconContainer,
                  { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${pillar.color}20` }
                ]}>
                  <Feather 
                    name={pillar.icon as any} 
                    size={24} 
                    color={isSelected ? '#fff' : pillar.color} 
                  />
                </View>
                <ThemedText 
                  type="h4" 
                  style={[styles.pillarName, { color: isSelected ? '#fff' : theme.text }]}
                >
                  {pillarName}
                </ThemedText>
                <ThemedText 
                  type="caption" 
                  style={[styles.pillarDescription, { color: isSelected ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}
                  numberOfLines={2}
                >
                  {pillar.description}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {selectedPillarData && selectedPillar ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
            <View style={styles.subcategoryHeader}>
              <View style={styles.subcategoryTitleRow}>
                <View style={[styles.pillarAccent, { backgroundColor: selectedPillarData.color }]} />
                <ThemedText type="h4">Tags</ThemedText>
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {selectedSubcategories.length}/{MAX_SUBCATEGORIES} selected (optional)
              </ThemedText>
            </View>
            <View style={styles.subcategoriesGrid}>
              {selectedPillarData.subcategories.map((subcat) => (
                <CategoryChip
                  key={subcat}
                  label={subcat}
                  isSelected={selectedSubcategories.includes(subcat)}
                  onPress={() => handleSubcategoryToggle(subcat)}
                  color={selectedPillarData.color}
                  testID={`chip-${subcat.toLowerCase().replace(/\s+/g, '-')}`}
                />
              ))}
              {(customTags[selectedPillar] || []).map((tag) => (
                <View key={tag} style={styles.customTagWrapper}>
                  <CategoryChip
                    label={tag}
                    isSelected={selectedSubcategories.includes(tag)}
                    onPress={() => handleSubcategoryToggle(tag)}
                    color={selectedPillarData.color}
                    testID={`chip-custom-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                  <Pressable
                    onPress={() => handleDeleteCustomTag(selectedPillar, tag)}
                    style={[styles.deleteTagButton, { backgroundColor: theme.error }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID={`delete-tag-${tag.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Feather name="x" size={10} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {(customTags[selectedPillar] || []).length < MAX_CUSTOM_TAGS_PER_PILLAR && !isAddingTag ? (
                <Pressable
                  onPress={handleStartAddingTag}
                  style={[styles.addTagButton, { borderColor: selectedPillarData.color }]}
                  testID="button-add-custom-tag"
                >
                  <Feather name="plus" size={16} color={selectedPillarData.color} />
                </Pressable>
              ) : null}
            </View>
            {isAddingTag ? (
              <View style={[styles.addTagInputContainer, { borderColor: selectedPillarData.color, backgroundColor: theme.inputBackground }]}>
                <TextInput
                  ref={newTagInputRef}
                  style={[styles.addTagInput, { color: theme.text }]}
                  placeholder="Enter custom tag name..."
                  placeholderTextColor={theme.placeholder}
                  value={newTagName}
                  onChangeText={setNewTagName}
                  maxLength={20}
                  onSubmitEditing={handleAddCustomTag}
                  returnKeyType="done"
                  autoFocus
                  testID="input-new-tag"
                />
                <Pressable 
                  onPress={handleAddCustomTag}
                  style={[styles.tagActionButton, { backgroundColor: selectedPillarData.color }]}
                  testID="button-confirm-tag"
                >
                  <Feather name="check" size={16} color="#fff" />
                </Pressable>
                <Pressable 
                  onPress={handleCancelAddingTag}
                  style={[styles.tagActionButton, { backgroundColor: theme.textSecondary }]}
                  testID="button-cancel-tag"
                >
                  <Feather name="x" size={16} color="#fff" />
                </Pressable>
              </View>
            ) : null}
            <ThemedText type="caption" style={[styles.customTagHint, { color: theme.textSecondary }]}>
              {(customTags[selectedPillar] || []).length}/{MAX_CUSTOM_TAGS_PER_PILLAR} custom tags
            </ThemedText>
          </Animated.View>
        ) : null}

        <ThemedText type="h3" style={styles.sectionTitle}>
          {mode === "ai" ? "What do you want to achieve?" : "Write your affirmation"}
        </ThemedText>

        <View
          style={[
            styles.inputContainer,
            { 
              backgroundColor: theme.inputBackground, 
              borderColor: selectedPillarData ? selectedPillarData.color : theme.inputBorder,
              borderWidth: selectedPillarData ? 2 : 1,
            },
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
            value={mode === "ai" ? goal : manualScript}
            onChangeText={mode === "ai" ? setGoal : setManualScript}
            multiline
            textAlignVertical="top"
            testID="input-goal"
          />
          <ThemedText type="caption" style={[styles.charCount, { color: theme.textSecondary }]}>
            {(mode === "ai" ? goal : manualScript).length} characters
          </ThemedText>
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

        {mode === "ai" ? (
          <Button
            variant="gradient"
            onPress={handleGenerate}
            loading={generateMutation.isPending}
            disabled={!selectedPillar}
            style={[styles.generateButton, !selectedPillar && { opacity: 0.5 }]}
            testID="button-generate"
          >
            Generate Script
          </Button>
        ) : null}

        {scriptHistory.length > 0 && mode === "ai" ? (
          <Card style={styles.scriptCard}>
            <View style={styles.scriptHeader}>
              <ThemedText type="h4">Generated Script</ThemedText>
              {scriptHistory.length < 3 ? (
                <Pressable onPress={handleRegenerate} disabled={generateMutation.isPending}>
                  <Feather 
                    name="refresh-cw" 
                    size={18} 
                    color={generateMutation.isPending ? theme.textSecondary : theme.primary} 
                  />
                </Pressable>
              ) : null}
            </View>
            <ScriptPager
              pagerRef={pagerRef}
              scripts={scriptHistory}
              currentIndex={currentScriptIndex}
              onPageSelected={setCurrentScriptIndex}
            />
            <View style={styles.paginationContainer}>
              {scriptHistory.map((_, index) => (
                <Pressable
                  key={index}
                  onPress={() => {
                    setCurrentScriptIndex(index);
                    if (Platform.OS !== 'web') {
                      pagerRef.current?.setPage(index);
                    }
                  }}
                  style={styles.dotTouchArea}
                >
                  <View
                    style={[
                      styles.paginationDot,
                      {
                        backgroundColor: index === currentScriptIndex 
                          ? (selectedPillarData?.color || theme.primary)
                          : `${selectedPillarData?.color || theme.primary}40`,
                      },
                    ]}
                  />
                </Pressable>
              ))}
            </View>
            <ThemedText type="caption" style={[styles.swipeHint, { color: theme.textSecondary }]}>
              {scriptHistory.length < 3 
                ? `${scriptHistory.length}/3 scripts generated` 
                : "Swipe to compare scripts"}
            </ThemedText>
          </Card>
        ) : null}

        {(scriptHistory.length > 0 || (mode === "manual" && manualScript.trim())) ? (
          <Button
            variant="gradient"
            onPress={handleCreate}
            loading={createMutation.isPending}
            disabled={!selectedPillar}
            style={[styles.createButton, !selectedPillar && { opacity: 0.5 }]}
            testID="button-create"
          >
            Create Affirmation
          </Button>
        ) : null}
      </KeyboardAwareScrollViewCompat>
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
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    marginBottom: Spacing.lg,
  },
  pillarsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  pillarCard: {
    width: "47%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    minHeight: 120,
    ...Shadows.small,
  },
  pillarIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  pillarName: {
    marginBottom: 4,
  },
  pillarDescription: {
    fontSize: 11,
    lineHeight: 14,
  },
  subcategoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  subcategoryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pillarAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  subcategoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  inputContainer: {
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
    lineHeight: 26,
  },
  pagerView: {
    height: 200,
    marginBottom: Spacing.sm,
  },
  scriptPage: {
    flex: 1,
  },
  scriptScrollView: {
    flex: 1,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  dotTouchArea: {
    padding: Spacing.xs,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  swipeHint: {
    textAlign: "center",
  },
  createButton: {
    marginTop: Spacing.lg,
  },
  customTagWrapper: {
    position: "relative",
  },
  deleteTagButton: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  addTagButton: {
    height: 36,
    width: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addTagInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    height: 48,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addTagInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
    paddingVertical: Spacing.sm,
  },
  tagActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  customTagHint: {
    marginTop: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
});
