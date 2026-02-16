import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  const { isAuthenticated } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !registered.current) {
      registerForPushNotifications();
    }
  }, [isAuthenticated]);

  async function registerForPushNotifications() {
    try {
      if (Platform.OS === "web") {
        return;
      }

      if (!Device.isDevice) {
        console.log("[Push] Must use physical device for push notifications");
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("[Push] Push notification permission not granted");
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: undefined,
      });

      const token = tokenData.data;
      const platform = Platform.OS;

      await apiRequest("POST", "/api/push-token", { token, platform });
      registered.current = true;
      console.log("[Push] Token registered successfully");
    } catch (error) {
      console.error("[Push] Registration failed:", error);
    }
  }
}
