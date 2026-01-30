import React, { useState, useCallback } from "react";
import { FlatList, View, StyleSheet, RefreshControl, TextInput, Modal, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { SwipeableAffirmationCard } from "@/components/SwipeableAffirmationCard";
import { CategoryChip } from "@/components/CategoryChip";
import { useTheme } from "@/hooks/useTheme";
import { useAudio } from "@/contexts/AudioContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Affirmation, Category } from "@shared/schema";

const CATEGORIES = ["All", "Career", "Health", "Confidence", "Wealth", "Relationships", "Sleep"];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { playAffirmation, currentAffirmation, isPlaying, togglePlayPause } = useAudio();

  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [affirmationToRename, setAffirmationToRename] = useState<Affirmation | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const { data: affirmations = [], refetch, isLoading } = useQuery<Affirmation[]>({
    queryKey: ["/api/affirmations"],
  });

  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

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

  // Create a map of category ID to name for filtering
  const categoryMap = React.useMemo(() => {
    const map: Record<number, string> = {};
    categoriesData.forEach((cat) => {
      map[cat.id] = cat.name;
    });
    return map;
  }, [categoriesData]);

  const filteredAffirmations = affirmations.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const itemCategoryName = item.categoryId ? categoryMap[item.categoryId] : null;
    const matchesCategory = selectedCategory === "All" || itemCategoryName === selectedCategory;
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

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={[styles.searchContainer, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
        <Feather name="search" size={20} color={theme.placeholder} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search affirmations..."
          placeholderTextColor={theme.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="input-search"
        />
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
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
    </View>
  );

  const renderEmpty = () => (
    <EmptyState
      image={require("../../assets/images/empty-library.png")}
      title="No Affirmations Yet"
      description="Create your first personalized affirmation to start rewiring your subconscious mind."
      actionLabel="Create Affirmation"
      onAction={handleCreatePress}
    />
  );

  const renderItem = ({ item }: { item: Affirmation }) => {
    const isCurrentlyPlaying = currentAffirmation?.id === item.id && isPlaying;
    return (
      <SwipeableAffirmationCard
        affirmation={item}
        onPress={() => handleAffirmationPress(item.id)}
        onPlayPress={() => handlePlayPress(item)}
        onRename={handleRenamePress}
        isActive={isCurrentlyPlaying}
        testID={`card-affirmation-${item.id}`}
      />
    );
  };

  return (
    <>
      <FlatList
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          filteredAffirmations.length === 0 && styles.emptyContainer,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={filteredAffirmations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      />

      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleRenameCancel}
      >
        <Pressable style={styles.modalOverlay} onPress={handleRenameCancel}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.card }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText type="title" style={styles.modalTitle}>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: 48,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.lg,
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
