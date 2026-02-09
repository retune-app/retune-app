import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Alert,
  Pressable,
  Platform,
  ScrollView,
  Keyboard,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
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

const PILLAR_EXAMPLES: Record<string, string> = {
  Mind: "e.g., Stay calm and focused under pressure, think clearly in stressful situations...",
  Body: "e.g., Feel energized and strong throughout the day, embrace a healthy lifestyle...",
  Spirit: "e.g., Feel deeply grateful for life's blessings, connect with inner peace...",
  Connection: "e.g., Build deeper, more meaningful relationships, communicate with empathy...",
  Achievement: "e.g., Reach my career goals with confidence, attract financial abundance...",
  Home: "e.g., Create a peaceful and harmonious home, strengthen family bonds...",
};

const TAG_EXAMPLES: Record<string, string> = {
  Confidence: "e.g., Speak up boldly in meetings, trust my decisions completely...",
  Focus: "e.g., Stay deeply focused for hours, eliminate distractions effortlessly...",
  Resilience: "e.g., Bounce back from setbacks stronger, handle challenges with grace...",
  Emotion: "e.g., Stay emotionally balanced, process feelings with clarity and calm...",
  Health: "e.g., Feel vibrant and full of energy, make healthy choices naturally...",
  Sleep: "e.g., Fall asleep effortlessly, wake up feeling refreshed and renewed...",
  "Body Image": "e.g., Love and appreciate my body exactly as it is, feel comfortable in my skin...",
  Gratitude: "e.g., Notice and appreciate the good in every day, feel abundant and thankful...",
  Happiness: "e.g., Choose joy in every moment, radiate positivity and warmth...",
  Vision: "e.g., See my future clearly, take inspired action toward my dreams...",
  Relationships: "e.g., Attract loving, supportive people, nurture deep connections...",
  "Self-Compassion": "e.g., Speak kindly to myself, forgive my mistakes and grow from them...",
  Career: "e.g., Excel in my professional role, attract new opportunities effortlessly...",
  Wealth: "e.g., Attract financial abundance, manage money wisely and confidently...",
  Skills: "e.g., Learn new skills quickly, master my craft with dedication...",
  Habits: "e.g., Build powerful daily routines, replace old habits with empowering ones...",
  Motivation: "e.g., Wake up driven and inspired, pursue my goals with relentless energy...",
  Family: "e.g., Be a loving and patient family member, create joyful family moments...",
  Organization: "e.g., Keep my space clean and organized, bring order to every area of life...",
  Environment: "e.g., Create a calming and inspiring living space, feel at peace in my home...",
};

