import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { FlatList, View, StyleSheet, RefreshControl, TextInput, Modal, Pressable, Alert, ImageBackground } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

const libraryBackgroundDark = require("../../assets/images/library-background.png");
const libraryBackgroundLight = require("../../assets/images/library-background-light.png");
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { SwipeableAffirmationCard } from "@/components/SwipeableAffirmationCard";
import { CategoryChip } from "@/components/CategoryChip";
import { LibraryTip } from "@/components/LibraryTip";
import { FloatingSettingsButton } from "@/components/FloatingSettingsButton";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useAudio } from "@/contexts/AudioContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Affirmation, Category } from "@shared/schema";

const DEFAULT_CATEGORIES = ["All", "Career", "Health", "Confidence", "Wealth", "Relationships", "Sleep"];

interface CustomCategory {
  id: number;
  userId: string;
  name: string;
  createdAt: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type HomeScreenRouteParams = {
  Home: { highlightAffirmationId?: number } | undefined;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<HomeScreenRouteParams, 'Home'>>();
  const { playAffirmation, currentAffirmation, isPlaying, togglePlayPause, breathingAffirmation, setBreathingAffirmation, highlightAffirmationId, clearHighlightAffirmation } = useAudio();
  
  const flatListRef = useRef<FlatList<Affirmation>>(null);
  const [highlightedAffirmationId, setHighlightedAffirmationId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [affirmationToRename, setAffirmationToRename] = useState<Affirmation | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [showSwipeTip, setShowSwipeTip] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("@settings/hapticEnabled").then((value) => {
      if (value !== null) {
        setHapticEnabled(value === "true");
      }
    });
    AsyncStorage.getItem("@tips/librarySwipe").then((value) => {
      if (value === null) {
        setShowSwipeTip(true);
      }
    });
  }, []);

  const dismissSwipeTip = useCallback(() => {
    setShowSwipeTip(false);
    AsyncStorage.setItem("@tips/librarySwipe", "seen");
  }, []);

  const { data: affirmations = [], refetch, isLoading } = useQuery<Affirmation[]>({
    queryKey: ["/api/affirmations"],
  });

