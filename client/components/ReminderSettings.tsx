import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Switch, Modal, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import DateTimePicker from "@react-native-community/datetimepicker";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface NotificationSettings {
  morningEnabled: boolean;
  morningTime: string;
  afternoonEnabled: boolean;
  afternoonTime: string;
  eveningEnabled: boolean;
  eveningTime: string;
}

type TimeSlot = "morning" | "afternoon" | "evening";

const SLOT_CONFIG: Record<TimeSlot, { icon: keyof typeof Feather.glyphMap; label: string; defaultTime: string }> = {
  morning: { icon: "sunrise", label: "Morning", defaultTime: "08:00" },
  afternoon: { icon: "sun", label: "Afternoon", defaultTime: "13:00" },
  evening: { icon: "moon", label: "Evening", defaultTime: "20:00" },
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

export default function ReminderSettings() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [tempTime, setTempTime] = useState(new Date());
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const { data: settings, isLoading } = useQuery<NotificationSettings>({
    queryKey: ["/api/notifications/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationSettings>) => {
      return apiRequest("PUT", "/api/notifications/settings", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      scheduleNotifications();
    },
  });

  useEffect(() => {
    checkPermission();
  }, []);

  useEffect(() => {
    if (settings) {
      scheduleNotifications();
    }
  }, [settings]);

  const checkPermission = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setHasPermission(status === "granted");
  };

  const requestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setHasPermission(status === "granted");
    return status === "granted";
  };

  const scheduleNotifications = async () => {
    if (!settings) return;
    
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    const slots: { enabled: boolean; time: string; slot: TimeSlot }[] = [
      { enabled: settings.morningEnabled, time: settings.morningTime, slot: "morning" },
      { enabled: settings.afternoonEnabled, time: settings.afternoonTime, slot: "afternoon" },
      { enabled: settings.eveningEnabled, time: settings.eveningTime, slot: "evening" },
    ];

    for (const { enabled, time, slot } of slots) {
      if (enabled && hasPermission) {
        const [hours, minutes] = time.split(":").map(Number);
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Time for Your Affirmations",
            body: getNotificationBody(slot),
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

  const getNotificationBody = (slot: TimeSlot): string => {
    switch (slot) {
      case "morning":
        return "Start your day with positive affirmations";
      case "afternoon":
        return "Take a moment to reinforce your positive mindset";
      case "evening":
        return "End your day with empowering thoughts";
    }
  };

  const handleToggle = async (slot: TimeSlot) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Request permission if not granted, but don't block saving settings
    if (!hasPermission) {
      requestPermission();
    }

    const key = `${slot}Enabled` as keyof NotificationSettings;
    const currentValue = settings?.[key] ?? false;
    updateMutation.mutate({ [key]: !currentValue });
  };

  const handleTimePress = (slot: TimeSlot) => {
    const timeKey = `${slot}Time` as keyof NotificationSettings;
    const currentTime = settings?.[timeKey] as string ?? SLOT_CONFIG[slot].defaultTime;
    setTempTime(parseTime(currentTime));
    setEditingSlot(slot);
    setShowTimePicker(true);
  };

  const handleTimeChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    
    if (selectedDate) {
      setTempTime(selectedDate);
      
      if (Platform.OS === "android" && editingSlot) {
        saveTime(editingSlot, selectedDate);
      }
    }
  };

  const saveTime = (slot: TimeSlot, date: Date) => {
    const timeKey = `${slot}Time` as keyof NotificationSettings;
    const newTime = formatTimeFromDate(date);
    updateMutation.mutate({ [timeKey]: newTime });
  };

  const handleTimeSave = () => {
    if (editingSlot) {
      saveTime(editingSlot, tempTime);
    }
    setShowTimePicker(false);
    setEditingSlot(null);
  };

  const handleTimeCancel = () => {
    setShowTimePicker(false);
    setEditingSlot(null);
  };

  const renderSlot = (slot: TimeSlot) => {
    const config = SLOT_CONFIG[slot];
    const enabledKey = `${slot}Enabled` as keyof NotificationSettings;
    const timeKey = `${slot}Time` as keyof NotificationSettings;
    const isEnabled = settings?.[enabledKey] ?? false;
    const time = settings?.[timeKey] as string ?? config.defaultTime;

    return (
      <View
        key={slot}
        style={[
          styles.slotItem,
          slot !== "evening" && { borderBottomWidth: 1, borderBottomColor: theme.border },
        ]}
      >
        <View style={[styles.slotIcon, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name={config.icon} size={20} color={theme.primary} />
        </View>
        <View style={styles.slotContent}>
          <ThemedText type="body">{config.label}</ThemedText>
          <Pressable onPress={() => handleTimePress(slot)} testID={`button-time-${slot}`}>
            <ThemedText 
              type="small" 
              style={{ color: isEnabled ? theme.primary : theme.textSecondary }}
            >
              {formatTime(time)}
            </ThemedText>
          </Pressable>
        </View>
        <View style={[styles.switchWrapper, { borderColor: isEnabled ? theme.primary + "60" : theme.primary + "40" }]}>
          <Switch
            value={isEnabled as boolean}
            onValueChange={() => handleToggle(slot)}
            trackColor={{ false: theme.border, true: theme.primary + "80" }}
            thumbColor={isEnabled ? theme.primary : theme.textSecondary}
            testID={`switch-${slot}`}
          />
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.cardBackground }]}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Loading reminder settings...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.sectionCard, { backgroundColor: theme.cardBackground }, Shadows.small]}>
        {renderSlot("morning")}
        {renderSlot("afternoon")}
        {renderSlot("evening")}
      </View>

      {hasPermission === false ? (
        <Pressable
          onPress={requestPermission}
          style={[styles.permissionButton, { backgroundColor: theme.primary }]}
          testID="button-enable-notifications"
        >
          <Feather name="bell" size={16} color={theme.buttonText} />
          <ThemedText type="small" style={{ color: theme.buttonText, marginLeft: Spacing.sm }}>
            Enable Notifications
          </ThemedText>
        </Pressable>
      ) : null}

      {Platform.OS === "ios" && showTimePicker ? (
        <Modal
          visible={showTimePicker}
          transparent
          animationType="fade"
          onRequestClose={handleTimeCancel}
        >
          <Pressable style={styles.modalOverlay} onPress={handleTimeCancel}>
            <Pressable 
              style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Pressable onPress={handleTimeCancel} testID="button-time-cancel">
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
                </Pressable>
                <ThemedText type="h4">
                  Set {editingSlot ? SLOT_CONFIG[editingSlot].label : ""} Time
                </ThemedText>
                <Pressable onPress={handleTimeSave} testID="button-time-save">
                  <ThemedText type="body" style={{ color: theme.primary }}>Save</ThemedText>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                style={styles.picker}
                textColor={theme.text}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {Platform.OS === "android" && showTimePicker ? (
        <DateTimePicker
          value={tempTime}
          mode="time"
          is24Hour={false}
          onChange={handleTimeChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  loadingContainer: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  sectionCard: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  slotItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  slotIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  slotContent: {
    flex: 1,
    gap: 2,
  },
  switchWrapper: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 2,
  },
  permissionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 28, 63, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
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
  picker: {
    height: 200,
  },
});