function getDynamicPlaceholder(pillar: PillarName | null, tags: string[]): string {
  if (tags.length > 0 && TAG_EXAMPLES[tags[0]]) {
    return TAG_EXAMPLES[tags[0]];
  }
  if (pillar && PILLAR_EXAMPLES[pillar]) {
    return PILLAR_EXAMPLES[pillar];
  }
  return "e.g., Build confidence in public speaking, achieve financial independence...";
}

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const { breathingAffirmation, setBreathingAffirmation } = useAudio();

  const { data: userLimits } = useQuery<{
    aiAffirmations: { used: number; limit: number; remaining: number };
  }>({
    queryKey: ["/api/user/limits"],
  });

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

  const [currentStep, setCurrentStep] = useState(1);
  const [showCreateButton, setShowCreateButton] = useState(false);
  const [showPillarHelp, setShowPillarHelp] = useState(false);
  const [showPillarTip, setShowPillarTip] = useState(false);
  const [showCreatingOverlay, setShowCreatingOverlay] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const step2Ref = useRef<View | null>(null);
  const step3Ref = useRef<View | null>(null);
  const scriptCardRef = useRef<View | null>(null);
  const prevScriptCountRef = useRef(0);

  const scriptGlow = useSharedValue(0);
  const scriptScale = useSharedValue(0.92);
  const scriptOpacity = useSharedValue(0);
  const shimmerX = useSharedValue(-1);
  const createButtonOpacity = useSharedValue(0);
  const createButtonTranslateY = useSharedValue(12);
  const creatingPulse = useSharedValue(0);

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_TAGS_STORAGE_KEY).then((value) => {
      if (value) {
        try {
          setCustomTags(JSON.parse(value));
        } catch (e) {}
      }
    });
    AsyncStorage.getItem("@tips/pillarSelection").then((value) => {
      if (!value) {
        setShowPillarTip(true);
      }
    });
  }, []);

  const saveCustomTags = async (tags: CustomTagsMap) => {
    setCustomTags(tags);
    await AsyncStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(tags));
  };

  const scrollToStep = useCallback((stepRef: React.RefObject<View | null>) => {
    setTimeout(() => {
      stepRef.current?.measureLayout(
        scrollViewRef.current as any,
        (_x, y) => {
          scrollViewRef.current?.scrollTo({ y: y - headerHeight - Spacing.lg, animated: true });
        },
        () => {}
      );
    }, 250);
  }, [headerHeight]);

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

  const dismissPillarTip = useCallback(() => {
    setShowPillarTip(false);
    AsyncStorage.setItem("@tips/pillarSelection", "true");
  }, []);

  const handlePillarSelect = (pillar: PillarName) => {
    if (showPillarTip) {
      dismissPillarTip();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selectedPillar === pillar) {
      setSelectedPillar(null);
      setSelectedSubcategories([]);
      setCurrentStep(1);
    } else {
      setSelectedPillar(pillar);
      setSelectedSubcategories([]);
      if (mode === "manual") {
        setCurrentStep(3);
        scrollToStep(step3Ref);
      } else {
        setCurrentStep(2);
        scrollToStep(step2Ref);
      }
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

  const handleContinueToStep3 = () => {
    setCurrentStep(3);
    scrollToStep(step3Ref);
  };

  const handleEditStep = (step: number) => {
    setCurrentStep(step);
    if (step === 1) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else if (step === 2) {
      scrollToStep(step2Ref);
    }
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
      setShowCreateButton(false);
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
      Keyboard.dismiss();
      queryClient.invalidateQueries({ queryKey: ["/api/user/limits"] });

      scriptScale.value = 0.92;
      scriptOpacity.value = 0;
      scriptGlow.value = 0;
      shimmerX.value = -1;
      createButtonOpacity.value = 0;
      createButtonTranslateY.value = 12;

      scriptScale.value = withSpring(1, { damping: 12, stiffness: 100 });
      scriptOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });

      scriptGlow.value = withDelay(300,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) })
          ),
          3,
          true
        )
      );

      shimmerX.value = withDelay(200,
        withRepeat(
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          2,
          false
        )
      );

      createButtonOpacity.value = withDelay(1200,
        withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) })
      );
      createButtonTranslateY.value = withDelay(1200,
        withSpring(0, { damping: 14, stiffness: 90 })
      );
      setTimeout(() => setShowCreateButton(true), 1200);

      setTimeout(() => {
        scriptCardRef.current?.measureLayout(
          scrollViewRef.current as any,
          (_x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - headerHeight - Spacing.md, animated: true });
          },
          () => {}
        );
      }, 150);
    },
    onError: (error: any) => {
      let message = "Failed to generate script. Please try again.";
      try {
        const errorStr = error?.message || "";
        const jsonMatch = errorStr.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error) message = parsed.error;
        }
      } catch {}
      Alert.alert("Limit Reached", message);
    },
  });

  const currentScript = mode === "ai" ? scriptHistory[currentScriptIndex] || "" : manualScript;

  const createMutation = useMutation({
    mutationFn: async (options?: { forceAiVoice?: boolean }) => {
      const res = await apiRequest("POST", "/api/affirmations/create-with-voice", {
        title: goal.substring(0, 50) || "My Affirmation",
        script: currentScript,
        pillar: selectedPillar,
        categories: selectedSubcategories,
        isManual: mode === "manual",
        ...(options?.forceAiVoice ? { forceAiVoice: true } : {}),
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
    onError: (error: any) => {
      let errorType = "";
      try {
        const errorStr = error?.message || "";
        const jsonMatch = errorStr.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.error) errorType = parsed.error;
        }
        if (!errorType && errorStr.includes("QUOTA_EXCEEDED")) errorType = "QUOTA_EXCEEDED";
        if (!errorType && errorStr.includes("PERSONAL_VOICE_FAILED")) errorType = "PERSONAL_VOICE_FAILED";
      } catch {}

      if (errorType === "QUOTA_EXCEEDED") {
        Alert.alert(
          "Credits Used Up",
          "Your voice cloning credits have been used up for this period. Would you like to use an AI voice instead?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Use AI Voice", onPress: () => createMutation.mutate({ forceAiVoice: true }) },
          ]
        );
      } else if (errorType === "PERSONAL_VOICE_FAILED") {
        Alert.alert(
          "Inner Voice Failed",
          "Could not generate audio with your Inner Voice. Would you like to try again or use an AI voice instead?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Try Again", onPress: () => createMutation.mutate({}) },
            { text: "Use AI Voice", onPress: () => createMutation.mutate({ forceAiVoice: true }) },
          ]
        );
      } else {
        Alert.alert("Error", "Failed to create affirmation. Please try again.");
      }
    },
  });

  useEffect(() => {
    if (createMutation.isPending) {
      setShowCreatingOverlay(true);
      creatingPulse.value = 0;
      creatingPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      setShowCreatingOverlay(false);
    }
  }, [createMutation.isPending]);

  const handleGenerate = () => {
    if (userLimits?.aiAffirmations?.remaining === 0) {
      Alert.alert("Monthly Limit Reached", "You've used all your AI-generated affirmations for this month.");
      return;
    }
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
    createMutation.mutate({});
  };

  const selectedPillarData = selectedPillar ? PILLARS[selectedPillar] : null;
  const accentColor = selectedPillarData?.color || theme.primary;

  const scriptCardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scriptScale.value }],
    opacity: scriptOpacity.value,
  }));

  const scriptGlowStyle = useAnimatedStyle(() => ({
    shadowColor: "#E5C95C",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: interpolate(scriptGlow.value, [0, 1], [0, 16]),
    shadowOpacity: interpolate(scriptGlow.value, [0, 1], [0, 0.7]),
    elevation: interpolate(scriptGlow.value, [0, 1], [0, 10]),
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shimmerX.value, [-1, 1], [-200, 400]) },
    ],
    opacity: interpolate(
      shimmerX.value,
      [-1, -0.5, 0, 0.5, 1],
      [0, 0.5, 0.7, 0.5, 0]
    ),
  }));

  const createButtonAnimStyle = useAnimatedStyle(() => ({
    opacity: createButtonOpacity.value,
    transform: [{ translateY: createButtonTranslateY.value }],
  }));

  const creatingPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(creatingPulse.value, [0, 1], [0.3, 1]),
    transform: [{ scale: interpolate(creatingPulse.value, [0, 1], [0.8, 1.2]) }],
  }));

  const renderStepSummary = (
    stepNumber: number,
    label: string,
    value: string,
    dotColor?: string,
  ) => (
    <Pressable
      onPress={() => handleEditStep(stepNumber)}
      style={[
        styles.summaryRow,
        {
          backgroundColor: theme.cardBackground,
          borderBottomColor: `${accentColor}30`,
          borderBottomWidth: 1,
        },
      ]}
    >
      <View style={styles.summaryLeft}>
        {dotColor ? (
          <View style={[styles.summaryDot, { backgroundColor: dotColor }]} />
        ) : null}
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.summaryRight}>
        <ThemedText type="small" style={{ fontWeight: "600" }} numberOfLines={1}>
          {value}
        </ThemedText>
        <Feather name="edit-2" size={14} color={theme.textSecondary} style={{ marginLeft: Spacing.sm }} />
      </View>
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        ref={scrollViewRef}
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

        {mode === "ai" && userLimits?.aiAffirmations ? (
          <View style={[styles.limitsRow, { backgroundColor: theme.cardBackground }]}>
            <Feather
              name={userLimits.aiAffirmations.remaining === 0 ? "alert-circle" : "zap"}
              size={14}
              color={
                userLimits.aiAffirmations.remaining === 0
                  ? theme.error
                  : userLimits.aiAffirmations.remaining <= 5
                    ? theme.warning
                    : theme.textSecondary
              }
            />
            <ThemedText
              type="caption"
              style={{
                color:
                  userLimits.aiAffirmations.remaining === 0
                    ? theme.error
                    : userLimits.aiAffirmations.remaining <= 5
                      ? theme.warning
                      : theme.textSecondary,
                marginLeft: Spacing.xs,
              }}
            >
              {userLimits.aiAffirmations.remaining === 0
                ? "Limit reached"
                : `${userLimits.aiAffirmations.remaining} of ${userLimits.aiAffirmations.limit} remaining this month`}
            </ThemedText>
          </View>
        ) : null}

        {currentStep === 1 ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepAccent, { backgroundColor: accentColor }]} />
              <View style={styles.stepHeaderContent}>
                <View style={styles.stepTitleRow}>
                  <ThemedText type="h3" style={styles.stepTitle}>
                    Focus
                  </ThemedText>
                  <Pressable
                    onPress={() => setShowPillarHelp(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    testID="button-pillar-help"
                  >
                    <Feather name="help-circle" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Select the area of life you want to focus on
                </ThemedText>
              </View>
            </View>

            {showPillarTip ? (
              <Animated.View entering={FadeIn.duration(300)} style={[styles.pillarTipContainer, { backgroundColor: theme.cardBackground }]}>
                <View style={[styles.pillarTipAccent, { backgroundColor: '#E5C95C' }]} />
                <View style={styles.pillarTipContent}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Choose a pillar to focus your affirmation on a specific area of life
                  </ThemedText>
                </View>
                <Pressable
                  onPress={dismissPillarTip}
                  style={styles.pillarTipDismiss}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  testID="button-dismiss-pillar-tip"
                >
                  <Feather name="x" size={14} color={theme.textSecondary} />
                </Pressable>
              </Animated.View>
            ) : null}

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
          </Animated.View>
        ) : selectedPillarData ? (
          <Animated.View entering={FadeIn.duration(200)}>
            {renderStepSummary(1, "Focus", selectedPillar!, selectedPillarData.color)}
          </Animated.View>
        ) : null}

        <View ref={step2Ref} collapsable={false}>
          {currentStep >= 2 && selectedPillarData && selectedPillar && mode === "ai" ? (
            currentStep === 2 ? (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepAccent, { backgroundColor: accentColor }]} />
                  <View>
                    <ThemedText type="h3" style={styles.stepTitle}>Tags</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {selectedSubcategories.length}/{MAX_SUBCATEGORIES} selected (optional)
                    </ThemedText>
                  </View>
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
                <Button
                  variant="primary"
                  onPress={handleContinueToStep3}
                  style={styles.continueButton}
                  testID="button-continue-tags"
                >
                  Continue
                </Button>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(200)}>
                {renderStepSummary(
                  2,
                  "Tags",
                  selectedSubcategories.length > 0 ? selectedSubcategories.join(", ") : "None selected",
                )}
              </Animated.View>
            )
          ) : null}
        </View>

        <View ref={step3Ref} collapsable={false}>
          {currentStep >= 3 && selectedPillar ? (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepAccent, { backgroundColor: accentColor }]} />
                <ThemedText type="h3" style={styles.stepTitle}>
                  {mode === "ai" ? "What do you want to achieve?" : "Write your affirmation"}
                </ThemedText>
              </View>

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
                      ? getDynamicPlaceholder(selectedPillar, selectedSubcategories)
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
                  style={[styles.generateButton, !selectedPillar ? { opacity: 0.5 } : undefined]}
                  testID="button-generate"
                >
                  Generate Script
                </Button>
              ) : null}

              {scriptHistory.length > 0 && mode === "ai" ? (
                <View ref={scriptCardRef} collapsable={false}>
                  <Animated.View style={[scriptGlowStyle, { borderRadius: BorderRadius.lg }]}>
                    <Animated.View style={scriptCardAnimStyle}>
                      <Card style={styles.scriptCard}>
                        <Animated.View style={[styles.shimmerOverlay, shimmerStyle]} pointerEvents="none">
                          <LinearGradient
                            colors={[
                              "transparent",
                              "rgba(229, 201, 92, 0.15)",
                              "rgba(255, 215, 0, 0.3)",
                              "rgba(229, 201, 92, 0.15)",
                              "transparent",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.shimmerGradient}
                          />
                        </Animated.View>
                        <View style={styles.scriptHeader}>
                          <View style={styles.scriptTitleRow}>
                            <Feather name="file-text" size={16} color={accentColor} />
                            <ThemedText type="h4">Your Script</ThemedText>
                          </View>
                          {scriptHistory.length < 3 ? (
                            <Pressable onPress={handleRegenerate} disabled={generateMutation.isPending} style={styles.regenerateButton}>
                              <Feather 
                                name="refresh-cw" 
                                size={16} 
                                color={generateMutation.isPending ? theme.textSecondary : theme.primary} 
                              />
                              <ThemedText type="caption" style={{ color: generateMutation.isPending ? theme.textSecondary : theme.primary, marginLeft: 4 }}>
                                Try another
                              </ThemedText>
                            </Pressable>
                          ) : null}
                        </View>
                        <ScriptPager
                          pagerRef={pagerRef}
                          scripts={scriptHistory}
                          currentIndex={currentScriptIndex}
                          onPageSelected={setCurrentScriptIndex}
                          scriptLength={selectedLength.toLowerCase()}
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
                    </Animated.View>
                  </Animated.View>

                  {showCreateButton ? (
                    <Animated.View style={createButtonAnimStyle}>
                      <View style={styles.reviewPrompt}>
                        <Feather name="check-circle" size={14} color={accentColor} />
                        <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                          Read through your script, then bring it to life
                        </ThemedText>
                      </View>
                      <Button
                        variant="gradient"
                        onPress={handleCreate}
                        loading={createMutation.isPending}
                        disabled={!selectedPillar}
                        style={[styles.createButton, !selectedPillar ? { opacity: 0.5 } : undefined]}
                        testID="button-create"
                      >
                        Create Affirmation
                      </Button>
                    </Animated.View>
                  ) : null}
                </View>
              ) : null}

              {mode === "manual" && manualScript.trim() ? (
                <Button
                  variant="gradient"
                  onPress={handleCreate}
                  loading={createMutation.isPending}
                  disabled={!selectedPillar}
                  style={[styles.createButton, !selectedPillar ? { opacity: 0.5 } : undefined]}
                  testID="button-create"
                >
                  Create Affirmation
                </Button>
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={showPillarHelp}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPillarHelp(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPillarHelp(false)}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Life Pillars</ThemedText>
              <Pressable
                onPress={() => setShowPillarHelp(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="button-close-pillar-help"
              >
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
              Pillars represent the key areas of your life. Choose one to focus your affirmation on.
            </ThemedText>
            <ScrollView style={styles.pillarHelpList} showsVerticalScrollIndicator={false}>
              {PILLAR_LIST.map((pillarName) => {
                const pillar = PILLARS[pillarName];
                return (
                  <View key={pillarName} style={styles.pillarHelpRow}>
                    <View style={[styles.pillarHelpIcon, { backgroundColor: `${pillar.color}20` }]}>
                      <Feather name={pillar.icon as any} size={18} color={pillar.color} />
                    </View>
                    <View style={styles.pillarHelpText}>
                      <View style={styles.pillarHelpNameRow}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>{pillarName}</ThemedText>
                        <View style={[styles.pillarHelpDot, { backgroundColor: pillar.color }]} />
                      </View>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={2}>
                        {pillar.description}
                      </ThemedText>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <Button
              variant="primary"
              onPress={() => setShowPillarHelp(false)}
              style={{ marginTop: Spacing.lg }}
              testID="button-got-it"
            >
              Got it
            </Button>
          </Pressable>
        </Pressable>
      </Modal>

      {showCreatingOverlay ? (
        <Modal
          visible={showCreatingOverlay}
          transparent
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.creatingOverlayCard, { backgroundColor: theme.cardBackground }]}>
              <Animated.View style={[styles.creatingPulseDot, { backgroundColor: theme.primary }, creatingPulseStyle]} />
              <ThemedText type="h3" style={{ marginTop: Spacing.lg, textAlign: "center" }}>
                Creating your affirmation...
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                This may take a moment
              </ThemedText>
            </View>
          </View>
        </Modal>
      ) : null}
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
  stepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
  },
  stepAccent: {
    width: 4,
    borderRadius: 2,
    alignSelf: "stretch",
    minHeight: 20,
  },
  stepTitle: {
    marginBottom: 2,
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
  summaryRow: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  summaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  summaryRight: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    marginBottom: Spacing.sm,
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
    marginBottom: Spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  scriptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  scriptTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  regenerateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    pointerEvents: "none",
  },
  shimmerGradient: {
    height: "100%",
    width: 120,
  },
  reviewPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
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
  continueButton: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
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
    marginBottom: Spacing.sm,
  },
  limitsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    opacity: 0.85,
  },
  stepHeaderContent: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  pillarHelpList: {
    maxHeight: 320,
  },
  pillarHelpRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  pillarHelpIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  pillarHelpText: {
    flex: 1,
  },
  pillarHelpNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 2,
  },
  pillarHelpDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  creatingOverlayCard: {
    width: "80%",
    maxWidth: 300,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  creatingPulseDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  pillarTipContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  pillarTipAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  pillarTipContent: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  pillarTipDismiss: {
    padding: Spacing.sm,
    marginRight: Spacing.xs,
  },
});