  // Handle context-based highlight request for affirmation
  useEffect(() => {
    if (highlightAffirmationId && affirmations.length > 0) {
      // Reset filters so the affirmation is visible
      setSelectedCategory("All");
      setSearchQuery("");
      
      setHighlightedAffirmationId(highlightAffirmationId);
      
      // Find the index of the affirmation in the unfiltered list (since we reset to "All")
      const index = affirmations.findIndex(a => a.id === highlightAffirmationId);
      if (index !== -1 && flatListRef.current) {
        // Delay to ensure filters are applied and FlatList is re-rendered
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
        }, 500);
      }
      
      // Clear highlight after 3.5 seconds
      setTimeout(() => {
        setHighlightedAffirmationId(null);
        clearHighlightAffirmation();
      }, 3500);
    }
  }, [highlightAffirmationId, affirmations, clearHighlightAffirmation]);

  const suggestedAffirmation = useMemo(() => {
    if (affirmations.length === 0) return null;
    const hour = new Date().getHours();
    let targetCategory = "Confidence";
    if (hour >= 5 && hour < 12) targetCategory = "Confidence";
    else if (hour >= 12 && hour < 17) targetCategory = "Career";
    else if (hour >= 17 && hour < 21) targetCategory = "Health";
    else targetCategory = "Sleep";
    
    const categoryMatch = affirmations.find(a => a.categoryName === targetCategory);
    return categoryMatch || affirmations[0];
  }, [affirmations]);

  const handleQuickPlay = async () => {
    const affirmationToPlay = currentAffirmation || suggestedAffirmation;
    if (affirmationToPlay) {
      if (currentAffirmation?.id === affirmationToPlay.id) {
        await togglePlayPause();
      } else {
        await playAffirmation(affirmationToPlay);
      }
    }
  };

  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: customCategories = [] } = useQuery<CustomCategory[]>({
    queryKey: ["/api/custom-categories"],
  });

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories.map(c => c.name)];

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      await apiRequest("PATCH", `/api/affirmations/${id}/rename`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affirmations"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRenameModalVisible(false);
      setAffirmationToRename(null);
      setNewTitle("");
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to rename affirmation");
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Simple filtering by categoryName field
  const filteredAffirmations = affirmations.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || item.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAffirmationPress = (id: number) => {
    navigation.navigate("Player", { affirmationId: id });
  };

  const handlePlayPress = async (affirmation: Affirmation) => {
    if (currentAffirmation?.id === affirmation.id) {
      await togglePlayPause();
    } else {
      await playAffirmation(affirmation);
    }
  };

  const handleCreatePress = () => {
    navigation.navigate("Create");
  };

  const handleRenamePress = (affirmation: Affirmation) => {
    setAffirmationToRename(affirmation);
    setNewTitle(affirmation.title);
    setRenameModalVisible(true);
  };

  const handleRenameSave = () => {
    if (affirmationToRename && newTitle.trim()) {
      renameMutation.mutate({ id: affirmationToRename.id, title: newTitle.trim() });
    }
  };

  const handleRenameCancel = () => {
    setRenameModalVisible(false);
    setAffirmationToRename(null);
    setNewTitle("");
  };

  const handleSettingsPress = () => {
    navigation.navigate("Main", { screen: "SettingsTab" } as any);
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      {/* Search bar with settings button */}
      <View style={styles.searchRow}>
        <Pressable
          onPress={handleSettingsPress}
          style={[styles.headerSettingsButton, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}
          testID="button-header-settings"
        >
          <Feather name="settings" size={20} color={theme.gold} />
        </Pressable>
        <View style={[styles.searchContainer, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
          <Feather name="search" size={18} color={theme.placeholder} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search affirmations..."
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="input-search"
          />
        </View>
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={allCategories}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.categoriesContainer}
        renderItem={({ item }) => (
          <CategoryChip
            label={item}
            isSelected={selectedCategory === item}
            onPress={() => setSelectedCategory(item)}
            testID={`chip-category-${item.toLowerCase()}`}
          />
        )}
      />
      {filteredAffirmations.length > 0 && (
        <LibraryTip visible={showSwipeTip} onDismiss={dismissSwipeTip} />
      )}
    </View>
  );

  const renderEmpty = () => (
    <EmptyState
      title="No Affirmations Yet"
      description="Create your first personalized affirmation to start rewiring your subconscious mind."
      actionLabel="Create Affirmation"
      onAction={handleCreatePress}
    />
  );

  const handleSetForBreathing = useCallback((affirmation: Affirmation) => {
    setBreathingAffirmation(affirmation);
  }, [setBreathingAffirmation]);

  const handleAfterDelete = useCallback((deletedAffirmation: Affirmation) => {
    // If the deleted affirmation was the breathing affirmation, fall back to the next available
    if (breathingAffirmation?.id === deletedAffirmation.id) {
      const remaining = affirmations.filter(a => a.id !== deletedAffirmation.id);
      if (remaining.length > 0) {
        setBreathingAffirmation(remaining[0]);
      } else {
        setBreathingAffirmation(null);
      }
    }
  }, [breathingAffirmation, affirmations, setBreathingAffirmation]);

  const renderItem = ({ item, index }: { item: Affirmation; index: number }) => {
    const isCurrentlyPlaying = currentAffirmation?.id === item.id && isPlaying;
    const isBreathingSelected = breathingAffirmation?.id === item.id;
    const isHighlighted = highlightedAffirmationId === item.id;
    return (
      <Animated.View entering={FadeInUp.delay(index * 50).duration(300).springify()}>
        <View style={isHighlighted ? [styles.highlightedCard, { shadowColor: theme.gold }] : undefined}>
          <SwipeableAffirmationCard
            affirmation={item}
            onPress={() => handleAffirmationPress(item.id)}
            onPlayPress={() => handlePlayPress(item)}
            onRename={handleRenamePress}
            onSetForBreathing={handleSetForBreathing}
            onAfterDelete={handleAfterDelete}
            isActive={isCurrentlyPlaying}
            isBreathingAffirmation={isBreathingSelected}
            testID={`card-affirmation-${item.id}`}
            hapticEnabled={hapticEnabled}
          />
        </View>
      </Animated.View>
    );
  };

  const edgeFadeColors = isDark 
    ? ["rgba(15, 28, 63, 0.95)", "rgba(15, 28, 63, 0)"] as const
    : ["rgba(255, 255, 255, 0.95)", "rgba(255, 255, 255, 0)"] as const;

  return (
    <ImageBackground
      key={isDark ? "dark-bg" : "light-bg"}
      source={isDark ? libraryBackgroundDark : libraryBackgroundLight}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <FlatList
        ref={flatListRef}
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: tabBarHeight + 80 + Spacing.xl,
          },
          filteredAffirmations.length === 0 && styles.emptyContainer,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={filteredAffirmations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        onScrollToIndexFailed={(info) => {
          // Handle scroll failure gracefully
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 100);
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      />

      {/* Top edge fade gradient */}
      <LinearGradient
        colors={edgeFadeColors}
        style={[styles.edgeFade, styles.topFade, { height: insets.top + 10 }]}
        pointerEvents="none"
      />

      {/* Bottom edge fade gradient */}
      <LinearGradient
        colors={[...edgeFadeColors].reverse() as unknown as readonly [string, string, ...string[]]}
        style={[styles.edgeFade, styles.bottomFade, { height: tabBarHeight + 40 }]}
        pointerEvents="none"
      />

      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleRenameCancel}
      >
        <Pressable style={styles.modalOverlay} onPress={handleRenameCancel}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.cardBackground }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText type="h3" style={styles.modalTitle}>
              Rename Affirmation
            </ThemedText>
            <TextInput
              style={[styles.renameInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter new title"
              placeholderTextColor={theme.placeholder}
              autoFocus
              selectTextOnFocus
              testID="input-rename-title"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton, { borderColor: theme.border }]}
                onPress={handleRenameCancel}
                testID="button-rename-cancel"
              >
                <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleRenameSave}
                disabled={!newTitle.trim() || renameMutation.isPending}
                testID="button-rename-save"
              >
                <ThemedText style={{ color: "#fff", fontWeight: "600" }}>
                  {renameMutation.isPending ? "Saving..." : "Save"}
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating Settings Button */}
      <FloatingSettingsButton bottomOffset={tabBarHeight + 16} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  highlightedCard: {
    borderWidth: 2,
    borderColor: '#C9A227',
    borderRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 12,
  },
  edgeFade: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  topFade: {
    top: 0,
  },
  bottomFade: {
    bottom: 0,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  headerContent: {
    marginBottom: Spacing.lg,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headerSettingsButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
  },
  categoriesContainer: {
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  separator: {
    height: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    shadowColor: "#0F1C3F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(201, 162, 39, 0.3)",
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
});
