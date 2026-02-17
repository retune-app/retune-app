import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  Layout,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const ACCENT_GOLD = "#C9A227";
const MAX_REMINDERS = 5;

interface Reminder {
  id: number;
  activityType: "breathe" | "believe";
  time: string;
  enabled: boolean;
  notificationMessage: string | null;
  createdAt: string;
}

const ACTIVITY_CONFIG = {
  breathe: {
    icon: "wind" as const,
    label: "Breathe",
    subtitle: "Meditation & breathing",
    color: "#4ECDC4",
    bgColor: "#4ECDC420",
  },
  believe: {
    icon: "heart" as const,
    label: "Believe",
    subtitle: "Listen to affirmations",
    color: "#E5C95C",
    bgColor: "#E5C95C20",
  },
};

function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function parseTime(time24: string): Date {
  const [hours, minutes] = time24.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTimeFromDate(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function RemindersScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<"breathe" | "believe">("breathe");
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [editTempTime, setEditTempTime] = useState(new Date());
  const [isCreating, setIsCreating] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
    queryKey: ["/api/reminders"],
  });

  React.useEffect(() => {
    checkPermission();
  }, []);

  React.useEffect(() => {
    if (reminders.length > 0) {
      scheduleAllNotifications(reminders);
    }
  }, [reminders]);

  const checkPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setHasPermission(status === "granted");
  };

  const requestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setHasPermission(status === "granted");
    return status === "granted";
  };

  const scheduleAllNotifications = async (reminderList: Reminder[]) => {
    if (!hasPermission) return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const reminder of reminderList) {
      if (reminder.enabled) {
        const [hours, minutes] = reminder.time.split(":").map(Number);
        const config = ACTIVITY_CONFIG[reminder.activityType];
        const title = reminder.activityType === "breathe"
          ? "Time to Breathe"
          : "Time for Affirmations";
        const body = reminder.notificationMessage ||
          (reminder.activityType === "breathe"
            ? "A few mindful breaths can shift your entire day"
            : "Your affirmations are ready when you are");

        await Notifications.scheduleNotificationAsync({
          identifier: `reminder-${reminder.id}`,
          content: {
            title,
            body,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: hours,
            minute: minutes,
          },
        });
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: { activityType: string; time: string }) => {
      return apiRequest("POST", "/api/reminders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setShowAddModal(false);
      setIsCreating(false);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    },
    onError: () => {
      setIsCreating(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      return apiRequest("PUT", `/api/reminders/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
    },
  });

  const updateTimeMutation = useMutation({
    mutationFn: async ({ id, time }: { id: number; time: string }) => {
      return apiRequest("PUT", `/api/reminders/${id}`, { time });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/reminders/${id}/regenerate-message`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    },
  });

  const handleAddReminder = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    setIsCreating(true);
    const time = formatTimeFromDate(selectedTime);
    createMutation.mutate({ activityType: selectedActivity, time });
  };

  const handleToggle = (reminder: Reminder) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}

    if (!hasPermission && !reminder.enabled) {
      requestPermission();
    }

    toggleMutation.mutate({ id: reminder.id, enabled: !reminder.enabled });
  };

  const handleTimePress = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setEditTempTime(parseTime(reminder.time));
    setShowEditTimePicker(true);
  };

  const handleEditTimeChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowEditTimePicker(false);
    }

    if (selectedDate) {
      setEditTempTime(selectedDate);

      if (Platform.OS === "android" && editingReminder) {
        const newTime = formatTimeFromDate(selectedDate);
        updateTimeMutation.mutate({ id: editingReminder.id, time: newTime });
        setEditingReminder(null);
      }
    }
  };

  const handleEditTimeSave = () => {
    if (editingReminder) {
      const newTime = formatTimeFromDate(editTempTime);
      updateTimeMutation.mutate({ id: editingReminder.id, time: newTime });
    }
    setShowEditTimePicker(false);
    setEditingReminder(null);
  };

  const handleEditTimeCancel = () => {
    setShowEditTimePicker(false);
    setEditingReminder(null);
  };

  const handleDelete = (id: number) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm !== null) {
      deleteMutation.mutate(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  const handleAddTimeChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      setSelectedTime(selectedDate);
    }
  };

  const renderReminderCard = (reminder: Reminder, index: number) => {
    const config = ACTIVITY_CONFIG[reminder.activityType];

    return (
      <Animated.View
        key={reminder.id}
        entering={SlideInRight.delay(index * 80).springify()}
        layout={Layout.springify()}
      >
        <View style={[styles.reminderCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
          <View style={styles.reminderTopRow}>
            <View style={[styles.activityBadge, { backgroundColor: config.bgColor }]}>
              <Feather name={config.icon} size={18} color={config.color} />
              <ThemedText type="small" style={[styles.activityLabel, { color: config.color }]}>
                {config.label}
              </ThemedText>
            </View>

            <View style={styles.reminderActions}>
              <Pressable
                onPress={() => handleTimePress(reminder)}
                style={[styles.timeButton, { borderColor: theme.border }]}
                testID={`button-edit-time-${reminder.id}`}
              >
                <Feather name="clock" size={14} color={reminder.enabled ? ACCENT_GOLD : theme.textSecondary} />
                <ThemedText
                  type="body"
                  style={[styles.timeText, { color: reminder.enabled ? theme.text : theme.textSecondary }]}
                >
                  {formatTime(reminder.time)}
                </ThemedText>
              </Pressable>

              <View style={[styles.switchWrapper, { borderColor: reminder.enabled ? ACCENT_GOLD + "60" : theme.border }]}>
                <Switch
                  value={reminder.enabled}
                  onValueChange={() => handleToggle(reminder)}
                  trackColor={{ false: theme.border, true: ACCENT_GOLD + "80" }}
                  thumbColor={reminder.enabled ? ACCENT_GOLD : theme.textSecondary}
                  testID={`switch-reminder-${reminder.id}`}
                />
              </View>
            </View>
          </View>

          {reminder.notificationMessage ? (
            <Pressable
              onPress={() => regenerateMutation.mutate(reminder.id)}
              style={styles.messageContainer}
              testID={`button-regenerate-${reminder.id}`}
            >
              <View style={styles.messageContent}>
                <Feather
                  name="message-circle"
                  size={14}
                  color={theme.textSecondary}
                  style={styles.messageIcon}
                />
                <ThemedText
                  type="small"
                  style={[styles.messageText, { color: theme.textSecondary }]}
                  numberOfLines={2}
                >
                  {regenerateMutation.isPending ? "Generating..." : `"${reminder.notificationMessage}"`}
                </ThemedText>
              </View>
              <Feather name="refresh-cw" size={12} color={theme.textSecondary} style={{ opacity: 0.5 }} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => handleDelete(reminder.id)}
            style={styles.deleteButton}
            testID={`button-delete-${reminder.id}`}
          >
            <Feather name="trash-2" size={14} color={theme.textSecondary} style={{ opacity: 0.4 }} />
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: headerHeight + Spacing.xl }]}>
        <ActivityIndicator size="small" color={ACCENT_GOLD} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xxl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <ThemedText type="small" style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Set daily reminders to build your mindfulness habit. Each notification includes a personalized AI message to inspire you.
          </ThemedText>
        </View>

        {hasPermission === false ? (
          <Pressable
            onPress={requestPermission}
            style={[styles.permissionBanner, { backgroundColor: ACCENT_GOLD + "15", borderColor: ACCENT_GOLD + "30" }]}
            testID="button-enable-notifications"
          >
            <View style={[styles.permissionIcon, { backgroundColor: ACCENT_GOLD + "20" }]}>
              <Feather name="bell-off" size={20} color={ACCENT_GOLD} />
            </View>
            <View style={styles.permissionContent}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                Enable Notifications
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Tap to allow Retuned to send reminders
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={ACCENT_GOLD} />
          </Pressable>
        ) : null}

        {reminders.length > 0 ? (
          <View style={styles.remindersList}>
            {reminders.map((reminder, index) => renderReminderCard(reminder, index))}
          </View>
        ) : (
          <Animated.View entering={FadeIn.delay(200)} style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.cardBackground }]}>
              <Feather name="bell" size={32} color={theme.textSecondary} />
            </View>
            <ThemedText type="body" style={[styles.emptyTitle, { color: theme.textSecondary }]}>
              No reminders yet
            </ThemedText>
            <ThemedText type="small" style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Add a reminder to build your daily practice
            </ThemedText>
          </Animated.View>
        )}

        {reminders.length < MAX_REMINDERS ? (
          <Pressable
            onPress={() => {
              setSelectedTime(new Date());
              setSelectedActivity("breathe");
              setShowAddModal(true);
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
            }}
            style={[styles.addButton, { borderColor: ACCENT_GOLD + "40" }]}
            testID="button-add-reminder"
          >
            <View style={[styles.addButtonIcon, { backgroundColor: ACCENT_GOLD + "15" }]}>
              <Feather name="plus" size={20} color={ACCENT_GOLD} />
            </View>
            <ThemedText type="body" style={[styles.addButtonText, { color: ACCENT_GOLD }]}>
              Add Reminder
            </ThemedText>
            <ThemedText type="small" style={[styles.addButtonCount, { color: theme.textSecondary }]}>
              {reminders.length}/{MAX_REMINDERS}
            </ThemedText>
          </Pressable>
        ) : (
          <View style={[styles.limitReached, { backgroundColor: theme.cardBackground }]}>
            <Feather name="info" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={[styles.limitText, { color: theme.textSecondary }]}>
              Maximum of {MAX_REMINDERS} reminders reached
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Pressable onPress={() => setShowAddModal(false)} testID="button-cancel-add">
                <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
              </Pressable>
              <ThemedText type="h4">New Reminder</ThemedText>
              <View style={{ width: 50 }} />
            </View>

            <View style={styles.modalBody}>
              <ThemedText type="caption" style={[styles.modalLabel, { color: theme.textSecondary }]}>
                REMIND ME TO
              </ThemedText>
              <View style={styles.activityPicker}>
                {(["breathe", "believe"] as const).map((type) => {
                  const config = ACTIVITY_CONFIG[type];
                  const isSelected = selectedActivity === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => {
                        setSelectedActivity(type);
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                      }}
                      style={[
                        styles.activityOption,
                        {
                          backgroundColor: isSelected ? config.bgColor : theme.backgroundSecondary,
                          borderColor: isSelected ? config.color + "60" : "transparent",
                          borderWidth: 1.5,
                        },
                      ]}
                      testID={`button-activity-${type}`}
                    >
                      <View style={[styles.activityOptionIcon, { backgroundColor: isSelected ? config.color + "20" : theme.border + "40" }]}>
                        <Feather
                          name={config.icon}
                          size={24}
                          color={isSelected ? config.color : theme.textSecondary}
                        />
                      </View>
                      <ThemedText
                        type="body"
                        style={[
                          styles.activityOptionLabel,
                          { color: isSelected ? config.color : theme.text, fontWeight: isSelected ? "700" : "400" },
                        ]}
                      >
                        {config.label}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: isSelected ? config.color + "99" : theme.textSecondary, textAlign: "center" }}
                      >
                        {config.subtitle}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedText type="caption" style={[styles.modalLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
                AT THIS TIME
              </ThemedText>

              {Platform.OS === "ios" ? (
                <View style={[styles.timePickerContainer, { backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md }]}>
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    display="spinner"
                    onChange={handleAddTimeChange}
                    style={styles.inlinePicker}
                    textColor={theme.text}
                  />
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowTimePicker(true)}
                  style={[styles.androidTimeButton, { backgroundColor: theme.backgroundSecondary }]}
                  testID="button-select-time"
                >
                  <Feather name="clock" size={20} color={ACCENT_GOLD} />
                  <ThemedText type="h3" style={{ color: theme.text }}>
                    {formatTime(formatTimeFromDate(selectedTime))}
                  </ThemedText>
                </Pressable>
              )}

              <Pressable
                onPress={handleAddReminder}
                style={[
                  styles.createButton,
                  { backgroundColor: ACCENT_GOLD, opacity: isCreating ? 0.7 : 1 },
                ]}
                disabled={isCreating}
                testID="button-create-reminder"
              >
                {isCreating ? (
                  <View style={styles.creatingRow}>
                    <ActivityIndicator size="small" color="#0F1C3F" />
                    <ThemedText type="body" style={[styles.createButtonText, { color: "#0F1C3F" }]}>
                      Creating...
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText type="body" style={[styles.createButtonText, { color: "#0F1C3F" }]}>
                    Create Reminder
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {Platform.OS === "android" && showTimePicker ? (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          is24Hour={false}
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (date) setSelectedTime(date);
          }}
        />
      ) : null}

      {Platform.OS === "ios" && showEditTimePicker ? (
        <Modal
          visible={showEditTimePicker}
          transparent
          animationType="fade"
          onRequestClose={handleEditTimeCancel}
        >
          <Pressable style={styles.modalOverlay} onPress={handleEditTimeCancel}>
            <Pressable
              style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Pressable onPress={handleEditTimeCancel} testID="button-edit-time-cancel">
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
                </Pressable>
                <ThemedText type="h4">Edit Time</ThemedText>
                <Pressable onPress={handleEditTimeSave} testID="button-edit-time-save">
                  <ThemedText type="body" style={{ color: ACCENT_GOLD }}>Save</ThemedText>
                </Pressable>
              </View>
              <DateTimePicker
                value={editTempTime}
                mode="time"
                display="spinner"
                onChange={handleEditTimeChange}
                style={styles.editPicker}
                textColor={theme.text}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {Platform.OS === "android" && showEditTimePicker ? (
        <DateTimePicker
          value={editTempTime}
          mode="time"
          is24Hour={false}
          onChange={handleEditTimeChange}
        />
      ) : null}

      <Modal
        visible={showDeleteConfirm !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteConfirm(null)}>
          <Pressable
            style={[styles.deleteModalContent, { backgroundColor: theme.cardBackground }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.deleteModalIcon, { backgroundColor: "#FF6B6B20" }]}>
              <Feather name="trash-2" size={24} color="#FF6B6B" />
            </View>
            <ThemedText type="body" style={styles.deleteModalTitle}>
              Delete Reminder?
            </ThemedText>
            <ThemedText type="small" style={[styles.deleteModalSubtitle, { color: theme.textSecondary }]}>
              This will remove the reminder and its notification
            </ThemedText>
            <View style={styles.deleteModalActions}>
              <Pressable
                onPress={() => setShowDeleteConfirm(null)}
                style={[styles.deleteModalButton, { backgroundColor: theme.backgroundSecondary }]}
                testID="button-cancel-delete"
              >
                <ThemedText type="body">Keep</ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                style={[styles.deleteModalButton, { backgroundColor: "#FF6B6B" }]}
                testID="button-confirm-delete"
              >
                <ThemedText type="body" style={{ color: "#FFFFFF" }}>Delete</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerSection: {
    marginBottom: Spacing.lg,
  },
  headerSubtitle: {
    lineHeight: 20,
  },
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  permissionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  permissionContent: {
    flex: 1,
    gap: 2,
  },
  remindersList: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  reminderCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  reminderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  activityLabel: {
    fontWeight: "600",
  },
  reminderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  timeText: {
    fontWeight: "600",
    fontSize: 14,
  },
  switchWrapper: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 2,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  messageContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  messageIcon: {
    marginTop: 2,
  },
  messageText: {
    flex: 1,
    fontStyle: "italic",
    lineHeight: 18,
  },
  deleteButton: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.lg,
    padding: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xxl * 2,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    textAlign: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  addButtonText: {
    flex: 1,
    fontWeight: "600",
  },
  addButtonCount: {
    fontSize: 12,
  },
  limitReached: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  limitText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 28, 63, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalLabel: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
    letterSpacing: 1,
  },
  activityPicker: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  activityOption: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  activityOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  activityOptionLabel: {
    fontSize: 16,
  },
  timePickerContainer: {
    overflow: "hidden",
  },
  inlinePicker: {
    height: 150,
  },
  androidTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  createButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  creatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  createButtonText: {
    fontWeight: "700",
    fontSize: 16,
  },
  editPicker: {
    height: 200,
  },
  deleteModalContent: {
    width: "80%",
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  deleteModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  deleteModalTitle: {
    fontWeight: "700",
    fontSize: 18,
    marginBottom: Spacing.xs,
  },
  deleteModalSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  deleteModalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  deleteModalButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
});
