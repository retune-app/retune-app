import React, { useState, useCallback } from "react";
import { FlatList, View, StyleSheet, RefreshControl, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { SwipeableAffirmationCard } from "@/components/SwipeableAffirmationCard";
import { CategoryChip } from "@/components/CategoryChip";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
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

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: affirmations = [], refetch, isLoading } = useQuery<Affirmation[]>({
    queryKey: ["/api/affirmations"],
  });

  const { data: categoriesData = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
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

  const handlePlayPress = (id: number) => {
    navigation.navigate("Player", { affirmationId: id });
  };

  const handleCreatePress = () => {
    navigation.navigate("Create");
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

  const renderItem = ({ item }: { item: Affirmation }) => (
    <SwipeableAffirmationCard
      affirmation={item}
      onPress={() => handleAffirmationPress(item.id)}
      onPlayPress={() => handlePlayPress(item.id)}
      testID={`card-affirmation-${item.id}`}
    />
  );

  return (
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
});
